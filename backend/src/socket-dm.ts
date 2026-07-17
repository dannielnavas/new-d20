import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import { Server, Socket } from "socket.io";
import { z } from "zod";

import { createRateLimiter } from "./rate-limit.js";
import { broadcastRoomState } from "./room-broadcast.js";
import { getRoom, invalidateTokenIndex } from "./rooms.js";
import { isDm } from "./socket-guards.js";
import { getSocketState, requireRoomId } from "./socket-state.js";
import { RoomState } from "./types.js";

const updateRoomSettingsSchema = z
  .object({
    backgroundUrl: z.string().max(2048).optional(),
    backgroundType: z.enum(["image", "video", "youtube"]).optional(),
    gridSize: z.number().int().min(10).max(300).optional(),
    snapToGrid: z.boolean().optional(),
    playersCanPing: z.boolean().optional(),
    mapAudioEnabled: z.boolean().optional(),
    mapVolume: z.number().int().min(0).max(100).optional(),
    boardWidth: z.number().int().min(200).max(4000).optional(),
    boardHeight: z.number().int().min(200).max(4000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Debe enviarse al menos una propiedad",
  });

const setSessionPasswordSchema = z.object({
  password: z.union([z.string().min(1).max(256), z.null()]),
});

const spawnNpcSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  imageUrl: z.string().trim().min(1).max(2048).optional(),
  x: z.number().refine(Number.isFinite, { message: "x debe ser finito" }).optional(),
  y: z.number().refine(Number.isFinite, { message: "y debe ser finito" }).optional(),
});

const spawnPcSchema = z.object({
  names: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  imageUrl: z.string().trim().min(1).max(2048).optional(),
});

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export function isSessionPasswordValid(room: RoomState, password: string | undefined): boolean {
  if (!room.sessionPasswordConfigured) {
    return true;
  }

  const hash = room.sessionPasswordHash;
  if (!hash || !password) {
    return false;
  }

  const expected = Buffer.from(hash, "utf8");
  const provided = Buffer.from(hashPassword(password), "utf8");

  if (expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(expected, provided);
}

const dmSpawnRateLimiter = createRateLimiter({ max: 5, windowMs: 1000 });

export function registerDmHandlers(io: Server, socket: Socket): void {
  socket.on("updateRoomSettings", (rawPayload: unknown) => {
    const roomId = requireRoomId(socket);
    if (!roomId) {
      return;
    }

    const parsed = updateRoomSettingsSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("dmError", { code: "VALIDATION_ERROR", message: "updateRoomSettings inválido" });
      return;
    }

    const state = getSocketState(socket);
    if (!state.role || !isDm(state.role)) {
      socket.emit("dmError", { code: "FORBIDDEN", message: "Solo el DM puede cambiar settings" });
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      socket.emit("dmError", { code: "ROOM_NOT_FOUND", message: "Sala no encontrada" });
      return;
    }

    room.settings = {
      ...room.settings,
      ...parsed.data,
    };

    broadcastRoomState(io, room);
  });

  socket.on("setSessionPassword", (rawPayload: unknown) => {
    const roomId = requireRoomId(socket);
    if (!roomId) {
      return;
    }

    const parsed = setSessionPasswordSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("dmError", { code: "VALIDATION_ERROR", message: "setSessionPassword inválido" });
      return;
    }

    const state = getSocketState(socket);
    if (!state.role || !isDm(state.role)) {
      socket.emit("dmError", {
        code: "FORBIDDEN",
        message: "Solo el DM puede cambiar la contraseña",
      });
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      socket.emit("dmError", { code: "ROOM_NOT_FOUND", message: "Sala no encontrada" });
      return;
    }

    if (parsed.data.password === null) {
      room.sessionPasswordHash = undefined;
      room.sessionPasswordConfigured = false;
    } else {
      room.sessionPasswordHash = hashPassword(parsed.data.password);
      room.sessionPasswordConfigured = true;
    }

    broadcastRoomState(io, room);
  });

  socket.on("spawnNpc", (rawPayload: unknown) => {
    const roomId = requireRoomId(socket);
    if (!roomId) {
      return;
    }

    const rateKey = `${socket.id}:spawnNpc`;
    if (!dmSpawnRateLimiter(rateKey)) {
      socket.emit("dmError", { code: "RATE_LIMITED", message: "Demasiados spawns" });
      return;
    }

    const parsed = spawnNpcSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("dmError", { code: "VALIDATION_ERROR", message: "spawnNpc inválido" });
      return;
    }

    const state = getSocketState(socket);
    if (!state.role || !isDm(state.role)) {
      socket.emit("dmError", { code: "FORBIDDEN", message: "Solo el DM puede crear NPC" });
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      socket.emit("dmError", { code: "ROOM_NOT_FOUND", message: "Sala no encontrada" });
      return;
    }

    room.tokens.push({
      id: randomUUID(),
      type: "npc",
      name:
        parsed.data.name ?? `NPC ${room.tokens.filter((token) => token.type === "npc").length + 1}`,
      imageUrl: parsed.data.imageUrl,
      x: parsed.data.x ?? 800,
      y: parsed.data.y ?? 450,
      size: 1,
      conditions: [],
    });
    invalidateTokenIndex(room);

    broadcastRoomState(io, room);
  });

  socket.on("spawnPc", (rawPayload: unknown) => {
    const roomId = requireRoomId(socket);
    if (!roomId) {
      return;
    }

    const rateKey = `${socket.id}:spawnPc`;
    if (!dmSpawnRateLimiter(rateKey)) {
      socket.emit("dmError", { code: "RATE_LIMITED", message: "Demasiados spawns" });
      return;
    }

    const parsed = spawnPcSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("dmError", { code: "VALIDATION_ERROR", message: "spawnPc inválido" });
      return;
    }

    const state = getSocketState(socket);
    if (!state.role || !isDm(state.role)) {
      socket.emit("dmError", { code: "FORBIDDEN", message: "Solo el DM puede crear PCs" });
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      socket.emit("dmError", { code: "ROOM_NOT_FOUND", message: "Sala no encontrada" });
      return;
    }

    const baseY = 240;
    const currentPcCount = room.tokens.filter((token) => token.type === "pc").length;

    for (const [index, name] of parsed.data.names.entries()) {
      room.tokens.push({
        id: randomUUID(),
        type: "pc",
        name,
        imageUrl: parsed.data.imageUrl,
        x: 200,
        y: baseY + (currentPcCount + index) * 70,
        size: 1,
        conditions: [],
      });
    }
    invalidateTokenIndex(room);

    broadcastRoomState(io, room);
  });
}
