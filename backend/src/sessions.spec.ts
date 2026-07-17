import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSessionsRouter } from "./sessions.js";
import * as authDm from "./auth-dm.js";
import { getRoomsMap, getRoom } from "./rooms.js";

vi.mock("./auth-dm.js");
vi.mock("./persistence.js", () => ({
  schedulePersistRooms: vi.fn(),
}));
vi.mock("./socket-initiative.js", () => ({
  cleanupRoomModifiers: vi.fn(),
}));

/** Minimal req/res mocks -------------------------------------------------- */

function makeReq(overrides: {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  ip?: string;
}) {
  return {
    method: overrides.method ?? "POST",
    body: overrides.body ?? {},
    headers: overrides.headers ?? {},
    params: overrides.params ?? {},
    ip: overrides.ip ?? "127.0.0.1",
  };
}

function makeRes() {
  const res = {
    statusCode: 200,
    body: {} as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.body = data;
      return this;
    },
  };
  return res;
}

/** Invoke a route handler by manually traversing the router stack ----------- */
async function callRoute(
  router: ReturnType<typeof buildSessionsRouter>,
  method: string,
  path: string,
  options: {
    body?: unknown;
    headers?: Record<string, string>;
    params?: Record<string, string>;
  } = {},
) {
  const req = makeReq({
    method,
    body: options.body,
    headers: options.headers,
    params: options.params,
  });
  const res = makeRes();

  // Walk the router stack and invoke matching layer(s)
  const layers = (
    router as unknown as {
      stack: Array<{
        route?: {
          path: string;
          methods: Record<string, boolean>;
          stack: Array<{ handle: (req: unknown, res: unknown, next: () => void) => void }>;
        };
      }>;
    }
  ).stack;

  for (const layer of layers) {
    if (!layer.route) continue;
    const routePath = layer.route.path as string;
    const methods = layer.route.methods as Record<string, boolean>;

    if (!methods[method.toLowerCase()]) continue;

    // Simple path matching (supports :param)
    const paramNames: string[] = [];
    const regexStr = routePath.replace(/:(\w+)/g, (_: string, name: string) => {
      paramNames.push(name);
      return "([^/]+)";
    });
    const match = path.match(new RegExp(`^${regexStr}$`));
    if (!match) continue;

    // Populate params
    const params: Record<string, string> = {};
    paramNames.forEach((name, i) => {
      params[name] = match[i + 1]!;
    });
    (req as Record<string, unknown>)["params"] = params;

    // Run middleware chain
    const handlers = layer.route.stack.map((s) => s.handle);
    let i = 0;
    const next = async (): Promise<void> => {
      const handler = handlers[i++];
      if (handler) {
        await handler(req, res, next as () => void);
      }
    };
    await next();
    break;
  }

  return res;
}

describe("sessions router", () => {
  beforeEach(() => {
    vi.mocked(authDm.verifyDmToken).mockResolvedValue({
      role: "dm",
      tokenType: "dm",
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    getRoomsMap().clear();
  });

  describe("POST /", () => {
    it("crea sesión y retorna accessToken + sessionUrl", async () => {
      const router = buildSessionsRouter();
      const res = await callRoute(router, "POST", "/", {
        headers: { authorization: "Bearer valid-token" },
        body: { name: "Campaña de prueba" },
      });

      expect(res.statusCode).toBe(201);
      const body = res.body as {
        sessionId: string;
        name: string;
        accessToken: string;
        sessionUrl: string;
      };
      expect(body.sessionId).toBeTruthy();
      expect(body.name).toBe("Campaña de prueba");
      expect(body.accessToken).toBeTruthy();
      expect(body.sessionUrl).toMatch(/^\/play\//);
    });

    it("devuelve 401 sin token DM", async () => {
      vi.mocked(authDm.verifyDmToken).mockResolvedValue(null);
      const router = buildSessionsRouter();
      const res = await callRoute(router, "POST", "/", {
        body: { name: "Test" },
      });

      expect(res.statusCode).toBe(401);
      expect((res.body as { code: string }).code).toBe("UNAUTHORIZED");
    });

    it("devuelve 400 con nombre vacío", async () => {
      const router = buildSessionsRouter();
      const res = await callRoute(router, "POST", "/", {
        headers: { authorization: "Bearer tok" },
        body: { name: "" },
      });

      expect(res.statusCode).toBe(400);
      expect((res.body as { code: string }).code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /", () => {
    it("lista las sesiones creadas", async () => {
      const router = buildSessionsRouter();

      // Crear una sesión primero
      await callRoute(router, "POST", "/", {
        headers: { authorization: "Bearer tok" },
        body: { name: "Sesión 1" },
      });

      const res = await callRoute(router, "GET", "/", {
        headers: { authorization: "Bearer tok" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.body as { sessions: Array<{ name: string; sessionUrl: string }> };
      expect(Array.isArray(body.sessions)).toBe(true);
      expect(body.sessions.length).toBeGreaterThan(0);
      expect(body.sessions[0]!.name).toBe("Sesión 1");
      expect(body.sessions[0]!.sessionUrl).toContain("__redacted__");
    });

    it("devuelve 401 sin token DM", async () => {
      vi.mocked(authDm.verifyDmToken).mockResolvedValue(null);
      const router = buildSessionsRouter();
      const res = await callRoute(router, "GET", "/", {});

      expect(res.statusCode).toBe(401);
    });
  });

  describe("DELETE /:sessionId", () => {
    it("elimina una sesión existente", async () => {
      const router = buildSessionsRouter();

      const createRes = await callRoute(router, "POST", "/", {
        headers: { authorization: "Bearer tok" },
        body: { name: "Sesión a borrar" },
      });
      const { sessionId } = createRes.body as { sessionId: string };

      const deleteRes = await callRoute(router, "DELETE", `/${sessionId}`, {
        headers: { authorization: "Bearer tok" },
      });

      expect(deleteRes.statusCode).toBe(200);
      expect((deleteRes.body as { ok: boolean }).ok).toBe(true);
      expect(getRoom(sessionId)).toBeUndefined();
    });

    it("devuelve 404 para sesión inexistente", async () => {
      const router = buildSessionsRouter();
      const res = await callRoute(router, "DELETE", "/no-existe-abc", {
        headers: { authorization: "Bearer tok" },
      });

      expect(res.statusCode).toBe(404);
      expect((res.body as { code: string }).code).toBe("NOT_FOUND");
    });

    it("devuelve 401 sin token DM", async () => {
      vi.mocked(authDm.verifyDmToken).mockResolvedValue(null);
      const router = buildSessionsRouter();
      const res = await callRoute(router, "DELETE", "/some-id", {});

      expect(res.statusCode).toBe(401);
    });
  });
});
