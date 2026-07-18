import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
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
