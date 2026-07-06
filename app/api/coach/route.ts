import { NextResponse, type NextRequest } from "next/server";

// OpenAI-compatible chat endpoint; works with Groq, xAI (Grok), Gemini
// compat mode, OpenRouter, etc. Unset key = deterministic coaching only.
// Accepts either the base url (…/v1) or the full …/chat/completions path.
function apiUrl(): string {
  const raw = process.env.COACH_API_URL ?? "https://api.groq.com/openai/v1";
  const base = raw.replace(/\/+$/, "");
  return base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
}
const MODEL = process.env.COACH_MODEL ?? "llama-3.3-70b-versatile";

export const maxDuration = 60; // reasoning models can sit on the request a while

const SYSTEM = `You are an osu!standard coach messaging a player directly, like a strong friend who plays at a high level. You get measured facts from one replay plus the findings a deterministic tool already flagged.
Add value on top of those findings, do not repeat them. Pick the single thing costing the most pp or consistency, explain in mechanical terms why it is happening, then give one exact drill to fix it with concrete targets (bpm, star rating, CS or AR, accuracy) pulled from the facts. Finish with one realistic thing to chase next.
Mods matter: every difficulty value in the facts (star rating, AR, OD, CS, length, key stats bpm) is ALREADY adjusted for the player's mods and clockRate. If clockRate is 1.5 the player experienced everything 50% faster than the map's listing, so anchor any bpm or star advice to these adjusted numbers, never to nomod values, and mention the mods when they change the story.
Follow every rule below:
- Write like a Discord message: direct, specific, a little blunt. Lowercase is fine.
- Plain text only. No markdown, no asterisks, no bold, no headings, no bullet points.
- Never use the em dash character. Use commas, periods, or the word "to" for ranges.
- No greeting, no sign off, no "overall", no "in summary", no motivational filler.
- 3 to 5 sentences. Do not restate raw numbers the player can already see unless you are drawing a conclusion from them. Never invent a number that is not in the facts.`;

// strip markdown and the em dash the model leaks despite instructions
function clean(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\*/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/[—―]/g, ", ")
    .replace(/ ,/g, ",")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(req: NextRequest) {
  const key = process.env.COACH_API_KEY;
  if (!key) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const facts = await req.json();
  try {
    const res = await fetch(apiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.5,
        max_tokens: 1600, // reasoning models spend part of the budget on hidden thinking
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: JSON.stringify(facts) },
        ],
      }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: "upstream_failed" }, { status: 502 });
    }
    const json = await res.json();
    const raw: string | undefined = json?.choices?.[0]?.message?.content;
    if (!raw) return NextResponse.json({ error: "empty" }, { status: 502 });
    return NextResponse.json({ review: clean(raw) });
  } catch {
    return NextResponse.json({ error: "upstream_failed" }, { status: 502 });
  }
}
