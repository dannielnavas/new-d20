import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerJoinHandlers } from "./join-handlers.js";
import * as authDm from "./auth-dm.js";
import * as persistence from "./persistence.js";
import { getOrCreateRoom, getRoomsMap, getRoom } from "./rooms.js";

vi.mock("./auth-dm.js");
vi.mock("./persistence.js", () => ({
  loadRoomForJoin: vi.fn().mockResolvedValue(null),
  schedulePersistRooms: vi.fn(),
}));

type Handler = (payload?: unknown) => void | Promise<void>;

class FakeSocket {
  data: Record<string, unknown> = {};
  id = "test-socket-id";

  private handlers = new Map<string, Handler>();
  readonly emitted: Array<{ event: string; payload: unknown }> = [];
  readonly joined: string[] = [];
  readonly left: string[] = [];

  on(event: string, handler: Handler): void {
    this.handlers.set(event, handler);
  }

  emit(event: string, payload: unknown): void {
    this.emitted.push({ event, payload });
  }

  join(roomId: string): void {
    this.joined.push(roomId);
  }

  leave(roomId: string): void {
    this.left.push(roomId);
  }

  async trigger(event: string, payload?: unknown): Promise<void> {
    const handler = this.handlers.get(event);
    if (!handler) throw new Error(`Handler no registrado para '${event}'`);
    await handler(payload);
  }
}

class FakeIo {
  readonly emitted: Array<{ room: string; event: string; payload: unknown }> = [];
  readonly sockets = {
    adapter: { rooms: new Map<string, Set<string>>() },
  };

  to(roomId: string) {
    return {
      emit: (event: string, payload: unknown) => {
        this.emitted.push({ room: roomId, event, payload });
      },
    };
  }
}

describe("join-handlers", () => {
  let socket: FakeSocket;
  let io: FakeIo;

  beforeEach(() => {
    socket = new FakeSocket();
    io = new FakeIo();
    vi.mocked(authDm.verifyDmToken).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    getRoomsMap().clear();
  });

  it("jugador puede unirse sin token DM", async () => {
    registerJoinHandlers(io as never, socket as never);
    await socket.trigger("joinRoom", { roomId: "sala-1" });

    expect(socket.joined).toContain("sala-1");
    const sessionState = socket.emitted.find((e) => e.event === "sessionState");
    expect(sessionState?.payload).toMatchObject({ role: "player" });
  });

  it("DM puede unirse con token DM válido", async () => {
    vi.mocked(authDm.verifyDmToken).mockResolvedValue({ role: "dm" } as any);

    registerJoinHandlers(io as never, socket as never);
    await socket.trigger("joinRoom", { roomId: "sala-2", dmToken: "valid-token" });

    const sessionState = socket.emitted.find((e) => e.event === "sessionState");
    expect(sessionState?.payload).toMatchObject({ role: "dm" });
  });

  it("rechaza token DM inválido", async () => {
    vi.mocked(authDm.verifyDmToken).mockResolvedValue(null);

    registerJoinHandlers(io as never, socket as never);
    await socket.trigger("joinRoom", { roomId: "sala-3", dmToken: "bad-token" });

    const error = socket.emitted.find((e) => e.event === "roomError");
    expect((error?.payload as { code: string }).code).toBe("INVALID_DM_TOKEN");
  });

  it("espectador se une con rol spectator", async () => {
    registerJoinHandlers(io as never, socket as never);
    await socket.trigger("joinRoom", { roomId: "sala-4", spectator: true });

    const sessionState = socket.emitted.find((e) => e.event === "sessionState");
    expect(sessionState?.payload).toMatchObject({ role: "spectator" });
  });

  it("rechaza acceso a sala con sessionMeta sin accessToken válido", async () => {
    const room = getOrCreateRoom("sala-privada");
    room.sessionMeta = {
      name: "Privada",
      accessTokenHash: "a".repeat(64),
      createdAt: Date.now(),
    };

    registerJoinHandlers(io as never, socket as never);
    await socket.trigger("joinRoom", { roomId: "sala-privada", accessToken: "token-incorrecto" });

    const error = socket.emitted.find((e) => e.event === "roomError");
    expect((error?.payload as { code: string }).code).toBe("INVALID_ACCESS_TOKEN");
  });

  it("rechaza jugador sin contraseña cuando la sala la requiere", async () => {
    const room = getOrCreateRoom("sala-password");
    room.sessionPasswordConfigured = true;
    room.sessionPasswordHash = "abc123";

    registerJoinHandlers(io as never, socket as never);
    await socket.trigger("joinRoom", { roomId: "sala-password" });

    const error = socket.emitted.find((e) => e.event === "roomError");
    expect((error?.payload as { code: string }).code).toBe("INVALID_SESSION_PASSWORD");
  });

  it("rechaza roomId inválido (demasiado largo)", async () => {
    registerJoinHandlers(io as never, socket as never);
    await socket.trigger("joinRoom", { roomId: "x".repeat(65) });

    const error = socket.emitted.find((e) => e.event === "roomError");
    expect((error?.payload as { code: string }).code).toBe("VALIDATION_ERROR");
  });

  it("añade la presencia del jugador a la sala", async () => {
    registerJoinHandlers(io as never, socket as never);
    await socket.trigger("joinRoom", { roomId: "sala-presencia", playerSessionId: "sesion-abc" });

    const room = getRoom("sala-presencia");
    expect(room).toBeDefined();
    expect(room!.presence.some((p) => p.sessionId === "sesion-abc")).toBe(true);
  });
});
