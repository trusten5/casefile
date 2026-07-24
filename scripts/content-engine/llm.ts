// Calls an LLM with a single forced tool call and returns the parsed tool
// input. Routes through OpenRouter while OPENROUTER_API_KEY is set (spends
// down the free credit first), falling back to a direct Anthropic call
// otherwise — so removing the OpenRouter key reverts to the old behavior
// with no code change needed.
//
// Only used for plain structured-JSON calls (generateCopy) — curatedFeed
// stays on the direct Anthropic call since it needs Anthropic's native
// web_search server tool, which OpenRouter doesn't expose the same way.
const ANTHROPIC_MODEL = process.env.CONTENT_ENGINE_MODEL || "claude-sonnet-5";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-5";

export async function callToolOnce(
  system: string,
  userMessage: string,
  toolName: string,
  toolDescription: string,
  schema: object
): Promise<unknown> {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        max_tokens: 2000,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMessage },
        ],
        tools: [{ type: "function", function: { name: toolName, description: toolDescription, parameters: schema } }],
        tool_choice: { type: "function", function: { name: toolName } },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error ${response.status}: ${await response.text()}`);
    }

    const body = await response.json();
    const toolCall = body.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool_calls in OpenRouter response");
    return JSON.parse(toolCall.function.arguments);
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) throw new Error("Neither OPENROUTER_API_KEY nor ANTHROPIC_API_KEY is set");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: userMessage }],
      tools: [{ name: toolName, description: toolDescription, input_schema: schema }],
      tool_choice: { type: "tool", name: toolName },
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);
  }

  const body = await response.json();
  const toolUse = body.content?.find((block: { type: string }) => block.type === "tool_use");
  if (!toolUse) throw new Error("No tool_use block in Claude response");
  return toolUse.input;
}
