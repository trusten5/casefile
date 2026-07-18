"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-2xl font-semibold text-ink">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink-soft">
        That&apos;s on us, not you. Try again, or head back home.
      </p>
      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper"
        >
          Try again
        </button>
        <Link href="/" className="text-sm font-medium text-ink-soft hover:text-ink">
          Go home
        </Link>
      </div>
    </div>
  );
}
