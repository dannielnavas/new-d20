import { Server, Socket } from "socket.io";

import { registerDiceHandlers } from "./socket-dice.js";
import { registerDmHandlers } from "./socket-dm.js";
import { registerInitiativeHandlers } from "./socket-initiative.js";
import { registerMapPingHandlers } from "./socket-map-ping.js";
import { registerMediaHandlers } from "./socket-media.js";
import { registerTokenHandlers } from "./socket-tokens.js";

export function registerSocketEventHandlers(io: Server, socket: Socket): void {
  registerTokenHandlers(io, socket);

  registerDiceHandlers(io, socket);
  registerMapPingHandlers(io, socket);
  registerMediaHandlers(io, socket);
  registerDmHandlers(io, socket);
  registerInitiativeHandlers(io, socket);
}
