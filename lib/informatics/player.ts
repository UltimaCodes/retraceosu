import type { OsuMe, OsuScore } from "../osu/types";
import { acronyms, scoreCombo } from "../osu/scoreMods";

export type PlayHighlight = {
  beatmapId: number;
  title: string;
  version: string;
  mods: string;
  pp: number;
  stars: number;
  acc: number;
  ageDays: number;
};

export type ModBest = { mod: string; play: PlayHighlight | null; count: number };
export type ComboBest = { combo: string; count: number; play: PlayHighlight };
export type PpBand = { from: number; to: number; count: number };

export type PlayerReport = {
  user: {
    id: number;
    username: string;
    avatarUrl: string;
    countryCode: string;
    countryName: string;
    globalRank: number | null;
    countryRank: number | null;
    pp: number;
    accuracy: number;
    playCount: number;
    playTimeSec: number;
    joinDate: string;
    level: number;
    supporter: boolean;
  };
  top: PlayHighlight | null;
  modBests: ModBest[];
  comboBests: ComboBest[];
  ppBands: PpBand[];
  ppStats: { top: number; median: number; floor: number; weightedTop: number };
  efficiency: { ppPerHour: number; playsPerDay: number };
  consistency: { accAvg: number; accStdev: number; noMissRate: number; avgMisses: number };
  modUsage: { mod: string; pct: number }[];
  recency: { newestDays: number; oldestDays: number; last90: number };
  spread: { srMedian: number; bpmMedian: number; arMedian: number; lengthMedianSec: number };
};

const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
const mean = (v: number[]) => (v.length ? sum(v) / v.length : 0);
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const stdev = (v: number[]) => {
  const m = mean(v);
  return Math.sqrt(mean(v.map((x) => (x - m) ** 2)));
};
const missOf = (s: OsuScore) => s.statistics?.count_miss ?? s.statistics?.miss ?? 0;
const rateOf = (acr: string[]) =>
  acr.includes("DT") || acr.includes("NC") ? 1.5 : acr.includes("HT") ? 0.75 : 1;

function toHighlight(s: OsuScore): PlayHighlight {
  const acr = acronyms(s.mods);
  return {
    beatmapId: s.beatmap.id,
    title: s.beatmapset?.title ?? s.beatmap.version,
    version: s.beatmap.version,
    mods: acr.length ? [...acr].sort().join("") : "NM",
    pp: Math.round(s.pp ?? 0),
    stars: Math.round(s.beatmap.difficulty_rating * 100) / 100,
    acc: Math.round(s.accuracy * 10000) / 100,
    ageDays: Math.floor((Date.now() - new Date(s.created_at).getTime()) / 86_400_000),
  };
}

// individual mods we split "best play" on; NM = no scoring mods
const SPLIT_MODS = ["NM", "HD", "DT", "HR", "FL", "EZ"];
const hasMod = (combo: string, mod: string) =>
  mod === "NM" ? combo === "" : combo.includes(mod);

