import type { Beatmap, Score } from "osu-classes";
import { StandardRuleset, type StandardBeatmap } from "osu-standard-stable";
import { clockRate, modsFromBitmask } from "./mods";
import { judgePlay } from "./judge";
import type { Frame, Mechanics } from "./reconstruct";

// applies the standard ruleset (+ mods, so HR flips positions and nested slider
// objects exist), then runs the full-play judgement.
export function reconstructFromDecoded(beatmap: Beatmap, score: Score): Mechanics {
  const raw = Number(score.info.rawMods);
  const rate = clockRate(modsFromBitmask(raw));

  const ruleset = new StandardRuleset();
  const standard = ruleset.applyToBeatmapWithMods(
    beatmap,
    ruleset.createModCombination(raw),
  ) as StandardBeatmap;

  const frames: Frame[] = (score.replay?.frames ?? []).map((f) => {
    const lf = f as unknown as {
      startTime: number;
      position: { x: number; y: number };
      buttonState: number;
    };
    return { time: lf.startTime, x: lf.position.x, y: lf.position.y, keys: lf.buttonState };
  });

  return judgePlay(standard, frames, rate);
}
