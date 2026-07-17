import { createHash, randomBytes } from "node:crypto";

import { Router } from "express";
import { z } from "zod";

import { verifyDmToken } from "./auth-dm.js";
import { logger } from "./logger.js";
import { schedulePersistRooms } from "./persistence.js";
import { createRateLimiter } from "./rate-limit.js";
import { cleanupRoomModifiers } from "./socket-initiative.js";
import { deleteRoom, getOrCreateRoom, getRoomsMap } from "./rooms.js";

const createSessionSchema = z.object({
  name: z.string().min(1).max(80),
});

const sessionCreateRateLimiter = createRateLimiter({ max: 5, windowMs: 60_000 });

async function requireDmToken(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.slice(7);
  const payload = await verifyDmToken(token);
  return payload?.role === "dm";
}

export function buildSessionsRouter(): Router {
  const router = Router();

  router.post(
    "/",
    (req, res, next) => {
      const key = req.ip ?? "unknown";
      if (!sessionCreateRateLimiter(key)) {
        res.status(429).json({
          code: "RATE_LIMITED",
          message: "Demasiadas sesiones creadas. Espera un minuto.",
        });
        return;
      }
      next();
    },
    async (req, res) => {
      const isDm = await requireDmToken(req.headers.authorization);
      if (!isDm) {
        res.status(401).json({ code: "UNAUTHORIZED", message: "Token DM requerido" });
        return;
      }

      const parsed = createSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ code: "VALIDATION_ERROR", message: "Nombre de sesión inválido" });
        return;
      }

      const { name } = parsed.data;
      const sessionId = randomBytes(12).toString("hex");
      const rawToken = randomBytes(32).toString("hex");
      const accessTokenHash = createHash("sha256").update(rawToken).digest("hex");

      const room = getOrCreateRoom(sessionId);
      room.sessionMeta = { name, accessTokenHash, createdAt: Date.now() };

      schedulePersistRooms(getRoomsMap());

      logger.info({ sessionId, name }, "Sesión creada");

      res.status(201).json({
        sessionId,
        name,
        accessToken: rawToken,
        sessionUrl: `/play/${sessionId}?token=${rawToken}`,
      });
    },
  );

  router.get("/", async (req, res) => {
    const isDm = await requireDmToken(req.headers.authorization);
    if (!isDm) {
      res.status(401).json({ code: "UNAUTHORIZED", message: "Token DM requerido" });
      return;
    }

    const sessions = [...getRoomsMap().values()]
      .filter((room) => room.sessionMeta !== undefined)
      .map((room) => ({
        sessionId: room.roomId,
        name: room.sessionMeta!.name,
        createdAt: room.sessionMeta!.createdAt,
        playerCount: room.presence.length,
        sessionUrl: `/play/${room.roomId}?token=__redacted__`,
      }));

    res.json({ sessions });
  });

  router.delete("/:sessionId", async (req, res) => {
    const isDm = await requireDmToken(req.headers.authorization);
    if (!isDm) {
      res.status(401).json({ code: "UNAUTHORIZED", message: "Token DM requerido" });
      return;
    }

    const { sessionId } = req.params;
    const roomsMap = getRoomsMap();
    const room = roomsMap.get(sessionId);

    if (!room?.sessionMeta) {
      res.status(404).json({ code: "NOT_FOUND", message: "Sesión no encontrada" });
      return;
    }

    deleteRoom(sessionId);
    cleanupRoomModifiers(sessionId);
    schedulePersistRooms(getRoomsMap());

    logger.info({ sessionId }, "Sesión eliminada");

    res.json({ ok: true });
  });

  return router;
}
