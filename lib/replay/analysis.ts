import {
  unstableRate,
  type AimStats,
  type Coaching,
  type ObjectResult,
  type PatternStat,
  type Section,
  type TapObject,
} from "./reconstruct";

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

const mmss = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

// where presses land inside the circle, and jump under/overshoot from the
// press offset projected onto the approach direction
export function computeAim(
  taps: TapObject[],
  results: ObjectResult[],
  radius: number,
): AimStats {
  const offsets: number[] = [];
  let edge = 0;
  let under = 0;
  let over = 0;
  let jumps = 0;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.offN == null || r.pressX == null || r.pressY == null) continue;
    offsets.push(r.offN);
    if (r.offN >= 0.85) edge++;

    if (i === 0) continue;
    const dx = taps[i].x - taps[i - 1].x;
    const dy = taps[i].y - taps[i - 1].y;
    const dist = Math.hypot(dx, dy);
    if (dist < radius * 3) continue; // only spaced jumps carry a direction signal
    jumps++;
    const proj = ((r.pressX - taps[i].x) * dx + (r.pressY - taps[i].y) * dy) / dist / radius;
    if (proj <= -0.3) under++; // landed short, toward where you came from
    else if (proj >= 0.3) over++;
  }

  return {
    avgOffset: avg(offsets),
    edgeHitRate: offsets.length ? edge / offsets.length : 0,
    undershootRate: jumps ? under / jumps : 0,
    overshootRate: jumps ? over / jumps : 0,
    jumpsSampled: jumps,
  };
}

// UR + misses over equal time slices, so spikes are locatable in the map
export function computeSections(results: ObjectResult[], buckets = 10): Section[] {
  if (results.length === 0) return [];
  const t0 = results[0].time;
  const t1 = results[results.length - 1].time;
  const span = t1 - t0 || 1;
  const sections: Section[] = [];
  for (let i = 0; i < buckets; i++) {
    const from = t0 + (span * i) / buckets;
    const to = t0 + (span * (i + 1)) / buckets;
    const inBucket = results.filter((r) =>
      i === buckets - 1 ? r.time >= from && r.time <= to : r.time >= from && r.time < to,
    );
    const errs = inBucket.flatMap((r) => (r.error != null ? [r.error] : []));
    sections.push({
      fromMs: Math.round(from),
      toMs: Math.round(to),
      ur: errs.length ? unstableRate(errs) : 0,
      misses: inBucket.filter((r) => r.judgement === "miss").length,
    });
  }
  return sections;
}

// group tap UR by movement pattern. Spacing (relative to circle size) decides
// aim vs not; tempo splits streams from bursts. A pattern needs a real sample
// to appear, so a handful of stray notes don't get reported.
const MIN_PATTERN = 12;

export function computePatterns(
  taps: TapObject[],
  results: ObjectResult[],
  radius: number,
): PatternStat[] {
  const diameter = radius * 2;
  const groups: Record<string, number[]> = {
    Streams: [],
    Bursts: [],
    Jumps: [],
    "Spaced control": [],
  };
  for (let i = 1; i < taps.length; i++) {
    const err = results[i]?.error;
    if (err == null) continue; // only landed hits carry timing
    const gap = taps[i].time - taps[i - 1].time;
    const spacing = Math.hypot(taps[i].x - taps[i - 1].x, taps[i].y - taps[i - 1].y) / diameter;
    const fast = gap <= 130;
    let name: keyof typeof groups;
    if (spacing >= 2.4) name = "Jumps";
    else if (fast && spacing < 1.3) name = "Streams";
    else if (fast) name = "Bursts";
    else name = "Spaced control";
    groups[name].push(err);
  }
  return Object.entries(groups)
    .filter(([, e]) => e.length >= MIN_PATTERN)
    .map(([name, e]) => ({ name, ur: unstableRate(e), count: e.length }))
    .sort((a, b) => b.count - a.count);
}

function practiceFor(pattern: string): string {
  if (pattern.startsWith("Stream") || pattern === "Bursts")
    return "Drop stream / finger-control maps about 10 to 20 bpm below your peak and rebuild them clean before pushing tempo.";
  if (pattern === "Jumps")
    return "Grind spaced-jump aim maps a notch above your comfort spacing, focusing on stopping the cursor on the circle rather than swiping through.";
  return "Play flow and control maps to steady your spacing before adding speed.";
}

