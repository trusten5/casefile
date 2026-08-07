import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { CloseIcon } from "@/components/icons";

// redirect_url is the same param the feed's save/apply actions attach when
// bouncing an anonymous visitor here — reuse it for the close button so
// declining to sign up lands back on whatever they were browsing, not a
// dead end with only the Clerk widget and the browser back button.
export default async function SignUpPage(props: PageProps<"/sign-up/[[...sign-up]]">) {
  const searchParams = await props.searchParams;
  const backHref = typeof searchParams.redirect_url === "string" ? searchParams.redirect_url : "/";

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-4 py-16">
      <Link
        href={backHref}
        aria-label="Close"
        className="absolute right-6 top-6 text-ink-soft hover:text-ink"
      >
        <CloseIcon className="h-5 w-5" />
      </Link>
      <SignUp />
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
