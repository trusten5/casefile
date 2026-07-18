export const ROLE_TYPE_LABELS: Record<string, string> = {
  internship: "Internship",
  new_grad: "New grad",
  full_time: "Full-time",
};

// Reuses the app's status-color tokens (globals.css) instead of introducing
// a new palette just for this pill.
export const ROLE_TYPE_STYLES: Record<string, string> = {
  internship: "bg-status-interview/15 text-status-interview",
  new_grad: "bg-status-applied/15 text-status-applied",
  full_time: "bg-status-ghosted/15 text-status-ghosted",
};
