import { randomUUID } from "node:crypto";

import { Server, Socket } from "socket.io";
import { z } from "zod";

import { createRateLimiter } from "./rate-limit.js";
import { broadcastRoomState } from "./room-broadcast.js";
import { getRoom } from "./rooms.js";
import { isDm } from "./socket-guards.js";
import { getSocketState, requireRoomId } from "./socket-state.js";

const initiativeSetModifierSchema = z.object({
  tokenId: z.string().min(1),
  modifier: z.number().int().min(-20).max(20),
});

const initiativeMoveSchema = z.object({
  fromIndex: z.number().int().min(0),
  toIndex: z.number().int().min(0),
});

const initiativeSetCurrentSchema = z.object({
  index: z.number().int().min(0),
});

export const roomModifiers = new Map<string, Map<string, number>>();

function requireDm(socket: Socket): boolean {
  const state = getSocketState(socket);
  if (!state.role || !isDm(state.role)) {
    socket.emit("dmError", { code: "FORBIDDEN", message: "Solo el DM puede editar iniciativa" });
    return false;
  }
  return true;
}

export function getInitiativeModifier(roomId: string, tokenId: string): number {
  return roomModifiers.get(roomId)?.get(tokenId) ?? 0;
}

export function cleanupRoomModifiers(roomId: string): void {
  roomModifiers.delete(roomId);
}

const initiativeRateLimiter = createRateLimiter({ max: 10, windowMs: 1000 });

export function registerInitiativeHandlers(io: Server, socket: Socket): void {
  socket.on("initiativeSetModifier", (rawPayload: unknown) => {
    const roomId = requireRoomId(socket);
    if (!roomId || !requireDm(socket)) {
      return;
    }

    const parsed = initiativeSetModifierSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("dmError", {
        code: "VALIDATION_ERROR",
        message: "initiativeSetModifier inválido",
      });
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      socket.emit("dmError", { code: "ROOM_NOT_FOUND", message: "Sala no encontrada" });
      return;
    }

    const tokenExists = room.tokens.some((token) => token.id === parsed.data.tokenId);
    if (!tokenExists) {
      socket.emit("dmError", { code: "TOKEN_NOT_FOUND", message: "Token no encontrado" });
      return;
    }

    const rateKey = `${socket.id}:initiative`;
    if (!initiativeRateLimiter(rateKey)) {
      return;
    }

    const modifierMap = roomModifiers.get(roomId) ?? new Map<string, number>();
    modifierMap.set(parsed.data.tokenId, parsed.data.modifier);
    roomModifiers.set(roomId, modifierMap);

    broadcastRoomState(io, room);
  });

  socket.on("initiativeRollAll", () => {
    const roomId = requireRoomId(socket);
    if (!roomId || !requireDm(socket)) {
      return;
    }

    const rateKey = `${socket.id}:initiative`;
    if (!initiativeRateLimiter(rateKey)) {
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      socket.emit("dmError", { code: "ROOM_NOT_FOUND", message: "Sala no encontrada" });
      return;
    }

    const order = [...room.tokens]
      .map((token) => {
        const die = Math.floor(Math.random() * 20) + 1;
        const total = die + getInitiativeModifier(roomId, token.id);
        room.diceLog.push({
          id: randomUUID(),
          dieType: "d20",
          mode: "normal",
          total,
          rolls: [die],
          by: token.name,
          ts: Date.now(),
        });
        return { tokenId: token.id, total };
      })
      .sort((a, b) => b.total - a.total)
      .map((entry) => entry.tokenId);

    room.initiative.order = order;
    room.initiative.currentIndex = order.length > 0 ? 0 : -1;

    broadcastRoomState(io, room);
  });

  socket.on("initiativeNext", () => {
    const roomId = requireRoomId(socket);
    if (!roomId || !requireDm(socket)) {
      return;
    }

    const rateKey = `${socket.id}:initiative`;
    if (!initiativeRateLimiter(rateKey)) {
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      return;
    }

    const orderLength = room.initiative.order.length;
    if (orderLength === 0) {
      return;
    }

    room.initiative.currentIndex = (room.initiative.currentIndex + 1) % orderLength;
    broadcastRoomState(io, room);
  });

  socket.on("initiativeMove", (rawPayload: unknown) => {
    const roomId = requireRoomId(socket);
    if (!roomId || !requireDm(socket)) {
      return;
    }

    const parsed = initiativeMoveSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("dmError", { code: "VALIDATION_ERROR", message: "initiativeMove inválido" });
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      return;
    }

    const { fromIndex, toIndex } = parsed.data;
    if (fromIndex >= room.initiative.order.length || toIndex >= room.initiative.order.length) {
      socket.emit("dmError", { code: "OUT_OF_RANGE", message: "Indices fuera de rango" });
      return;
    }

    const [moved] = room.initiative.order.splice(fromIndex, 1);
    if (!moved) {
      return;
    }
    room.initiative.order.splice(toIndex, 0, moved);

    broadcastRoomState(io, room);
  });

  socket.on("initiativeSetCurrent", (rawPayload: unknown) => {
    const roomId = requireRoomId(socket);
    if (!roomId || !requireDm(socket)) {
      return;
    }

    const parsed = initiativeSetCurrentSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("dmError", {
        code: "VALIDATION_ERROR",
        message: "initiativeSetCurrent inválido",
      });
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      return;
    }

    if (parsed.data.index >= room.initiative.order.length) {
      socket.emit("dmError", { code: "OUT_OF_RANGE", message: "Indice fuera de rango" });
      return;
    }

    room.initiative.currentIndex = parsed.data.index;
    broadcastRoomState(io, room);
  });

  socket.on("initiativeToggleVisibility", () => {
    const roomId = requireRoomId(socket);
    if (!roomId || !requireDm(socket)) {
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      return;
    }

    room.initiative.visible = !room.initiative.visible;
    broadcastRoomState(io, room);
  });
}
