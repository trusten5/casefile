import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { safeRedirectPath } from "@/lib/safeRedirect";

// redirect_url is the same param the feed's save/apply actions attach when
// bouncing an anonymous visitor here — reuse it for the close button so
// declining to sign up lands back on whatever they were browsing, not a
// dead end with only the Clerk widget and the browser back button.
export default async function SignUpPage(props: PageProps<"/sign-up/[[...sign-up]]">) {
  const searchParams = await props.searchParams;
  const backHref = safeRedirectPath(searchParams.redirect_url, "/");

  // Clerk honors a `redirect_url` query param over fallbackRedirectUrl, so
  // every bounce-from-save/apply signup (the common case) would skip
  // /onboarding entirely and land back on /feed etc. forceRedirectUrl always
  // wins instead — /onboarding reads this same param back out to still land
  // the user where they started once they finish (or skip) the form.
  const postOnboarding = safeRedirectPath(searchParams.redirect_url, "/dashboard");

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-4 py-16">
      <Link
        href={backHref}
        aria-label="Close"
        className="absolute right-6 top-6 text-2xl leading-none text-ink-soft hover:text-ink"
      >
        ×
      </Link>
      <SignUp forceRedirectUrl={`/onboarding?redirect_url=${encodeURIComponent(postOnboarding)}`} />
      <p className="text-xs text-ink-soft">
        By signing up, you agree to the{" "}
        <Link href="/terms" className="underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline">
          Privacy
        </Link>{" "}
        pages.
      </p>
    </div>
  );
}
