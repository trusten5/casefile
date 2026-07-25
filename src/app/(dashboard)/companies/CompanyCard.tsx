"use client";

import Link from "next/link";
import { CompanyLogo } from "@/components/CompanyLogo";
import { formatPostedDate } from "@/lib/dates";
import { saveCompany, unsaveCompany } from "./actions";
import { SaveCompanyButton } from "./SaveCompanyButton";

type Company = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  activeCount: number;
  firstSeenAt: string | null;
  mostRecentTitle: string | null;
  isSaved: boolean;
  contactCount: number;
};

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-ink-soft"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// Shared by the "Saved companies" section and the "All companies" directory
// so a card looks and behaves identically wherever it shows up.
export function CompanyCard({
  company: c,
  freeTier,
  showFirstSeen = false,
}: {
  company: Company;
  freeTier: boolean;
  showFirstSeen?: boolean;
}) {
  const save = saveCompany.bind(null, c.id, "/companies");
  const unsave = unsaveCompany.bind(null, c.id, "/companies");

  return (
    <div className="flex items-center gap-3 rounded-lg border border-paper-line bg-tab/20 p-4 hover:border-ink-soft">
      <Link href={`/companies/${c.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
        <CompanyLogo name={c.name} logoUrl={c.logoUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-ink">{c.name}</p>
            {c.contactCount > 0 && (
              <span
                title={`You know ${c.contactCount} ${c.contactCount === 1 ? "person" : "people"} here`}
                className="shrink-0 rounded-full bg-status-offer/15 px-1.5 py-0.5 font-mono text-[11px] font-medium text-status-offer"
              >
                👤 {c.contactCount}
              </span>
            )}
          </div>
          {c.mostRecentTitle ? (
            <p className="truncate text-xs text-ink-soft">{c.mostRecentTitle}</p>
          ) : (
            <p className="text-xs text-ink-soft">Nothing active right now</p>
          )}
          {c.activeCount > 1 && (
            <p className="font-mono text-xs text-ink-soft">
              View {c.activeCount - 1} other posting{c.activeCount - 1 === 1 ? "" : "s"}
            </p>
          )}
          {showFirstSeen && (
            <p className="font-mono text-xs text-ink-soft">
              {c.firstSeenAt ? `First seen ${formatPostedDate(c.firstSeenAt)}` : "Not seen yet"}
            </p>
          )}
        </div>
        <ArrowIcon />
      </Link>
      <SaveCompanyButton
        initialSaved={c.isSaved}
        onSave={save}
        onUnsave={unsave}
        companyName={c.name}
        freeTier={freeTier}
      />
    </div>
  );
}
