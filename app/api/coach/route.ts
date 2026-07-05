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

const SYSTEM = `You are an osu!standard coach reviewing one replay from measured data.
The facts are computed from the actual cursor/keypress stream — trust them, do not invent numbers.
Write a short review in plain language: 2-3 sentences on what happened, then 2-3 concrete bullet points on what to practice and why.
Reference timestamps and numbers from the facts. No greetings, no fluff, no disclaimers.`;

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
        temperature: 0.4,
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
    const review: string | undefined = json?.choices?.[0]?.message?.content;
    if (!review) return NextResponse.json({ error: "empty" }, { status: 502 });
    return NextResponse.json({ review });
  } catch {
    return NextResponse.json({ error: "upstream_failed" }, { status: 502 });
  }
}
