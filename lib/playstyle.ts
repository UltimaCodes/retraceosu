import type { OsuMod, OsuScore, OsuScoreStatistics } from "./osu/types";

export type Spread = { min: number; median: number; max: number };

export type ModUse = { mod: string; count: number; pct: number };

export type SkillDimensions = {
  aim: number;
  speed: number;
  stamina: number;
  reading: number;
  accuracy: number;
  tech: number;
};

export type PlaystyleAnalysis = {
  sampleSize: number;
  label: string;
  traits: string[];
  skill: SkillDimensions; // 0..100, heuristic from top plays
  sr: Spread;
  bpm: Spread; // mod-adjusted (effective) BPM
  ar: Spread;
  cs: Spread;
  od: Spread;
  lengthSec: Spread;
  circleRatio: number; // circles / (circles + sliders)
  accuracy: { avg: number; best: number; worst: number; stdev: number };
  pp: { top: number; median: number; floor: number };
  noMissRate: number; // share of top plays with zero misses
  avgMisses: number;
  mods: ModUse[];
  modCombos: { combo: string; count: number }[];
  recency: { newestDays: number; oldestDays: number; last90: number };
};

const ZERO: Spread = { min: 0, median: 0, max: 0 };

const EMPTY: PlaystyleAnalysis = {
  sampleSize: 0,
  label: "Unknown",
  traits: [],
  skill: { aim: 0, speed: 0, stamina: 0, reading: 0, accuracy: 0, tech: 0 },
  sr: ZERO,
  bpm: ZERO,
  ar: ZERO,
  cs: ZERO,
  od: ZERO,
  lengthSec: ZERO,
  circleRatio: 0,
  accuracy: { avg: 0, best: 0, worst: 0, stdev: 0 },
  pp: { top: 0, median: 0, floor: 0 },
  noMissRate: 0,
  avgMisses: 0,
  mods: [],
  modCombos: [],
  recency: { newestDays: 0, oldestDays: 0, last90: 0 },
};

function acronyms(mods: OsuMod[]): string[] {
  return mods
    .map((m) => (typeof m === "string" ? m : m.acronym))
    .filter((m) => m !== "CL"); // classic mod is noise on lazer scores
}

// DT/NC speed up the map, HT slows it down; everything else keeps base rate
function rateOf(mods: string[]): number {
  if (mods.includes("DT") || mods.includes("NC")) return 1.5;
  if (mods.includes("HT")) return 0.75;
  return 1;
}

function missesOf(s?: OsuScoreStatistics): number {
  if (!s) return 0;
  return s.count_miss ?? s.miss ?? 0;
}

const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
const mean = (v: number[]) => sum(v) / v.length;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function spread(values: number[]): Spread {
  const s = [...values].sort((a, b) => a - b);
  return { min: s[0], median: median(s), max: s[s.length - 1] };
}

