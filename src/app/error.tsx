"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // No APM wired up yet — this at least lands the stack trace in Vercel's
  // function logs instead of vanishing once the boundary renders.
  useEffect(() => {
    console.error(error);
  }, [error]);

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
          className="rounded bg-ink px-5 py-2.5 text-sm font-semibold text-paper"
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
