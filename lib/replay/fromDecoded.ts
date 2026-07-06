import type { Beatmap, Score } from "osu-classes";
import {
  Circle,
  Slider,
  Spinner,
  StandardRuleset,
  type StandardBeatmap,
} from "osu-standard-stable";
import { judgePlay, stackedPos } from "./judge";
import { clockRate, modsFromBitmask } from "./mods";
import { computeCursorStats, computeKeyStats } from "./style";
import { circleRadius, type Frame, type Judgement, type Mechanics } from "./reconstruct";
import type { ViewerData, ViewerObject } from "./types";

const KEY_MASK = 1 | 2 | 4 | 8;
const MAX_PATH_PTS = 24;
const J_NUM: Record<Judgement, number> = { great: 0, ok: 1, meh: 2, miss: 3 };

function arToPreempt(ar: number): number {
  return ar <= 5 ? 1800 - 120 * ar : 1200 - 150 * (ar - 5);
}

// slider body as an absolute polyline, downsampled for the payload
function sliderPath(o: Slider): number[] {
  const pts = (o.path as unknown as { calculatedPath: { x: number; y: number }[] })
    .calculatedPath;
  const sp = stackedPos(o);
  if (!pts || pts.length === 0) return [sp.x, sp.y];
  const step = Math.max(1, Math.ceil(pts.length / MAX_PATH_PTS));
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += step) {
    out.push(Math.round(sp.x + pts[i].x), Math.round(sp.y + pts[i].y));
  }
  const last = pts[pts.length - 1];
  const lx = Math.round(sp.x + last.x);
  const ly = Math.round(sp.y + last.y);
  if (out[out.length - 2] !== lx || out[out.length - 1] !== ly) out.push(lx, ly);
  return out;
}

function buildViewer(
  beatmap: StandardBeatmap,
  frames: Frame[],
  rate: number,
  judgements: Judgement[],
): ViewerData {
  const objects: ViewerObject[] = beatmap.hitObjects.map((o, i) => {
    const p = stackedPos(o);
    const base: ViewerObject = {
      t: Math.round(o.startTime),
      x: Math.round(p.x),
      y: Math.round(p.y),
      type: o instanceof Circle ? 0 : o instanceof Slider ? 1 : 2,
      j: J_NUM[judgements[i]] ?? 0,
    };
    if (o instanceof Slider) {
      base.end = Math.round(o.endTime);
      base.path = sliderPath(o);
    } else if (o instanceof Spinner) {
      base.end = Math.round(o.endTime);
    }
    return base;
  });

  const vframes = frames
    .filter((f) => f.time >= 0)
    .map((f) => ({
      t: Math.round(f.time),
      x: Math.round(f.x),
      y: Math.round(f.y),
      k: f.keys & KEY_MASK ? 1 : 0,
    }))
    .sort((a, b) => a.t - b.t);

  const last = objects[objects.length - 1];
  return {
    objects,
    frames: vframes,
    radius: circleRadius(beatmap.difficulty.circleSize),
    preempt: arToPreempt(beatmap.difficulty.approachRate),
    lengthMs: last ? (last.end ?? last.t) : 0,
    rate,
  };
}

// single ruleset pass -> both the judgement and the viewer payload
export function analyzeFromDecoded(
  beatmap: Beatmap,
  score: Score,
): { mechanics: Mechanics; viewer: ViewerData } {
  const ruleset = new StandardRuleset();
  const standard = ruleset.applyToBeatmapWithMods(
    beatmap,
    ruleset.createModCombination(Number(score.info.rawMods)),
  ) as StandardBeatmap;

  const frames: Frame[] = (score.replay?.frames ?? []).map((f) => {
    const lf = f as unknown as {
      startTime: number;
      position: { x: number; y: number };
      buttonState: number;
    };
    return { time: lf.startTime, x: lf.position.x, y: lf.position.y, keys: lf.buttonState };
  });

  const rate = clockRate(modsFromBitmask(Number(score.info.rawMods)));
  const { mechanics, objectJudgements } = judgePlay(standard, frames, rate);
  const viewer = buildViewer(standard, frames, rate, objectJudgements);
  mechanics.keys = computeKeyStats(frames, rate) ?? undefined;
  mechanics.cursor = computeCursorStats(viewer.objects, viewer.frames, viewer.radius) ?? undefined;
  return { mechanics, viewer };
}
