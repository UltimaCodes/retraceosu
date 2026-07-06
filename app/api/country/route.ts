import { NextResponse, type NextRequest } from "next/server";
import { getAppToken } from "@/lib/osu/appToken";
import { osuFetch } from "@/lib/osu/client";
import type { OsuScore } from "@/lib/osu/types";
import { buildCountryReport, type CountryPlay, type RankingItem } from "@/lib/informatics/country";
import { fetchAttributes, mapLimit } from "@/lib/osu/difficulty";

const cache = new Map<string, { at: number; body: unknown }>();
const TTL = 30 * 60 * 1000; // country stats move slowly and the fan-out is expensive

const SAMPLE = 50; // top players we pull bests from for big-plays / per-combo bests

// "DTHD" -> ["DT","HD"]; every osu mod acronym is two chars
const comboToMods = (combo: string) => combo.match(/../g) ?? [];

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code)) {
    return NextResponse.json({ error: "bad_code" }, { status: 400 });
  }
  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.body);

  try {
    const token = await getAppToken();
    const ranks = await osuFetch<{ ranking: RankingItem[] }>(
      token,
      `/rankings/osu/performance?country=${code}`,
      2,
    );
    const ranking = ranks.ranking ?? [];
    if (ranking.length === 0) {
      return NextResponse.json({ error: "empty" }, { status: 404 });
    }

    const samples = (
      await mapLimit(ranking.slice(0, SAMPLE), 8, async (r) => {
        try {
          const plays = await osuFetch<OsuScore[]>(
            token,
            `/users/${r.user.id}/scores/best?mode=osu&limit=50`,
            2,
          );
          return { player: { id: r.user.id, username: r.user.username }, plays };
        } catch {
          return null;
        }
      })
    ).filter((s): s is { player: { id: number; username: string }; plays: OsuScore[] } => s != null);

    const body = buildCountryReport(code, ranking, samples);

    // patch displayed plays to mod-adjusted SR (nomod SR lies about DT/HR plays)
    const shown: CountryPlay[] = [
      ...body.bigPlays,
      ...body.comboBests.flatMap((c) => c.plays),
      ...(body.legacy ? [body.legacy] : []),
      ...(body.speedDemon ? [body.speedDemon] : []),
      ...(body.accBest ? [body.accBest] : []),
    ];
    await mapLimit(shown, 8, async (p) => {
      const attr = await fetchAttributes(token, p.beatmapId, comboToMods(p.combo));
      if (attr?.star_rating) p.stars = Math.round(attr.star_rating * 100) / 100;
    });

    cache.set(code, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
