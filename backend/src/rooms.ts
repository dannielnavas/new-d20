import { RoomState } from "./types.js";

const rooms = new Map<string, RoomState>();

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
    },
    tokens: [],
    chatLog: [],
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
