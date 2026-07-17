import { describe, expect, it, vi, afterEach } from "vitest";

import { getAllowedOrigins, isOriginAllowed, buildCorsOptions } from "./cors-config.js";

describe("cors-config", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isOriginAllowed", () => {
    it("permite localhost en desarrollo", () => {
      expect(isOriginAllowed("http://localhost:4200")).toBe(true);
    });

    it("permite el dominio de Vercel configurado", () => {
      expect(isOriginAllowed("https://d20-new.vercel.app")).toBe(true);
    });

    it("permite subdominios wildcard de vercel.app", () => {
      expect(isOriginAllowed("https://mi-proyecto.vercel.app")).toBe(true);
    });

    it("permite orígenes de Discord", () => {
      expect(isOriginAllowed("https://discord.com")).toBe(true);
      expect(isOriginAllowed("https://ptb.discord.com")).toBe(true);
      expect(isOriginAllowed("https://canary.discord.com")).toBe(true);
    });

    it("permite subdominios de discordsays.com", () => {
      expect(isOriginAllowed("https://1234567890.discordsays.com")).toBe(true);
    });

    it("rechaza origen desconocido", () => {
      expect(isOriginAllowed("https://evil.example.com")).toBe(false);
    });

    it("rechaza http externo (no localhost)", () => {
      expect(isOriginAllowed("http://example.com")).toBe(false);
    });

    it("rechaza el origen 'null' (riesgo de exfiltración)", () => {
      expect(isOriginAllowed("null")).toBe(false);
    });
  });

  describe("getAllowedOrigins", () => {
    it("retorna la lista por defecto cuando no hay CLIENT_ORIGIN en env", () => {
      const origins = getAllowedOrigins();
      expect(origins).toContain("http://localhost:4200");
      expect(origins).toContain("https://discord.com");
    });
  });

  describe("buildCorsOptions", () => {
    it("permite orígenes válidos a través del callback", () => {
      const options = buildCorsOptions();
      const fn = options.origin as (
        origin: string | undefined,
        cb: (err: Error | null, allow?: boolean) => void,
      ) => void;

      let result: boolean | undefined;
      fn("http://localhost:4200", (err, allow) => {
        result = allow;
      });
      expect(result).toBe(true);
    });

    it("permite solicitudes sin origen (e.g. Postman / server-to-server)", () => {
      const options = buildCorsOptions();
      const fn = options.origin as (
        origin: string | undefined,
        cb: (err: Error | null, allow?: boolean) => void,
      ) => void;

      let result: boolean | undefined;
      fn(undefined, (err, allow) => {
        result = allow;
      });
      expect(result).toBe(true);
    });

    it("rechaza orígenes no permitidos con un error", () => {
      const options = buildCorsOptions();
      const fn = options.origin as (
        origin: string | undefined,
        cb: (err: Error | null, allow?: boolean) => void,
      ) => void;

      let error: Error | null = null;
      fn("https://evil.example.com", (err) => {
        error = err;
      });
      expect(error).toBeInstanceOf(Error);
    });
  });
});
