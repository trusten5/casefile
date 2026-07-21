// Formats a Date as a local (server-timezone) YYYY-MM-DD key. Matches the
// local-midnight convention the dashboard's existing "Today" tile already
// uses (see startOfTodayISO() in dashboard/page.tsx) so streak days line up
// with what "today" means there.
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Consecutive-day streak of days where applications >= dailyGoal, walking
// backwards from today. If today hasn't hit the goal yet, today is simply
// skipped (not counted, but doesn't break the streak) so a streak in
// progress doesn't zero out mid-day before the user's had a chance to apply.
export function computeStreak(
  countsByDay: Record<string, number>,
  dailyGoal: number,
  today: Date = new Date()
): number {
  const cursor = new Date(today);
  if ((countsByDay[localDateKey(cursor)] ?? 0) < dailyGoal) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while ((countsByDay[localDateKey(cursor)] ?? 0) >= dailyGoal) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
