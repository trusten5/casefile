// Weekly digests fire on a fixed day (Monday) rather than each user's
// signup-anniversary day — keeps the due-check a pure function of "today"
// instead of per-user state.
export function isDigestDue(cadence: "daily" | "weekly", isMonday: boolean): boolean {
  return cadence === "daily" || (cadence === "weekly" && isMonday);
}
