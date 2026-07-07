import { NextResponse, type NextRequest } from "next/server";
import { getAppToken } from "@/lib/osu/appToken";
import { OsuApiError, osuFetch } from "@/lib/osu/client";
import { fetchAttributes, mapLimit } from "@/lib/osu/difficulty";
import type { OsuMe, OsuScore } from "@/lib/osu/types";

// how the analysis page frames who's playing: is this map a stretch for them,
// a curveball below their level, or a normal day at the office
export type ReplayContext = {
  username: string;
  globalRank: number | null;
  rankTier: string; // "top 1,000" | "5-digit" | "6-digit" | "unranked" etc
  pp: number;
  comfort: { lo: number; hi: number } | null; // mod-adjusted SR band from their own top 100
};

export const maxDuration = 60; // up to 100 attribute fetches on a cold cache

const cache = new Map<string, { at: number; body: ReplayContext | null }>();
const TTL = 15 * 60 * 1000;

function rankTier(rank: number | null): string {
  if (rank == null) return "unranked";
  if (rank <= 1000) return "top 1,000";
  const digits = String(rank).length;
  return `${digits}-digit`;
}

const quantile = (sorted: number[], q: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

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
    const withPp = best.filter((s) => s.pp != null);

    // mod-adjusted star rating per play, same approach the player informatics page
    // uses; a DT player's comfort zone must reflect what they played, not the nomod listing
    const stars = await mapLimit(withPp, 8, async (s) => {
      const attr = await fetchAttributes(token, s.beatmap.id, s.mods);
      return attr?.star_rating ?? s.beatmap.difficulty_rating;
    });
    stars.sort((a, b) => a - b);

    const body: ReplayContext = {
      username: user.username,
      globalRank: user.statistics.global_rank,
      rankTier: rankTier(user.statistics.global_rank),
      pp: Math.round(user.statistics.pp),
      comfort:
        stars.length >= 5
          ? {
              lo: +quantile(stars, 0.25).toFixed(2),
              hi: +quantile(stars, 0.75).toFixed(2),
            }
          : null,
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
