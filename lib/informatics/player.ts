import type { OsuDifficultyAttributes, OsuMe, OsuScore } from "../osu/types";
import { acronyms, scoreCombo } from "../osu/scoreMods";

export type PlayHighlight = {
  beatmapId: number;
  title: string;
  artist: string;
  version: string;
  mods: string; // display acronyms
  combo: string; // scoring combo for filtering, "" = nomod
  pp: number;
  stars: number; // mod-adjusted when attributes are available
  acc: number;
  misses: number;
  lengthSec: number; // effective (rate-adjusted)
  ageDays: number;
};

export type ComboBest = { combo: string; count: number; play: PlayHighlight };
export type PpBand = { from: number; to: number; count: number };
export type Milestone = { pp: number; date: string; ageDays: number; title: string };

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
  plays: PlayHighlight[]; // full top-100 by pp desc, for the mod picker
  comboBests: ComboBest[];
  ppBands: PpBand[];
  ppStats: { top: number; median: number; floor: number };
  efficiency: { ppPerHour: number; playsPerDay: number };
  consistency: { accAvg: number; accStdev: number; noMissRate: number; avgMisses: number };
  modUsage: { mod: string; pct: number }[];
  recency: { newestDays: number; oldestDays: number; last90: number };
  spread: { srMedian: number; bpmMedian: number; arMedian: number; lengthMedianSec: number };
  milestones: Milestone[];
  novelty: {
    fossil: PlayHighlight | null; // oldest play still standing
    scrappiest: PlayHighlight | null; // lowest acc that still made the cut
    favoriteArtists: { artist: string; count: number }[];
    favoriteMapper: { name: string; count: number } | null;
    chokes: { plays: number; misses: number };
    longest: PlayHighlight | null;
    comfort: { lo: number; hi: number }; // modded SR p25 to p75
    grades: { ss: number; s: number; other: number }; // ranks across the top 100
    weekendPct: number; // share of bests set on Sat/Sun (UTC)
    carryPct: number; // top play's share of the weighted top-100 total
  };
};

const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
const mean = (v: number[]) => (v.length ? sum(v) / v.length : 0);
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const quantile = (v: number[], q: number) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
};
const stdev = (v: number[]) => {
  const m = mean(v);
  return Math.sqrt(mean(v.map((x) => (x - m) ** 2)));
};
const missOf = (s: OsuScore) => s.statistics?.count_miss ?? s.statistics?.miss ?? 0;
const rateOf = (acr: string[]) =>
  acr.includes("DT") || acr.includes("NC") ? 1.5 : acr.includes("HT") ? 0.75 : 1;

export type AttrMap = Map<number, OsuDifficultyAttributes | null>;

function toHighlight(s: OsuScore, attrs?: AttrMap): PlayHighlight {
  const acr = acronyms(s.mods);
  const rate = rateOf(acr);
  const attr = attrs?.get(s.beatmap.id);
  return {
    beatmapId: s.beatmap.id,
    title: s.beatmapset?.title ?? s.beatmap.version,
    artist: s.beatmapset?.artist ?? "",
    version: s.beatmap.version,
    mods: acr.length ? [...acr].sort().join("") : "NM",
    combo: scoreCombo(s.mods),
    pp: Math.round(s.pp ?? 0),
    stars: Math.round((attr?.star_rating ?? s.beatmap.difficulty_rating) * 100) / 100,
    acc: Math.round(s.accuracy * 10000) / 100,
    misses: missOf(s),
    lengthSec: Math.round(s.beatmap.hit_length / rate),
    ageDays: Math.floor((Date.now() - new Date(s.created_at).getTime()) / 86_400_000),
  };
}

// first play still standing worth each pp step, most recent steps first.
// steps below the #100 floor are degenerate (every play clears them), skip those
function buildMilestones(scored: OsuScore[], highlights: PlayHighlight[]): Milestone[] {
  if (highlights.length === 0) return [];
  const pps = highlights.map((h) => h.pp);
  const top = Math.max(...pps);
  const floor = Math.min(...pps);
  const start = Math.max(100, (Math.floor(floor / 100) + 1) * 100);
  if (top < start) return [];
  const steps: number[] = [];
  for (let t = start; t <= top; t += 100) steps.push(t);
  const out: Milestone[] = [];
  for (const t of steps.slice(-6)) {
    let idx = -1;
    let earliest = Infinity;
    for (let i = 0; i < scored.length; i++) {
      if ((scored[i].pp ?? 0) < t) continue;
      const at = new Date(scored[i].created_at).getTime();
      if (at < earliest) {
        earliest = at;
        idx = i;
      }
    }
    if (idx >= 0) {
      out.push({
        pp: t,
        date: scored[idx].created_at,
        ageDays: Math.floor((Date.now() - earliest) / 86_400_000),
        title: highlights[idx].title,
      });
    }
  }
  return out.reverse();
}

