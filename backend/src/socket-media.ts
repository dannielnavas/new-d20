import { Server, Socket } from "socket.io";
import { z } from "zod";

import { getSocketState, requireRoomId } from "./socket-state.js";

const discordActivityReadySchema = z.object({
  instanceId: z.string().min(1).max(128),
  channelId: z.string().min(1).max(128),
  guildId: z.string().min(1).max(128).optional(),
});

interface RoomActivityState {
  instanceId: string;
  channelId: string;
  guildId?: string;
  participants: Set<string>;
}

const activityByRoom = new Map<string, RoomActivityState>();
const activityBySocket = new Map<string, { roomId: string; participantId: string }>();

function emitActivityState(io: Server, roomId: string): void {
  const state = activityByRoom.get(roomId);
  io.to(roomId).emit("discordActivityState", {
    instanceId: state?.instanceId,
    channelId: state?.channelId,
    participants: state ? [...state.participants] : [],
  });
}

function removeParticipant(io: Server, socket: Socket): void {
  const socketActivity = activityBySocket.get(socket.id);
  if (!socketActivity) {
    return;
  }

  const roomState = activityByRoom.get(socketActivity.roomId);
  if (roomState) {
    roomState.participants.delete(socketActivity.participantId);

    if (roomState.participants.size === 0) {
      activityByRoom.delete(socketActivity.roomId);
    }
  }

  activityBySocket.delete(socket.id);
  emitActivityState(io, socketActivity.roomId);
}

export function registerMediaHandlers(io: Server, socket: Socket): void {
  socket.on("discordActivityReady", (rawPayload: unknown) => {
    const roomId = requireRoomId(socket);
    if (!roomId) {
      return;
    }

    const parsed = discordActivityReadySchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("discordActivityError", {
        code: "VALIDATION_ERROR",
        message: "discordActivityReady inválido",
      });
      return;
    }

    const state = getSocketState(socket);
    if (!state.sessionId) {
      socket.emit("discordActivityError", {
        code: "SESSION_MISSING",
        message: "No hay sesión asociada al socket",
      });
      return;
    }

    const roomActivity = activityByRoom.get(roomId) ?? {
      instanceId: parsed.data.instanceId,
      channelId: parsed.data.channelId,
      guildId: parsed.data.guildId,
      participants: new Set<string>(),
    };

    roomActivity.instanceId = parsed.data.instanceId;
    roomActivity.channelId = parsed.data.channelId;
    roomActivity.guildId = parsed.data.guildId;
    roomActivity.participants.add(state.sessionId);

    activityByRoom.set(roomId, roomActivity);
    activityBySocket.set(socket.id, { roomId, participantId: state.sessionId });

    emitActivityState(io, roomId);
  });

  socket.on("discordActivityLeave", () => {
    removeParticipant(io, socket);
  });

  socket.on("disconnect", () => {
    removeParticipant(io, socket);
  });
}
