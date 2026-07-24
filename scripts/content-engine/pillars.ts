// Daily batch: 2 anchor pillars (tactical-advice, networking-tactics) plus
// one pillar rotated from SLOT3_POOL (see ANCHOR_PILLARS/SLOT3_POOL below).
// Each pillar's rule is the hard constraint the AI copy must satisfy — see
// generateCopy.ts for how these get built into a prompt.

// "screenshots" (real app screenshots) is deliberately excluded — every
// slide should be a real photo, not an app UI shot.
export type AssetType = "pinterest" | "photos" | "backgrounds";

export interface Pillar {
  key: string;
  title: string;
  needsStats: boolean;
  brief: string;
}

export const PILLARS: Pillar[] = [
  {
    key: "tactical-advice",
    title: "Pillar 1 — Tactical advice",
    needsStats: false,
    brief: `Topic: concrete, defensible tactics for tracking and running a job search that actually change outcomes — practical, not motivational.
Rules: every tactic must be something you could defend if a recruiter commented "that's not true" — no invented or unsourced statistics anywhere (a number in the hook should count the tactics you're covering, never an unsourced population stat like "75% of resumes get rejected"). Vary the structure every time — a numbered list, one tactic walked through in depth, a before/after, a myth correction, whatever fits this specific idea — don't default to the same shape post to post.`,
  },
  {
    key: "relatability",
    title: "Pillar 2 — Relatability",
    needsStats: false,
    brief: `Slide 1 (hook): a specific, real moment — not a generic stage-of-grief joke. e.g. "the 4th round + take-home that still said no — here's what the data says happens next".
Slides 2-N: the emotional beat, escalating, then a turn (either dark humor or a real stat).
Last slide: land it — either a joke landing, or a data punchline that ties back to the data/numbers pillar.
Rule: if the joke can't be traced to something real and observable about job hunting, it's generic — cut it or reroute it through something concrete.`,
  },
  {
    key: "networking-tactics",
    title: "Pillar 3 — Networking tactics",
    needsStats: false,
    brief: `Topic: networking/outreach tactics for job searching — real scripts, asks, and timing that actually get replies, not generic "network more" advice.
Rules: ground it in a specific ask or script, not abstract advice. This pillar quietly sets up tracking who you reached out to and follow-up timing as a habit a smart person would build for themselves — never name any specific product/feature/app. Vary the structure every time — sometimes a script broken into parts, sometimes one specific mistake dissected in depth, sometimes a before/after of a message that worked vs one that flopped — don't default to the same opener/ask/close/mistake shape every post.`,
  },
  {
    key: "company-intel",
    title: "Pillar 4 — Company/industry intel",
    needsStats: true,
    brief: `Slide 1 (hook): a specific, dated claim using the real stats provided below. e.g. "companies still posting internships in [month] — pulled from [N] postings".
Slides 2-N: 3-5 companies/patterns from the real stats, framed as observation not accusation. Safer framing: "X postings this week" / "response rate up Y%" — avoid naming/shaming a specific company negatively.
Last slide: what this means for where to focus applications this week.
Rule: aggregate or trend-level claims only, and only use numbers given in the stats data below. If naming a specific company, only use positive/neutral framing ("still hiring") — never negative framing about a named company.`,
  },
  {
    key: "positive-hiring-data",
    title: "Pillar 5 — Positive hiring data",
    needsStats: true,
    brief: `Topic: real hiring data from the stats below, framed as good news and opportunity, not scarcity.
Rules: every number must come directly from the stats data below — never estimate, round dramatically, or invent a number that isn't in that data. Vary the structure every time — sometimes several stats in quick succession, sometimes one stat unpacked in depth, sometimes framed as "here's what I noticed this week" — don't default to the same list shape every time.`,
  },
  {
    key: "cta",
    title: "CTA post (every 6th)",
    needsStats: false,
    brief: `Topic: the product, framed strictly as a personal system you built for yourself — never a pitch.
Rules: this is the only pillar allowed to reference the product directly, and even then only as "the thing I built for myself." Walk ONE screen/feature as part of your own workflow — show, don't pitch, no feature-list, no "sign up now." Close softly, varied every time — never repeat a previous closing line or its near-paraphrase, no urgency language. Vary how you get there each time — sometimes a personal story leads in, sometimes you start mid-feature, sometimes a before/after — don't default to the same slide count or shape every time.`,
  },
  {
    key: "corporate-translator",
    title: "Pillar 6 — Corporate translator",
    needsStats: false,
    brief: `Topic: common corporate/job-posting jargon, translated into what it actually means — wry, not bitter.
Rules: only translate phrases that are genuinely common across job postings in general — no fabricated single company/listing, no naming a real company negatively. Land on at least one phrase that's an actual green flag, not pure mockery. Vary the format — sometimes a straight phrase-by-phrase translation, sometimes framed as a single story where the jargon shows up, sometimes ranked worst-to-best — don't default to the same slide count or list shape every time.`,
  },
  {
    key: "interview-tips-explainer",
    title: "Pillar 7 — Interview/hiring process explainer",
    needsStats: false,
    brief: `Topic: how the hiring process actually works behind the scenes — demystifying, not alarming.
Rules: explain real, generally-true mechanics (why callbacks take as long as they do, what an ATS actually filters on, what "we'll keep you on file" usually means) — no invented statistics, no discovery of a specific real event required. Vary the structure every time — sometimes one misconception corrected in depth, sometimes several quick ones, sometimes framed as a single story or example — don't default to the same myth-then-mechanics-then-advice shape every time.`,
  },
  {
    key: "things-nobody-tells-you",
    title: "Pillar 8 — Things nobody tells you",
    needsStats: false,
    brief: `Topic: genuinely surprising, positive facts about the hiring process and job search — reassuring, not another thing to worry about.
Rules: every fact must be genuinely reassuring or empowering — if something reads as a caveat or a new worry, cut it or reroute it positive. Vary the structure every time — sometimes several quick facts, sometimes one fact explored in depth, sometimes framed as a personal realization — don't default to the same list shape every time.`,
  },
];

// Pillars 2 (relatability), 4 (company-intel) didn't land — paused, not
// deleted, in case they're worth revisiting later.
//
// Two daily anchors run every batch; the 3rd slot rotates through
// SLOT3_POOL so the CTA stops running daily (it's meant to be a rare post,
// not a third of every batch) and the batch gets real format variety
// instead of the same 3 templates every day.
export const ANCHOR_PILLARS: Pillar[] = ["tactical-advice", "networking-tactics"].map(
  (key) => PILLARS.find((p) => p.key === key)!
);

export const SLOT3_POOL: Pillar[] = [
  "cta",
  "corporate-translator",
  "interview-tips-explainer",
  "things-nobody-tells-you",
  "positive-hiring-data",
].map((key) => PILLARS.find((p) => p.key === key)!);
