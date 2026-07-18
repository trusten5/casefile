// Server actions redirect back with ?flash=<message> so a click has visible
// confirmation ("Application added") without needing client-side state —
// the redirect's fresh render is the feedback.
export function Flash({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="mb-6 rounded-md border border-status-offer bg-status-offer/10 px-4 py-2 text-sm font-medium text-status-offer">
      {message}
    </div>
  );
}
