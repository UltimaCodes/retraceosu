import {
  Circle,
  Slider,
  SliderHead,
  Spinner,
  SpinnerBonusTick,
  SpinnerTick,
  type StandardBeatmap,
  type StandardHitObject,
} from "osu-standard-stable";
import {
  circleRadius,
  reconstruct,
  type Frame,
  type Judgement,
  type Mechanics,
  type TapObject,
} from "./reconstruct";
import { computeAim, computePatterns, computeSections, deriveCoaching } from "./analysis";

const KEY_MASK = 1 | 2 | 4 | 8;

// osu! draws (and you aim at) the stack-offset position, not the raw one
export function stackedPos(o: StandardHitObject): { x: number; y: number } {
  const s = (o as unknown as { stackedStartPosition?: { x: number; y: number } })
    .stackedStartPosition;
  return s ?? o.startPosition;
}

// cursor state at an arbitrary time, interpolated between frames
function cursorAt(frames: Frame[], t: number): { x: number; y: number; keys: number } {
  if (frames.length === 0) return { x: 256, y: 192, keys: 0 };
  if (t <= frames[0].time) return frames[0];
  const last = frames[frames.length - 1];
  if (t >= last.time) return last;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].time <= t) lo = mid;
    else hi = mid;
  }
  const a = frames[lo];
  const b = frames[lo + 1];
  const u = (t - a.time) / (b.time - a.time || 1);
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, keys: a.keys };
}

// total revolutions about the spinner centre over a time window
function rotations(frames: Frame[], start: number, end: number): number {
  let total = 0;
  let prev: number | null = null;
  for (const f of frames) {
    if (f.time < start || f.time > end) continue;
    const ang = Math.atan2(f.y - 192, f.x - 256);
    if (prev !== null) {
      let d = ang - prev;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      total += Math.abs(d);
    }
    prev = ang;
  }
  return total / (2 * Math.PI);
}

function fracJudge(hit: number, total: number): Judgement {
  if (total === 0 || hit >= total) return "great";
  const f = hit / total;
  if (f >= 0.5) return "ok";
  if (f > 0) return "meh";
  return "miss";
}

export type JudgeOutput = {
  mechanics: Mechanics;
  // final judgement per hitObject, in beatmap order (feeds the viewer)
  objectJudgements: Judgement[];
};

// full-play judgement: circles + slider follow-circle + spinner rotations.
// UR / hit errors come from the tap engine (circles + slider heads).
export function judgePlay(beatmap: StandardBeatmap, frames: Frame[], rate = 1): JudgeOutput {
  const od = beatmap.difficulty.overallDifficulty;
  const cs = beatmap.difficulty.circleSize;
  const radius = circleRadius(cs);
  const followR2 = (radius * 2.4) ** 2;

  const taps: TapObject[] = [];
  const tapIndex: number[] = []; // tap i -> hitObjects index
  beatmap.hitObjects.forEach((o, oi) => {
    if (o instanceof Circle || o instanceof Slider) {
      const p = stackedPos(o);
      taps.push({ time: o.startTime, x: p.x, y: p.y, isSlider: o instanceof Slider });
      tapIndex.push(oi);
    }
  });

  const { mechanics, results } = reconstruct(taps, frames, { od, cs });

  const judgements: Judgement[] = new Array(beatmap.hitObjects.length).fill("miss");
  let c300 = 0;
  let c100 = 0;
  let c50 = 0;
  let miss = 0;
  let sliderBreaks = 0;
  const missTimes: number[] = [];
  const bump = (j: Judgement, oi: number, time: number) => {
    judgements[oi] = j;
    if (j === "great") c300++;
    else if (j === "ok") c100++;
    else if (j === "meh") c50++;
    else {
      miss++;
      missTimes.push(Math.round(time));
    }
  };

  results.forEach((r, i) => {
    const oi = tapIndex[i];
    const o = beatmap.hitObjects[oi];
    if (!(o instanceof Slider)) {
      bump(r.judgement, oi, r.time);
      return;
    }
    // slider: nested parts follow the same stack offset as the head
    const sp = stackedPos(o);
    const sdx = sp.x - o.startPosition.x;
    const sdy = sp.y - o.startPosition.y;
    const headHit = r.judgement !== "miss";
    let hit = headHit ? 1 : 0;
    let total = 1;
    for (const n of o.nestedHitObjects) {
      if (n instanceof SliderHead) continue;
      total++;
      const c = cursorAt(frames, n.startTime);
      if ((c.keys & KEY_MASK) === 0) continue;
      const dx = c.x - (n.startPosition.x + sdx);
      const dy = c.y - (n.startPosition.y + sdy);
      if (dx * dx + dy * dy <= followR2) hit++;
    }
    if (headHit && hit < total) sliderBreaks++;
    bump(fracJudge(hit, total), oi, r.time);
  });

  beatmap.hitObjects.forEach((o, oi) => {
    if (!(o instanceof Spinner)) return;
    const required = o.nestedHitObjects.filter(
      (n) => n instanceof SpinnerTick && !(n instanceof SpinnerBonusTick),
    ).length;
    const spins = rotations(frames, o.startTime, o.endTime);
    bump(
      required === 0 || spins >= required
        ? "great"
        : spins >= required * 0.75
          ? "ok"
          : spins >= required * 0.5
            ? "meh"
            : "miss",
      oi,
      o.startTime,
    );
  });

  const sections = computeSections(results);
  const patterns = computePatterns(taps, results, radius, rate);
  const aim = computeAim(taps, results, radius);
  missTimes.sort((a, b) => a - b);

  return {
    mechanics: {
      ...mechanics,
      count300: c300,
      count100: c100,
      count50: c50,
      countMiss: miss,
      objects: beatmap.hitObjects.length,
      sections,
      patterns,
      aim,
      sliderBreaks,
      missTimes,
      coaching: deriveCoaching(mechanics.meanError, sections, patterns, aim, sliderBreaks, missTimes),
    },
    objectJudgements: judgements,
  };
}
