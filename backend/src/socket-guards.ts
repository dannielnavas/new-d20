import { Role } from "./types.js";

export function isDm(role: Role): boolean {
  return role === "dm";
}

export function canWriteChat(role: Role): boolean {
  return role === "dm" || role === "player";
}

export function canMutateTokens(role: Role): boolean {
  return role === "dm" || role === "player";
}
