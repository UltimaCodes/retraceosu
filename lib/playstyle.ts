import type { OsuMod, OsuScore } from "./osu/types";

export type Spread = { min: number; median: number; max: number };

export type PlaystyleSummary = {
  sampleSize: number;
  sr: Spread;
  bpm: Spread; // mod-adjusted (effective) BPM
  avgLengthSec: number;
  circleRatio: number; // circles / (circles + sliders)
  avgAccuracy: number; // percent, 0..100
  avgOd: number;
  mods: Record<string, number>; // acronym -> count across the sample
  label: string;
  traits: string[];
};

const EMPTY: PlaystyleSummary = {
  sampleSize: 0,
  sr: { min: 0, median: 0, max: 0 },
  bpm: { min: 0, median: 0, max: 0 },
  avgLengthSec: 0,
  circleRatio: 0,
  avgAccuracy: 0,
  avgOd: 0,
  mods: {},
  label: "Unknown",
  traits: [],
};

function acronyms(mods: OsuMod[]): string[] {
  return mods.map((m) => (typeof m === "string" ? m : m.acronym));
}

// DT/NC speed up the map, HT slows it down; everything else keeps base rate
function rateOf(mods: string[]): number {
  if (mods.includes("DT") || mods.includes("NC")) return 1.5;
  if (mods.includes("HT")) return 0.75;
  return 1;
}

function spread(values: number[]): Spread {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  return { min: sorted[0], median, max: sorted[sorted.length - 1] };
}

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

// thresholds are deliberately coarse; precise aim/speed split waits for rosu-pp strain values
const HIGH_BPM = 185;
const HIGH_CIRCLE_RATIO = 0.62;
const SLIDER_HEAVY_RATIO = 0.45;
const PRECISION_ACC = 98.5;
const LONG_MAP_SEC = 150;

function deriveLabel(s: Omit<PlaystyleSummary, "label" | "traits">): string {
  const bpm = s.bpm.median;
  const cr = s.circleRatio;
  if (bpm >= HIGH_BPM && cr >= HIGH_CIRCLE_RATIO) return "Stream / Speed";
  if (cr >= HIGH_CIRCLE_RATIO) return "Aim / Jump";
  if (cr < SLIDER_HEAVY_RATIO) return "Tech / Flow";
  if (s.avgAccuracy >= PRECISION_ACC) return "Precision / Acc";
  return "All-rounder";
}

function deriveTraits(s: Omit<PlaystyleSummary, "label" | "traits">): string[] {
  const t: string[] = [];
  if (s.bpm.median >= HIGH_BPM) t.push("High BPM");
  if (s.circleRatio >= HIGH_CIRCLE_RATIO) t.push("Circle-heavy");
  if (s.circleRatio < SLIDER_HEAVY_RATIO) t.push("Slider-heavy");
  if (s.avgLengthSec >= LONG_MAP_SEC) t.push("Stamina maps");
  if (s.avgAccuracy >= PRECISION_ACC) t.push("High accuracy");
  if ((s.mods.DT ?? 0) + (s.mods.NC ?? 0) >= s.sampleSize / 2) t.push("DT main");
  if ((s.mods.HD ?? 0) >= s.sampleSize / 2) t.push("HD main");
  if ((s.mods.HR ?? 0) >= s.sampleSize / 2) t.push("HR main");
  return t;
}

export function inferPlaystyle(scores: OsuScore[]): PlaystyleSummary {
  if (scores.length === 0) return EMPTY;

  const mods: Record<string, number> = {};
  const srs: number[] = [];
  const bpms: number[] = [];
  const lengths: number[] = [];
  const accs: number[] = [];
  const ods: number[] = [];
  let circles = 0;
  let sliders = 0;

  for (const score of scores) {
    const acr = acronyms(score.mods);
    const rate = rateOf(acr);
    for (const m of acr) mods[m] = (mods[m] ?? 0) + 1;

    const b = score.beatmap;
    srs.push(b.difficulty_rating);
    bpms.push(b.bpm * rate);
    lengths.push(b.hit_length / rate);
    accs.push(score.accuracy * 100);
    ods.push(b.accuracy);
    circles += b.count_circles;
    sliders += b.count_sliders;
  }

  const base = {
    sampleSize: scores.length,
    sr: spread(srs),
    bpm: spread(bpms),
    avgLengthSec: mean(lengths),
    circleRatio: circles / Math.max(1, circles + sliders),
    avgAccuracy: mean(accs),
    avgOd: mean(ods),
    mods,
  };

  return { ...base, label: deriveLabel(base), traits: deriveTraits(base) };
}
