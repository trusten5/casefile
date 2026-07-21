// Renders the slide PNGs + caption.txt for a batch draft you've already
// reviewed (and optionally hand-edited) via generate.ts.
//
// Run with: npx tsx scripts/content-engine/render.ts <date>
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { renderSlide } from "./renderSlides";
import type { Draft } from "./generateCopy";
import { getSupabase } from "../../src/lib/supabase";

async function loadDrafts(date: string, localPath: string): Promise<Draft[]> {
  // If you edited and clicked "Done editing" on /admin/content, that row is
  // marked edited — use it instead of the local file. Otherwise (never
  // touched the page, or the Supabase check fails) fall back to the local
  // file exactly as before — the local pipeline never depends on the web
  // page working.
  try {
    const { data } = await getSupabase()
      .from("content_drafts")
      .select("drafts, edited")
      .eq("batch_date", date)
      .maybeSingle();
    if (data?.edited) {
      console.log("Using the edited draft from /admin/content.");
      return data.drafts as Draft[];
    }
  } catch (err) {
    console.error("Supabase draft check failed (non-fatal), using local file:", err);
  }
  return JSON.parse(readFileSync(localPath, "utf8"));
}

async function main() {
  const date = process.argv[2];
  if (!date) {
    console.error("Usage: npx tsx scripts/content-engine/render.ts <date>");
    process.exit(1);
  }

  const batchDir = join(__dirname, "..", "..", "content", "output", date);
  const draftPath = join(batchDir, "draft.json");
  if (!existsSync(draftPath)) {
    console.error(`No draft found at ${draftPath} — run generate.ts first.`);
    process.exit(1);
  }

  const drafts: Draft[] = await loadDrafts(date, draftPath);

  for (const { label, post } of drafts) {
    console.log(`[${label}] rendering ${post.slides.length} slides...`);
    const postDir = join(batchDir, label);
    // Wipe first — re-rendering a shortened draft shouldn't leave stale
    // higher-numbered slides from a previous, longer render.
    rmSync(postDir, { recursive: true, force: true });
    mkdirSync(postDir, { recursive: true });

    for (let s = 0; s < post.slides.length; s++) {
      const slide = post.slides[s];
      const png = await renderSlide({
        text: slide.text,
        photo: slide.photo ?? null,
        assetType: slide.assetType,
        slideIndex: s,
        slideCount: post.slides.length,
      });
      writeFileSync(join(postDir, `slide-${s + 1}.png`), Buffer.from(png));
    }

    writeFileSync(
      join(postDir, "caption.txt"),
      `${post.caption}\n\n${post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}\n`
    );
    console.log(`[${label}] done`);
  }

  console.log(`\nRender complete: ${batchDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
