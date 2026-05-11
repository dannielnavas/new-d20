import { Server, Socket } from "socket.io";

import { broadcastRoomState } from "./room-broadcast.js";
import { getRoom } from "./rooms.js";
import { getSocketState } from "./socket-state.js";

export function registerDisconnectHandler(io: Server, socket: Socket): void {
  socket.on("disconnect", () => {
    const state = getSocketState(socket);

    if (!state.roomId || !state.sessionId) {
      return;
    }

    const room = getRoom(state.roomId);
    if (!room) {
      return;
    }

    room.presence = room.presence.filter((entry) => entry.sessionId !== state.sessionId);

    for (const token of room.tokens) {
      if (token.claimedBy === state.sessionId) {
        token.claimedBy = undefined;
      }
    }

    state.claimedTokenId = undefined;

    broadcastRoomState(io, room);
  });
}
