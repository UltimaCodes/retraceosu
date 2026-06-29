import {
  Circle,
  Slider,
  SliderHead,
  Spinner,
  SpinnerBonusTick,
  SpinnerTick,
  type StandardBeatmap,
} from "osu-standard-stable";
import {
  circleRadius,
  reconstruct,
  type Frame,
  type Judgement,
  type Mechanics,
  type TapObject,
} from "./reconstruct";

const KEY_MASK = 1 | 2 | 4 | 8;

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

// full-play judgement: circles + slider follow-circle + spinner rotations.
// UR / hit errors come from the tap engine (circles + slider heads).
export function judgePlay(beatmap: StandardBeatmap, frames: Frame[]): Mechanics {
  const od = beatmap.difficulty.overallDifficulty;
  const cs = beatmap.difficulty.circleSize;
  const followR2 = (circleRadius(cs) * 2.4) ** 2;

  const taps: TapObject[] = [];
  const tapRef: (Circle | Slider)[] = [];
  for (const o of beatmap.hitObjects) {
    if (o instanceof Circle || o instanceof Slider) {
      taps.push({
        time: o.startTime,
        x: o.startPosition.x,
        y: o.startPosition.y,
        isSlider: o instanceof Slider,
      });
      tapRef.push(o);
    }
  }

  const { mechanics, results } = reconstruct(taps, frames, { od, cs });

  let c300 = 0;
  let c100 = 0;
  let c50 = 0;
  let miss = 0;
  const bump = (j: Judgement) => {
    if (j === "great") c300++;
    else if (j === "ok") c100++;
    else if (j === "meh") c50++;
    else miss++;
  };

  results.forEach((r, i) => {
    const o = tapRef[i];
    if (!(o instanceof Slider)) {
      bump(r.judgement); // circle: tap result is final
      return;
    }
    let hit = r.judgement !== "miss" ? 1 : 0; // head
    let total = 1;
    for (const n of o.nestedHitObjects) {
      if (n instanceof SliderHead) continue;
      total++;
      const c = cursorAt(frames, n.startTime);
      if ((c.keys & KEY_MASK) === 0) continue;
      const dx = c.x - n.startPosition.x;
      const dy = c.y - n.startPosition.y;
      if (dx * dx + dy * dy <= followR2) hit++;
    }
    bump(fracJudge(hit, total));
  });

  for (const o of beatmap.hitObjects) {
    if (!(o instanceof Spinner)) continue;
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
    );
  }

  return {
    ...mechanics,
    count300: c300,
    count100: c100,
    count50: c50,
    countMiss: miss,
    objects: beatmap.hitObjects.length,
  };
}
