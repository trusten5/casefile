"use client";

import { useState } from "react";
import Link from "next/link";
import { localDateKey } from "@/lib/streak";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Not full history, just this month — a lightweight hover extra on top of
// the streak tile, not a standalone dashboard feature.
export function StreakTile({
  streak,
  todayCount,
  dailyGoal,
  countsByDay,
}: {
  streak: number;
  todayCount: number;
  dailyGoal: number;
  countsByDay: Record<string, number>;
}) {
  const [hovered, setHovered] = useState(false);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const monthLabel = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const cells: ({ day: number; key: string; count: number } | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const key = localDateKey(new Date(year, month, day));
    cells.push({ day, key, count: countsByDay[key] ?? 0 });
  }

  function cellClass(count: number) {
    if (count >= dailyGoal) return "bg-status-offer";
    if (count > 0) return "bg-status-oa";
    return "bg-paper-line";
  }

  return (
    <div
      className="relative rounded border border-paper-line bg-tab/30 px-4 py-3"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Streak</p>
      <p className="font-display text-xl font-semibold text-ink">
        {streak} day{streak === 1 ? "" : "s"}
      </p>
      <p className="mt-1 text-xs text-ink-soft">
        Today: {todayCount} / {dailyGoal} applied
      </p>

      {hovered && (
        <div className="stamp-pop absolute left-0 top-full z-20 mt-2 w-60 p-3">
          <p className="mb-2 text-xs font-medium text-ink">{monthLabel}</p>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label, i) => (
              <span key={i} className="text-center font-mono text-[10px] text-ink-soft">
                {label}
              </span>
            ))}
            {cells.map((cell, i) =>
              cell ? (
                <div
                  key={cell.key}
                  title={`${cell.key}: ${cell.count} applied`}
                  className={`aspect-square rounded ${cellClass(cell.count)}`}
                />
              ) : (
                <div key={`empty-${i}`} />
              )
            )}
          </div>
          <div className="mt-2 flex flex-col gap-1 text-[10px] text-ink-soft">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded bg-status-offer" /> Met or beat goal
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded bg-status-oa" /> Applied, under goal
            </span>
            <span>
              * <Link href="/profile" className="underline hover:text-ink">set goal in profile</Link>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
