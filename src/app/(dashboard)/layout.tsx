import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { PublicHeader } from "@/components/PublicHeader";

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/feed", label: "Feed" },
  { href: "/companies", label: "Companies" },
  { href: "/applications", label: "Applications" },
  { href: "/contacts", label: "Contacts" },
  { href: "/profile", label: "Profile" },
];

// /feed and /companies (the only routes under this layout that render for
// signed-out visitors — everything else is gated in proxy.ts) get this
// instead: no Dashboard/Applications/Contacts/Profile links, since an
// anonymous visitor can't use any of them.
const PUBLIC_NAV_LINKS = [
  { href: "/feed", label: "Feed" },
  { href: "/companies", label: "Companies" },
];

// Account identity/sign-out (Clerk's UserButton) lives inside /profile now,
// not the header — a single entry point for everything account- and
// preference-related, instead of two separate ones.
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { userId } = await auth();

  if (!userId) {
    return (
      <div className="flex flex-1 flex-col">
        <PublicHeader />
        <nav className="mx-auto flex w-full max-w-5xl gap-4 px-6 pb-4">
          {PUBLIC_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink-soft hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
      </div>
    );
  }

  const navLinks = (await isAdmin())
    ? [...NAV_LINKS, { href: "/admin/reports", label: "Admin" }]
    : NAV_LINKS;

  return (
    <div className="flex flex-1 flex-col">
      <header className="relative flex items-center justify-between border-b border-paper-line px-6 py-4 md:justify-start md:gap-8">
        <Link href="/dashboard" className="font-display text-lg font-semibold text-ink">
          Casefile
        </Link>
        <nav className="hidden md:flex md:gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink-soft hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <details className="md:hidden">
          <summary
            aria-label="Menu"
            className="flex list-none items-center rounded p-1 text-ink [&::-webkit-details-marker]:hidden"
          >
            <MenuIcon />
          </summary>
          <nav className="absolute inset-x-0 top-full z-10 flex flex-col gap-1 border-b border-paper-line bg-paper px-6 py-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-ink-soft hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </details>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
