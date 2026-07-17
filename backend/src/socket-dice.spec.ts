import { afterEach, describe, expect, it, vi } from "vitest";

import { registerDiceHandlers } from "./socket-dice.js";
import { getOrCreateRoom, getRoomsMap } from "./rooms.js";

type SocketHandler = (payload?: unknown) => void;

class FakeSocket {
  data: Record<string, unknown> = {};
  id = "socket-dice-test";

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

describe("registerDiceHandlers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emite error si no hay roomId en socket", () => {
    const socket = new FakeSocket();
    const io = { to: vi.fn(() => ({ emit: vi.fn() })) };
    registerDiceHandlers(io as never, socket as never);
    socket.trigger("diceRoll", { dieType: "d20", mode: "normal" });
    expect(socket.emitted[0]?.event).toBe("roomError");
    expect(socket.emitted[0]?.payload).toMatchObject({ code: "NOT_JOINED" });
  });

  it("emite error para payload inválido", () => {
    const socket = new FakeSocket();
    socket.data = { roomId: "room-1", role: "player", sessionId: "player-1" };
    const io = { to: vi.fn(() => ({ emit: vi.fn() })) };
    registerDiceHandlers(io as never, socket as never);
    socket.trigger("diceRoll", { dieType: "d99" });
    expect(socket.emitted[0]?.event).toBe("roomError");
    expect(socket.emitted[0]?.payload).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("emite error si el rol no puede escribir chat", () => {
    const socket = new FakeSocket();
    socket.data = { roomId: "room-1", role: "spectator", sessionId: "spec-1" };
    const io = { to: vi.fn(() => ({ emit: vi.fn() })) };
    registerDiceHandlers(io as never, socket as never);
    socket.trigger("diceRoll", { dieType: "d20", mode: "normal" });
    expect(socket.emitted[0]?.event).toBe("roomError");
    expect(socket.emitted[0]?.payload).toMatchObject({ code: "FORBIDDEN" });
  });

  it("emite diceRolled a la sala para tirada normal de jugador", () => {
    getOrCreateRoom("room-1");

    const toSpy = vi.fn(() => ({ emit: vi.fn() }));
    const roomSocket = new FakeSocket();
    roomSocket.data = { roomId: "room-1", role: "player", sessionId: "player-1" };

    const roomSockets = new Map<string, Set<string>>();
    roomSockets.set("room-1", new Set([roomSocket.id]));

    const socketsMap = new Map<string, typeof roomSocket>();
    socketsMap.set(roomSocket.id, roomSocket);

    const io = {
      to: toSpy,
      sockets: {
        adapter: {
          rooms: roomSockets,
        },
        sockets: socketsMap as any,
      },
    };

    const socket = new FakeSocket();
    socket.data = { roomId: "room-1", role: "player", sessionId: "player-1" };
    registerDiceHandlers(io as never, socket as never);

    vi.setSystemTime(1_000_000_000);
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    socket.trigger("diceRoll", { dieType: "d20", mode: "normal" });

    expect(toSpy).toHaveBeenCalledWith("room-1");
    expect(roomSocket.emitted.some((e) => e.event === "roomState")).toBe(true);
  });
});
