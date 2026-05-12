import { CorsOptions } from "cors";

function splitOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function matchOrigin(origin: string, allowedOrigin: string): boolean {
  const normalizedOrigin = normalizeOrigin(origin);
  const normalizedAllowedOrigin = normalizeOrigin(allowedOrigin);

  if (!normalizedAllowedOrigin.includes("*")) {
    return normalizedOrigin === normalizedAllowedOrigin;
  }

  try {
    const originUrl = new URL(normalizedOrigin);
    const allowedUrl = new URL(normalizedAllowedOrigin.replace("*.", ""));

    if (originUrl.protocol !== allowedUrl.protocol) {
      return false;
    }

    const wildcardHost = `.${allowedUrl.hostname}`;
    return originUrl.hostname === allowedUrl.hostname || originUrl.hostname.endsWith(wildcardHost);
  } catch {
    return false;
  }
}

export function getAllowedOrigins(): string[] {
  const envOrigins = process.env.CLIENT_ORIGIN;
  if (!envOrigins) {
    return [
      "http://localhost:4200",
      "https://d20-new.vercel.app",
      "https://discord.com",
      "https://ptb.discord.com",
      "https://canary.discord.com",
      "https://*.discordsays.com",
    ];
  }
  return splitOrigins(envOrigins);
}

export function isOriginAllowed(origin: string): boolean {
  if (origin === "null") {
    return true;
  }

  return getAllowedOrigins().some((allowedOrigin) => matchOrigin(origin, allowedOrigin));
}

export function buildCorsOptions(): CorsOptions {
  return {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origen no permitido por CORS"));
    },
    credentials: true,
  };
}
