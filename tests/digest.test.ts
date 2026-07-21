// tests/digest.test.ts
import { describe, expect, it } from "vitest";
import { isDigestDue } from "@/lib/digest";

describe("isDigestDue", () => {
  it("daily is always due", () => {
    expect(isDigestDue("daily", false)).toBe(true);
    expect(isDigestDue("daily", true)).toBe(true);
  });

  it("weekly is due only on Monday", () => {
    expect(isDigestDue("weekly", true)).toBe(true);
    expect(isDigestDue("weekly", false)).toBe(false);
  });
});
