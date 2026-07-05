import { NextResponse, type NextRequest } from "next/server";
import { OsuApiError, osuFetch } from "@/lib/osu/client";
import type { OsuMe, OsuScore } from "@/lib/osu/types";
import { deriveFarmProfile, pickCandidates, type SearchSet } from "@/lib/recommend";
import { calcPp, fetchOsuFile } from "@/lib/server/rosu";
import { mapLimit } from "@/lib/osu/difficulty";

export type Recommendation = {
  beatmapId: number;
  setId: number;
  artist: string;
  title: string;
  version: string;
  mods: string;
  expectedPp: number;
  stars: number;
  bpm: number;
  lengthSec: number;
};

const cache = new Map<number, { at: number; body: unknown }>();
const TTL = 10 * 60 * 1000;

export async function GET(req: NextRequest) {
  const token = req.cookies.get("osu_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const me = await osuFetch<OsuMe>(token, "/me/osu");
    const hit = cache.get(me.id);
    if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.body);

    const best = await osuFetch<OsuScore[]>(
      token,
      `/users/${me.id}/scores/best?mode=osu&limit=100`,
    );
    const profile = deriveFarmProfile(best);
    if (!profile) {
      return NextResponse.json({ error: "not_enough_plays" }, { status: 422 });
    }

    const q = encodeURIComponent(`stars>=${profile.srLo} stars<=${profile.srHi}`);
    const search = await osuFetch<{ beatmapsets: SearchSet[] }>(
      token,
      `/beatmapsets/search?m=0&s=ranked&sort=plays_desc&q=${q}`,
    );
    const candidates = pickCandidates(search.beatmapsets ?? [], profile);

    const rate = profile.mods.includes("DT") ? 1.5 : profile.mods.includes("HT") ? 0.75 : 1;
    const recs = (
      await mapLimit(candidates, 6, async (c) => {
        const osuText = await fetchOsuFile(c.beatmapId);
        if (!osuText) return null;
        try {
          const r = calcPp(osuText, { mods: profile.mods || 0, accuracy: profile.acc, misses: 0 });
          return {
            beatmapId: c.beatmapId,
            setId: c.setId,
            artist: c.artist,
            title: c.title,
            version: c.version,
            mods: profile.mods || "NM",
            expectedPp: Math.round(r.pp),
            stars: +r.stars.toFixed(2),
            bpm: Math.round(c.bpm * rate),
            lengthSec: Math.round(c.lengthSec / rate),
          } satisfies Recommendation;
        } catch {
          return null;
        }
      })
    ).filter((r): r is Recommendation => r != null && r.expectedPp > profile.floor);

    recs.sort((a, b) => b.expectedPp - a.expectedPp);
    const body = {
      profile: {
        mods: profile.mods || "NM",
        acc: profile.acc,
        floor: Math.round(profile.floor),
        srLo: profile.srLo,
        srHi: profile.srHi,
      },
      recommendations: recs.slice(0, 12),
    };
    cache.set(me.id, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (e) {
    const status = e instanceof OsuApiError && e.status === 401 ? 401 : 502;
    return NextResponse.json({ error: "fetch_failed" }, { status });
  }
}
