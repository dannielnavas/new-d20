import { Server, Socket } from "socket.io";
import { z } from "zod";

import { createRateLimiter } from "./rate-limit.js";
import { getRoom } from "./rooms.js";
import { canWriteChat } from "./socket-guards.js";
import { getSocketState, requireRoomId, resolveActorLabel } from "./socket-state.js";

const mapPingSchema = z.object({
  x: z.number().refine(Number.isFinite, { message: "x debe ser finito" }),
  y: z.number().refine(Number.isFinite, { message: "y debe ser finito" }),
});

const pingRateLimiter = createRateLimiter({ max: 8, windowMs: 1500 });

export function registerMapPingHandlers(io: Server, socket: Socket): void {
  socket.on("mapPing", (rawPayload: unknown) => {
    const roomId = requireRoomId(socket);
    if (!roomId) {
      return;
    }

    const parsed = mapPingSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("roomError", { code: "VALIDATION_ERROR", message: "mapPing inválido" });
      return;
    }

    const state = getSocketState(socket);
    if (!state.role || !canWriteChat(state.role)) {
      socket.emit("roomError", { code: "FORBIDDEN", message: "No puedes hacer ping en el mapa" });
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      socket.emit("roomError", { code: "ROOM_NOT_FOUND", message: "Sala no encontrada" });
      return;
    }

    if (state.role === "player" && !room.settings.playersCanPing) {
      socket.emit("roomError", {
        code: "FORBIDDEN",
        message: "El DM ha desactivado ping para jugadores",
      });
      return;
    }

    const rateKey = `${socket.id}:mapPing`;
    if (!pingRateLimiter(rateKey)) {
      socket.emit("roomError", { code: "RATE_LIMITED", message: "Demasiados pings" });
      return;
    }

    io.to(roomId).emit("mapPing", {
      x: parsed.data.x,
      y: parsed.data.y,
      by: resolveActorLabel(socket),
      ts: Date.now(),
    });
  });
}
