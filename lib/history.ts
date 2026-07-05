import type { ParsedSummary } from "./replay/types";

// analyzed replays live in the browser (IndexedDB), nothing is uploaded
export type ReplayRecord = {
  id: string;
  savedAt: number;
  player: string;
  artist: string;
  title: string;
  version: string;
  mods: string;
  acc: number;
  ur: number;
  meanError: number;
  misses: number;
  sliderBreaks: number;
  patterns: { name: string; ur: number }[];
  strengths: string[];
  weaknesses: string[];
  practice: string[];
};

const DB = "retrace";
const STORE = "replays";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export function recordFrom(s: ParsedSummary): ReplayRecord {
  const m = s.mechanics;
  const r = s.replay;
  return {
    // same replay analyzed twice overwrites itself
    id: `${r.beatmapMD5}:${r.player}:${r.totalScore}:${r.maxCombo}`,
    savedAt: Date.now(),
    player: r.player,
    artist: s.beatmap.artist,
    title: s.beatmap.title,
    version: s.beatmap.version,
    mods: r.mods,
    acc: Math.round(r.accuracy * 100) / 100,
    ur: Math.round(m.ur),
    meanError: Math.round(m.meanError * 10) / 10,
    misses: m.countMiss,
    sliderBreaks: m.sliderBreaks,
    patterns: m.patterns.map((p) => ({ name: p.name, ur: Math.round(p.ur) })),
    strengths: m.coaching.strengths,
    weaknesses: m.coaching.weaknesses,
    practice: m.coaching.practice,
  };
}

export function saveReplay(rec: ReplayRecord): Promise<IDBValidKey> {
  return tx("readwrite", (s) => s.put(rec));
}

export async function listReplays(): Promise<ReplayRecord[]> {
  const all = await tx<ReplayRecord[]>("readonly", (s) => s.getAll() as IDBRequest<ReplayRecord[]>);
  return all.sort((a, b) => b.savedAt - a.savedAt);
}

export function deleteReplay(id: string): Promise<undefined> {
  return tx("readwrite", (s) => s.delete(id));
}

export function clearReplays(): Promise<undefined> {
  return tx("readwrite", (s) => s.clear());
}
