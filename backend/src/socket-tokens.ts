import { randomUUID } from "node:crypto";

import { Server, Socket } from "socket.io";
import { z } from "zod";

import { createRateLimiter } from "./rate-limit.js";
import { broadcastRoomState } from "./room-broadcast.js";
import { getRoom } from "./rooms.js";
import { canMutateTokens, isDm } from "./socket-guards.js";
import { getSocketState, requireRoomId } from "./socket-state.js";
import { Token } from "./types.js";

const tokenMoveSchema = z.object({
  tokenId: z.string().min(1),
  x: z.number().refine(Number.isFinite, { message: "x debe ser finito" }),
  y: z.number().refine(Number.isFinite, { message: "y debe ser finito" }),
});

const claimPcSchema = z.object({
  tokenId: z.string().min(1),
});

const tokenSetConditionsSchema = z.object({
  tokenId: z.string().min(1),
  conditions: z.array(z.string().min(1).max(32)).max(6),
});

const tokenRemoveSchema = z.object({
  tokenId: z.string().min(1),
});

const tokenIdentitySchema = z.object({
  tokenId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  imageUrl: z.string().trim().min(1).max(2048).optional().or(z.literal("")),
});

const tokenStatsSchema = z.object({
  tokenId: z.string().min(1),
  hp: z.number().int().optional(),
  maxHp: z.number().int().optional(),
  ac: z.number().int().optional(),
  frameColor: z.string().trim().max(32).optional().or(z.literal("")),
});

const moveRateLimiter = createRateLimiter({ max: 40, windowMs: 1000 });

function canControlToken(token: Token, state: ReturnType<typeof getSocketState>): boolean {
  if (!state.role) {
    return false;
  }
  if (isDm(state.role)) {
    return true;
  }

  return token.type === "pc" && !!state.sessionId && token.claimedBy === state.sessionId;
}

