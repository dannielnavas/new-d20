import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { Server } from "socket.io";

import { RoomState } from "./types.js";

const DEFAULT_REDIS_TTL_SECONDS = 86400;

function getRedisTtlSeconds(): number {
  const rawTtl = process.env.REDIS_SESSION_TTL;
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
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();
  const ttlSeconds = getRedisTtlSeconds();

  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.info("Redis adapter activo para Socket.IO");
  } catch (error: unknown) {
    console.warn("No se pudo activar Redis adapter; iniciando en modo single-node", error);
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
        return JSON.parse(raw) as RoomState;
      } catch (error: unknown) {
        console.warn(`No se pudo leer room:${roomId} desde Redis`, error);
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
