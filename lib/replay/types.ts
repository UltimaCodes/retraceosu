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

export type ParsedSummary = {
  beatmap: ParsedBeatmap;
  replay: ParsedReplay;
  mechanics: Mechanics;
};

export type ParseResponse =
  | { ok: true; summary: ParsedSummary }
  | { ok: false; error: string };
