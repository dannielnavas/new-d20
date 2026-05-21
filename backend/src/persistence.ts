import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { RedisRoomStore } from "./redis-adapter.js";
import { RoomState } from "./types.js";

const SAVE_DEBOUNCE_MS = 500;

const roomStateSchema = z.object({
  roomId: z.string(),
  roomVersion: z.number(),
  sessionPasswordConfigured: z.boolean(),
  sessionPasswordHash: z.string().optional(),
  settings: z.object({
    backgroundUrl: z.string(),
    backgroundType: z.enum(["image", "video", "youtube"]),
    gridSize: z.number(),
    snapToGrid: z.boolean(),
    playersCanPing: z.boolean(),
    mapAudioEnabled: z.boolean(),
    mapVolume: z.number(),
    discordInviteUrl: z.string().max(2048).default(""),
  }),
  tokens: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["pc", "npc"]),
      name: z.string(),
      imageUrl: z.string().optional(),
      x: z.number(),
      y: z.number(),
      size: z.number(),
      claimedBy: z.string().optional(),
      conditions: z.array(z.string()),
      frameColor: z.string().optional(),
      reaction: z.string().optional(),
      hp: z.number().optional(),
      maxHp: z.number().optional(),
      ac: z.number().optional(),
      rotation: z.number().optional(),
    }),
  ),
  chatLog: z.array(z.object({ id: z.string(), text: z.string(), by: z.string(), ts: z.number() })),
  activityLog: z.array(z.object({ id: z.string(), text: z.string(), ts: z.number() })),
  diceLog: z.array(
    z.object({
      id: z.string(),
      dieType: z.enum(["d4", "d6", "d8", "d10", "d12", "d20", "d100"]),
      mode: z.enum(["normal", "advantage", "disadvantage"]),
      total: z.number(),
      rolls: z.array(z.number()),
      by: z.string(),
      ts: z.number(),
    }),
  ),
  initiative: z.object({
    visible: z.boolean(),
    order: z.array(z.string()),
    currentIndex: z.number(),
  }),
  presence: z.array(
    z.object({ sessionId: z.string(), role: z.enum(["dm", "player", "spectator"]) }),
  ),
});

const snapshotSchema = z.object({
  rooms: z.array(roomStateSchema),
});

let pendingWrite: NodeJS.Timeout | null = null;
let redisRoomStore: RedisRoomStore | null = null;

export function setRedisRoomStore(store: RedisRoomStore | null): void {
  redisRoomStore = store;
}

export function getPersistencePath(): string {
  return process.env.PERSISTENCE_PATH || path.resolve(process.cwd(), "data/vtt-snapshot.json");
}

async function writeSnapshot(roomsMap: Map<string, RoomState>): Promise<void> {
  const persistencePath = getPersistencePath();
  await mkdir(path.dirname(persistencePath), { recursive: true });
  const payload = {
    rooms: [...roomsMap.values()],
  };
  await writeFile(persistencePath, JSON.stringify(payload, null, 2), "utf8");
}

async function syncRoomsToRedis(roomsMap: Map<string, RoomState>): Promise<void> {
  if (!redisRoomStore) {
    return;
  }

  try {
    const redisSafeRooms = [...roomsMap.values()].map((room) => {
      const { sessionPasswordHash: _sessionPasswordHash, ...redisSafeRoom } = room;
      return redisSafeRoom;
    });
    await redisRoomStore.setRooms(redisSafeRooms);
  } catch (error: unknown) {
    console.warn("No se pudo sincronizar snapshot a Redis", error);
  }
}

export function schedulePersistRooms(roomsMap: Map<string, RoomState>): void {
  if (pendingWrite) {
    clearTimeout(pendingWrite);
  }

  pendingWrite = setTimeout(() => {
    void Promise.all([writeSnapshot(roomsMap), syncRoomsToRedis(roomsMap)]).catch(
      (error: unknown) => {
        console.error("No se pudo persistir snapshot", error);
      },
    );
    pendingWrite = null;
  }, SAVE_DEBOUNCE_MS);
}

export async function flushPersistedRooms(roomsMap: Map<string, RoomState>): Promise<void> {
  if (pendingWrite) {
    clearTimeout(pendingWrite);
    pendingWrite = null;
  }
  await Promise.all([writeSnapshot(roomsMap), syncRoomsToRedis(roomsMap)]);
}

async function readRoomsSnapshotFromDisk(): Promise<RoomState[]> {
  const persistencePath = getPersistencePath();

  try {
    const raw = await readFile(persistencePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const result = snapshotSchema.safeParse(parsed);
    if (!result.success) {
      console.warn("Snapshot inválido; iniciando sin salas persistidas");
      return [];
    }

    return result.data.rooms;
  } catch (error: unknown) {
    const isMissingFile =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT";

    if (isMissingFile) {
      return [];
    }

    console.error("No se pudo cargar snapshot", error);
    return [];
  }
}

export async function loadRoomsFromDisk(): Promise<RoomState[]> {
  return readRoomsSnapshotFromDisk();
}

export async function loadRoomForJoin(roomId: string): Promise<RoomState | null> {
  if (redisRoomStore) {
    const roomFromRedis = await redisRoomStore.getRoom(roomId);
    if (
      roomFromRedis &&
      (!roomFromRedis.sessionPasswordConfigured || !!roomFromRedis.sessionPasswordHash)
    ) {
      return roomFromRedis;
    }
  }

  const rooms = await readRoomsSnapshotFromDisk();
  return rooms.find((room) => room.roomId === roomId) ?? null;
}
