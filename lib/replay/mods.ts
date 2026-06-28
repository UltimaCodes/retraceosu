export type Difficulty = { cs: number; ar: number; od: number; hp: number };

export function parseMods(modsString: string): Set<string> {
  return new Set(modsString.match(/[A-Z]{2}/g) ?? []);
}

// legacy .osr mod bitmask -> acronyms (the decoder doesn't resolve mods without a ruleset)
const LEGACY_MODS: [number, string][] = [
  [1, "NF"], [2, "EZ"], [4, "TD"], [8, "HD"], [16, "HR"], [32, "SD"],
  [64, "DT"], [128, "RX"], [256, "HT"], [512, "NC"], [1024, "FL"], [2048, "AT"],
  [4096, "SO"], [8192, "AP"], [16384, "PF"], [536870912, "V2"],
];

export function modsFromBitmask(raw: number): Set<string> {
  const out = new Set<string>();
  for (const [bit, acr] of LEGACY_MODS) if ((raw & bit) === bit) out.add(acr);
  if (out.has("NC")) out.delete("DT"); // NC sets the DT bit too
  if (out.has("PF")) out.delete("SD"); // PF sets the SD bit too
  return out;
}

export function modsToString(mods: Set<string>): string {
  return mods.size ? [...mods].join("") : "None";
}

export function clockRate(mods: Set<string>): number {
  if (mods.has("DT") || mods.has("NC")) return 1.5;
  if (mods.has("HT")) return 0.75;
  return 1;
}

// AR <-> approach preempt (ms): AR0=1800, AR5=1200, AR10=450
function arToPreempt(ar: number): number {
  return ar <= 5 ? 1800 - 120 * ar : 1200 - 150 * (ar - 5);
}
function preemptToAr(p: number): number {
  return p >= 1200 ? (1800 - p) / 120 : 5 + (1200 - p) / 150;
}

// OD <-> 300 hit window (ms)
const odToWindow = (od: number) => 80 - 6 * od;
const windowToOd = (w: number) => (80 - w) / 6;

// applies HR/EZ stat multipliers and DT/HT clock scaling to base difficulty
export function effectiveDifficulty(base: Difficulty, mods: Set<string>): Difficulty {
  const rate = clockRate(mods);
  const statMul = mods.has("HR") ? "hr" : mods.has("EZ") ? "ez" : null;
  const scale = (v: number, hr: number, ez: number) =>
    statMul === "hr" ? Math.min(10, v * hr) : statMul === "ez" ? v * ez : v;

  const cs = scale(base.cs, 1.3, 0.5);
  const hp = scale(base.hp, 1.4, 0.5);
  // AR/OD: apply HR/EZ to the stat, then DT/HT to the timing window
  const ar = preemptToAr(arToPreempt(scale(base.ar, 1.4, 0.5)) / rate);
  const od = windowToOd(odToWindow(scale(base.od, 1.4, 0.5)) / rate);

  return { cs, ar, od, hp };
}
