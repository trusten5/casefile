// Generates the copy-only draft for a batch (tactical advice, networking
// tactics, CTA) — no images yet. Review content/output/<date>/review.md,
// edit content/output/<date>/draft.json directly if you want to change any
// wording, then run render.ts on the same date to produce the slide images.
//
// Run with: npx tsx scripts/content-engine/generate.ts
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { ACTIVE_PILLARS as PILLARS } from "./pillars";
import { getContentStats } from "./stats";
import { generateCopy, type Draft } from "./generateCopy";
import { pickAssetPath } from "./renderSlides";

function localDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function main() {
  // Local date, not UTC — a UTC-based date would mismatch the shell
  // wrapper's `date +%Y-%m-%d` (also local) for evening runs in timezones
  // behind UTC, pointing render/email steps at a folder that doesn't exist.
  const date = localDateKey(new Date());
  const batchDir = join(__dirname, "..", "..", "content", "output", date);
  const drafts: Draft[] = [];
  const reviewLines: string[] = [
    `# Content batch — ${date}\n`,
    `Edit draft.json (NOT this file — this is just a summary and isn't read back) if you want changes, then run:`,
    `  npx tsx scripts/content-engine/render.ts ${date}`,
    "",
  ];

  for (let i = 0; i < PILLARS.length; i++) {
    const pillar = PILLARS[i];
    const label = `${i + 1}-${pillar.key}`;
    console.log(`[${label}] generating copy...`);

    let stats = null;
    if (pillar.needsStats) {
      try {
        stats = await getContentStats();
      } catch (err) {
        console.error(`[${label}] stats query failed, skipping post:`, err);
        reviewLines.push(`## ${label} — SKIPPED (stats query failed)\n`);
        continue;
      }
    }

    let post;
    try {
      post = await generateCopy(pillar, stats);
    } catch (err) {
      console.error(`[${label}] copy generation failed, skipping post:`, err);
      reviewLines.push(`## ${label} — SKIPPED (Claude API error)\n`);
      continue;
    }

    // Resolve each slide's category (assetType) to one specific filename now,
    // at draft time — that's what makes it visible and editable in
    // draft.json instead of being re-picked randomly when render.ts runs.
    post.slides = post.slides.map((s) => ({ ...s, photo: pickAssetPath(s.assetType) }));

    drafts.push({ label, pillarTitle: pillar.title, post });
    reviewLines.push(
      `## ${label} — ${pillar.title}`,
      `Hook: ${post.hook}`,
      pillar.needsStats
        ? "Numbers: verify against the stats bundle logged above before posting."
        : "Defensibility check: could you defend every tactic/claim on this post if challenged?",
      ...post.slides.map((s, idx) => `  ${label}/slide-${idx + 1}.png (photo: ${s.photo ?? "none available"}) — ${s.text}`),
      ""
    );
    console.log(`[${label}] done — ${post.slides.length} slides`);
  }

  mkdirSync(batchDir, { recursive: true });
  writeFileSync(join(batchDir, "draft.json"), JSON.stringify(drafts, null, 2));
  writeFileSync(join(batchDir, "review.md"), reviewLines.join("\n"));
  console.log(`\nDraft ready: ${batchDir}`);
  console.log(`Review review.md (edit draft.json, not review.md, for changes), then run:`);
  console.log(`  npx tsx scripts/content-engine/render.ts ${date}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
