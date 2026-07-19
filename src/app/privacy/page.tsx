import Link from "next/link";

export const metadata = { title: "Privacy — Casefile" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm font-medium text-ink-soft hover:text-ink">
        ← Back to Casefile
      </Link>
      <h1 className="mt-6 font-display text-3xl font-semibold text-ink">Privacy</h1>
      <p className="mt-2 text-sm text-ink-soft">Last updated July 19, 2026.</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-soft">
        <section>
          <h2 className="font-display text-lg font-semibold text-ink">What we collect</h2>
          <p className="mt-2">
            Your account info (name, email) via Clerk, the authentication
            provider. Application and networking data you enter or save
            yourself — job postings, application statuses, notes, contacts
            you log (name, company, LinkedIn, how you met), resume/cover
            letter links you provide, and saved search preferences.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Why</h2>
          <p className="mt-2">
            Solely to run the feed, tracker, and networking features you use.
            Nothing here is used for advertising, and nothing is sold to
            third parties.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Where it&apos;s stored</h2>
          <p className="mt-2">
            Account/auth data lives with Clerk. Everything else lives in a
            Supabase (Postgres) database. Both are processors used to run
            the app, not separate parties we share your data with beyond
            what&apos;s needed to operate it.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Forwarded emails</h2>
          <p className="mt-2">
            Casefile does not currently read or process forwarded emails —
            that feature isn&apos;t live yet. This page will be updated with
            exactly what would be stored before that feature ships.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Your data</h2>
          <p className="mt-2">
            Email{" "}
            <a href="mailto:hq@casefile.site" className="underline">
              hq@casefile.site
            </a>{" "}
            to request an export or deletion of your data.
          </p>
        </section>
      </div>
    </div>
  );
}
