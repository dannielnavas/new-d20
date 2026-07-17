import { afterEach, describe, expect, it, vi } from "vitest";

import { getOrCreateRoom } from "./rooms.js";
import { registerTokenHandlers } from "./socket-tokens.js";

type SocketHandler = (payload?: unknown) => void;

class FakeSocket {
  data: Record<string, unknown> = {};
  id = "socket-token-test";

  private handlers = new Map<string, SocketHandler>();
  readonly emitted: Array<{ event: string; payload: unknown }> = [];

  on(event: string, handler: SocketHandler): void {
    this.handlers.set(event, handler);
  }

  emit(event: string, payload: unknown): void {
    this.emitted.push({ event, payload });
  }

  trigger(event: string, payload?: unknown): void {
    const handler = this.handlers.get(event);
    if (!handler) {
      throw new Error(`Handler no registrado para ${event}`);
    }
    handler(payload);
  }
}

describe("registerTokenHandlers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tokenRemove emite error si no hay roomId", () => {
    const socket = new FakeSocket();
    const io = { to: vi.fn(() => ({ emit: vi.fn() })), sockets: { adapter: { rooms: new Map() } } };
    registerTokenHandlers(io as never, socket as never);
    socket.trigger("tokenRemove", { tokenId: "token-1" });
    expect(socket.emitted[0]?.event).toBe("roomError");
    expect(socket.emitted[0]?.payload).toMatchObject({ code: "NOT_JOINED" });
  });

  it("spawnDemoPc no hace nada si no es DM", () => {
    const socket = new FakeSocket();
    socket.data = { roomId: "room-1", role: "player", sessionId: "player-1" };
    const io = { to: vi.fn(() => ({ emit: vi.fn() })), sockets: { adapter: { rooms: new Map() } } };
    registerTokenHandlers(io as never, socket as never);
    socket.trigger("spawnDemoPc");
    expect(socket.emitted.length).toBe(0);
  });

  it("tokenRotate emite error si el payload es inválido", () => {
    const socket = new FakeSocket();
    socket.data = { roomId: "room-1", role: "dm", sessionId: "dm-1" };
    const io = { to: vi.fn(() => ({ emit: vi.fn() })), sockets: { adapter: { rooms: new Map() } } };
    registerTokenHandlers(io as never, socket as never);
    socket.trigger("tokenRotate", {});
    expect(socket.emitted[0]?.event).toBe("tokenError");
    expect(socket.emitted[0]?.payload).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("spawnDemoPc crea token si es DM", () => {
    getOrCreateRoom("room-1");

    const socketInRoom = new FakeSocket();
    socketInRoom.data = { roomId: "room-1", role: "dm", sessionId: "dm-1" };

    const roomSockets = new Map<string, Set<string>>();
    roomSockets.set("room-1", new Set([socketInRoom.id]));

    const socketsMap = new Map<string, typeof socketInRoom>();
    socketsMap.set(socketInRoom.id, socketInRoom);

    const io = {
      sockets: {
        adapter: {
          rooms: roomSockets,
        },
        sockets: socketsMap as any,
      },
    };

    const socket = new FakeSocket();
    socket.data = { roomId: "room-1", role: "dm", sessionId: "dm-1" };
    registerTokenHandlers(io as never, socket as never);
    socket.trigger("spawnDemoPc");

    expect(socketInRoom.emitted.some((e) => e.event === "roomState")).toBe(true);
  });
});
