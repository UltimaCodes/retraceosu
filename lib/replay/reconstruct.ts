// Reconstructs osu!standard judgements from a replay by replaying the cursor
// stream against the hit objects. Targets stable behaviour (circles + slider heads).

export type TapObject = { time: number; x: number; y: number; isSlider: boolean };
export type Frame = { time: number; x: number; y: number; keys: number };

export type Judgement = "great" | "ok" | "meh" | "miss";

export type ObjectResult = {
  time: number;
  isSlider: boolean;
  judgement: Judgement;
  error: number | null; // signed ms, + = late, null = miss
};

export type Mechanics = {
  ur: number; // unstable rate = stdev(errors) * 10
  meanError: number; // + late / - early
  earlyRate: number; // share of hits that landed early
  count300: number;
  count100: number;
  count50: number;
  countMiss: number;
  hitErrors: { time: number; error: number }[];
  objects: number; // tap objects considered
  insights: string[]; // plain-language findings derived from the above
};

export type ReconstructOptions = { od: number; cs: number; clockRate: number };

const KEY_MASK = 1 | 2 | 4 | 8; // M1 M2 K1 K2, ignoring smoke

export function circleRadius(cs: number): number {
  return 54.4 - 4.48 * cs;
}

// stable hit windows (ms) for a given OD, scaled into map time by the clock rate
export function hitWindows(od: number, clockRate: number) {
  return {
    great: (80 - 6 * od) / clockRate,
    ok: (140 - 8 * od) / clockRate,
    meh: (200 - 10 * od) / clockRate,
  };
}

type PressEdge = { time: number; x: number; y: number };

function pressEdges(frames: Frame[]): PressEdge[] {
  const edges: PressEdge[] = [];
  let prev = 0;
  for (const f of frames) {
    if (f.time < 0) {
      prev = f.keys & KEY_MASK;
      continue;
    }
    const now = f.keys & KEY_MASK;
    if ((now & ~prev) !== 0) edges.push({ time: f.time, x: f.x, y: f.y });
    prev = now;
  }
  return edges;
}

function judge(absErr: number, w: { great: number; ok: number; meh: number }): Judgement {
  if (absErr <= w.great) return "great";
  if (absErr <= w.ok) return "ok";
  if (absErr <= w.meh) return "meh";
  return "miss";
}

export function reconstruct(
  objects: TapObject[],
  frames: Frame[],
  opts: ReconstructOptions,
): { mechanics: Mechanics; results: ObjectResult[] } {
  const w = hitWindows(opts.od, opts.clockRate);
  const radius = circleRadius(opts.cs);
  const r2 = radius * radius;
  const edges = pressEdges(frames);

  const results: ObjectResult[] = [];
  let ei = 0;

  for (const obj of objects) {
    const open = obj.time - w.meh;
    const close = obj.time + w.meh;

    // skip presses that happened before this object's window opened (wasted taps)
    while (ei < edges.length && edges[ei].time < open) ei++;

    let hit: ObjectResult | null = null;
    let j = ei;
    while (j < edges.length && edges[j].time <= close) {
      const e = edges[j];
      const dx = e.x - obj.x;
      const dy = e.y - obj.y;
      if (dx * dx + dy * dy <= r2) {
        const error = e.time - obj.time;
        hit = { time: obj.time, isSlider: obj.isSlider, judgement: judge(Math.abs(error), w), error };
        ei = j + 1; // consume this press (note-lock: it can't hit a later object)
        break;
      }
      j++;
    }

    results.push(hit ?? { time: obj.time, isSlider: obj.isSlider, judgement: "miss", error: null });
  }

  return { mechanics: aggregate(results), results };
}

function urOf(errors: number[]): number {
  if (errors.length === 0) return 0;
  const m = errors.reduce((a, b) => a + b, 0) / errors.length;
  return Math.sqrt(errors.reduce((a, b) => a + (b - m) ** 2, 0) / errors.length) * 10;
}

function deriveInsights(
  hits: { time: number; error: number }[],
  meanError: number,
  earlyRate: number,
  countMiss: number,
): string[] {
  const out: string[] = [];
  if (hits.length === 0) return out;

  if (Math.abs(meanError) >= 8) {
    out.push(
      `You hit ${Math.abs(meanError).toFixed(1)}ms ${meanError < 0 ? "early" : "late"} on average — nudge your timing ${meanError < 0 ? "later" : "earlier"}.`,
    );
  } else {
    out.push(`Timing is well-centered (${meanError >= 0 ? "+" : ""}${meanError.toFixed(1)}ms bias).`);
  }

  const ePct = Math.round(earlyRate * 100);
  if (ePct >= 65) out.push(`You rush — ${ePct}% of hits land early.`);
  else if (ePct <= 35) out.push(`You drag — ${100 - ePct}% of hits land late.`);

  if (hits.length >= 20) {
    const mid = Math.floor(hits.length / 2);
    const u1 = urOf(hits.slice(0, mid).map((h) => h.error));
    const u2 = urOf(hits.slice(mid).map((h) => h.error));
    if (u2 > u1 * 1.25)
      out.push(`Consistency drops in the back half (UR ${u1.toFixed(0)} → ${u2.toFixed(0)}) — likely stamina or focus.`);
    else if (u1 > u2 * 1.25)
      out.push(`You settle in — UR improves ${u1.toFixed(0)} → ${u2.toFixed(0)} across the map.`);
    else out.push(`Consistency holds steady (UR ${u1.toFixed(0)} → ${u2.toFixed(0)}).`);
  }

  if (countMiss > 0) out.push(`${countMiss} reconstructed miss${countMiss > 1 ? "es" : ""}.`);
  return out;
}

function aggregate(results: ObjectResult[]): Mechanics {
  const errors: number[] = [];
  const hitErrors: { time: number; error: number }[] = [];
  let c300 = 0;
  let c100 = 0;
  let c50 = 0;
  let miss = 0;

  for (const r of results) {
    switch (r.judgement) {
      case "great":
        c300++;
        break;
      case "ok":
        c100++;
        break;
      case "meh":
        c50++;
        break;
      case "miss":
        miss++;
        break;
    }
    if (r.error != null) {
      errors.push(r.error);
      hitErrors.push({ time: r.time, error: r.error });
    }
  }

  const mean = errors.length ? errors.reduce((a, b) => a + b, 0) / errors.length : 0;
  const earlyRate = errors.length ? errors.filter((e) => e < 0).length / errors.length : 0;

  return {
    ur: urOf(errors),
    meanError: mean,
    earlyRate,
    count300: c300,
    count100: c100,
    count50: c50,
    countMiss: miss,
    hitErrors,
    objects: results.length,
    insights: deriveInsights(hitErrors, mean, earlyRate, miss),
  };
}
