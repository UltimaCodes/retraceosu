import type { OsuMod, OsuScore } from "./osu/types";

export type ComboProfile = {
  mods: string; // scoring-relevant combo, "" = nomod
  acc: number; // median accuracy on that combo, percent
  count: number;
};

export type FarmProfile = {
  combos: ComboProfile[]; // top combos by usage, most-played first
  srLo: number; // nomod SR comfort band for candidates
  srHi: number;
  floor: number; // lowest pp in top plays, the bar to clear
  top: number; // best play pp, realism ceiling for recommendations
  owned: number[]; // beatmap ids already in top plays
  sampleIds: number[]; // highest-pp beatmap ids, for measuring aim/speed lean
};

export type SearchBeatmap = {
  id: number;
  mode_int: number;
  difficulty_rating: number;
  total_length: number;
  bpm: number;
  version: string;
};

export type SearchSet = {
  id: number;
  title: string;
  artist: string;
  play_count: number;
  beatmaps?: SearchBeatmap[];
};

export type Candidate = {
  beatmapId: number;
  setId: number;
  artist: string;
  title: string;
  version: string;
  bpm: number;
  lengthSec: number;
  playCount: number;
};

// SD/PF/NF don't change pp; CL is lazer noise; NC scores identically to DT
const PP_MODS = new Set(["HD", "HR", "DT", "EZ", "HT", "FL"]);

function ppCombo(mods: OsuMod[]): string {
  const set = new Set<string>();
  for (const m of mods) {
    let a = typeof m === "string" ? m : m.acronym;
    if (a === "NC") a = "DT";
    if (PP_MODS.has(a)) set.add(a);
  }
  return [...set].sort().join("");
}

const quantile = (sorted: number[], q: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

export function deriveFarmProfile(scores: OsuScore[]): FarmProfile | null {
  const withPp = scores.filter((s) => s.pp != null);
  if (withPp.length < 5) return null;

  const byCombo = new Map<string, OsuScore[]>();
  for (const s of withPp) {
    const c = ppCombo(s.mods);
    byCombo.set(c, [...(byCombo.get(c) ?? []), s]);
  }
  // top 2 combos, second only if it's a real part of their play (>=15%)
  const ranked = [...byCombo.entries()].sort((a, b) => b[1].length - a[1].length);
  const combos: ComboProfile[] = ranked
    .filter(([, list], i) => i === 0 || list.length >= withPp.length * 0.15)
    .slice(0, 2)
    .map(([mods, list]) => {
      const accs = list.map((s) => s.accuracy * 100).sort((a, b) => a - b);
      return { mods, acc: +quantile(accs, 0.5).toFixed(2), count: list.length };
    });

  const main = ranked[0][1].length >= 8 ? ranked[0][1] : withPp;
  const srs = main.map((s) => s.beatmap.difficulty_rating).sort((a, b) => a - b);
  const pps = withPp.map((s) => s.pp as number);

  return {
    combos,
    // FCs happen below your ceiling, band ends near p80, not at your hardest scrape
    srLo: +quantile(srs, 0.35).toFixed(2),
    srHi: +(quantile(srs, 0.8) + 0.1).toFixed(2),
    floor: scores.length >= 100 ? Math.min(...pps) : 0,
    top: Math.max(...pps),
    owned: withPp.map((s) => s.beatmap.id),
    sampleIds: [...withPp]
      .sort((a, b) => (b.pp as number) - (a.pp as number))
      .slice(0, 12)
      .map((s) => s.beatmap.id),
  };
}

export function pickCandidates(
  sets: SearchSet[],
  profile: FarmProfile,
  cap = 24,
): Candidate[] {
  const owned = new Set(profile.owned);
  const out: Candidate[] = [];
  for (const set of sets) {
    for (const b of set.beatmaps ?? []) {
      if (b.mode_int !== 0) continue;
      if (b.difficulty_rating < profile.srLo || b.difficulty_rating > profile.srHi) continue;
      if (b.total_length < 25 || b.total_length > 320) continue;
      if (owned.has(b.id)) continue;
      out.push({
        beatmapId: b.id,
        setId: set.id,
        artist: set.artist,
        title: set.title,
        version: b.version,
        bpm: b.bpm,
        lengthSec: b.total_length,
        playCount: set.play_count,
      });
    }
  }
  out.sort((a, b) => b.playCount - a.playCount);
  // one diff per set keeps the list varied
  const seen = new Set<number>();
  return out.filter((c) => !seen.has(c.setId) && seen.add(c.setId)).slice(0, cap);
}
