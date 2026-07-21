import { redirect } from "next/navigation";

// Pricing now lives as a section on /profile instead of its own page —
// kept as a redirect (not deleted) in case anything still links here.
export default function PricingPage() {
  redirect("/profile");
}
