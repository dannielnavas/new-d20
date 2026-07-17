import { Router } from "express";
import { JWTPayload, jwtVerify, SignJWT } from "jose";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { ENV } from "./env.js";
import { createRateLimiter } from "./rate-limit.js";

const dmAuthBodySchema = z.object({
  dmKey: z.string().min(1),
});

const DM_TOKEN_EXPIRATION = "12h";
const DM_ISSUER = "d20-vtt";
const DM_AUDIENCE = "d20-dm";

function getDmSecret(): string {
  const secret = ENV.JWT_SECRET || ENV.DM_SECRET;
  if (!secret) {
    throw new Error("DM_SECRET o JWT_SECRET es requerido para autenticar DM");
  }
  return secret;
}

function getSigningKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signDmToken(): Promise<string> {
  const secret = getDmSecret();
  const key = getSigningKey(secret);

  return new SignJWT({ role: "dm", tokenType: "dm" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(DM_ISSUER)
    .setAudience(DM_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(DM_TOKEN_EXPIRATION)
    .sign(key);
}

export async function verifyDmToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = getDmSecret();
    const key = getSigningKey(secret);
    const result = await jwtVerify(token, key, {
      issuer: DM_ISSUER,
      audience: DM_AUDIENCE,
    });

    if (result.payload.role !== "dm" || result.payload.tokenType !== "dm") {
      return null;
    }

    return result.payload;
  } catch {
    return null;
  }
}

function safeDmKeyEquals(inputDmKey: string, configuredDmSecret: string): boolean {
  const inputHash = createHash("sha256").update(inputDmKey).digest();
  const secretHash = createHash("sha256").update(configuredDmSecret).digest();

  if (inputHash.length !== secretHash.length) {
    return false;
  }

  return timingSafeEqual(inputHash, secretHash);
}

const authRateLimiter = createRateLimiter({ max: 10, windowMs: 60_000 });

export function buildDmAuthRouter(): Router {
  const router = Router();

  router.post(
    "/",
    (req, res, next) => {
      const key = req.ip ?? "unknown";
      if (!authRateLimiter(key)) {
        res
          .status(429)
          .json({ code: "RATE_LIMITED", message: "Demasiados intentos. Espera un minuto." });
        return;
      }
      next();
    },
    async (req, res) => {
      const parsed = dmAuthBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ code: "VALIDATION_ERROR", message: "Body inválido" });
        return;
      }

      const dmSecret = ENV.DM_SECRET;
      if (!dmSecret) {
        res.status(500).json({ code: "CONFIG_ERROR", message: "DM_SECRET no está configurado" });
        return;
      }

      if (!safeDmKeyEquals(parsed.data.dmKey, dmSecret)) {
        res.status(401).json({ code: "INVALID_DM_KEY", message: "Credenciales inválidas" });
        return;
      }

      try {
        const token = await signDmToken();
        res.json({ token, expiresIn: DM_TOKEN_EXPIRATION });
      } catch {
        res.status(500).json({ code: "TOKEN_ISSUE_ERROR", message: "No se pudo emitir token" });
      }
    },
  );

  return router;
}
