import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

describe("rate limiting", () => {
  it("blocks requests after the configured limit within one window", () => {
    const bucket = new Map<string, number[]>();
    expect(
      checkRateLimit({
        key: "client-a",
        limit: 2,
        windowMs: 60_000,
        now: 1000,
        bucket,
      }).allowed,
    ).toBe(true);
    expect(
      checkRateLimit({
        key: "client-a",
        limit: 2,
        windowMs: 60_000,
        now: 2000,
        bucket,
      }).allowed,
    ).toBe(true);
    expect(
      checkRateLimit({
        key: "client-a",
        limit: 2,
        windowMs: 60_000,
        now: 3000,
        bucket,
      }).allowed,
    ).toBe(false);
  });
});
