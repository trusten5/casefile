import { NETWORKING_TIPS, EMAIL_TEMPLATES } from "./networkingContent";

// Plain content — no collapse behavior of its own. Rendered standalone on
// its own page (contacts/guide) rather than inline, so returning contacts
// don't have to scroll past it every time.
export function NetworkingGuidance() {
  return (
    <div>
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Getting started</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-soft">
          {NETWORKING_TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Email templates</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {EMAIL_TEMPLATES.map((t) => (
            <div key={t.id} className="rounded-lg border border-paper-line bg-paper p-4">
              <p className="font-medium text-ink">{t.label}</p>
              <p className="mt-1 text-xs text-ink-soft">Subject: {t.subject}</p>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ink-soft">{t.body}</pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
