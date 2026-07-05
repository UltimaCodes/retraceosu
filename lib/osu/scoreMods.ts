import type { OsuMod } from "./types";

// mods that actually move pp; NC scores as DT, CL and the rest are cosmetic
export const SCORING_MODS = ["HD", "HR", "DT", "EZ", "HT", "FL"] as const;

export function acronyms(mods: OsuMod[]): string[] {
  return mods.map((m) => (typeof m === "string" ? m : m.acronym)).filter((m) => m !== "CL");
}

// canonical scoring combo, sorted, "" for nomod
export function scoreCombo(mods: OsuMod[]): string {
  const set = new Set<string>();
  for (const a of acronyms(mods)) {
    const m = a === "NC" ? "DT" : a;
    if ((SCORING_MODS as readonly string[]).includes(m)) set.add(m);
  }
  return [...set].sort().join("");
}

export function comboLabel(combo: string): string {
  return combo === "" ? "NM" : combo;
}
