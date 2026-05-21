import { Server } from "socket.io";

import { schedulePersistRooms } from "./persistence.js";
import { getRoomsMap } from "./rooms.js";
import { RoomState } from "./types.js";

export function sanitizeRoomState(room: RoomState): RoomState {
  const { sessionPasswordHash: _sessionPasswordHash, ...safeRoom } = room;

  return {
    ...safeRoom,
    settings: { ...safeRoom.settings },
    tokens: safeRoom.tokens.map((token) => ({
      ...token,
      conditions: [...token.conditions],
    })),

    activityLog: safeRoom.activityLog.map((entry) => ({ ...entry })),
    diceLog: safeRoom.diceLog.map((entry) => ({ ...entry, rolls: [...entry.rolls] })),
    initiative: {
      ...safeRoom.initiative,
      order: [...safeRoom.initiative.order],
    },
    presence: safeRoom.presence.map((entry) => ({ ...entry })),
  };
}

export function broadcastRoomState(io: Server, room: RoomState): void {
  room.roomVersion += 1;
  io.to(room.roomId).emit("roomState", sanitizeRoomState(room));
  schedulePersistRooms(getRoomsMap());
}
