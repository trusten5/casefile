// Generates one full 6-post batch (5 pillars + CTA) for the faceless TikTok
// account: AI-drafted copy grounded on real DB stats, rendered into
// ready-to-upload slide PNGs.
//
// Run with: npx tsx scripts/content-engine/generate.ts
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { PILLARS } from "./pillars";
import { getContentStats } from "./stats";
import { generateCopy } from "./generateCopy";
import { renderSlide } from "./renderSlides";

async function main() {
  const date = new Date().toISOString().slice(0, 10);
  const batchDir = join(__dirname, "..", "..", "content", "output", date);
  const reviewLines: string[] = [`# Content batch — ${date}\n`];

  for (let i = 0; i < PILLARS.length; i++) {
    const pillar = PILLARS[i];
    const label = `${i + 1}-${pillar.key}`;
    console.log(`[${label}] generating...`);

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

    writeFileSync(join(postDir, "caption.txt"), `${post.caption}\n\n${post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}\n`);

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
  writeFileSync(join(batchDir, "review.md"), reviewLines.join("\n"));
  console.log(`\nBatch complete: ${batchDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
