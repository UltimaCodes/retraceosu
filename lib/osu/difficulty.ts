import type { OsuDifficultyAttributes, OsuMod } from "./types";

const API_BASE = "https://osu.ppy.sh/api/v2";
const cache = new Map<string, OsuDifficultyAttributes | null>();

// only mods that actually change star rating; NC scores the same as DT
const DIFF_MODS = new Set(["DT", "NC", "HR", "EZ", "HT", "FL"]);

function diffMods(mods: OsuMod[]): string[] {
  const out = new Set<string>();
  for (const m of mods) {
    const acr = typeof m === "string" ? m : m.acronym;
    if (DIFF_MODS.has(acr)) out.add(acr === "NC" ? "DT" : acr);
  }
  return [...out].sort();
}

export async function fetchAttributes(
  token: string,
  beatmapId: number,
  mods: OsuMod[],
): Promise<OsuDifficultyAttributes | null> {
  const dm = diffMods(mods);
  const key = `${beatmapId}:${dm.join("")}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  // disk L2 (server-only, hence the dynamic import): ranked attrs don't change
  try {
    const { diskGet } = await import("../server/diskCache");
    const hit = await diskGet<OsuDifficultyAttributes>("attrs", key, 7 * 24 * 3600 * 1000);
    if (hit) {
      cache.set(key, hit);
      return hit;
    }
  } catch {}

  try {
    const res = await fetch(`${API_BASE}/beatmaps/${beatmapId}/attributes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({ mods: dm, ruleset_id: 0 }),
    });
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const json = await res.json();
    const attr = (json?.attributes ?? null) as OsuDifficultyAttributes | null;
    cache.set(key, attr);
    if (attr) {
      import("../server/diskCache")
        .then(({ diskSet }) => diskSet("attrs", key, attr))
        .catch(() => {});
    }
    return attr;
  } catch {
    cache.set(key, null);
    return null;
  }
}

export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}
