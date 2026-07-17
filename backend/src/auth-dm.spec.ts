import { jwtVerify, SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";

import { signDmToken, verifyDmToken } from "./auth-dm.js";

function makeKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

async function signTokenWithSecret(secret: string): Promise<string> {
  return new SignJWT({ role: "dm", tokenType: "dm" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("d20-vtt")
    .setAudience("d20-dm")
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(makeKey(secret));
}

describe("auth-dm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("firma y valida token DM con claims esperados", async () => {
    const token = await signDmToken();
    const payload = await verifyDmToken(token);

    expect(payload).toBeTruthy();
    expect(payload?.role).toBe("dm");
    expect(payload?.tokenType).toBe("dm");
  });

  it("rechaza token DM cuando se verifica con secreto distinto", async () => {
    const token = await signTokenWithSecret("secret_1");

    const payload = await jwtVerify(token, makeKey("secret_2"), {
      issuer: "d20-vtt",
      audience: "d20-dm",
    }).catch(() => null);

    expect(payload).toBeNull();
  });
});
