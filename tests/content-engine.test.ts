// tests/content-engine.test.ts
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local in this environment — tests that need it will fail below
}

import { describe, expect, it } from "vitest";
import { getContentStats } from "../scripts/content-engine/stats";
import { renderSlide } from "../scripts/content-engine/renderSlides";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

describe("getContentStats", () => {
  it("returns real, non-null numbers from the current DB", async () => {
    const stats = await getContentStats();

    expect(typeof stats.totalActivePostings).toBe("number");
    expect(stats.totalActivePostings).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(stats.postingsBySource)).toBe(true);
    expect(typeof stats.postingsLast7Days).toBe("number");
    expect(typeof stats.busiestDayOfWeek).toBe("string");
    expect(stats.busiestDayOfWeek.length).toBeGreaterThan(0);
  });
});

describe("renderSlide", () => {
  it("produces a valid PNG even with no local assets", async () => {
    const png = await renderSlide({
      text: "test slide",
      assetType: "backgrounds",
      slideIndex: 0,
      slideCount: 1,
    });

    const bytes = new Uint8Array(png).slice(0, 4);
    expect(Array.from(bytes)).toEqual(PNG_MAGIC);
  });
});
