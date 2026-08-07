import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { isAdmin } from "@/lib/admin";
import { Flash } from "@/components/Flash";
import { formatPostedDate } from "@/lib/dates";
import { markFeatureRequestRead } from "../actions";

export const dynamic = "force-dynamic";

type FeatureRequestRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export default async function AdminFeatureRequestsPage(props: PageProps<"/admin/feature-requests">) {
  if (!(await isAdmin())) notFound();

  const searchParams = await props.searchParams;
  const flash = typeof searchParams.flash === "string" ? searchParams.flash : undefined;
  const supabase = getSupabase();

  const { data: requests, error } = await supabase
    .from("feature_requests")
    .select("id, user_id, body, created_at")
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .returns<FeatureRequestRow[]>();

  return (
    <div>
      <Flash message={flash} />
      <Link
        href="/admin/reports"
        className="inline-block rounded border border-paper-line px-3 py-1.5 text-sm text-ink"
      >
        ← Reports
      </Link>
      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Feature requests</h1>
      <p className="mt-1 text-sm text-ink-soft">Unread submissions from /profile.</p>

      {error && (
        <p className="mt-6 text-sm text-status-rejected">
          Couldn&apos;t load feature requests: {error.message}
        </p>
      )}

      {requests?.length === 0 && !error && (
        <p className="mt-8 text-sm text-ink-soft">Nothing unread.</p>
      )}

      <ul className="mt-6 divide-y divide-paper-line">
        {(requests ?? []).map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <p className="whitespace-pre-wrap text-sm text-ink">{r.body}</p>
              <p className="mt-1 font-mono text-xs text-ink-soft">
                {r.user_id} — {formatPostedDate(r.created_at)}
              </p>
            </div>
            <form action={markFeatureRequestRead.bind(null, r.id)} className="shrink-0">
              <button
                type="submit"
                className="rounded border border-paper-line px-3 py-1.5 text-sm text-ink"
              >
                Mark read
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
