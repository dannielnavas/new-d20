import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRateLimiter } from "./rate-limit.js";

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("permite llamadas dentro del límite", () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 1000 });
    expect(limiter("key-1")).toBe(true);
    expect(limiter("key-1")).toBe(true);
    expect(limiter("key-1")).toBe(true);
  });

  it("bloquea cuando excede el límite", () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 1000 });
    expect(limiter("key-2")).toBe(true);
    expect(limiter("key-2")).toBe(true);
    expect(limiter("key-2")).toBe(false);
  });

  it("reinicia el contador después de la ventana de tiempo", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 500 });
    expect(limiter("key-3")).toBe(true);
    expect(limiter("key-3")).toBe(false);

    vi.advanceTimersByTime(501);
    expect(limiter("key-3")).toBe(true);
  });

  it("maneja claves independientes", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(limiter("key-a")).toBe(true);
    expect(limiter("key-b")).toBe(true);
    expect(limiter("key-a")).toBe(false);
    expect(limiter("key-b")).toBe(false);
  });
});
