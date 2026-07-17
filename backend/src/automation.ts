import { randomUUID } from "node:crypto";

import { Request, Router } from "express";
import { Server } from "socket.io";
import { z } from "zod";

import { ENV } from "./env.js";
import { logger } from "./logger.js";
import { broadcastRoomState } from "./room-broadcast.js";
import { getRoom } from "./rooms.js";
import { getInitiativeModifier } from "./socket-initiative.js";
import { getSocketState } from "./socket-state.js";
import { DieType, RollMode } from "./types.js";

const baseBodySchema = z.object({
  action: z.string().min(1),
  roomId: z.string().min(1).max(64),
  payload: z.unknown().optional(),
});

const initiativeVisibilitySchema = z.object({
  visible: z.boolean(),
});

const diceRollPayloadSchema = z.object({
  dieType: z.enum(["d4", "d6", "d8", "d10", "d12", "d20", "d100"]),
  mode: z.enum(["normal", "advantage", "disadvantage"]).optional(),
  roller: z.string().trim().min(1).max(80).optional(),
  count: z.number().int().min(1).max(4).optional(),
  secret: z.boolean().optional(),
});

const mediaPlayPauseSchema = z.object({
  enabled: z.boolean().optional(),
});

const mediaVolumeSchema = z.object({
  volume: z.number().int().min(0).max(100),
});

const mapCenterTokenSchema = z.object({
  tokenId: z.string().min(1),
  x: z.number().optional(),
  y: z.number().optional(),
});

const spawnNpcPayloadSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  imageUrl: z.string().trim().min(1).max(2048).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
});

const spawnPcPayloadSchema = z.object({
  names: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  imageUrl: z.string().trim().min(1).max(2048).optional(),
});

const tokenRemovePayloadSchema = z.object({
  tokenId: z.string().min(1),
});

const tokenUpdateStatsPayloadSchema = z.object({
  tokenId: z.string().min(1),
  hp: z.number().int().optional(),
  maxHp: z.number().int().optional(),
  ac: z.number().int().optional(),
  frameColor: z.string().trim().max(32).optional().or(z.literal("")),
  size: z.number().min(1).max(5).optional(),
});

const tokenSetConditionsPayloadSchema = z.object({
  tokenId: z.string().min(1),
  conditions: z.array(z.string().min(1).max(32)).max(6),
});

const tokenToggleConditionPayloadSchema = z.object({
  tokenId: z.string().min(1),
  condition: z.string().min(1).max(32),
});

function isAutomationEnabled(): boolean {
  return ENV.AUTOMATION_ENABLED;
}

function isLoopback(ip: string): boolean {
  const normalized = ip.trim();
  return (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "::ffff:127.0.0.1" ||
    normalized === "localhost"
  );
}

function extractCallerIp(rawIp: string | undefined, forwardedFor: string | undefined): string {
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return (rawIp ?? "").trim();
}

function validateAutomationSecurity(
  req: Request,
  token: string | undefined,
): { ok: true } | { ok: false; code: number; body: { code: string; message: string } } {
  if (!isAutomationEnabled()) {
    return {
      ok: false,
      code: 503,
      body: { code: "AUTOMATION_DISABLED", message: "AUTOMATION_ENABLED debe ser 1" },
    };
  }

  const configuredToken = ENV.AUTOMATION_TOKEN;
  if (!configuredToken) {
    return {
      ok: false,
      code: 500,
      body: { code: "AUTOMATION_TOKEN_MISSING", message: "AUTOMATION_TOKEN no configurado" },
    };
  }

  if (!token || token !== configuredToken) {
    return {
      ok: false,
      code: 401,
      body: { code: "UNAUTHORIZED", message: "Token de automatizacion inválido" },
    };
  }

  if (ENV.AUTOMATION_LOCAL_ONLY) {
    const callerIp = extractCallerIp(
      (req as unknown as { ip?: string }).ip,
      req.header("x-forwarded-for") ?? undefined,
    );
    if (!isLoopback(callerIp)) {
      return {
        ok: false,
        code: 403,
        body: { code: "FORBIDDEN", message: "Solo loopback permitido por AUTOMATION_LOCAL_ONLY" },
      };
    }
  }

  return { ok: true };
}

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

