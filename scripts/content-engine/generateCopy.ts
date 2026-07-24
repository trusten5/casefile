import type { Pillar, AssetType } from "./pillars";
import type { ContentStats } from "./stats";
import { callToolOnce } from "./llm";

export interface GeneratedPost {
  hook: string;
  // `photo` is filled in by generate.ts right after the model responds —
  // the model only chooses a category (assetType); generate.ts resolves
  // that to one specific filename so it's visible/editable in draft.json.
  slides: { text: string; assetType: AssetType; photo?: string | null }[];
  caption: string;
  hashtags: string[];
}

// One entry per post in a batch's draft.json — written by generate.ts,
// read back by render.ts once you've reviewed (and optionally edited) it.
export interface Draft {
  label: string;
  pillarTitle: string;
  post: GeneratedPost;
}

const POST_SCHEMA = {
  type: "object",
  properties: {
    hook: { type: "string", description: "The slide 1 hook line" },
    slides: {
      type: "array",
      minItems: 5,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          text: { type: "string", description: "The on-slide text for this slide, including slide 1's hook as the first item" },
          assetType: {
            type: "string",
            enum: ["pinterest", "photos", "backgrounds"],
            description: "Which local image category best fits this slide's background",
          },
        },
        required: ["text", "assetType"],
      },
    },
    caption: { type: "string", description: "TikTok caption text, 1-2 sentences" },
    hashtags: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 8 },
  },
  required: ["hook", "slides", "caption", "hashtags"],
};

export async function generateCopy(
  pillar: Pillar,
  stats: ContentStats | null,
  recentHooks: string[] = []
): Promise<GeneratedPost> {
  const statsBlock = stats
    ? `\n\nREAL VERIFIED DATA (use only these numbers — never invent, round dramatically, or estimate beyond what's here):\n${JSON.stringify(stats, null, 2)}`
    : "";

  const historyBlock = recentHooks.length
    ? `\n\nRECENT POSTS FOR THIS PILLAR (hook :: tactics covered) — do not reuse any of these hooks, or the underlying tactics, even under a reworded headline. Come at this from a genuinely different angle:\n${recentHooks.map((h) => `- ${h}`).join("\n")}`
    : "";

  const system = `You write slideshow scripts for a faceless TikTok account promoting a job-search tracking app, aimed at students/new grads applying to internships and jobs. Voice: direct, a little wry, zero corporate tone, no emoji spam, no hype language ("game-changer", "you won't believe").

STYLE RULES — apply to every slide:
- Terse: cut filler, qualifiers, and throat-clearing. Combine each slide's "what" and "why" into the tightest phrasing that still lands — hook slide under 14 words, every other slide under 20. If a word can be cut without losing meaning, cut it.
- Accurate: never relabel a number's unit. If a stat counts postings, call it postings, not companies (and vice versa). Never round, restate, or paraphrase a real number differently than it's given.
- Strong hooks, any of these registers — pick whichever fits the pillar below, not the same one every time: a real number + concrete action + concrete stake; a curiosity gap (tease a surprising result without giving it away up front); a contrarian take ("everyone says X, here's why that's backwards"); dropping the viewer straight into a scene; a confession. No generic openers ("here's the truth about...", "let's talk about..."). Front-load the single most surprising detail, don't build up to it.
- Tone mix: not every post needs a scarcity/anxiety angle — curiosity, humor, and encouragement are equally valid registers. Unless the pillar brief below is explicitly tactical advice, default to upbeat, funny, or surprising over anxious.
- Never reuse these closing phrases or close near-paraphrases of them, no matter which pillar: "saved you N minutes of guessing", "link in bio if you want it too", "losing track of", "lost in the void", "before it's too late". Vary the close every time.
- Pillars are topics and constraints, not outlines — the brief below tells you the subject and the rules, not the shape. Don't impose the same slide-by-slide structure on every post in a pillar (e.g. always hook → numbered list → "the mistake" → close). Invent a fresh structure each time: a story, a ranked list, one idea explored in depth, several quick hits, whatever fits this specific post — vary slide count, pacing, and where the payoff lands naturally with the content. The hook is still the one thing that must land hard every time; everything after it is free-form.

${pillar.brief}${statsBlock}${historyBlock}`;

  const input = await callToolOnce(
    system,
    `Write the ${pillar.title} post for today's batch.`,
    "emit_post",
    "Emit the finished slideshow post",
    POST_SCHEMA
  );

  return input as GeneratedPost;
}
