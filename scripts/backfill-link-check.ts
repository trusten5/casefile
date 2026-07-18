// Gentle, bounded local backfill — runs a fixed number of small, spaced-out
// rounds rather than draining the whole backlog in one aggressive pass (an
// earlier attempt at high concurrency got rate-limited by career-site hosts
// within a few hundred requests). The rest of the backlog clears gradually
// over normal sync cycles, since checkStaleLinks() is already wired into
// POST /api/sync-postings.
// Run with: npx tsx scripts/backfill-link-check.ts
import { checkStaleLinks } from "../src/lib/scrapers/linkcheck";

const ROUNDS = 15;
const DELAY_BETWEEN_ROUNDS_MS = 8000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let totalChecked = 0;
  let totalDead = 0;
  for (let round = 1; round <= ROUNDS; round++) {
    const result = await checkStaleLinks();
    totalChecked += result.checked;
    totalDead += result.dead;
    console.log(
      `round ${round}/${ROUNDS}: checked=${result.checked} dead=${result.dead} alive=${result.alive} inconclusive=${result.inconclusive} | totals: checked=${totalChecked} dead=${totalDead}`
    );
    if (result.checked === 0) {
      console.log("backlog exhausted");
      break;
    }
    await sleep(DELAY_BETWEEN_ROUNDS_MS);
  }
  console.log("done (partial pass — remainder clears via normal sync cycles)");
}

main();
