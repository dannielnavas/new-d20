import { RoomState, Token } from "./types.js";

const rooms = new Map<string, RoomState>();

/**
 * In-memory token index: RoomState → (tokenId → Token).
 * Built lazily on first access and invalidated on structural changes.
 * Uses WeakMap so entries are GCed automatically when rooms are removed.
 */
const tokenIndices = new WeakMap<RoomState, Map<string, Token>>();

function buildTokenIndex(room: RoomState): Map<string, Token> {
  const index = new Map<string, Token>();
  for (const token of room.tokens) {
    index.set(token.id, token);
  }
  tokenIndices.set(room, index);
  return index;
}

/** O(1) token lookup by ID. Falls back to O(n) if index not yet built. */
export function findTokenById(room: RoomState, tokenId: string): Token | undefined {
  const index = tokenIndices.get(room) ?? buildTokenIndex(room);
  return index.get(tokenId);
}

/** Call after pushing / splicing room.tokens to keep the index in sync. */
export function invalidateTokenIndex(room: RoomState): void {
  tokenIndices.delete(room);
}

function createDefaultRoom(roomId: string): RoomState {
  return {
    roomId,
    roomVersion: 0,
    sessionPasswordConfigured: false,
    sessionPasswordHash: undefined,
    settings: {
      backgroundUrl: "",
      backgroundType: "image",
      gridSize: 50,
      snapToGrid: true,
      playersCanPing: true,
      mapAudioEnabled: false,
      mapVolume: 50,
      discordInviteUrl: "",
      boardWidth: 1600,
      boardHeight: 900,
    },
    tokens: [],

    activityLog: [],
    diceLog: [],
    initiative: {
      visible: false,
      order: [],
      currentIndex: 0,
    },
    presence: [],
  };
}

export function getRoomsMap(): Map<string, RoomState> {
  return rooms;
}

export function getRoom(roomId: string): RoomState | undefined {
  return rooms.get(roomId);
}

export function getOrCreateRoom(roomId: string): RoomState {
  const existingRoom = rooms.get(roomId);
  if (existingRoom) {
    return existingRoom;
  }

  const room = createDefaultRoom(roomId);
  rooms.set(roomId, room);
  return room;
}

export function hydrateRooms(loadedRooms: RoomState[]): void {
  for (const room of loadedRooms) {
    rooms.set(room.roomId, room);
  }
}

export function deleteRoom(roomId: string): void {
  rooms.delete(roomId);
}
