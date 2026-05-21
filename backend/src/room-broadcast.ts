import { Server } from "socket.io";

import { schedulePersistRooms } from "./persistence.js";
import { getRoomsMap } from "./rooms.js";
import { RoomState } from "./types.js";

import { getSocketState } from "./socket-state.js";

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

export function sanitizeRoomStateForRole(room: RoomState, role?: string): RoomState {
  const sanitized = sanitizeRoomState(room);
  if (role !== "dm") {
    sanitized.diceLog = sanitized.diceLog.filter((entry) => !entry.secret);
  }
  return sanitized;
}

export function broadcastRoomState(io: Server, room: RoomState): void {
  room.roomVersion += 1;

  const sockets = io.sockets.adapter.rooms.get(room.roomId);
  if (sockets) {
    for (const socketId of sockets) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        const state = getSocketState(socket);
        socket.emit("roomState", sanitizeRoomStateForRole(room, state.role));
      }
    }
  }

  schedulePersistRooms(getRoomsMap());
}
