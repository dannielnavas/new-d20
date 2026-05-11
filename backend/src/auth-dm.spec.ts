import { afterEach, describe, expect, it, vi } from "vitest";

import { signDmToken, verifyDmToken } from "./auth-dm.js";

describe("auth-dm", () => {
  const originalEnv = {
    DM_SECRET: process.env.DM_SECRET,
    JWT_SECRET: process.env.JWT_SECRET,
  };

  afterEach(() => {
    process.env.DM_SECRET = originalEnv.DM_SECRET;
    process.env.JWT_SECRET = originalEnv.JWT_SECRET;
    vi.restoreAllMocks();
  });

  it("firma y valida token DM con claims esperados", async () => {
    process.env.DM_SECRET = "secret_dm_de_prueba_123456789";
    process.env.JWT_SECRET = "secret_jwt_de_prueba_123456789";

    const token = await signDmToken();
    const payload = await verifyDmToken(token);

    expect(payload).toBeTruthy();
    expect(payload?.role).toBe("dm");
    expect(payload?.tokenType).toBe("dm");
  });

  it("rechaza token DM cuando se verifica con secreto distinto", async () => {
    process.env.DM_SECRET = "secret_dm_1";
    process.env.JWT_SECRET = "secret_jwt_1";

    const token = await signDmToken();

    process.env.DM_SECRET = "secret_dm_2";
    process.env.JWT_SECRET = "secret_jwt_2";

    const payload = await verifyDmToken(token);
    expect(payload).toBeNull();
  });
});
