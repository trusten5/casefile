import type { Pillar, AssetType } from "./pillars";
import type { ContentStats } from "./stats";

export interface GeneratedPost {
  hook: string;
  slides: { text: string; assetType: AssetType }[];
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

const MODEL = process.env.CONTENT_ENGINE_MODEL || "claude-sonnet-5";

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
            enum: ["pinterest", "screenshots", "photos", "backgrounds"],
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

export async function generateCopy(pillar: Pillar, stats: ContentStats | null): Promise<GeneratedPost> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const statsBlock = stats
    ? `\n\nREAL VERIFIED DATA (use only these numbers — never invent, round dramatically, or estimate beyond what's here):\n${JSON.stringify(stats, null, 2)}`
    : "";

  const system = `You write slideshow scripts for a faceless TikTok account promoting a job-search tracking app, aimed at students/new grads applying to internships and jobs. Voice: direct, a little wry, zero corporate tone, no emoji spam, no hype language ("game-changer", "you won't believe").

STYLE RULES — apply to every slide:
- Terse: cut filler, qualifiers, and throat-clearing. Combine each slide's "what" and "why" into the tightest phrasing that still lands — hook slide under 14 words, every other slide under 20. If a word can be cut without losing meaning, cut it.
- Accurate: never relabel a number's unit. If a stat counts postings, call it postings, not companies (and vice versa). Never round, restate, or paraphrase a real number differently than it's given.
- Strong hooks: hyper-specific — a real number + a concrete action + a concrete stake. No generic openers ("here's the truth about...", "let's talk about..."). Front-load the single most surprising detail, don't build up to it.

${pillar.brief}${statsBlock}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: `Write the ${pillar.title} post for today's batch.` }],
      tools: [{ name: "emit_post", description: "Emit the finished slideshow post", input_schema: POST_SCHEMA }],
      tool_choice: { type: "tool", name: "emit_post" },
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);
  }

  const body = await response.json();
  const toolUse = body.content?.find((block: { type: string }) => block.type === "tool_use");
  if (!toolUse) throw new Error("No tool_use block in Claude response");

  return toolUse.input as GeneratedPost;
}
