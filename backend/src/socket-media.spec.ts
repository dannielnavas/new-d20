import { describe, expect, it, vi } from "vitest";

import { registerMediaHandlers } from "./socket-media.js";

type SocketHandler = (payload?: unknown) => void;

class FakeSocket {
  data: Record<string, unknown> = {};
  id = "socket-1";

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

describe("registerMediaHandlers", () => {
  it("emite error si no hay room asociada", () => {
    const io = {
      to: vi.fn(() => ({ emit: vi.fn() })),
    };

    const socket = new FakeSocket();
    registerMediaHandlers(io as never, socket as never);

    socket.trigger("discordActivityReady", {
      instanceId: "inst-1",
      channelId: "ch-1",
      guildId: "g-1",
    });

    expect(socket.emitted[0]?.event).toBe("roomError");
    expect(socket.emitted[0]?.payload).toMatchObject({ code: "NOT_JOINED" });
  });

  it("publica estado de actividad al registrar participante", () => {
    const roomEmitter = { emit: vi.fn() };
    const io = {
      to: vi.fn(() => roomEmitter),
    };

    const socket = new FakeSocket();
    socket.data = {
      roomId: "demo",
      sessionId: "player-1",
      role: "player",
    };

    registerMediaHandlers(io as never, socket as never);

    socket.trigger("discordActivityReady", {
      instanceId: "inst-1",
      channelId: "ch-1",
      guildId: "g-1",
    });

    expect(io.to).toHaveBeenCalledWith("demo");
    expect(roomEmitter.emit).toHaveBeenCalledWith(
      "discordActivityState",
      expect.objectContaining({
        instanceId: "inst-1",
        channelId: "ch-1",
        participants: ["player-1"],
      }),
    );
  });
});
