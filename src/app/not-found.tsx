import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-sm text-ink-soft">
        That page doesn&apos;t exist — check the link, or head back home.
      </p>
      <Link
        href="/"
        className="mt-6 rounded bg-cobalt px-5 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-ink"
      >
        Go home
      </Link>
    </div>
  );
}