export function deriveCoaching(
  meanError: number,
  sections: Section[],
  patterns: PatternStat[],
  aim?: AimStats,
  sliderBreaks = 0,
  missTimes: number[] = [],
): Coaching {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const practice: string[] = [];

  // only compare patterns that make up a real share of this map, so a few stray
  // stream notes on an aim map don't trigger "practice streams"
  const totalCount = patterns.reduce((a, p) => a + p.count, 0);
  const eligible = patterns.filter(
    (p) => p.count >= Math.max(20, totalCount * 0.18),
  );
  if (eligible.length >= 2) {
    const sorted = [...eligible].sort((a, b) => a.ur - b.ur);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (worst.ur > best.ur * 1.25) {
      weaknesses.push(
        `${worst.name} are your weakest pattern here (UR ${worst.ur.toFixed(0)} vs ${best.ur.toFixed(0)} on ${best.name.toLowerCase()}).`,
      );
      strengths.push(`${best.name} are your strongest (UR ${best.ur.toFixed(0)}).`);
      practice.push(practiceFor(worst.name));
    } else {
      strengths.push("Your timing holds up evenly across pattern types.");
    }
  } else if (eligible.length === 1) {
    strengths.push(
      `This map is mostly ${eligible[0].name.toLowerCase()}, your UR there is ${eligible[0].ur.toFixed(0)}.`,
    );
  }

  if (Math.abs(meanError) >= 6) {
    weaknesses.push(`You consistently hit ${Math.abs(meanError).toFixed(1)}ms ${meanError < 0 ? "early" : "late"}.`);
    practice.push(`Shift your timing ${meanError < 0 ? "later" : "earlier"} (or adjust your local offset).`);
  } else {
    strengths.push(`Overall timing is well-centred (${meanError >= 0 ? "+" : ""}${meanError.toFixed(1)}ms).`);
  }

  if (sections.length >= 4) {
    const half = Math.floor(sections.length / 2);
    const u1 = avg(sections.slice(0, half).map((s) => s.ur).filter(Boolean));
    const u2 = avg(sections.slice(half).map((s) => s.ur).filter(Boolean));
    if (u2 > u1 * 1.2) {
      weaknesses.push(`Consistency fades through the map (UR ${u1.toFixed(0)} → ${u2.toFixed(0)}).`);
      practice.push("Build stamina on longer maps slightly below your peak SR.");
    } else if (u1 > u2 * 1.2) {
      strengths.push(`You warm up well (UR ${u1.toFixed(0)} → ${u2.toFixed(0)}).`);
    }
  }

  // aim signals, only with a real jump sample behind them
  if (aim && aim.jumpsSampled >= 15) {
    if (aim.undershootRate >= 0.35) {
      weaknesses.push(
        `You undershoot jumps, ${Math.round(aim.undershootRate * 100)}% of spaced hits land short of the target.`,
      );
      practice.push("Practice snap aim: overshoot-focused jump maps, slightly larger spacing than comfortable.");
    } else if (aim.overshootRate >= 0.35) {
      weaknesses.push(
        `You overshoot jumps, ${Math.round(aim.overshootRate * 100)}% of spaced hits sail past centre.`,
      );
      practice.push("Practice controlled aim: lower spacing, focus on stopping on the circle.");
    }
  }
  if (aim && aim.edgeHitRate >= 0.3) {
    weaknesses.push(
      `${Math.round(aim.edgeHitRate * 100)}% of your hits land on the circle's edge, aim is loose even when timing is fine.`,
    );
    practice.push("Play a notch smaller CS or slower maps focusing on cursor precision.");
  } else if (aim && aim.avgOffset > 0 && aim.avgOffset <= 0.45) {
    strengths.push(`Aim is tight, hits average ${Math.round(aim.avgOffset * 100)}% from centre.`);
  }

  if (sliderBreaks > 0) {
    weaknesses.push(`${sliderBreaks} slider break${sliderBreaks > 1 ? "s" : ""}, you drop the follow circle after the head.`);
    practice.push("Hold sliders to the end; practice slider-heavy maps at low BPM.");
  }

  if (missTimes.length > 0) {
    const shown = missTimes.slice(0, 4).map(mmss).join(", ");
    weaknesses.push(
      `Miss${missTimes.length > 1 ? "es" : ""} at ${shown}${missTimes.length > 4 ? ` (+${missTimes.length - 4} more)` : ""}, scrub the viewer there.`,
    );
  }

  if (strengths.length === 0) strengths.push("Solid, balanced play with no glaring weakness.");
  return { strengths, weaknesses, practice };
}
