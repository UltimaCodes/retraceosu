import { NextResponse, type NextRequest } from "next/server";
import { OsuApiError, osuFetch } from "@/lib/osu/client";
import type { OsuMe, OsuScore } from "@/lib/osu/types";
import { deriveFarmProfile, pickCandidates, type SearchSet } from "@/lib/recommend";
import { aimLean, calcPp, fetchOsuFile } from "@/lib/server/rosu";
import { mapLimit } from "@/lib/osu/difficulty";

export type Recommendation = {
  beatmapId: number;
  setId: number;
  artist: string;
  title: string;
  version: string;
  mods: string;
  accUsed: number; // the acc the expected pp assumes
  expectedPp: number;
  stars: number;
  bpm: number;
  lengthSec: number;
  lean: "aim" | "speed" | "balanced";
};

const cache = new Map<number, { at: number; body: unknown }>();
const TTL = 10 * 60 * 1000;

// recs beyond your best play * this are FC fantasies, not farm
const CEILING = 1.5;

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0.5;
};

const leanTag = (l: number): Recommendation["lean"] =>
  l >= 0.54 ? "aim" : l <= 0.46 ? "speed" : "balanced";

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

    // aim/speed lean measured from their strongest plays, under the main combo
    const mainMods = profile.combos[0].mods || 0;
    const leans = (
      await mapLimit(profile.sampleIds, 6, async (id) => {
        const text = await fetchOsuFile(id);
        return text ? aimLean(text, mainMods) : null;
      })
    ).filter((l): l is number => l != null);
    const userLean = leans.length >= 5 ? median(leans) : null;

    const q = encodeURIComponent(`stars>=${profile.srLo} stars<=${profile.srHi}`);
    const search = await osuFetch<{ beatmapsets: SearchSet[] }>(
      token,
      `/beatmapsets/search?m=0&s=ranked&sort=plays_desc&q=${q}`,
    );
    const candidates = pickCandidates(search.beatmapsets ?? [], profile);

    const ceiling = profile.top * CEILING;
    const scored = (
      await mapLimit(candidates, 6, async (c) => {
        const osuText = await fetchOsuFile(c.beatmapId);
        if (!osuText) return null;
        // try each of their real mod combos at that combo's own acc; keep the best
        let pick: { rec: Recommendation; lean: number } | null = null;
        for (const combo of profile.combos) {
          try {
            const r = calcPp(osuText, { mods: combo.mods || 0, accuracy: combo.acc, misses: 0 });
            if (r.pp <= profile.floor || r.pp > ceiling) continue;
            if (pick && r.pp <= pick.rec.expectedPp) continue;
            const rate = combo.mods.includes("DT") ? 1.5 : combo.mods.includes("HT") ? 0.75 : 1;
            const lean = aimLean(osuText, combo.mods || 0) ?? 0.5;
            pick = {
              lean,
              rec: {
                beatmapId: c.beatmapId,
                setId: c.setId,
                artist: c.artist,
                title: c.title,
                version: c.version,
                mods: combo.mods || "NM",
                accUsed: combo.acc,
                expectedPp: Math.round(r.pp),
                stars: +r.stars.toFixed(2),
                bpm: Math.round(c.bpm * rate),
                lengthSec: Math.round(c.lengthSec / rate),
                lean: leanTag(lean),
              },
            };
          } catch {
            // unparseable under this combo — skip
          }
        }
        return pick;
      })
    ).filter((p): p is { rec: Recommendation; lean: number } => p != null);

    // rank by pp, discounted by distance from the player's own aim/speed lean
    scored.sort((a, b) => {
      const fit = (l: number) =>
        userLean == null ? 1 : 1 - Math.min(0.4, Math.abs(l - userLean) * 2.5);
      return b.rec.expectedPp * fit(b.lean) - a.rec.expectedPp * fit(a.lean);
    });

    const body = {
      profile: {
        combos: profile.combos.map((c) => ({ mods: c.mods || "NM", acc: c.acc })),
        floor: Math.round(profile.floor),
        top: Math.round(profile.top),
        srLo: profile.srLo,
        srHi: profile.srHi,
        lean: userLean == null ? null : leanTag(userLean),
      },
      recommendations: scored.slice(0, 12).map((s) => s.rec),
    };
    cache.set(me.id, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (e) {
    const status = e instanceof OsuApiError && e.status === 401 ? 401 : 502;
    return NextResponse.json({ error: "fetch_failed" }, { status });
  }
}
