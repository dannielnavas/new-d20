import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { Server } from "socket.io";

import { ENV } from "./env.js";
import { logger } from "./logger.js";
import { roomStateSchema } from "./persistence.js";
import { RoomState } from "./types.js";

const DEFAULT_REDIS_TTL_SECONDS = 86400;

function getRedisTtlSeconds(): number {
  const rawTtl = ENV.REDIS_SESSION_TTL;
  const parsed = Number(rawTtl);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_REDIS_TTL_SECONDS;
}

function roomKey(roomId: string): string {
  return `room:${roomId}`;
}

function roomVersionKey(roomId: string): string {
  return `room:${roomId}:version`;
}

interface DisconnectableRedisClient {
  quit(): Promise<unknown>;
  disconnect(): Promise<unknown>;
}

async function safeDisconnect(client: DisconnectableRedisClient): Promise<void> {
  try {
    await client.quit();
  } catch {
    try {
      await client.disconnect();
    } catch {
      // Ignore close errors during degraded startup.
    }
  }
}

export interface RedisRoomStore {
  getRoom(roomId: string): Promise<RoomState | null>;
  setRooms(rooms: RoomState[]): Promise<void>;
  disconnect(): Promise<void>;
}

export async function applyRedisAdapter(io: Server): Promise<RedisRoomStore | null> {
  const redisUrl = ENV.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();
  const ttlSeconds = getRedisTtlSeconds();

  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Redis adapter activo para Socket.IO");
  } catch (error: unknown) {
    logger.warn({ err: error }, "No se pudo activar Redis adapter; iniciando en modo single-node");
    await Promise.allSettled([safeDisconnect(pubClient), safeDisconnect(subClient)]);
    return null;
  }

  return {
    async getRoom(roomId: string): Promise<RoomState | null> {
      try {
        const raw = await pubClient.get(roomKey(roomId));
        if (!raw) {
          return null;
        }
        const parsed = roomStateSchema.safeParse(JSON.parse(raw) as unknown);
        if (!parsed.success) {
          logger.warn(
            { roomId, issues: parsed.error.issues },
            "Room de Redis no pasó validación Zod; descartando",
          );
          return null;
        }
        const room = parsed.data as RoomState;
        room.settings = {
          ...room.settings,
          discordInviteUrl: room.settings.discordInviteUrl ?? "",
        };
        return room;
      } catch (error: unknown) {
        logger.warn({ roomId, err: error }, "No se pudo leer room desde Redis");
        return null;
      }
    },

    async setRooms(rooms: RoomState[]): Promise<void> {
      if (rooms.length === 0) {
        return;
      }

      const pipeline = pubClient.multi();
      for (const room of rooms) {
        pipeline.set(roomKey(room.roomId), JSON.stringify(room), { EX: ttlSeconds });
        pipeline.set(roomVersionKey(room.roomId), String(room.roomVersion), { EX: ttlSeconds });
      }
      await pipeline.exec();
    },

    async disconnect(): Promise<void> {
      await Promise.allSettled([safeDisconnect(pubClient), safeDisconnect(subClient)]);
    },
  };
}