export function buildPlayerReport(user: OsuMe, best: OsuScore[], attrs?: AttrMap): PlayerReport {
  const scored = best.filter((s) => s.pp != null);
  const st = user.statistics;

  const highlights = scored.map((s) => toHighlight(s, attrs));
  const pps = scored.map((s) => s.pp as number);
  const accs = scored.map((s) => s.accuracy * 100);
  const misses = scored.map(missOf);

  const comboCounts = new Map<string, number>();
  for (const h of highlights) comboCounts.set(h.combo, (comboCounts.get(h.combo) ?? 0) + 1);
  const comboBests: ComboBest[] = [...comboCounts.entries()]
    .map(([combo, count]) => {
      const play = highlights
        .filter((h) => h.combo === combo)
        .reduce((a, b) => (b.pp > a.pp ? b : a));
      return { combo, count, play };
    })
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

  const modCounts = new Map<string, number>();
  for (const s of scored)
    for (const m of acronyms(s.mods)) modCounts.set(m, (modCounts.get(m) ?? 0) + 1);
  const modUsage = [...modCounts.entries()]
    .map(([mod, count]) => ({ mod, pct: Math.round((count / Math.max(1, scored.length)) * 100) }))
    .sort((a, b) => b.pct - a.pct);

  const ages = highlights.map((h) => h.ageDays);
  const srs = highlights.map((h) => h.stars);
  const bpms = scored.map((s) => s.beatmap.bpm * rateOf(acronyms(s.mods)));
  const ars = scored.map(
    (s) => attrs?.get(s.beatmap.id)?.approach_rate ?? s.beatmap.ar,
  );
  const lengths = highlights.map((h) => h.lengthSec);

  const artistCounts = new Map<string, number>();
  for (const h of highlights)
    if (h.artist) artistCounts.set(h.artist, (artistCounts.get(h.artist) ?? 0) + 1);
  const favoriteArtists = [...artistCounts.entries()]
    .map(([artist, count]) => ({ artist, count }))
    .sort((a, b) => b.count - a.count)
    .filter((a) => a.count >= 2)
    .slice(0, 3);

  const chokePlays = highlights.filter((h) => h.misses > 0);

  const mapperCounts = new Map<string, number>();
  for (const s of scored) {
    const c = s.beatmapset?.creator;
    if (c) mapperCounts.set(c, (mapperCounts.get(c) ?? 0) + 1);
  }
  const topMapper = [...mapperCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  let ss = 0;
  let sGrade = 0;
  for (const s of scored) {
    if (s.rank === "X" || s.rank === "XH") ss++;
    else if (s.rank === "S" || s.rank === "SH") sGrade++;
  }

  const weekend = scored.filter((s) => {
    const d = new Date(s.created_at).getUTCDay();
    return d === 0 || d === 6;
  }).length;

  const byPpDesc = [...pps].sort((a, b) => b - a);
  const weightedTotal = byPpDesc.reduce((s, p, i) => s + p * 0.95 ** i, 0);

  const playTimeSec = st.play_time ?? 0;
  const joinDays = Math.max(1, (Date.now() - new Date(user.join_date).getTime()) / 86_400_000);

  const byPp = [...highlights].sort((a, b) => b.pp - a.pp);

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
    top: byPp[0] ?? null,
    plays: byPp,
    comboBests,
    ppBands,
    ppStats: {
      top: Math.round(top),
      median: Math.round(median(pps)),
      floor: Math.round(floor),
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
      newestDays: ages.length ? Math.min(...ages) : 0,
      oldestDays: ages.length ? Math.max(...ages) : 0,
      last90: ages.filter((d) => d <= 90).length,
    },
    spread: {
      srMedian: Math.round(median(srs) * 100) / 100,
      bpmMedian: Math.round(median(bpms)),
      arMedian: Math.round(median(ars) * 10) / 10,
      lengthMedianSec: Math.round(median(lengths)),
    },
    milestones: buildMilestones(scored, highlights),
    novelty: {
      fossil: highlights.length
        ? highlights.reduce((a, b) => (b.ageDays > a.ageDays ? b : a))
        : null,
      scrappiest: highlights.length
        ? highlights.reduce((a, b) => (b.acc < a.acc ? b : a))
        : null,
      favoriteArtists,
      favoriteMapper:
        topMapper && topMapper[1] >= 3 ? { name: topMapper[0], count: topMapper[1] } : null,
      chokes: { plays: chokePlays.length, misses: sum(chokePlays.map((h) => h.misses)) },
      longest: highlights.length
        ? highlights.reduce((a, b) => (b.lengthSec > a.lengthSec ? b : a))
        : null,
      comfort: {
        lo: Math.round(quantile(srs, 0.25) * 100) / 100,
        hi: Math.round(quantile(srs, 0.75) * 100) / 100,
      },
      grades: { ss, s: sGrade, other: Math.max(0, scored.length - ss - sGrade) },
      weekendPct: scored.length ? Math.round((weekend / scored.length) * 100) : 0,
      carryPct:
        weightedTotal > 0 && byPpDesc.length
          ? Math.round((byPpDesc[0] / weightedTotal) * 100)
          : 0,
    },
  };
}
