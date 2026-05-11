import { randomUUID } from "node:crypto";

import { Request, Router } from "express";
import { Server } from "socket.io";
import { z } from "zod";

import { broadcastRoomState } from "./room-broadcast.js";
import { getRoom } from "./rooms.js";
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

function isAutomationEnabled(): boolean {
  return process.env.AUTOMATION_ENABLED === "1";
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

  const configuredToken = process.env.AUTOMATION_TOKEN;
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

  if (process.env.AUTOMATION_LOCAL_ONLY === "1") {
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

function resolveDiceRoll(dieType: DieType, mode: RollMode): { total: number; rolls: number[] } {
  if (dieType === "d20" && (mode === "advantage" || mode === "disadvantage")) {
    const first = rollDie(20);
    const second = rollDie(20);
    return {
      total: mode === "advantage" ? Math.max(first, second) : Math.min(first, second),
      rolls: [first, second],
    };
  }

  const total = rollDie(sidesFromDieType(dieType));
  return { total, rolls: [total] };
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
      const result = resolveDiceRoll(parsed.data.dieType, mode);

      const entry = {
        id: randomUUID(),
        dieType: parsed.data.dieType,
        mode,
        total: result.total,
        rolls: result.rolls,
        by: parsed.data.roller ?? "automation",
        ts: Date.now(),
      };

      room.diceLog.push(entry);
      if (room.diceLog.length > 300) {
        room.diceLog = room.diceLog.slice(-300);
      }

      io.to(roomId).emit("diceRolled", entry);
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
