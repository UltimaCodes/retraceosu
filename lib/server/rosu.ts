import * as rosu from "rosu-pp-js";
import { diskGet, diskSet } from "./diskCache";

export type PpInput = {
  mods: string | number;
  accuracy?: number;
  n300?: number;
  n100?: number;
  n50?: number;
  misses?: number;
  combo?: number;
};

export type PpResult = {
  pp: number;
  ppFc: number; // same acc, no misses, full combo
  stars: number;
  aim: number;
  speed: number;
  maxCombo: number;
};

export function calcPp(osuText: string, input: PpInput): PpResult {
  const map = new rosu.Beatmap(osuText);
  try {
    if (map.mode !== rosu.GameMode.Osu) throw new Error("not an osu!standard map");
    const attrs = new rosu.Performance({
      mods: input.mods,
      accuracy: input.accuracy,
      n300: input.n300,
      n100: input.n100,
      n50: input.n50,
      misses: input.misses,
      combo: input.combo,
    }).calculate(map);
    const fc = new rosu.Performance({
      mods: input.mods,
      accuracy: input.accuracy ?? accFromCounts(input),
      misses: 0,
    }).calculate(map);
    return {
      pp: attrs.pp,
      ppFc: fc.pp,
      stars: attrs.difficulty.stars,
      aim: attrs.difficulty.aim ?? 0,
      speed: attrs.difficulty.speed ?? 0,
      maxCombo: attrs.difficulty.maxCombo,
    };
  } finally {
    map.free();
  }
}

// aim share of total difficulty: ~0.5 balanced, higher = aim map, lower = speed map
export function aimLean(osuText: string, mods: string | number): number | null {
  const map = new rosu.Beatmap(osuText);
  try {
    if (map.mode !== rosu.GameMode.Osu) return null;
    const d = new rosu.Difficulty({ mods }).calculate(map);
    const aim = d.aim ?? 0;
    const speed = d.speed ?? 0;
    return aim + speed > 0 ? aim / (aim + speed) : null;
  } catch {
    return null;
  } finally {
    map.free();
  }
}

function accFromCounts(i: PpInput): number | undefined {
  if (i.n300 == null) return undefined;
  const n300 = i.n300 ?? 0;
  const n100 = i.n100 ?? 0;
  const n50 = i.n50 ?? 0;
  const miss = i.misses ?? 0;
  const total = n300 + n100 + n50 + miss;
  if (!total) return undefined;
  return ((n300 * 300 + n100 * 100 + n50 * 50) / (total * 300)) * 100;
}

// small in-memory .osu cache shared by pp/recommend routes
const osuCache = new Map<number, string>();
const CACHE_MAX = 200;

export async function fetchOsuFile(beatmapId: number): Promise<string | null> {
  const hit = osuCache.get(beatmapId);
  if (hit) return hit;
  const key = String(beatmapId);
  let text = await diskGet<string>("osu", key, 7 * 24 * 3600 * 1000);
  if (!text) {
    const res = await fetch(`https://osu.ppy.sh/osu/${beatmapId}`, { cache: "no-store" });
    if (!res.ok) return null;
    text = await res.text();
    if (!text.startsWith("osu file format")) return null;
    void diskSet("osu", key, text);
  }
  if (osuCache.size >= CACHE_MAX) {
    const first = osuCache.keys().next().value;
    if (first !== undefined) osuCache.delete(first);
  }
  osuCache.set(beatmapId, text);
  return text;
}
