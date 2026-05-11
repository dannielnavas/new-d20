import { CorsOptions } from "cors";

function splitOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function getAllowedOrigins(): string[] {
  const envOrigins = process.env.CLIENT_ORIGIN;
  if (!envOrigins) {
    return ["http://localhost:4200"];
  }
  return splitOrigins(envOrigins);
}

export function buildCorsOptions(): CorsOptions {
  const allowedOrigins = getAllowedOrigins();

  return {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origen no permitido por CORS"));
    },
    credentials: true,
  };
}