export function buildPlayerReport(user: OsuMe, best: OsuScore[]): PlayerReport {
  const scored = best.filter((s) => s.pp != null);
  const st = user.statistics;

  const highlights = scored.map(toHighlight);
  const combos = scored.map((s) => scoreCombo(s.mods));
  const pps = scored.map((s) => s.pp as number);
  const accs = scored.map((s) => s.accuracy * 100);
  const misses = scored.map(missOf);

  const bestByPp = (pred: (i: number) => boolean): PlayHighlight | null => {
    let idx = -1;
    let bestPp = -1;
    for (let i = 0; i < scored.length; i++) {
      if (pred(i) && pps[i] > bestPp) {
        bestPp = pps[i];
        idx = i;
      }
    }
    return idx >= 0 ? highlights[idx] : null;
  };

  const modBests: ModBest[] = SPLIT_MODS.map((mod) => ({
    mod,
    play: bestByPp((i) => hasMod(combos[i], mod)),
    count: combos.filter((c) => hasMod(c, mod)).length,
  })).filter((m) => m.count > 0);

  const comboCounts = new Map<string, number>();
  for (const c of combos) comboCounts.set(c, (comboCounts.get(c) ?? 0) + 1);
  const comboBests: ComboBest[] = [...comboCounts.entries()]
    .map(([combo, count]) => ({ combo, count, play: bestByPp((i) => combos[i] === combo)! }))
    .filter((c) => c.play)
    .sort((a, b) => b.play.pp - a.play.pp)
    .slice(0, 8);

  // pp bands from floor to top in even steps, so the pp profile is visible
  const top = pps.length ? Math.max(...pps) : 0;
  const floor = pps.length ? Math.min(...pps) : 0;
  const bandCount = 6;
  const step = Math.max(1, (top - floor) / bandCount);
  const ppBands: PpBand[] = [];
  for (let i = 0; i < bandCount; i++) {
    const from = floor + step * i;
    const to = i === bandCount - 1 ? top + 0.01 : floor + step * (i + 1);
    ppBands.push({
      from: Math.round(from),
      to: Math.round(to),
      count: pps.filter((p) => p >= from && p < to).length,
    });
  }

  // weighted pp of the visible top plays (0.95^n), how much of their total these carry
  const weightedTop = sum(
    [...pps].sort((a, b) => b - a).map((p, i) => p * Math.pow(0.95, i)),
  );

  const modCounts = new Map<string, number>();
  for (const s of scored) for (const m of acronyms(s.mods)) modCounts.set(m, (modCounts.get(m) ?? 0) + 1);
  const modUsage = [...modCounts.entries()]
    .map(([mod, count]) => ({ mod, pct: Math.round((count / Math.max(1, scored.length)) * 100) }))
    .sort((a, b) => b.pct - a.pct);

  const ages = scored.map(
    (s) => (Date.now() - new Date(s.created_at).getTime()) / 86_400_000,
  );
  const srs = scored.map((s) => s.beatmap.difficulty_rating);
  const bpms = scored.map((s) => s.beatmap.bpm * rateOf(acronyms(s.mods)));
  const ars = scored.map((s) => s.beatmap.ar);
  const lengths = scored.map((s) => s.beatmap.hit_length / rateOf(acronyms(s.mods)));

  const playTimeSec = st.play_time ?? 0;
  const joinDays = Math.max(
    1,
    (Date.now() - new Date(user.join_date).getTime()) / 86_400_000,
  );

  return {
    user: {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatar_url,
      countryCode: user.country_code,
      countryName: user.country?.name ?? user.country_code,
      globalRank: st.global_rank,
      countryRank: st.country_rank,
      pp: Math.round(st.pp),
      accuracy: st.hit_accuracy,
      playCount: st.play_count,
      playTimeSec,
      joinDate: user.join_date,
      level: st.level.current,
      supporter: user.is_supporter,
    },
    top: highlights.length ? highlights.reduce((a, b) => (b.pp > a.pp ? b : a)) : null,
    modBests,
    comboBests,
    ppBands,
    ppStats: {
      top: Math.round(top),
      median: Math.round(median(pps)),
      floor: Math.round(floor),
      weightedTop: Math.round(weightedTop),
    },
    efficiency: {
      ppPerHour: playTimeSec > 0 ? Math.round((st.pp / (playTimeSec / 3600)) * 10) / 10 : 0,
      playsPerDay: Math.round((st.play_count / joinDays) * 10) / 10,
    },
    consistency: {
      accAvg: Math.round(mean(accs) * 100) / 100,
      accStdev: Math.round(stdev(accs) * 100) / 100,
      noMissRate: scored.length ? misses.filter((m) => m === 0).length / scored.length : 0,
      avgMisses: Math.round(mean(misses) * 10) / 10,
    },
    modUsage,
    recency: {
      newestDays: ages.length ? Math.floor(Math.min(...ages)) : 0,
      oldestDays: ages.length ? Math.floor(Math.max(...ages)) : 0,
      last90: ages.filter((d) => d <= 90).length,
    },
    spread: {
      srMedian: Math.round(median(srs) * 100) / 100,
      bpmMedian: Math.round(median(bpms)),
      arMedian: Math.round(median(ars) * 10) / 10,
      lengthMedianSec: Math.round(median(lengths)),
    },
  };
}
