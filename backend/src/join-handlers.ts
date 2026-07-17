import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import { Server, Socket } from "socket.io";
import { z } from "zod";

import { verifyDmToken } from "./auth-dm.js";
import { loadRoomForJoin } from "./persistence.js";
import { broadcastRoomState } from "./room-broadcast.js";
import { getOrCreateRoom, getRoom, hydrateRooms } from "./rooms.js";
import { isSessionPasswordValid } from "./socket-dm.js";
import { getSocketState } from "./socket-state.js";
import { Role, SessionStatePayload } from "./types.js";

const joinRoomSchema = z.object({
  roomId: z.string().min(1).max(64),
  dmToken: z.string().optional(),
  playerSessionId: z.string().optional(),
  sessionPassword: z.string().optional(),
  spectator: z.boolean().optional(),
  accessToken: z.string().optional(),
});

async function resolveRole(payload: z.infer<typeof joinRoomSchema>): Promise<Role | null> {
  if (payload.spectator) {
    return "spectator";
  }

  if (payload.dmToken) {
    const verified = await verifyDmToken(payload.dmToken);
    if (verified?.role === "dm") {
      return "dm";
    }
    return null;
  }

  return "player";
}

export function registerJoinHandlers(io: Server, socket: Socket): void {
  socket.on("joinRoom", async (rawPayload: unknown) => {
    const parsed = joinRoomSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("roomError", { code: "VALIDATION_ERROR", message: "joinRoom inválido" });
      return;
    }

    const payload = parsed.data;
    const role = await resolveRole(payload);
    if (!role) {
      socket.emit("roomError", {
        code: "INVALID_DM_TOKEN",
        message: "Token DM inválido o expirado",
      });
      return;
    }

    const sessionId = payload.playerSessionId || randomUUID();

    let room = getRoom(payload.roomId);
    if (!room) {
      const restoredRoom = await loadRoomForJoin(payload.roomId);
      if (restoredRoom) {
        hydrateRooms([restoredRoom]);
        room = restoredRoom;
      }
    }

    room = room ?? getOrCreateRoom(payload.roomId);

    if (room.sessionMeta) {
      const incomingHash = createHash("sha256")
        .update(payload.accessToken ?? "")
        .digest("hex");
      const storedHash = Buffer.from(room.sessionMeta.accessTokenHash, "hex");
      const incomingHashBuf = Buffer.from(incomingHash, "hex");
      if (
        storedHash.length !== incomingHashBuf.length ||
        !timingSafeEqual(storedHash, incomingHashBuf)
      ) {
        socket.emit("roomError", {
          code: "INVALID_ACCESS_TOKEN",
          message: "Token de acceso inválido o faltante",
        });
        return;
      }
    }

    if (role !== "dm" && room.sessionPasswordConfigured) {
      if (!isSessionPasswordValid(room, payload.sessionPassword)) {
        socket.emit("roomError", {
          code: "INVALID_SESSION_PASSWORD",
          message: "Contraseña de sesión inválida",
        });
        return;
      }
    }

    const state = getSocketState(socket);
    if (state.roomId) {
      socket.leave(state.roomId);
    }

    socket.join(payload.roomId);
    state.roomId = payload.roomId;
    state.role = role;
    state.sessionId = sessionId;

    room.presence = room.presence.filter((entry) => entry.sessionId !== sessionId);
    room.presence.push({
      sessionId,
      role,
    });

    const claimedToken = room.tokens.find(
      (token) => token.type === "pc" && token.claimedBy === sessionId,
    );
    state.claimedTokenId = claimedToken?.id;

    const sessionState: SessionStatePayload = { role, claimedTokenId: claimedToken?.id };
    socket.emit("sessionState", sessionState);

    broadcastRoomState(io, room);
  });
}
