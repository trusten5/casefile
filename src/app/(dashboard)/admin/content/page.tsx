import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { isAdmin } from "@/lib/admin";
import { Flash } from "@/components/Flash";
import { saveContentDraft } from "./actions";
// Type-only import — no runtime code from scripts/content-engine ships in
// the app bundle, just the shape of a batch draft.
import type { Draft } from "../../../../../scripts/content-engine/generateCopy";

export const dynamic = "force-dynamic";

export default async function AdminContentPage(props: PageProps<"/admin/content">) {
  if (!(await isAdmin())) notFound();

  const searchParams = await props.searchParams;
  const flash = typeof searchParams.flash === "string" ? searchParams.flash : undefined;

  const supabase = getSupabase();
  const { data: row } = await supabase
    .from("content_drafts")
    .select("batch_date, drafts, edited")
    .order("batch_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const drafts = (row?.drafts ?? []) as Draft[];

  return (
    <div>
      <Flash message={flash} />
      <h1 className="font-display text-2xl font-semibold text-ink">Content draft</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {row
          ? `${row.batch_date} — ${
              row.edited
                ? "edited here — the 8:30am render will use this version"
                : "not yet edited — the 8:30am render will use draft.json on your Mac as-is unless you save changes here"
            }`
          : "No draft yet — check back after the 8am generation step."}
      </p>

      {row && (
        <form action={saveContentDraft.bind(null, row.batch_date)} className="mt-8 space-y-8">
          <input type="hidden" name="postCount" value={drafts.length} />
          {drafts.map((draft, i) => (
            <fieldset key={draft.label} className="rounded-md border border-paper-line p-4">
              <legend className="px-1 font-display text-lg text-ink">{draft.pillarTitle}</legend>
              <input type="hidden" name={`label__${i}`} value={draft.label} />
              <input type="hidden" name={`pillarTitle__${i}`} value={draft.pillarTitle} />
              <input type="hidden" name={`slideCount__${i}`} value={draft.post.slides.length} />

              <label className="mt-3 block text-sm font-medium text-ink">
                Hook
                <input
                  type="text"
                  name={`hook__${i}`}
                  defaultValue={draft.post.hook}
                  className="mt-1 w-full rounded-md border border-paper-line bg-paper px-3 py-1.5 text-sm text-ink"
                />
              </label>

              <label className="mt-3 block text-sm font-medium text-ink">
                Caption
                <input
                  type="text"
                  name={`caption__${i}`}
                  defaultValue={draft.post.caption}
                  className="mt-1 w-full rounded-md border border-paper-line bg-paper px-3 py-1.5 text-sm text-ink"
                />
              </label>

              <label className="mt-3 block text-sm font-medium text-ink">
                Hashtags (comma-separated)
                <input
                  type="text"
                  name={`hashtags__${i}`}
                  defaultValue={draft.post.hashtags.join(", ")}
                  className="mt-1 w-full rounded-md border border-paper-line bg-paper px-3 py-1.5 text-sm text-ink"
                />
              </label>

              <div className="mt-4 space-y-3">
                {draft.post.slides.map((slide, j) => (
                  <div key={j} className="rounded-md border border-paper-line p-3">
                    <p className="font-mono text-xs text-ink-soft">
                      {draft.label}/slide-{j + 1}.png
                    </p>
                    <input type="hidden" name={`assetType__${i}__${j}`} value={slide.assetType} />
                    <textarea
                      name={`text__${i}__${j}`}
                      defaultValue={slide.text}
                      rows={2}
                      className="mt-1 w-full rounded-md border border-paper-line bg-paper px-3 py-1.5 text-sm text-ink"
                    />
                    <input
                      type="text"
                      name={`photo__${i}__${j}`}
                      defaultValue={slide.photo ?? ""}
                      placeholder="photo filename"
                      className="mt-1 w-full rounded-md border border-paper-line bg-paper px-3 py-1.5 font-mono text-xs text-ink"
                    />
                  </div>
                ))}
              </div>
            </fieldset>
          ))}

          <button type="submit" className="rounded-md bg-status-offer px-4 py-2 text-sm font-medium text-paper">
            Done editing
          </button>
        </form>
      )}
    </div>
  );
}
