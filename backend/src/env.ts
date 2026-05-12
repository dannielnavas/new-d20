import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";

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
