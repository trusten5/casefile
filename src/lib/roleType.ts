export const ROLE_TYPE_LABELS: Record<string, string> = {
  internship: "Internship",
  new_grad: "New grad",
  full_time: "Full-time",
};

// Reuses the app's status-color tokens (globals.css) instead of introducing
// a new palette just for this stamp. Bordered, not filled — a stamped
// label, not a soft SaaS pill.
export const ROLE_TYPE_STYLES: Record<string, string> = {
  internship: "border-status-interview text-status-interview",
  new_grad: "border-status-applied text-status-applied",
  full_time: "border-status-ghosted text-status-ghosted",
};
