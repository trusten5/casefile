// tests/cronAuth.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isValidCronRequest } from "@/lib/cronAuth";

describe("isValidCronRequest", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret-value";
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("accepts the correct bearer token", () => {
    const request = new Request("http://localhost", {
      headers: { authorization: "Bearer test-secret-value" },
    });
    expect(isValidCronRequest(request)).toBe(true);
  });

  it("rejects an incorrect token", () => {
    const request = new Request("http://localhost", {
      headers: { authorization: "Bearer wrong-value" },
    });
    expect(isValidCronRequest(request)).toBe(false);
  });

  it("rejects a missing header", () => {
    const request = new Request("http://localhost");
    expect(isValidCronRequest(request)).toBe(false);
  });
});