export function registerTokenHandlers(io: Server, socket: Socket): void {
  socket.on("tokenMove", (rawPayload: unknown) => {
    const roomId = requireRoomId(socket);
    if (!roomId) {
      return;
    }

    const rateKey = `${socket.id}:tokenMove`;
    if (!moveRateLimiter(rateKey)) {
      socket.emit("tokenError", {
        code: "RATE_LIMITED",
        message: "Movimiento demasiado frecuente",
      });
      return;
    }

    const parsed = tokenMoveSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("tokenError", { code: "VALIDATION_ERROR", message: "tokenMove inválido" });
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      socket.emit("tokenError", { code: "ROOM_NOT_FOUND", message: "Sala no encontrada" });
      return;
    }

    const state = getSocketState(socket);
    if (!state.role || !canMutateTokens(state.role)) {
      socket.emit("tokenError", { code: "FORBIDDEN", message: "No puedes mover fichas" });
      return;
    }

    const token = room.tokens.find((item) => item.id === parsed.data.tokenId);
    if (!token || !canControlToken(token, state)) {
      socket.emit("tokenError", { code: "FORBIDDEN", message: "No puedes mover esta ficha" });
      return;
    }

    token.x = parsed.data.x;
    token.y = parsed.data.y;
    io.to(roomId).emit("tokenMove", { tokenId: token.id, x: token.x, y: token.y });
    broadcastRoomState(io, room);
  });

  socket.on("tokenMoveEnd", (rawPayload: unknown) => {
    const roomId = requireRoomId(socket);
    if (!roomId) {
      return;
    }

    const rateKey = `${socket.id}:tokenMoveEnd`;
    if (!moveRateLimiter(rateKey)) {
      socket.emit("tokenError", {
        code: "RATE_LIMITED",
        message: "Movimiento demasiado frecuente",
      });
      return;
    }

    const parsed = tokenMoveSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("tokenError", { code: "VALIDATION_ERROR", message: "tokenMoveEnd inválido" });
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      socket.emit("tokenError", { code: "ROOM_NOT_FOUND", message: "Sala no encontrada" });
      return;
    }

    const state = getSocketState(socket);
    const token = room.tokens.find((item) => item.id === parsed.data.tokenId);
    if (!state.role || !token || !canControlToken(token, state)) {
      socket.emit("tokenError", { code: "FORBIDDEN", message: "No puedes mover esta ficha" });
      return;
    }

    token.x = parsed.data.x;
    token.y = parsed.data.y;
    io.to(roomId).emit("tokenMoveEnd", { tokenId: token.id, x: token.x, y: token.y });
    broadcastRoomState(io, room);
  });

  socket.on("claimPc", (rawPayload: unknown) => {
    const roomId = requireRoomId(socket);
    if (!roomId) {
      return;
    }

    const parsed = claimPcSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("claimError", { code: "VALIDATION_ERROR", message: "claimPc inválido" });
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      socket.emit("claimError", { code: "ROOM_NOT_FOUND", message: "Sala no encontrada" });
      return;
    }

    const state = getSocketState(socket);
    if (!state.role || state.role !== "player" || !state.sessionId) {
      socket.emit("claimError", {
        code: "FORBIDDEN",
        message: "Solo jugadores pueden reclamar PC",
      });
      return;
    }

    const token = room.tokens.find((item) => item.id === parsed.data.tokenId && item.type === "pc");
    if (!token) {
      socket.emit("claimError", { code: "TOKEN_NOT_FOUND", message: "PC no encontrado" });
      return;
    }

    if (token.claimedBy && token.claimedBy !== state.sessionId) {
      socket.emit("claimError", { code: "ALREADY_CLAIMED", message: "Este PC ya está reclamado" });
      return;
    }

    const currentClaimedToken = room.tokens.find(
      (item) => item.type === "pc" && item.claimedBy === state.sessionId,
    );
    if (currentClaimedToken && currentClaimedToken.id !== token.id) {
      socket.emit("claimError", {
        code: "ALREADY_HAS_PC",
        message: "Solo puedes seleccionar un personaje",
      });
      return;
    }

    for (const item of room.tokens) {
      if (item.type === "pc" && item.claimedBy === state.sessionId) {
        item.claimedBy = undefined;
      }
    }

    token.claimedBy = state.sessionId;
    state.claimedTokenId = token.id;

    socket.emit("sessionState", { role: state.role, claimedTokenId: token.id });
    broadcastRoomState(io, room);
  });

  socket.on("releasePc", (rawPayload: unknown) => {
    const roomId = requireRoomId(socket);
    if (!roomId) return;

    const parsed = claimPcSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("claimError", { code: "VALIDATION_ERROR", message: "releasePc inválido" });
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      socket.emit("claimError", { code: "ROOM_NOT_FOUND", message: "Sala no encontrada" });
      return;
    }

    const state = getSocketState(socket);
    if (!state.role) return;

    const token = room.tokens.find((item) => item.id === parsed.data.tokenId && item.type === "pc");
    if (!token) {
      socket.emit("claimError", { code: "TOKEN_NOT_FOUND", message: "PC no encontrado" });
      return;
    }

    // Solo el DM o el jugador que lo tiene reclamado pueden liberarlo
    if (!isDm(state.role) && token.claimedBy !== state.sessionId) {
      socket.emit("claimError", {
        code: "FORBIDDEN",
        message: "No tienes permiso para liberar este PC",
      });
      return;
    }

    token.claimedBy = undefined;

    // Si el jugador que lo tenía reclamado es el que hace la petición, limpiar su estado
    if (state.claimedTokenId === token.id) {
      state.claimedTokenId = undefined;
      socket.emit("sessionState", { role: state.role });
    }

    // Si el DM lo libera, también deberíamos avisar al jugador original para que su sesión se limpie,
    // pero al hacer broadcastRoomState el frontend se enterará y ajustará su estado (aunque la sesión siga igual).
    // Lo ideal sería emitir sessionState al jugador dueño, pero requeriría buscar su socket.

    broadcastRoomState(io, room);
  });

  socket.on("tokenSetConditions", (rawPayload: unknown) => {
    const roomId = requireRoomId(socket);
    if (!roomId) {
      return;
    }

    const parsed = tokenSetConditionsSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("tokenError", {
        code: "VALIDATION_ERROR",
        message: "tokenSetConditions inválido",
      });
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      socket.emit("tokenError", { code: "ROOM_NOT_FOUND", message: "Sala no encontrada" });
      return;
    }

    const state = getSocketState(socket);
    const token = room.tokens.find((item) => item.id === parsed.data.tokenId);

    if (!state.role || !token || !canControlToken(token, state)) {
      socket.emit("tokenError", {
        code: "FORBIDDEN",
        message: "No puedes editar condiciones de esta ficha",
      });
      return;
    }

    token.conditions = parsed.data.conditions;
    broadcastRoomState(io, room);
  });

  socket.on("tokenUpdateIdentity", (rawPayload: unknown) => {
    const roomId = requireRoomId(socket);
    if (!roomId) {
      return;
    }

    const parsed = tokenIdentitySchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("tokenError", {
        code: "VALIDATION_ERROR",
        message: "tokenUpdateIdentity inválido",
      });
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      socket.emit("tokenError", { code: "ROOM_NOT_FOUND", message: "Sala no encontrada" });
      return;
    }

    const state = getSocketState(socket);
    const token = room.tokens.find((item) => item.id === parsed.data.tokenId);
    if (!state.role || !token || !canControlToken(token, state)) {
      socket.emit("tokenError", {
        code: "FORBIDDEN",
        message: "No puedes editar esta ficha",
      });
      return;
    }

    token.name = parsed.data.name;
    token.imageUrl = parsed.data.imageUrl?.trim() || undefined;
    broadcastRoomState(io, room);
  });

  socket.on("tokenUpdateStats", (rawPayload: unknown) => {
    const roomId = requireRoomId(socket);
    if (!roomId) {
      return;
    }

    const parsed = tokenStatsSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("tokenError", {
        code: "VALIDATION_ERROR",
        message: "tokenUpdateStats inválido",
      });
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      socket.emit("tokenError", { code: "ROOM_NOT_FOUND", message: "Sala no encontrada" });
      return;
    }

    const state = getSocketState(socket);
    const token = room.tokens.find((item) => item.id === parsed.data.tokenId);
    if (!state.role || !token || !canControlToken(token, state)) {
      socket.emit("tokenError", {
        code: "FORBIDDEN",
        message: "No puedes editar las estadísticas de esta ficha",
      });
      return;
    }

    if (parsed.data.hp !== undefined) token.hp = parsed.data.hp;
    if (parsed.data.maxHp !== undefined) token.maxHp = parsed.data.maxHp;
    if (parsed.data.ac !== undefined) token.ac = parsed.data.ac;
    if (parsed.data.frameColor !== undefined)
      token.frameColor = parsed.data.frameColor || undefined;

    broadcastRoomState(io, room);
  });

  socket.on("tokenRemove", (rawPayload: unknown) => {
    const roomId = requireRoomId(socket);
    if (!roomId) {
      return;
    }

    const parsed = tokenRemoveSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("tokenError", { code: "VALIDATION_ERROR", message: "tokenRemove inválido" });
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      socket.emit("tokenError", { code: "ROOM_NOT_FOUND", message: "Sala no encontrada" });
      return;
    }

    const state = getSocketState(socket);
    if (!state.role || !isDm(state.role)) {
      socket.emit("tokenError", { code: "FORBIDDEN", message: "Solo el DM puede borrar tokens" });
      return;
    }

    const tokenIndex = room.tokens.findIndex((item) => item.id === parsed.data.tokenId);
    if (tokenIndex < 0) {
      socket.emit("tokenError", { code: "TOKEN_NOT_FOUND", message: "Token no encontrado" });
      return;
    }

    const token = room.tokens[tokenIndex];
    if (!token || token.type !== "npc") {
      socket.emit("tokenError", { code: "FORBIDDEN", message: "Solo se pueden borrar PNJ" });
      return;
    }

    room.initiative.order = room.initiative.order.filter((id) => id !== token.id);
    if (room.initiative.order.length === 0) {
      room.initiative.currentIndex = -1;
    } else if (room.initiative.currentIndex >= room.initiative.order.length) {
      room.initiative.currentIndex = 0;
    }

    room.tokens.splice(tokenIndex, 1);

    broadcastRoomState(io, room);
  });

  socket.on("spawnDemoPc", () => {
    const roomId = requireRoomId(socket);
    if (!roomId) {
      return;
    }
    const state = getSocketState(socket);
    if (!state.role || !isDm(state.role)) {
      return;
    }
    const room = getRoom(roomId);
    if (!room) {
      return;
    }

    room.tokens.push({
      id: randomUUID(),
      type: "pc",
      name: `PC ${room.tokens.length + 1}`,
      imageUrl: undefined,
      x: 100 + room.tokens.length * 30,
      y: 100,
      size: 1,
      conditions: [],
    });

    broadcastRoomState(io, room);
  });
}
