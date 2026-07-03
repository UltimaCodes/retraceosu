export type HitCounts = { great: number; ok: number; meh: number; miss: number };

export type ParsedBeatmap = {
  artist: string;
  title: string;
  version: string;
  creator: string;
  mode: number;
  cs: number;
  ar: number;
  od: number;
  hp: number;
  hitObjects: number;
  circles: number;
  sliders: number;
  spinners: number;
  lengthMs: number;
};

export type ParsedReplay = {
  player: string;
  mods: string;
  rulesetId: number;
  totalScore: number;
  maxCombo: number;
  accuracy: number; // percent
  counts: HitCounts;
  frameCount: number;
  beatmapMD5: string;
  rawStats: Record<string, number>;
};

import type { Mechanics } from "./reconstruct";

export type ViewerObject = {
  t: number;
  x: number;
  y: number;
  type: number; // 0 circle, 1 slider, 2 spinner
  end?: number; // slider/spinner end time
  path?: number[]; // slider body polyline, flat absolute [x0,y0,x1,y1,...]
  j?: number; // judgement: 0=300 1=100 2=50 3=miss
};

export type ViewerFrame = { t: number; x: number; y: number; k: number };

export type ViewerData = {
  objects: ViewerObject[];
  frames: ViewerFrame[];
  radius: number;
  preempt: number; // approach time (ms, map-time)
  lengthMs: number;
  rate: number; // playback clock rate: DT 1.5, HT 0.75, else 1
};

export type ParsedSummary = {
  beatmap: ParsedBeatmap;
  replay: ParsedReplay;
  mechanics: Mechanics;
  viewer: ViewerData;
};

export type ParseResponse =
  | { ok: true; summary: ParsedSummary }
  | { ok: false; error: string };
