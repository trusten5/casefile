// Finds real headlines/tweets from the last 24-48h as source material for a
// possible manual meme/joke post — this never writes the post itself, and
// nothing here is auto-turned into draft.json/a rendered slide.
const MODEL = process.env.CONTENT_ENGINE_MODEL || "claude-sonnet-5";

export async function getCuratedFeed(): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const system = `Find 5 real, genuinely interesting/funny/crazy headlines or tweets from the last 24-48 hours, for a person to manually consider turning into a joke/meme-style social post. You are only finding source material — do not write a post, caption, or joke yourself.

Scope: job search, careers, college, tech, finance, interviews, corporate/business/VC trends. Examples of the kind of thing that fits: "[company] revolutionizes interview process," a wild VC/business trend, a new hiring-by-degree report, colleges ranked by starting salary.

Recency: only the last 24-48 hours.

Tone: don't pick sides politically, but a bill passing or a politician announcing something that hits these topic areas is fair game. Controversy is fine as long as it's on-topic — don't chase controversy that's unrelated to these topics.

Output format: respond with EXACTLY 5 lines, nothing else — no intro, no numbering explanation, no ranking rationale. Each line: <the headline or tweet text> — <URL>`;

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
      messages: [{ role: "user", content: "Find today's 5 items." }],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);
  }

  const body = await response.json();
  const textBlocks = (body.content ?? []).filter((block: { type: string }) => block.type === "text");
  const last = textBlocks[textBlocks.length - 1];
  if (!last) throw new Error("No text block in Claude response");
  return last.text as string;
}
