import { NextResponse, type NextRequest } from "next/server";
import { OsuApiError, osuFetch } from "@/lib/osu/client";
import type { OsuMe, OsuScore } from "@/lib/osu/types";
import { deriveFarmProfile, pickCandidates, type SearchSet } from "@/lib/recommend";
import { aimLean, calcPp, fetchOsuFile } from "@/lib/server/rosu";
import { scoreCombo } from "@/lib/osu/scoreMods";
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

// a top-100 play left pp on the table: a choke, or accuracy genuinely low enough to push
export type Choke = {
  beatmapId: number;
  title: string;
  version: string;
  mods: string;
  stars: number;
  currentPp: number;
  currentAcc: number;
  misses: number;
  potentialPp: number;
  gain: number;
  reason: "choke" | "acc";
  targetAcc: number;
};

const cache = new Map<number, { at: number; body: unknown }>();
const TTL = 10 * 60 * 1000;

// recs beyond your best play * this are FC fantasies, not farm
const CEILING = 1.2;

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0.5;
};

const leanTag = (l: number): Recommendation["lean"] =>
  l >= 0.54 ? "aim" : l <= 0.46 ? "speed" : "balanced";

const missOf = (s: OsuScore) => s.statistics?.count_miss ?? s.statistics?.miss ?? 0;

// price the plays you already own but underperformed, only when there's real pp to gain
async function computeChokes(best: OsuScore[]): Promise<Choke[]> {
  const cands = best
    .filter((s) => s.pp != null)
    .filter((s) => missOf(s) > 0 || s.accuracy * 100 < 96) // a real choke, or acc actually bad
    .sort((a, b) => missOf(b) - missOf(a) || a.accuracy - b.accuracy)
    .slice(0, 30);

  const out = (
    await mapLimit(cands, 6, async (s) => {
      const text = await fetchOsuFile(s.beatmap.id);
      if (!text) return null;
      const combo = scoreCombo(s.mods);
      const curAcc = s.accuracy * 100;
      const miss = missOf(s);
      const curPp = s.pp as number;
      try {
        const reason: Choke["reason"] = miss > 0 ? "choke" : "acc";
        // choke: same acc but no misses / full combo. bad acc: push acc a realistic notch
        const targetAcc = reason === "choke" ? curAcc : Math.min(99, Math.round((curAcc + 2) * 10) / 10);
        const r = calcPp(text, { mods: combo || 0, accuracy: targetAcc, misses: 0 });
        const potentialPp = r.pp;
        const gain = potentialPp - curPp;
        if (gain < Math.max(10, curPp * 0.04)) return null;
        return {
          beatmapId: s.beatmap.id,
          title: s.beatmapset?.title ?? s.beatmap.version,
          version: s.beatmap.version,
          mods: combo || "NM",
          stars: +r.stars.toFixed(2), // mod-adjusted, not the nomod listing SR
          currentPp: Math.round(curPp),
          currentAcc: +curAcc.toFixed(2),
          misses: miss,
          potentialPp: Math.round(potentialPp),
          gain: Math.round(gain),
          reason,
          targetAcc: +targetAcc.toFixed(1),
        } as Choke;
      } catch {
        return null;
      }
    })
  ).filter((c): c is Choke => c != null);
  out.sort((a, b) => b.gain - a.gain);
  return out.slice(0, 25);
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get("osu_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";

  try {
    const me = await osuFetch<OsuMe>(token, "/me/osu");
    if (!refresh) {
      const hit = cache.get(me.id);
      if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.body);
    }

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
    const candidates = pickCandidates(search.beatmapsets ?? [], profile, 60);

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
            // unparseable under this combo, skip
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

    const chokes = await computeChokes(best);

    const body = {
      profile: {
        combos: profile.combos.map((c) => ({ mods: c.mods || "NM", acc: c.acc })),
        floor: Math.round(profile.floor),
        top: Math.round(profile.top),
        srLo: profile.srLo,
        srHi: profile.srHi,
        lean: userLean == null ? null : leanTag(userLean),
      },
      recommendations: scored.slice(0, 50).map((s) => s.rec),
      chokes,
    };
    cache.set(me.id, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (e) {
    const status = e instanceof OsuApiError && e.status === 401 ? 401 : 502;
    return NextResponse.json({ error: "fetch_failed" }, { status });
  }
}
