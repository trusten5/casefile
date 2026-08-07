"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Same link, either way — just knows whether it's the current page so the
// nav can show where you are, not just where you can go.
export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={
        active
          ? "border-b-2 border-cobalt text-sm font-medium text-cobalt"
          : "border-b-2 border-transparent text-sm font-medium text-ink-soft hover:text-ink"
      }
    >
      {label}
    </Link>
  );
}
