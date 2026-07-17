export type Role = "dm" | "player" | "spectator";

export type BackgroundType = "image" | "video" | "youtube";

export type DieType = "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100";

export type RollMode = "normal" | "advantage" | "disadvantage";

export interface RoomSettings {
  backgroundUrl: string;
  backgroundType: BackgroundType;
  gridSize: number;
  snapToGrid: boolean;
  playersCanPing: boolean;
  mapAudioEnabled: boolean;
  mapVolume: number;
  discordInviteUrl: string;
  boardWidth?: number;
  boardHeight?: number;
}

export interface Token {
  id: string;
  type: "pc" | "npc";
  name: string;
  imageUrl?: string;
  x: number;
  y: number;
  size: number;
  claimedBy?: string;
  conditions: string[];
  frameColor?: string;
  reaction?: string;
  hp?: number;
  maxHp?: number;
  ac?: number;
  rotation?: number;
}

export interface ActivityEntry {
  id: string;
  text: string;
  ts: number;
}

export interface DiceEntry {
  id: string;
  dieType: DieType;
  mode: RollMode;
  total: number;
  rolls: number[];
  by: string;
  ts: number;
  secret?: boolean;
}

export interface InitiativeState {
  visible: boolean;
  order: string[];
  currentIndex: number;
}

export interface PresenceEntry {
  sessionId: string;
  role: Role;
}

export interface SessionMeta {
  name: string;
  accessTokenHash: string;
  createdAt: number;
}

export interface RoomState {
  roomId: string;
  roomVersion: number;
  sessionPasswordConfigured: boolean;
  sessionPasswordHash?: string;
  settings: RoomSettings;
  tokens: Token[];

  activityLog: ActivityEntry[];
  diceLog: DiceEntry[];
  initiative: InitiativeState;
  presence: PresenceEntry[];
  sessionMeta?: SessionMeta;
}

export interface SessionStatePayload {
  role: Role;
  claimedTokenId?: string;
}
