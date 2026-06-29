import type { Beatmap, Score } from "osu-classes";
import {
  Circle,
  Slider,
  Spinner,
  StandardRuleset,
  type StandardBeatmap,
} from "osu-standard-stable";
import { judgePlay } from "./judge";
import { circleRadius, type Frame, type Mechanics } from "./reconstruct";
import type { ViewerData, ViewerObject } from "./types";

const KEY_MASK = 1 | 2 | 4 | 8;

function arToPreempt(ar: number): number {
  return ar <= 5 ? 1800 - 120 * ar : 1200 - 150 * (ar - 5);
}

function buildViewer(beatmap: StandardBeatmap, frames: Frame[]): ViewerData {
  const objects: ViewerObject[] = beatmap.hitObjects.map((o) => {
    const base: ViewerObject = {
      t: Math.round(o.startTime),
      x: Math.round(o.startPosition.x),
      y: Math.round(o.startPosition.y),
      type: o instanceof Circle ? 0 : o instanceof Slider ? 1 : 2,
    };
    if (o instanceof Slider) {
      base.ex = Math.round(o.endPosition.x);
      base.ey = Math.round(o.endPosition.y);
      base.end = Math.round(o.endTime);
    } else if (o instanceof Spinner) {
      base.end = Math.round(o.endTime);
    }
    return base;
  });

  const vframes = frames
    .filter((f) => f.time >= 0)
    .map((f) => ({ t: Math.round(f.time), x: Math.round(f.x), y: Math.round(f.y), k: f.keys & KEY_MASK ? 1 : 0 }));

  const last = objects[objects.length - 1];
  return {
    objects,
    frames: vframes,
    radius: circleRadius(beatmap.difficulty.circleSize),
    preempt: arToPreempt(beatmap.difficulty.approachRate),
    lengthMs: last ? (last.end ?? last.t) : 0,
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

  return { mechanics: judgePlay(standard, frames), viewer: buildViewer(standard, frames) };
}
