import { randomUUID } from "node:crypto";

import { Server, Socket } from "socket.io";
import { z } from "zod";

import { createRateLimiter } from "./rate-limit.js";
import { broadcastRoomState } from "./room-broadcast.js";
import { getRoom } from "./rooms.js";
import { canWriteChat } from "./socket-guards.js";
import { getSocketState, requireRoomId, resolveActorLabel } from "./socket-state.js";

const chatMessageSchema = z.object({
  text: z.string().trim().min(1).max(1000),
});

const chatRateLimiter = createRateLimiter({ max: 8, windowMs: 2000 });

export function registerChatHandlers(io: Server, socket: Socket): void {
  socket.on("chatMessage", (rawPayload: unknown) => {
    const roomId = requireRoomId(socket);
    if (!roomId) {
      return;
    }

    const parsed = chatMessageSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("roomError", { code: "VALIDATION_ERROR", message: "chatMessage inválido" });
      return;
    }

    const state = getSocketState(socket);
    const role = state.role;
    if (!role || !canWriteChat(role)) {
      socket.emit("roomError", {
        code: "FORBIDDEN",
        message: "No tienes permiso para escribir en chat",
      });
      return;
    }

    const rateKey = `${socket.id}:chatMessage`;
    if (!chatRateLimiter(rateKey)) {
      socket.emit("roomError", {
        code: "RATE_LIMITED",
        message: "Demasiados mensajes en poco tiempo",
      });
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      socket.emit("roomError", { code: "ROOM_NOT_FOUND", message: "Sala no encontrada" });
      return;
    }

    room.chatLog.push({
      id: randomUUID(),
      text: parsed.data.text,
      by: resolveActorLabel(socket),
      ts: Date.now(),
    });

    if (room.chatLog.length > 300) {
      room.chatLog = room.chatLog.slice(-300);
    }

    room.activityLog.push({
      id: randomUUID(),
      text: `${resolveActorLabel(socket)} envío un mensaje`,
      ts: Date.now(),
    });

    if (room.activityLog.length > 300) {
      room.activityLog = room.activityLog.slice(-300);
    }

    broadcastRoomState(io, room);
  });
}
