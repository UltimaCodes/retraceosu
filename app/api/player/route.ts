import { NextResponse, type NextRequest } from "next/server";
import { getAppToken } from "@/lib/osu/appToken";
import { OsuApiError, osuFetch } from "@/lib/osu/client";
import type { OsuMe, OsuScore } from "@/lib/osu/types";
import { buildPlayerReport } from "@/lib/informatics/player";

const cache = new Map<string, { at: number; body: unknown }>();
const TTL = 10 * 60 * 1000;

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("u")?.trim();
  if (!username) return NextResponse.json({ error: "no_username" }, { status: 400 });

  const key = username.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.body);

  try {
    const token = await getAppToken();
    const user = await osuFetch<OsuMe>(
      token,
      `/users/${encodeURIComponent(username)}/osu?key=username`,
      2,
    );
    const best = await osuFetch<OsuScore[]>(
      token,
      `/users/${user.id}/scores/best?mode=osu&limit=100`,
      2,
    );
    const body = buildPlayerReport(user, best);
    cache.set(key, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (e) {
    if (e instanceof OsuApiError && e.status === 404) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
