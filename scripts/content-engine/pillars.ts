// The 6-post cycle for the faceless TikTok account: 5 content pillars, then
// a CTA post, repeating. Each pillar's rule is the hard constraint the AI
// copy must satisfy — see generateCopy.ts for how these get built into a
// prompt.

export type AssetType = "pinterest" | "screenshots" | "photos" | "backgrounds";

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
    brief: `Slide 1 (hook): [Specific number] + [specific action] + [specific stakes]. e.g. "3 resume lines that get you auto-rejected by FAANG ATS".
Slides 2-N: one tactic per slide. Lead with the "what," follow with the "why it works."
Last slide: one-line summary + soft sign-off ("saved you 20 min of guessing").
Rule: every tactic must be something you could defend if a recruiter commented "that's not true." Only include tactics that are actually defensible — do not invent a stat or claim to sound more authoritative.`,
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
    brief: `Slide 1 (hook): the specific ask or script, not "networking tips." e.g. "the exact DM that got me 3 referrals this month".
Slides 2-N: script/template, broken into parts (opener / ask / close), one per slide.
Last slide: the one mistake that kills response rate.
Rule: this pillar quietly sets up tracking who you reached out to and follow-up timing as a habit a smart person would build for themselves — never name any specific product/feature/app.`,
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
    key: "data-numbers",
    title: "Pillar 5 — Data/numbers hooks",
    needsStats: true,
    brief: `Slide 1 (hook): "I tracked [N] postings this [period]. Here's what stood out." — use the real N from the stats data below.
Slides 2-N: one real, verifiable stat per slide from the data below — posting volume trend, which week/day sees the most postings, etc.
Last slide: the takeaway/action a job-hunter should change based on this.
Rule: every number must come directly from the stats data below — never estimate, round dramatically, or invent a number that isn't in that data.`,
  },
  {
    key: "cta",
    title: "CTA post (every 6th)",
    needsStats: false,
    brief: `Slide 1 (hook): the payoff line, framed personal. e.g. "I built the tracker I wish I had after my 40th rejection".
Slides 2-4: walk ONE screen/feature as a personal system (funnel view, filtered feed, etc.) — show, don't pitch. No feature-list, no "sign up now."
Last slide: soft close. "Link in bio if you want it too" — one line, no urgency language.
Rule: this is the only post allowed to reference the product directly, and even then only as "the thing I built for myself," never as a pitch.`,
  },
];
