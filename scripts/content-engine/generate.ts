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

async function main() {
  const date = new Date().toISOString().slice(0, 10);
  const batchDir = join(__dirname, "..", "..", "content", "output", date);
  const drafts: Draft[] = [];
  const reviewLines: string[] = [
    `# Content batch — ${date}\n`,
    "Review below, edit draft.json if you want changes, then run:",
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

    drafts.push({ label, pillarTitle: pillar.title, post });
    reviewLines.push(
      `## ${label} — ${pillar.title}`,
      `Hook: ${post.hook}`,
      pillar.needsStats
        ? "Numbers: verify against the stats bundle logged above before posting."
        : "Defensibility check: could you defend every tactic/claim on this post if challenged?",
      ...post.slides.map((s, idx) => `  ${idx + 1}. ${s.text}`),
      ""
    );
    console.log(`[${label}] done — ${post.slides.length} slides`);
  }

  mkdirSync(batchDir, { recursive: true });
  writeFileSync(join(batchDir, "draft.json"), JSON.stringify(drafts, null, 2));
  writeFileSync(join(batchDir, "review.md"), reviewLines.join("\n"));
  console.log(`\nDraft ready: ${batchDir}`);
  console.log(`Review review.md (edit draft.json for changes), then run:`);
  console.log(`  npx tsx scripts/content-engine/render.ts ${date}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
