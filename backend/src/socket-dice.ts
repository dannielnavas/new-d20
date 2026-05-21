import { randomUUID } from "node:crypto";

import { Server, Socket } from "socket.io";
import { z } from "zod";

import { broadcastRoomState } from "./room-broadcast.js";
import { getRoom } from "./rooms.js";
import { canWriteChat, isDm } from "./socket-guards.js";
import { getSocketState, requireRoomId, resolveActorLabel } from "./socket-state.js";
import { DieType, RollMode } from "./types.js";

const diceRollSchema = z.object({
  dieType: z.enum(["d4", "d6", "d8", "d10", "d12", "d20", "d100"]),
  mode: z.enum(["normal", "advantage", "disadvantage"]).optional(),
  count: z.number().int().min(1).max(4).optional(),
});

function sidesFromDieType(dieType: DieType): number {
  switch (dieType) {
    case "d4":
      return 4;
    case "d6":
      return 6;
    case "d8":
      return 8;
    case "d10":
      return 10;
    case "d12":
      return 12;
    case "d20":
      return 20;
    case "d100":
      return 100;
  }
}

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

function resolveDice(
  dieType: DieType,
  mode: RollMode,
  count = 1,
): { total: number; rolls: number[] } {
  if (dieType === "d20" && (mode === "advantage" || mode === "disadvantage")) {
    const rollA = rollDie(20);
    const rollB = rollDie(20);
    return {
      total: mode === "advantage" ? Math.max(rollA, rollB) : Math.min(rollA, rollB),
      rolls: [rollA, rollB],
    };
  }

  const sides = sidesFromDieType(dieType);
  const rolls: number[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const val = rollDie(sides);
    rolls.push(val);
    total += val;
  }
  return { total, rolls };
}

export function registerDiceHandlers(io: Server, socket: Socket): void {
  socket.on("diceRoll", (rawPayload: unknown) => {
    console.log("DEBUG diceRoll rawPayload:", rawPayload);
    const roomId = requireRoomId(socket);
    if (!roomId) {
      return;
    }

    const parsed = diceRollSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.log("DEBUG diceRoll validation failed:", parsed.error);
      socket.emit("roomError", { code: "VALIDATION_ERROR", message: "diceRoll inválido" });
      return;
    }

    const state = getSocketState(socket);
    const role = state.role;
    if (!role || !canWriteChat(role)) {
      socket.emit("roomError", {
        code: "FORBIDDEN",
        message: "No tienes permiso para tirar dados",
      });
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      socket.emit("roomError", { code: "ROOM_NOT_FOUND", message: "Sala no encontrada" });
      return;
    }

    const dieType = parsed.data.dieType;
    const mode: RollMode = parsed.data.mode ?? "normal";
    const count = parsed.data.count ?? 1;
    console.log(`DEBUG diceRoll parsed: dieType=${dieType}, mode=${mode}, count=${count}`);
    const result = resolveDice(dieType, mode, count);
    console.log("DEBUG diceRoll resolveDice result:", result);

    const entry = {
      id: randomUUID(),
      dieType,
      mode,
      total: result.total,
      rolls: result.rolls,
      by: resolveActorLabel(socket),
      ts: Date.now(),
    };

    room.diceLog.push(entry);
    if (room.diceLog.length > 300) {
      room.diceLog = room.diceLog.slice(-300);
    }

    io.to(roomId).emit("diceRolled", entry);
    broadcastRoomState(io, room);
  });

  socket.on("diceLogReset", () => {
    const roomId = requireRoomId(socket);
    if (!roomId) {
      return;
    }

    const state = getSocketState(socket);
    if (!state.role || !isDm(state.role)) {
      socket.emit("dmError", {
        code: "FORBIDDEN",
        message: "Solo el DM puede reiniciar el log de dados",
      });
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      socket.emit("roomError", { code: "ROOM_NOT_FOUND", message: "Sala no encontrada" });
      return;
    }

    room.diceLog = [];
    broadcastRoomState(io, room);
  });
}