function resolveDiceRoll(
  dieType: DieType,
  mode: RollMode,
  count = 1,
): { total: number; rolls: number[] } {
  if (dieType === "d20" && (mode === "advantage" || mode === "disadvantage")) {
    const first = rollDie(20);
    const second = rollDie(20);
    return {
      total: mode === "advantage" ? Math.max(first, second) : Math.min(first, second),
      rolls: [first, second],
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

function requireDmConnected(roomId: string): boolean {
  const room = getRoom(roomId);
  if (!room) {
    return false;
  }

  return room.presence.some((entry) => entry.role === "dm");
}

function applyAutomationAction(
  io: Server,
  action: string,
  roomId: string,
  payload: unknown,
):
  | { ok: true; data?: Record<string, unknown> }
  | { ok: false; code: number; body: { code: string; message: string } } {
  const room = getRoom(roomId);
  if (!room) {
    return {
      ok: false,
      code: 404,
      body: { code: "ROOM_NOT_FOUND", message: "Sala no encontrada" },
    };
  }

  if (!requireDmConnected(roomId)) {
    return {
      ok: false,
      code: 409,
      body: { code: "DM_NOT_CONNECTED", message: "Se requiere un DM conectado en la sala" },
    };
  }

  switch (action) {
    case "initiative.rollAll": {
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
      return { ok: true };
    }

    case "initiative.next": {
      const orderLength = room.initiative.order.length;
      if (orderLength > 0) {
        room.initiative.currentIndex = (room.initiative.currentIndex + 1) % orderLength;
      }
      broadcastRoomState(io, room);
      return { ok: true };
    }

    case "initiative.visibility": {
      const parsed = initiativeVisibilitySchema.safeParse(payload ?? {});
      if (!parsed.success) {
        return {
          ok: false,
          code: 400,
          body: {
            code: "VALIDATION_ERROR",
            message: "Payload inválido para initiative.visibility",
          },
        };
      }

      room.initiative.visible = parsed.data.visible;
      broadcastRoomState(io, room);
      return { ok: true };
    }

    case "dice.resetLog": {
      room.diceLog = [];
      broadcastRoomState(io, room);
      return { ok: true };
    }

    case "dice.roll": {
      const parsed = diceRollPayloadSchema.safeParse(payload ?? {});
      if (!parsed.success) {
        return {
          ok: false,
          code: 400,
          body: { code: "VALIDATION_ERROR", message: "Payload inválido para dice.roll" },
        };
      }

      const mode: RollMode = parsed.data.mode ?? "normal";
      const count = parsed.data.count ?? 1;
      const secret = !!parsed.data.secret;
      const result = resolveDiceRoll(parsed.data.dieType, mode, count);

      const entry = {
        id: randomUUID(),
        dieType: parsed.data.dieType,
        mode,
        total: result.total,
        rolls: result.rolls,
        by: parsed.data.roller ?? "automation",
        ts: Date.now(),
        secret,
      };

      room.diceLog.push(entry);
      if (room.diceLog.length > 300) {
        room.diceLog = room.diceLog.slice(-300);
      }

      if (secret) {
        // Send ONLY to the DM sockets in this room
        const sockets = io.sockets.adapter.rooms.get(roomId);
        if (sockets) {
          for (const socketId of sockets) {
            const s = io.sockets.sockets.get(socketId);
            if (s) {
              const socketState = getSocketState(s);
              if (socketState.role === "dm") {
                s.emit("diceRolled", entry);
              }
            }
          }
        }
      } else {
        io.to(roomId).emit("diceRolled", entry);
      }

      broadcastRoomState(io, room);
      return { ok: true, data: { total: entry.total } };
    }

    case "media.playPause": {
      const parsed = mediaPlayPauseSchema.safeParse(payload ?? {});
      if (!parsed.success) {
        return {
          ok: false,
          code: 400,
          body: { code: "VALIDATION_ERROR", message: "Payload inválido para media.playPause" },
        };
      }

      room.settings.mapAudioEnabled = parsed.data.enabled ?? !room.settings.mapAudioEnabled;
      broadcastRoomState(io, room);
      return { ok: true, data: { mapAudioEnabled: room.settings.mapAudioEnabled } };
    }

    case "media.volume": {
      const parsed = mediaVolumeSchema.safeParse(payload ?? {});
      if (!parsed.success) {
        return {
          ok: false,
          code: 400,
          body: { code: "VALIDATION_ERROR", message: "Payload inválido para media.volume" },
        };
      }

      room.settings.mapVolume = parsed.data.volume;
      broadcastRoomState(io, room);
      return { ok: true, data: { mapVolume: room.settings.mapVolume } };
    }

    case "map.centerToken": {
      const parsed = mapCenterTokenSchema.safeParse(payload ?? {});
      if (!parsed.success) {
        return {
          ok: false,
          code: 400,
          body: { code: "VALIDATION_ERROR", message: "Payload inválido para map.centerToken" },
        };
      }

      const token = room.tokens.find((item) => item.id === parsed.data.tokenId);
      if (!token) {
        return {
          ok: false,
          code: 404,
          body: { code: "TOKEN_NOT_FOUND", message: "Token no encontrado" },
        };
      }

      token.x = parsed.data.x ?? 800;
      token.y = parsed.data.y ?? 450;
      io.to(roomId).emit("tokenMoveEnd", { tokenId: token.id, x: token.x, y: token.y });
      broadcastRoomState(io, room);
      return { ok: true, data: { tokenId: token.id, x: token.x, y: token.y } };
    }

    case "tokens.spawnNpc": {
      const parsed = spawnNpcPayloadSchema.safeParse(payload ?? {});
      if (!parsed.success) {
        return {
          ok: false,
          code: 400,
          body: { code: "VALIDATION_ERROR", message: "Payload inválido para tokens.spawnNpc" },
        };
      }

      const npcToken = {
        id: randomUUID(),
        type: "npc" as const,
        name:
          parsed.data.name ??
          `NPC ${room.tokens.filter((token) => token.type === "npc").length + 1}`,
        imageUrl: parsed.data.imageUrl,
        x: parsed.data.x ?? 800,
        y: parsed.data.y ?? 450,
        size: 1,
        conditions: [],
      };

      room.tokens.push(npcToken);
      broadcastRoomState(io, room);
      return { ok: true, data: { tokenId: npcToken.id } };
    }

    case "tokens.spawnPc": {
      const parsed = spawnPcPayloadSchema.safeParse(payload ?? {});
      if (!parsed.success) {
        return {
          ok: false,
          code: 400,
          body: { code: "VALIDATION_ERROR", message: "Payload inválido para tokens.spawnPc" },
        };
      }

      const baseY = 240;
      const currentPcCount = room.tokens.filter((token) => token.type === "pc").length;
      const spawnedIds: string[] = [];

      for (const [index, name] of parsed.data.names.entries()) {
        const tokenId = randomUUID();
        room.tokens.push({
          id: tokenId,
          type: "pc" as const,
          name,
          imageUrl: parsed.data.imageUrl,
          x: 200,
          y: baseY + (currentPcCount + index) * 70,
          size: 1,
          conditions: [],
        });
        spawnedIds.push(tokenId);
      }

      broadcastRoomState(io, room);
      return { ok: true, data: { tokenIds: spawnedIds } };
    }

    case "tokens.remove": {
      const parsed = tokenRemovePayloadSchema.safeParse(payload ?? {});
      if (!parsed.success) {
        return {
          ok: false,
          code: 400,
          body: { code: "VALIDATION_ERROR", message: "Payload inválido para tokens.remove" },
        };
      }

      const tokenIndex = room.tokens.findIndex((item) => item.id === parsed.data.tokenId);
      if (tokenIndex < 0) {
        return {
          ok: false,
          code: 404,
          body: { code: "TOKEN_NOT_FOUND", message: "Token no encontrado" },
        };
      }

      const token = room.tokens[tokenIndex];
      if (!token) {
        return {
          ok: false,
          code: 404,
          body: { code: "TOKEN_NOT_FOUND", message: "Token no encontrado" },
        };
      }

      room.initiative.order = room.initiative.order.filter((id) => id !== token.id);
      if (room.initiative.order.length === 0) {
        room.initiative.currentIndex = -1;
      } else if (room.initiative.currentIndex >= room.initiative.order.length) {
        room.initiative.currentIndex = 0;
      }

      room.tokens.splice(tokenIndex, 1);

      if (token.type === "pc") {
        io.in(roomId)
          .fetchSockets()
          .then((sockets) => {
            for (const s of sockets) {
              const sState = getSocketState(s as any);
              if (sState.claimedTokenId === token.id) {
                sState.claimedTokenId = undefined;
                s.emit("sessionState", { role: sState.role });
              }
            }
          })
          .catch((err) => {
            logger.error({ err }, "Error fetching sockets on tokenRemove");
          });
      }

      broadcastRoomState(io, room);
      return { ok: true };
    }

    case "tokens.updateStats": {
      const parsed = tokenUpdateStatsPayloadSchema.safeParse(payload ?? {});
      if (!parsed.success) {
        return {
          ok: false,
          code: 400,
          body: { code: "VALIDATION_ERROR", message: "Payload inválido para tokens.updateStats" },
        };
      }

      const token = room.tokens.find((item) => item.id === parsed.data.tokenId);
      if (!token) {
        return {
          ok: false,
          code: 404,
          body: { code: "TOKEN_NOT_FOUND", message: "Token no encontrado" },
        };
      }

      if (parsed.data.hp !== undefined) token.hp = parsed.data.hp;
      if (parsed.data.maxHp !== undefined) token.maxHp = parsed.data.maxHp;
      if (parsed.data.ac !== undefined) token.ac = parsed.data.ac;
      if (parsed.data.frameColor !== undefined)
        token.frameColor = parsed.data.frameColor || undefined;
      if (parsed.data.size !== undefined) token.size = parsed.data.size;

      broadcastRoomState(io, room);
      return { ok: true };
    }

    case "tokens.setConditions": {
      const parsed = tokenSetConditionsPayloadSchema.safeParse(payload ?? {});
      if (!parsed.success) {
        return {
          ok: false,
          code: 400,
          body: { code: "VALIDATION_ERROR", message: "Payload inválido para tokens.setConditions" },
        };
      }

      const token = room.tokens.find((item) => item.id === parsed.data.tokenId);
      if (!token) {
        return {
          ok: false,
          code: 404,
          body: { code: "TOKEN_NOT_FOUND", message: "Token no encontrado" },
        };
      }

      token.conditions = parsed.data.conditions;
      broadcastRoomState(io, room);
      return { ok: true };
    }

    case "tokens.toggleCondition": {
      const parsed = tokenToggleConditionPayloadSchema.safeParse(payload ?? {});
      if (!parsed.success) {
        return {
          ok: false,
          code: 400,
          body: {
            code: "VALIDATION_ERROR",
            message: "Payload inválido para tokens.toggleCondition",
          },
        };
      }

      const token = room.tokens.find((item) => item.id === parsed.data.tokenId);
      if (!token) {
        return {
          ok: false,
          code: 404,
          body: { code: "TOKEN_NOT_FOUND", message: "Token no encontrado" },
        };
      }

      const condition = parsed.data.condition;
      if (token.conditions.includes(condition)) {
        token.conditions = token.conditions.filter((c) => c !== condition);
      } else {
        if (token.conditions.length >= 6) {
          return {
            ok: false,
            code: 400,
            body: {
              code: "MAX_CONDITIONS_REACHED",
              message: "Límite máximo de condiciones (6) alcanzado",
            },
          };
        }
        token.conditions.push(condition);
      }

      broadcastRoomState(io, room);
      return { ok: true, data: { conditions: token.conditions } };
    }

    default:
      return {
        ok: false,
        code: 400,
        body: { code: "UNKNOWN_ACTION", message: "Acción de automatización no soportada" },
      };
  }
}

export function buildAutomationRouter(io: Server): Router {
  const router = Router();

  router.post("/actions", (req, res) => {
    const authResult = validateAutomationSecurity(
      req,
      req.header("x-automation-token") ?? undefined,
    );

    if (!authResult.ok) {
      res.status(authResult.code).json(authResult.body);
      return;
    }

    const parsedBody = baseBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ code: "VALIDATION_ERROR", message: "Body inválido" });
      return;
    }

    const result = applyAutomationAction(
      io,
      parsedBody.data.action,
      parsedBody.data.roomId,
      parsedBody.data.payload,
    );

    if (!result.ok) {
      res.status(result.code).json(result.body);
      return;
    }

    res.json({ ok: true, ...result.data });
  });

  return router;
}
