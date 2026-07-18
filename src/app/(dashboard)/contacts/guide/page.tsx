import Link from "next/link";
import { NetworkingGuidance } from "../NetworkingGuidance";

export default function ContactsGuidePage() {
  return (
    <div>
      <Link href="/contacts" className="text-sm font-medium text-ink-soft hover:text-ink">
        ← Back to contacts
      </Link>
      <h1 className="mt-2 font-display text-2xl font-semibold text-ink">Networking guide</h1>
      <p className="mt-1 text-sm text-ink-soft">
        A few tips on getting started, and email templates for the most common situations.
      </p>

      <div className="mt-8">
        <NetworkingGuidance />
      </div>
    </div>
  );
}
