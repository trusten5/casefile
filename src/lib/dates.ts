const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatPostedDate(iso: string): string {
  const date = new Date(iso);
  const diffDays = Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (Math.abs(diffDays) < 30) return RELATIVE_FORMATTER.format(diffDays, "day");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
