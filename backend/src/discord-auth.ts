import { Router } from "express";
import { z } from "zod";

import { ENV } from "./env.js";

const authBodySchema = z.object({
  code: z.string().min(1),
});

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export function buildDiscordAuthRouter(): Router {
  const router = Router();

  router.post("/", async (req, res) => {
    const parsed = authBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ code: "VALIDATION_ERROR", message: "Body inválido" });
      return;
    }

    const clientId = ENV.DISCORD_CLIENT_ID;
    const clientSecret = ENV.DISCORD_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      res
        .status(503)
        .json({ code: "DISCORD_NOT_CONFIGURED", message: "Discord OAuth2 no está configurado" });
      return;
    }

    const form = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code: parsed.data.code,
    });

    const redirectUri = ENV.DISCORD_REDIRECT_URI;
    if (redirectUri) {
      form.set("redirect_uri", redirectUri);
    }

    try {
      const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: form,
      });

      if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.text();
        res.status(502).json({
          code: "DISCORD_TOKEN_EXCHANGE_FAILED",
          message: "No se pudo intercambiar código OAuth2",
          details: errorBody,
        });
        return;
      }

      const tokenData = (await tokenResponse.json()) as DiscordTokenResponse;

      const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
        headers: {
          authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      const user = userResponse.ok ? await userResponse.json() : null;

      res.json({
        access_token: tokenData.access_token,
        user,
      });
    } catch (error: unknown) {
      res.status(502).json({
        code: "DISCORD_AUTH_ERROR",
        message: "Error en autenticación con Discord",
        error,
      });
    }
  });

  return router;
}
