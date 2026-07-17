import { describe, expect, it } from "vitest";

import { getOrCreateRoom, getRoom, getRoomsMap, hydrateRooms } from "./rooms.js";
import { RoomState } from "./types.js";

describe("rooms", () => {
  it("getOrCreateRoom crea sala con valores por defecto", () => {
    const room = getOrCreateRoom("test-1");
    expect(room.roomId).toBe("test-1");
    expect(room.roomVersion).toBe(0);
    expect(room.tokens).toEqual([]);
    expect(room.diceLog).toEqual([]);
    expect(room.activityLog).toEqual([]);
    expect(room.initiative).toEqual({ visible: false, order: [], currentIndex: 0 });
    expect(room.presence).toEqual([]);
    expect(room.sessionPasswordConfigured).toBe(false);
  });

  it("getOrCreateRoom devuelve la misma sala si ya existe", () => {
    const room1 = getOrCreateRoom("test-2");
    room1.roomVersion = 5;
    const room2 = getOrCreateRoom("test-2");
    expect(room2.roomVersion).toBe(5);
    expect(room1).toBe(room2);
  });

  it("getRoom devuelve undefined para sala inexistente", () => {
    expect(getRoom("inexistente")).toBeUndefined();
  });

  it("getRoom devuelve la sala si existe", () => {
    getOrCreateRoom("test-3");
    expect(getRoom("test-3")).toBeDefined();
  });

  it("hydrateRooms carga salas en el mapa", () => {
    const rooms: RoomState[] = [
      {
        roomId: "hydrated-1",
        roomVersion: 10,
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
        activityLog: [],
        diceLog: [],
        initiative: { visible: false, order: [], currentIndex: 0 },
        presence: [],
      },
    ];
    hydrateRooms(rooms);
    expect(getRoom("hydrated-1")).toBeDefined();
    expect(getRoom("hydrated-1")?.roomVersion).toBe(10);
  });

  it("getRoomsMap devuelve el mapa interno", () => {
    const map = getRoomsMap();
    expect(map).toBeInstanceOf(Map);
  });
});
