import Link from "next/link";

export const metadata = { title: "Terms — Casefile" };

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm font-medium text-ink-soft hover:text-ink">
        ← Back to Casefile
      </Link>
      <h1 className="mt-6 font-display text-3xl font-semibold text-ink">Terms</h1>
      <p className="mt-2 text-sm text-ink-soft">Last updated July 19, 2026.</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-soft">
        <section>
          <p>
            Casefile is a free, independently-run tool for tracking
            internship and job applications. It&apos;s provided as-is, with
            no warranty of any kind.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Job posting data</h2>
          <p className="mt-2">
            The feed aggregates postings from public company career pages
            and a community-maintained list. We don&apos;t guarantee
            accuracy, availability, or that a posting is still open —
            always confirm on the company&apos;s own site before applying.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Your responsibility</h2>
          <p className="mt-2">
            Casefile doesn&apos;t submit applications on your behalf — it
            tracks what you tell it. You&apos;re responsible for the
            accuracy of what you log.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Changes</h2>
          <p className="mt-2">
            The service may change or be discontinued at any time. See our{" "}
            <Link href="/privacy" className="underline">
              privacy page
            </Link>{" "}
            for how your data is handled if that happens.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Contact</h2>
          <p className="mt-2">
            Questions:{" "}
            <a href="mailto:hq@casefile.site" className="underline">
              hq@casefile.site
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
