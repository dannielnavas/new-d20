import { describe, expect, it, vi, afterEach } from "vitest";
import { roomStateSchema } from "./persistence.js";
import { RoomState } from "./types.js";

function makeRoom(overrides: Partial<RoomState> = {}): unknown {
  return {
    roomId: "test-room",
    roomVersion: 0,
    sessionPasswordConfigured: false,
    settings: {
      backgroundUrl: "",
      backgroundType: "image",
      gridSize: 50,
      snapToGrid: true,
      playersCanPing: true,
      mapAudioEnabled: false,
      mapVolume: 50,
      discordInviteUrl: "",
      boardWidth: 1600,
      boardHeight: 900,
    },
    tokens: [],
    chatLog: [],
    activityLog: [],
    diceLog: [],
    initiative: { visible: false, order: [], currentIndex: 0 },
    presence: [],
    ...overrides,
  };
}

describe("roomStateSchema (persistence)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("valida un room correcto", () => {
    const result = roomStateSchema.safeParse(makeRoom());
    expect(result.success).toBe(true);
  });

  it("valida un room con tokens y sessionMeta", () => {
    const result = roomStateSchema.safeParse(
      makeRoom({
        tokens: [
          {
            id: "tok-1",
            type: "pc",
            name: "Héroe",
            x: 100,
            y: 200,
            size: 1,
            conditions: [],
          },
        ],
        sessionMeta: {
          name: "Campaña",
          accessTokenHash: "a".repeat(64),
          createdAt: Date.now(),
        },
      } as any),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tokens[0]!.name).toBe("Héroe");
    }
  });

  it("rechaza room sin roomId", () => {
    const data = makeRoom() as Record<string, unknown>;
    delete data["roomId"];
    const result = roomStateSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rechaza backgroundType inválido en settings", () => {
    const data = makeRoom() as Record<string, unknown>;
    (data["settings"] as Record<string, unknown>)["backgroundType"] = "flash";
    const result = roomStateSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rechaza token con tipo desconocido", () => {
    const data = makeRoom({
      tokens: [
        { id: "t1", type: "monster", name: "Orco", x: 0, y: 0, size: 1, conditions: [] },
      ] as any,
    });
    const result = roomStateSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rechaza diceLog con dieType desconocido", () => {
    const data = makeRoom({
      diceLog: [
        { id: "d1", dieType: "d3", mode: "normal", total: 2, rolls: [2], by: "Jugador", ts: 0 },
      ] as any,
    });
    const result = roomStateSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("aplica defaults: boardWidth/boardHeight y discordInviteUrl", () => {
    const data = makeRoom() as Record<string, unknown>;
    const settings = { ...(data["settings"] as Record<string, unknown>) };
    delete settings["boardWidth"];
    delete settings["boardHeight"];
    delete settings["discordInviteUrl"];
    data["settings"] = settings;

    const result = roomStateSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.settings.boardWidth).toBe(1600);
      expect(result.data.settings.boardHeight).toBe(900);
      expect(result.data.settings.discordInviteUrl).toBe("");
    }
  });
});
