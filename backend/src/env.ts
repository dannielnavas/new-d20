import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";
import { z } from "zod";

function findEnvFile(): string | null {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", ".env"),
    resolve(process.cwd(), "..", "..", ".env"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

const envFile = findEnvFile();
if (envFile) {
  loadDotenv({ path: envFile });
} else {
  loadDotenv();
}

const envSchema = z.object({
  PORT: z.coerce.number().positive().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  SOCKET_IO_PATH: z.string().default("/socketio"),
  CLIENT_ORIGIN: z.string().optional(),
  JWT_SECRET: z.string().min(1, "JWT_SECRET es requerido"),
  DM_SECRET: z.string().min(1, "DM_SECRET es requerido"),
  REDIS_URL: z.string().url().optional(),
  REDIS_SESSION_TTL: z.coerce.number().positive().default(86400),
  PERSISTENCE_PATH: z.string().default("./data/rooms.json"),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_REDIRECT_URI: z.string().url().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_UPLOAD_FOLDER: z.string().default("d20-uploads"),
  AUTOMATION_ENABLED: z.coerce.boolean().default(false),
  AUTOMATION_TOKEN: z.string().optional(),
  AUTOMATION_LOCAL_ONLY: z.coerce.boolean().default(true),
});

type EnvSchema = z.infer<typeof envSchema>;

let _ENV: EnvSchema | null = null;

function validateEnv(): EnvSchema {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
    if (isTest) {
      return envSchema.parse({
        JWT_SECRET: "test-jwt-secret",
        DM_SECRET: "test-dm-secret",
      });
    }

    const messages = result.error.issues.map(
      (issue) => `  ${issue.path.join(".")}: ${issue.message}`,
    );
    console.error(`Variables de entorno inválidas:\n${messages.join("\n")}`);
    process.exit(1);
  }

  return result.data;
}

export function getEnv(): EnvSchema {
  if (!_ENV) {
    _ENV = validateEnv();
  }
  return _ENV;
}

export const ENV: EnvSchema = new Proxy({} as EnvSchema, {
  get(_target, prop: string | symbol) {
    return getEnv()[prop as keyof EnvSchema];
  },
});
