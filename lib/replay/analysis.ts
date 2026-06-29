import {
  unstableRate,
  type Coaching,
  type ObjectResult,
  type PatternStat,
  type Section,
  type TapObject,
} from "./reconstruct";

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

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

// group tap UR by movement pattern (tempo + spacing relative to the previous tap)
export function computePatterns(
  taps: TapObject[],
  results: ObjectResult[],
  radius: number,
): PatternStat[] {
  const diameter = radius * 2;
  const groups: Record<string, number[]> = {
    "Streams (1/4)": [],
    Bursts: [],
    Jumps: [],
    "Spaced control": [],
  };
  for (let i = 1; i < taps.length; i++) {
    const err = results[i]?.error;
    if (err == null) continue; // only landed hits carry timing
    const gap = taps[i].time - taps[i - 1].time;
    const dist = Math.hypot(taps[i].x - taps[i - 1].x, taps[i].y - taps[i - 1].y);
    let name: keyof typeof groups;
    if (gap <= 130 && dist <= diameter * 1.2) name = "Streams (1/4)";
    else if (gap <= 130) name = "Bursts";
    else if (dist >= diameter * 2.2) name = "Jumps";
    else name = "Spaced control";
    groups[name].push(err);
  }
  return Object.entries(groups)
    .filter(([, e]) => e.length >= 5)
    .map(([name, e]) => ({ name, ur: unstableRate(e), count: e.length }))
    .sort((a, b) => b.count - a.count);
}

function practiceFor(pattern: string): string {
  if (pattern.startsWith("Stream") || pattern === "Bursts")
    return "Practice finger-control / stream maps just below your top BPM.";
  if (pattern === "Jumps") return "Practice spaced-jump / aim maps to tighten jump timing.";
  return "Practice control maps to steady your spacing.";
}

export function deriveCoaching(
  meanError: number,
  sections: Section[],
  patterns: PatternStat[],
): Coaching {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const practice: string[] = [];

  if (patterns.length >= 2) {
    const sorted = [...patterns].sort((a, b) => a.ur - b.ur);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (worst.ur > best.ur * 1.2) {
      weaknesses.push(
        `${worst.name} are your weakest pattern (UR ${worst.ur.toFixed(0)} vs ${best.ur.toFixed(0)} on ${best.name.toLowerCase()}).`,
      );
      strengths.push(`${best.name} are your strongest pattern (UR ${best.ur.toFixed(0)}).`);
      practice.push(practiceFor(worst.name));
    }
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

  const totalMisses = sections.reduce((a, s) => a + s.misses, 0);
  if (totalMisses > 0) {
    const worstSec = [...sections].sort((a, b) => b.misses - a.misses)[0];
    if (worstSec.misses > 0)
      weaknesses.push(`Most misses cluster around ${Math.round(worstSec.fromMs / 1000)}s into the map.`);
  }

  if (strengths.length === 0) strengths.push("Solid, balanced play with no glaring weakness.");
  return { strengths, weaknesses, practice };
}
