import { Server, Socket } from "socket.io";
import { z } from "zod";

const peerCallRequestSchema = z.object({
  fromPeerId: z.string().min(1),
  toSessionId: z.string().optional(),
});

const peerSignalSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.enum(["offer", "answer", "ice-candidate"]),
  data: z.unknown(),
});

const peerControlSchema = z.object({
  targetPeerId: z.string().min(1),
  action: z.enum(["kick", "mute"]),
});

export function registerPeerHandlers(io: Server, socket: Socket): void {
  socket.on("peerCallRequest", async (rawPayload: unknown) => {
    const parsed = peerCallRequestSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("peerError", {
        code: "INVALID_CALL_REQUEST",
        message: "Formato inválido de peerCallRequest",
      });
      return;
    }

    const { fromPeerId, toSessionId } = parsed.data;
    const roomId = Array.from(socket.rooms).find((room) => room !== socket.id);

    if (!roomId) {
      socket.emit("peerError", {
        code: "NOT_IN_ROOM",
        message: "No estás en una sala",
      });
      return;
    }

    // Si se especifica toSessionId, enviar solo a ese usuario
    // Si no, broadcast a todos excepto el originador
    if (toSessionId) {
      io.to(toSessionId).emit("peerCallSignal", {
        fromPeerId,
        fromSessionId: socket.id,
      });
    } else {
      socket.broadcast.to(roomId).emit("peerCallSignal", {
        fromPeerId,
        fromSessionId: socket.id,
      });
    }
  });

  socket.on("peerSignal", async (rawPayload: unknown) => {
    const parsed = peerSignalSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("peerError", {
        code: "INVALID_SIGNAL",
        message: "Formato inválido de peerSignal",
      });
      return;
    }

    const { from, to, type, data } = parsed.data;

    // Forwarding del signal al destinatario
    io.to(to).emit("peerSignal", {
      from,
      to,
      type,
      data,
    });
  });

  socket.on("peerControl", (rawPayload: unknown) => {
    const parsed = peerControlSchema.safeParse(rawPayload);
    if (!parsed.success) return;

    const roomId = Array.from(socket.rooms).find((room) => room !== socket.id);
    if (!roomId) return;

    // Solo un DM debería enviar esto, aunque la lógica real de autorización la podemos asumir por front
    // Para más seguridad podríamos checar el rol aquí si tenemos acceso rápido
    socket.broadcast.to(roomId).emit("peerControl", parsed.data);
  });

  // Notifica desconexión a otros peers
  socket.on("disconnect", () => {
    const roomId = Array.from(socket.rooms).find((room) => room !== socket.id);
    if (roomId) {
      socket.broadcast.to(roomId).emit("peerUserLeft", socket.id);
    }
  });
}
