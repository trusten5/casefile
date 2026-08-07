import Link from "next/link";
import { companyDisplayName, companyLogoUrl, companySlug } from "@/lib/companies";
import { formatPostedDate } from "@/lib/dates";
import { ROLE_TYPE_LABELS, ROLE_TYPE_STYLES } from "@/lib/roleType";
import { CompanyLogo } from "@/components/CompanyLogo";
import { savePosting, unsavePosting, applyFromPosting, reportBrokenLink } from "./actions";
import { ApplyControl } from "./ApplyControl";
import { SavePostingToggle } from "./SavePostingToggle";

type CompanyInfo = { name: string; logo_url?: string | null; slug?: string | null };

type Posting = {
  id: string;
  title: string;
  location: string | null;
  role_type: string | null;
  url: string;
  posted_at: string;
  company: CompanyInfo | CompanyInfo[] | null;
};

// Shared by the full feed and the dashboard's "latest postings" preview so
// Save/Applied behave identically wherever a posting shows up. `returnTo`
// tells the action which page to redirect back to (with a flash message).
export function PostingRow({
  posting,
  isSaved,
  isApplied,
  returnTo,
}: {
  posting: Posting;
  isSaved: boolean;
  isApplied: boolean;
  returnTo: string;
}) {
  const save = savePosting.bind(null, posting.id, returnTo);
  const unsave = unsavePosting.bind(null, posting.id, returnTo);
  const apply = applyFromPosting.bind(null, posting.id, returnTo);
  const reportBroken = reportBrokenLink.bind(null, posting.id, returnTo);
  const companyName = companyDisplayName(posting.company);
  const slug = companySlug(posting.company);
  const roleType = posting.role_type;

  return (
    <li className="flex flex-col items-start gap-3 py-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {slug ? (
          <Link href={`/companies/${slug}`} className="shrink-0">
            <CompanyLogo name={companyName} logoUrl={companyLogoUrl(posting.company)} />
          </Link>
        ) : (
          <CompanyLogo name={companyName} logoUrl={companyLogoUrl(posting.company)} />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-words font-medium text-ink">{posting.title}</p>
            {roleType && ROLE_TYPE_LABELS[roleType] && (
              <span
                className={`shrink-0 rounded border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ${ROLE_TYPE_STYLES[roleType]}`}
              >
                {ROLE_TYPE_LABELS[roleType]}
              </span>
            )}
          </div>
          <p className="break-words text-sm text-ink-soft">
            {slug ? (
              <Link href={`/companies/${slug}`} className="hover:underline">
                {companyName}
              </Link>
            ) : (
              companyName
            )}
            {posting.location ? ` — ${posting.location}` : ""}
          </p>
          <p className="mt-0.5 font-mono text-xs text-ink-soft">
            Posted {formatPostedDate(posting.posted_at)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
        <SavePostingToggle initialSaved={isSaved} onSave={save} onUnsave={unsave} />
        <ApplyControl
          url={posting.url}
          initialApplied={isApplied}
          onApply={apply}
          onReportBroken={reportBroken}
        />
      </div>
    </li>
  );
}
