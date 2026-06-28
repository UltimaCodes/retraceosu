import type {
  OsuDifficultyAttributes,
  OsuMod,
  OsuScore,
  OsuScoreStatistics,
} from "./osu/types";

export type EnrichedPlay = { score: OsuScore; attr: OsuDifficultyAttributes | null };

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

export type MapHighlight = {
  title: string;
  version: string;
  mods: string;
  stars: number; // mod-adjusted
  metric: string;
};

export type PlaystyleAnalysis = {
  sampleSize: number;
  label: string;
  traits: string[];
  skill: SkillDimensions; // anchored to global rank, shaped by tendencies
  highlights: Partial<Record<keyof SkillDimensions, MapHighlight>>;
  sr: Spread; // mod-adjusted star rating
  bpm: Spread; // mod-adjusted (effective) BPM
  ar: Spread; // mod-adjusted approach rate
  cs: Spread;
  od: Spread; // mod-adjusted overall difficulty
  lengthSec: Spread;
  circleRatio: number;
  accuracy: { avg: number; best: number; worst: number; stdev: number };
  pp: { top: number; median: number; floor: number };
  noMissRate: number;
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
  highlights: {},
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
    .filter((m) => m !== "CL");
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
const frac = (v: number, lo: number, hi: number) => clamp((v - lo) / (hi - lo), 0, 1);

// overall skill level (0..100) from global rank, so #1 ~ 100 and a 5-digit sits mid-scale
function rankLevel(globalRank: number | null): number {
  if (!globalRank || globalRank < 1) return 30;
  return clamp(100 - 11 * Math.log10(globalRank), 8, 99);
}

// how far a playstyle lean is allowed to push an axis away from the rank baseline
const SKILL_SPREAD = 46;

type SkillInputs = {
  aimDiff: number;
  speedDiff: number;
  length: number;
  ar: number;
  acc: number;
  sliderRatio: number;
};

function computeSkill(globalRank: number | null, m: SkillInputs): SkillDimensions {
  const t = {
    aim: frac(m.aimDiff, 2.0, 4.2),
    speed: frac(m.speedDiff, 1.8, 3.6),
    stamina: frac(m.length, 30, 240),
    reading: frac(m.ar, 8.0, 10.8),
    accuracy: frac(m.acc, 94, 99.8),
    tech: frac(m.sliderRatio, 0.25, 0.6),
  };
  const base = rankLevel(globalRank);
  const meanT = (t.aim + t.speed + t.stamina + t.reading + t.accuracy + t.tech) / 6;
  const axis = (v: number) => Math.round(clamp(base + (v - meanT) * SKILL_SPREAD, 0, 100));
  return {
    aim: axis(t.aim),
    speed: axis(t.speed),
    stamina: axis(t.stamina),
    reading: axis(t.reading),
    accuracy: axis(t.accuracy),
    tech: axis(t.tech),
  };
}

const HIGH_BPM = 185;
const HIGH_CIRCLE_RATIO = 0.62;
const SLIDER_HEAVY_RATIO = 0.45;
const PRECISION_ACC = 98.5;
const LONG_MAP_SEC = 150;
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

function mmss(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

function sliderRatioOf(score: OsuScore): number {
  const b = score.beatmap;
  return b.count_sliders / Math.max(1, b.count_circles + b.count_sliders);
}

function highlight(play: EnrichedPlay, metric: string): MapHighlight {
  const acr = acronyms(play.score.mods);
  const stars = play.attr?.star_rating ?? play.score.beatmap.difficulty_rating;
  return {
    title: play.score.beatmapset?.title ?? "Unknown",
    version: play.score.beatmap.version,
    mods: acr.length ? `+${acr.join("")}` : "NM",
    stars: Math.round(stars * 100) / 100,
    metric,
  };
}

export function analyzeTopPlays(
  plays: EnrichedPlay[],
  globalRank: number | null,
): PlaystyleAnalysis {
  if (plays.length === 0) return EMPTY;
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
  const aimVals: number[] = [];
  const speedVals: number[] = [];
  const missCounts: number[] = [];
  const ages: number[] = [];
  let circles = 0;
  let sliders = 0;

  for (const { score, attr } of plays) {
    const acr = acronyms(score.mods);
    const rate = rateOf(acr);
    for (const m of acr) mods[m] = (mods[m] ?? 0) + 1;
    const comboKey = acr.length ? [...acr].sort().join("") : "NM";
    combos[comboKey] = (combos[comboKey] ?? 0) + 1;

    const b = score.beatmap;
    srs.push(attr?.star_rating ?? b.difficulty_rating);
    bpms.push(b.bpm * rate);
    ars.push(attr?.approach_rate ?? b.ar);
    css.push(b.cs);
    ods.push(attr?.overall_difficulty ?? b.accuracy);
    lengths.push(b.hit_length / rate);
    accs.push(score.accuracy * 100);
    if (score.pp != null) pps.push(score.pp);
    if (attr?.aim_difficulty != null) aimVals.push(attr.aim_difficulty);
    if (attr?.speed_difficulty != null) speedVals.push(attr.speed_difficulty);
    missCounts.push(missesOf(score.statistics));
    ages.push((now - new Date(score.created_at).getTime()) / 86_400_000);
    circles += b.count_circles;
    sliders += b.count_sliders;
  }

  const circleRatio = circles / Math.max(1, circles + sliders);
  const srSpread = spread(srs);
  const bpmSpread = spread(bpms);
  const arSpread = spread(ars);
  const lengthSpread = spread(lengths);
  const avgAcc = mean(accs);

  const modList: ModUse[] = Object.entries(mods)
    .map(([mod, count]) => ({ mod, count, pct: Math.round((count / plays.length) * 100) }))
    .sort((a, b) => b.count - a.count);

  const skill = computeSkill(globalRank, {
    aimDiff: aimVals.length ? median(aimVals) : srSpread.median * 0.62,
    speedDiff: speedVals.length ? median(speedVals) : srSpread.median * 0.55,
    length: lengthSpread.median,
    ar: arSpread.median,
    acc: avgAcc,
    sliderRatio: 1 - circleRatio,
  });

  const argmax = (valueFn: (p: EnrichedPlay) => number | undefined) => {
    let best: EnrichedPlay | null = null;
    let bestV = -Infinity;
    for (const p of plays) {
      const v = valueFn(p);
      if (v != null && v > bestV) {
        bestV = v;
        best = p;
      }
    }
    return best ? { play: best, value: bestV } : null;
  };

  const aimH = argmax((p) => p.attr?.aim_difficulty);
  const speedH = argmax((p) => p.attr?.speed_difficulty);
  const stamH = argmax((p) => p.score.beatmap.hit_length / rateOf(acronyms(p.score.mods)));
  const readH = argmax((p) => p.attr?.approach_rate ?? p.score.beatmap.ar);
  const accH = argmax((p) => p.score.accuracy);
  const techH = argmax((p) => sliderRatioOf(p.score));

  const highlights: Partial<Record<keyof SkillDimensions, MapHighlight>> = {};
  if (aimH) highlights.aim = highlight(aimH.play, `aim ${aimH.value.toFixed(2)}`);
  if (speedH) highlights.speed = highlight(speedH.play, `speed ${speedH.value.toFixed(2)}`);
  if (stamH) highlights.stamina = highlight(stamH.play, `${mmss(stamH.value)} drain`);
  if (readH) highlights.reading = highlight(readH.play, `AR ${readH.value.toFixed(1)}`);
  if (accH) highlights.accuracy = highlight(accH.play, `${(accH.value * 100).toFixed(2)}% acc`);
  if (techH) highlights.tech = highlight(techH.play, `${Math.round(techH.value * 100)}% sliders`);

  return {
    sampleSize: plays.length,
    label: deriveLabel(skill),
    traits: deriveTraits(bpmSpread.median, circleRatio, lengthSpread.median, avgAcc, modList),
    skill,
    highlights,
    sr: srSpread,
    bpm: bpmSpread,
    ar: arSpread,
    cs: spread(css),
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
    noMissRate: missCounts.filter((m) => m === 0).length / plays.length,
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
