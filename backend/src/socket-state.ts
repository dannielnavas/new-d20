import { Socket } from "socket.io";

import { getRoom } from "./rooms.js";
import { Role } from "./types.js";

export interface SocketState {
  roomId?: string;
  role?: Role;
  sessionId?: string;
  claimedTokenId?: string;
}

export function getSocketState(socket: Socket): SocketState {
  return socket.data as SocketState;
}

export function requireRoomId(socket: Socket): string | null {
  const state = getSocketState(socket);
  if (!state.roomId) {
    socket.emit("roomError", { code: "NOT_JOINED", message: "Debes unirte a una sala primero" });
    return null;
  }
  return state.roomId;
}

export function resolveActorLabel(socket: Socket): string {
  const state = getSocketState(socket);
  if (state.role === "dm") {
    return "El DM";
  }

  if (!state.roomId || !state.sessionId) {
    return state.role === "player"
      ? "Jugador"
      : state.role === "spectator"
        ? "Espectador"
        : "Desconocido";
  }

  const room = getRoom(state.roomId);
  const token = room?.tokens.find((item) => item.claimedBy === state.sessionId);
  return token?.name ?? (state.role === "player" ? "Jugador" : "Espectador");
}