function stdev(values: number[]): number {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// map a raw metric onto 0..100 against a reference band
const norm = (v: number, lo: number, hi: number) =>
  Math.round(clamp(((v - lo) / (hi - lo)) * 100, 0, 100));

const HIGH_BPM = 185;
const HIGH_CIRCLE_RATIO = 0.62;
const SLIDER_HEAVY_RATIO = 0.45;
const PRECISION_ACC = 98.5;
const LONG_MAP_SEC = 150;

// minimum lead a dimension needs over the average to claim a specialty
const SPECIALTY_LEAD = 14;

// label off the strongest skill dimension, not brittle map-attribute cutoffs
function deriveLabel(skill: SkillDimensions): string {
  const buckets: [string, number][] = [
    ["Speed / Stream", skill.speed],
    ["Aim / Jump", skill.aim],
    ["Tech / Flow", skill.tech],
    ["Precision / Acc", skill.accuracy],
  ];
  const avg = buckets.reduce((s, [, v]) => s + v, 0) / buckets.length;
  const [name, value] = buckets.reduce((a, b) => (b[1] > a[1] ? b : a));
  return value - avg >= SPECIALTY_LEAD ? name : "All-rounder";
}

export function analyzeTopPlays(scores: OsuScore[]): PlaystyleAnalysis {
  if (scores.length === 0) return EMPTY;
  const now = Date.now();

  const mods: Record<string, number> = {};
  const combos: Record<string, number> = {};
  const srs: number[] = [];
  const bpms: number[] = [];
  const ars: number[] = [];
  const css: number[] = [];
  const ods: number[] = [];
  const lengths: number[] = [];
  const accs: number[] = [];
  const pps: number[] = [];
  const missCounts: number[] = [];
  const ages: number[] = [];
  let circles = 0;
  let sliders = 0;

  for (const score of scores) {
    const acr = acronyms(score.mods);
    const rate = rateOf(acr);
    for (const m of acr) mods[m] = (mods[m] ?? 0) + 1;
    const comboKey = acr.length ? [...acr].sort().join("") : "NM";
    combos[comboKey] = (combos[comboKey] ?? 0) + 1;

    const b = score.beatmap;
    srs.push(b.difficulty_rating);
    bpms.push(b.bpm * rate);
    ars.push(b.ar);
    css.push(b.cs);
    ods.push(b.accuracy);
    lengths.push(b.hit_length / rate);
    accs.push(score.accuracy * 100);
    if (score.pp != null) pps.push(score.pp);
    missCounts.push(missesOf(score.statistics));
    ages.push((now - new Date(score.created_at).getTime()) / 86_400_000);
    circles += b.count_circles;
    sliders += b.count_sliders;
  }

  const circleRatio = circles / Math.max(1, circles + sliders);
  const srSpread = spread(srs);
  const bpmSpread = spread(bpms);
  const arSpread = spread(ars);
  const csSpread = spread(css);
  const lengthSpread = spread(lengths);
  const avgAcc = mean(accs);

  const modList: ModUse[] = Object.entries(mods)
    .map(([mod, count]) => ({ mod, count, pct: Math.round((count / scores.length) * 100) }))
    .sort((a, b) => b.count - a.count);

  const skill: SkillDimensions = {
    aim: norm(srSpread.median, 3.5, 7.5),
    speed: norm(bpmSpread.median, 150, 230),
    stamina: norm(lengthSpread.median, 60, 240),
    reading: norm(arSpread.median, 8.5, 10.3),
    accuracy: norm(avgAcc, 95, 99.5),
    tech: norm(1 - circleRatio, 0.3, 0.6),
  };

  return {
    sampleSize: scores.length,
    label: deriveLabel(skill),
    traits: deriveTraits(bpmSpread.median, circleRatio, lengthSpread.median, avgAcc, modList),
    skill,
    sr: srSpread,
    bpm: bpmSpread,
    ar: arSpread,
    cs: csSpread,
    od: spread(ods),
    lengthSec: lengthSpread,
    circleRatio,
    accuracy: {
      avg: avgAcc,
      best: Math.max(...accs),
      worst: Math.min(...accs),
      stdev: stdev(accs),
    },
    pp: {
      top: pps.length ? Math.max(...pps) : 0,
      median: pps.length ? median(pps) : 0,
      floor: pps.length ? Math.min(...pps) : 0,
    },
    noMissRate: missCounts.filter((m) => m === 0).length / scores.length,
    avgMisses: mean(missCounts),
    mods: modList,
    modCombos: Object.entries(combos)
      .map(([combo, count]) => ({ combo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    recency: {
      newestDays: Math.floor(Math.min(...ages)),
      oldestDays: Math.floor(Math.max(...ages)),
      last90: ages.filter((d) => d <= 90).length,
    },
  };
}

function deriveTraits(
  bpmMedian: number,
  circleRatio: number,
  lengthMedian: number,
  avgAcc: number,
  mods: ModUse[],
): string[] {
  const t: string[] = [];
  const pctOf = (m: string) => mods.find((x) => x.mod === m)?.pct ?? 0;
  if (bpmMedian >= HIGH_BPM) t.push("High BPM");
  if (circleRatio >= HIGH_CIRCLE_RATIO) t.push("Circle-heavy");
  if (circleRatio < SLIDER_HEAVY_RATIO) t.push("Slider-heavy");
  if (lengthMedian >= LONG_MAP_SEC) t.push("Stamina maps");
  if (avgAcc >= PRECISION_ACC) t.push("High accuracy");
  if (pctOf("DT") + pctOf("NC") >= 50) t.push("DT main");
  if (pctOf("HD") >= 50) t.push("HD main");
  if (pctOf("HR") >= 50) t.push("HR main");
  return t;
}
