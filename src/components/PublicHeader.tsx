import Link from "next/link";

// Shared by the landing page and the (dashboard) layout's signed-out branch
// so /feed and /companies (public, no account needed) show this instead of
// the full dashboard nav — anonymous visitors shouldn't see Dashboard,
// Applications, Contacts, or Profile links they can't actually use.
export function PublicHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
      <Link href="/" className="font-display text-lg font-semibold text-ink">
        Casefile
      </Link>
      <div className="flex items-center gap-5">
        <Link href="/sign-in" className="text-sm font-medium text-ink-soft hover:text-ink">
          Sign in
        </Link>
        <Link
          href="/sign-up"
          className="rounded border border-cobalt px-4 py-1.5 text-sm font-medium text-cobalt transition-colors hover:bg-cobalt hover:text-paper"
        >
          Sign up free
        </Link>
      </div>
    </header>
  );
}
