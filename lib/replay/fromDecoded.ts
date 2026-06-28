import { HittableObject, SlidableObject } from "osu-parsers";
import type { Beatmap, Score } from "osu-classes";
import { reconstruct, type Frame, type Mechanics, type TapObject } from "./reconstruct";

function modSet(score: Score): Set<string> {
  return new Set((score.info.mods?.toString() ?? "").match(/[A-Z]{2}/g) ?? []);
}

// turns decoded osu-parsers objects into engine inputs and runs the reconstruction
export function reconstructFromDecoded(beatmap: Beatmap, score: Score): Mechanics {
  const mods = modSet(score);
  const rate = mods.has("DT") || mods.has("NC") ? 1.5 : mods.has("HT") ? 0.75 : 1;
  const odMul = mods.has("HR") ? 1.4 : mods.has("EZ") ? 0.5 : 1;
  const csMul = mods.has("HR") ? 1.3 : mods.has("EZ") ? 0.5 : 1;
  const od = Math.min(10, beatmap.difficulty.overallDifficulty * odMul);
  const cs = Math.min(10, beatmap.difficulty.circleSize * csMul);

  const objects: TapObject[] = [];
  for (const o of beatmap.hitObjects) {
    if (o instanceof HittableObject || o instanceof SlidableObject) {
      objects.push({
        time: o.startTime,
        x: o.startPosition.x,
        y: o.startPosition.y,
        isSlider: o instanceof SlidableObject,
      });
    }
  }

  const frames: Frame[] = (score.replay?.frames ?? []).map((f) => {
    const lf = f as unknown as {
      startTime: number;
      position: { x: number; y: number };
      buttonState: number;
    };
    return { time: lf.startTime, x: lf.position.x, y: lf.position.y, keys: lf.buttonState };
  });

  return reconstruct(objects, frames, { od, cs, clockRate: rate }).mechanics;
}
