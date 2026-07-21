// tests/streak.test.ts
import { describe, expect, it } from "vitest";
import { computeStreak, localDateKey } from "@/lib/streak";

const DAY = 24 * 60 * 60 * 1000;
const today = new Date("2026-07-21T12:00:00");
const daysAgo = (n: number) => new Date(today.getTime() - n * DAY);

describe("computeStreak", () => {
  it("counts consecutive days meeting the goal, ending today", () => {
    const counts = {
      [localDateKey(today)]: 2,
      [localDateKey(daysAgo(1))]: 3,
      [localDateKey(daysAgo(2))]: 1,
    };
    expect(computeStreak(counts, 1, today)).toBe(3);
  });

  it("doesn't break the streak if today hasn't hit the goal yet", () => {
    const counts = {
      [localDateKey(daysAgo(1))]: 1,
      [localDateKey(daysAgo(2))]: 1,
    };
    expect(computeStreak(counts, 1, today)).toBe(2);
  });

  it("resets at the first missed day", () => {
    const counts = {
      [localDateKey(today)]: 1,
      [localDateKey(daysAgo(1))]: 1,
      [localDateKey(daysAgo(2))]: 0,
      [localDateKey(daysAgo(3))]: 1,
    };
    expect(computeStreak(counts, 1, today)).toBe(2);
  });

  it("returns 0 with no qualifying days", () => {
    expect(computeStreak({}, 1, today)).toBe(0);
  });
});
