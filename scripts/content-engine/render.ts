// Renders the slide PNGs + caption.txt for a batch draft you've already
// reviewed (and optionally hand-edited) via generate.ts.
//
// Run with: npx tsx scripts/content-engine/render.ts <date>
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { renderSlide } from "./renderSlides";
import type { Draft } from "./generateCopy";

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

  const drafts: Draft[] = JSON.parse(readFileSync(draftPath, "utf8"));

  for (const { label, post } of drafts) {
    console.log(`[${label}] rendering ${post.slides.length} slides...`);
    const postDir = join(batchDir, label);
    mkdirSync(postDir, { recursive: true });

    for (let s = 0; s < post.slides.length; s++) {
      const slide = post.slides[s];
      const png = await renderSlide({
        text: slide.text,
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
