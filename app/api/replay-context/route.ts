import { NextResponse, type NextRequest } from "next/server";
import { getAppToken } from "@/lib/osu/appToken";
import { OsuApiError, osuFetch } from "@/lib/osu/client";
import type { OsuMe, OsuScore } from "@/lib/osu/types";
import { deriveFarmProfile } from "@/lib/recommend";

// how the analysis page frames who's playing: is this map a stretch for them,
// a curveball below their level, or a normal day at the office
export type ReplayContext = {
  username: string;
  globalRank: number | null;
  rankTier: string; // "top 1,000" | "5-digit" | "6-digit" | "unranked" etc
  pp: number;
  comfort: { lo: number; hi: number } | null; // SR band from their own top 100, nomod listing
};

const cache = new Map<string, { at: number; body: ReplayContext | null }>();
const TTL = 15 * 60 * 1000;

function rankTier(rank: number | null): string {
  if (rank == null) return "unranked";
  if (rank <= 1000) return "top 1,000";
  const digits = String(rank).length;
  return `${digits}-digit`;
}

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
    // deriveFarmProfile is cheap (no per-map attribute fetch), just what we need here
    const profile = deriveFarmProfile(best);
    const body: ReplayContext = {
      username: user.username,
      globalRank: user.statistics.global_rank,
      rankTier: rankTier(user.statistics.global_rank),
      pp: Math.round(user.statistics.pp),
      comfort: profile ? { lo: profile.srLo, hi: profile.srHi } : null,
    };
    cache.set(key, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (e) {
    // no account by that name (bots, offline profiles, deleted accounts): not an error,
    // the analysis just runs without player context
    if (e instanceof OsuApiError && e.status === 404) {
      cache.set(key, { at: Date.now(), body: null });
      return NextResponse.json(null);
    }
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
