import "./env.js";

import { createServer } from "node:http";

import cors from "cors";
import express from "express";
import { Server } from "socket.io";

import { buildDmAuthRouter } from "./auth-dm.js";
import { buildAutomationRouter } from "./automation.js";
import { buildCorsOptions, isOriginAllowed } from "./cors-config.js";
import { buildDiscordAuthRouter } from "./discord-auth.js";
import { registerJoinHandlers } from "./join-handlers.js";
import { registerDisconnectHandler } from "./on-disconnect.js";
import { flushPersistedRooms, loadRoomsFromDisk, setRedisRoomStore } from "./persistence.js";
import { applyRedisAdapter } from "./redis-adapter.js";
import { getRoomsMap, hydrateRooms } from "./rooms.js";
import { registerSocketEventHandlers } from "./socket-events.js";
import { buildUploadsRouter } from "./uploads.js";

const PORT = Number(process.env.PORT || 3000);

async function bootstrap(): Promise<void> {
  const app = express();

  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: "12mb" }));

  app.get("/", (req, res) => {
    const acceptsJson = req.accepts(["json", "html"]) === "json";
    if (acceptsJson) {
      res.json({ ok: true, service: "d20-vtt", status: "running" });
      return;
    }

    res.status(200).type("html").send("<h1>d20-vtt backend</h1><p>Servicio operativo.</p>");
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "d20-vtt" });
  });

  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || isOriginAllowed(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Origen no permitido por CORS"));
      },
      credentials: true,
    },
  });

  const redisRoomStore = await applyRedisAdapter(io);
  setRedisRoomStore(redisRoomStore);

  app.use("/auth/dm", buildDmAuthRouter());
  app.use("/auth/discord", buildDiscordAuthRouter());
  app.use("/uploads", buildUploadsRouter());
  app.use("/automation", buildAutomationRouter(io));

  const persistedRooms = await loadRoomsFromDisk();
  hydrateRooms(persistedRooms);

  io.on("connection", (socket) => {
    registerJoinHandlers(io, socket);
    registerSocketEventHandlers(io, socket);
    registerDisconnectHandler(io, socket);
  });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    console.log(`Recibido ${signal}. Persistiendo estado y cerrando servidor...`);
    await flushPersistedRooms(getRoomsMap());
    if (redisRoomStore) {
      await redisRoomStore.disconnect();
    }

    io.close();
    httpServer.close((error?: Error) => {
      if (error) {
        console.error("Error al cerrar servidor HTTP", error);
        process.exit(1);
      }
      process.exit(0);
    });
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  httpServer.listen(PORT, () => {
    console.log(`d20-vtt backend escuchando en :${PORT}`);
  });
}

try {
  await bootstrap();
} catch (error: unknown) {
  console.error("Fallo al iniciar backend", error);
  process.exit(1);
}
