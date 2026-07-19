import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

// redirect_url is the same param the feed's save/apply actions attach when
// bouncing an anonymous visitor here — reuse it for the close button so
// declining to sign in lands back on whatever they were browsing, not a
// dead end with only the Clerk widget and the browser back button.
export default async function SignInPage(props: PageProps<"/sign-in/[[...sign-in]]">) {
  const searchParams = await props.searchParams;
  const backHref = typeof searchParams.redirect_url === "string" ? searchParams.redirect_url : "/";

  return (
    <div className="relative flex flex-1 items-center justify-center py-16">
      <Link
        href={backHref}
        aria-label="Close"
        className="absolute right-6 top-6 text-2xl leading-none text-ink-soft hover:text-ink"
      >
        ×
      </Link>
      <SignIn />
    </div>
  );
}
