import type { Frame } from "./reconstruct";
import type { ViewerFrame, ViewerObject } from "./types";

export type KeyStats = {
  k1: number;
  k2: number;
  k1Pct: number; // left-key share of all presses
  altRate: number; // fraction of consecutive fast presses that switch keys
  style: "alternate" | "singletap" | "mixed";
  altBpm: number | null; // stream bpm where they start alternating (singletap/mixed only)
  holdMsMedian: number;
};

export type CursorStats = {
  style: "snap" | "flow" | "hybrid";
  straightness: number; // median travelled/direct ratio on jumps, 1 = laser straight
  missLeft: number; // misses on each playfield half
  missRight: number;
};

const K1 = 4;
const K2 = 8;
const M1 = 1;
const M2 = 2;

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

// rate converts map-time to real time so DT hands read as the player felt them
export function computeKeyStats(frames: Frame[], rate = 1): KeyStats | null {
  const sorted = [...frames].filter((f) => f.time >= 0).sort((a, b) => a.time - b.time);
  const presses: { t: number; key: 1 | 2 }[] = [];
  const holds: number[] = [];
  let prevLeft = false;
  let prevRight = false;
  let leftDown = 0;
  let rightDown = 0;

  for (const f of sorted) {
    const t = f.time / rate; // physical milliseconds
    // K1 also raises M1 in stable replays, so each side is key-or-mouse
    const left = (f.keys & (K1 | M1)) !== 0;
    const right = (f.keys & (K2 | M2)) !== 0;
    if (left && !prevLeft) {
      presses.push({ t, key: 1 });
      leftDown = t;
    }
    if (!left && prevLeft) holds.push(t - leftDown);
    if (right && !prevRight) {
      presses.push({ t, key: 2 });
      rightDown = t;
    }
    if (!right && prevRight) holds.push(t - rightDown);
    prevLeft = left;
    prevRight = right;
  }
  if (presses.length < 30) return null;
  presses.sort((a, b) => a.t - b.t);

  const k1 = presses.filter((p) => p.key === 1).length;
  const k2 = presses.length - k1;

  // only gaps that represent actual tapping decide the style
  const pairs: { bpm: number; alt: boolean }[] = [];
  for (let i = 1; i < presses.length; i++) {
    const dt = presses[i].t - presses[i - 1].t;
    if (dt < 30 || dt > 400) continue;
    pairs.push({ bpm: 15000 / dt, alt: presses[i].key !== presses[i - 1].key });
  }
  const altRate = pairs.length ? pairs.filter((p) => p.alt).length / pairs.length : 0;
  const style: KeyStats["style"] =
    altRate >= 0.55 ? "alternate" : altRate <= 0.25 ? "singletap" : "mixed";

  // where does a non-alternator give in and start switching fingers
  let altBpm: number | null = null;
  if (style !== "alternate") {
    for (let th = 140; th <= 300; th += 20) {
      const fast = pairs.filter((p) => p.bpm >= th);
      if (fast.length < 12) break;
      if (fast.filter((p) => p.alt).length / fast.length >= 0.5) {
        altBpm = th;
        break;
      }
    }
  }

  const sane = holds.filter((h) => h >= 8 && h <= 300);
  return {
    k1,
    k2,
    k1Pct: Math.round((k1 / presses.length) * 100),
    altRate: Math.round(altRate * 100) / 100,
    style,
    altBpm,
    holdMsMedian: Math.round(median(sane)),
  };
}

export function computeCursorStats(
  objects: ViewerObject[],
  frames: ViewerFrame[],
  radius: number,
): CursorStats | null {
  let missLeft = 0;
  let missRight = 0;
  for (const o of objects) {
    if (o.j === 3) {
      if (o.x < 256) missLeft++;
      else missRight++;
    }
  }

  // approach shape on jumps: travelled distance vs straight line
  const ratios: number[] = [];
  const heads = objects.filter((o) => o.type !== 2);
  let fi = 0;
  for (let i = 1; i < heads.length; i++) {
    const a = heads[i - 1];
    const b = heads[i];
    const t0 = a.end ?? a.t;
    const dt = b.t - t0;
    if (dt <= 0 || dt > 500) continue;
    const direct = Math.hypot(b.x - a.x, b.y - a.y);
    if (direct < radius * 3) continue;
    while (fi < frames.length && frames[fi].t < t0) fi++;
    let travelled = 0;
    let n = 0;
    let j = fi;
    while (j + 1 < frames.length && frames[j + 1].t <= b.t) {
      travelled += Math.hypot(frames[j + 1].x - frames[j].x, frames[j + 1].y - frames[j].y);
      n++;
      j++;
    }
    if (n >= 3 && travelled > 0) ratios.push(travelled / direct);
  }
  if (ratios.length < 8) return null;

  const straightness = Math.round(median(ratios) * 100) / 100;
  return {
    style: straightness <= 1.12 ? "snap" : straightness >= 1.3 ? "flow" : "hybrid",
    straightness,
    missLeft,
    missRight,
  };
}
