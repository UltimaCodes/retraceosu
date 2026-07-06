import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

// file-backed L2 behind the in-memory caches; survives dev restarts and
// protects the API quota. Best-effort: any fs error falls through to the network
const DIR = path.join(process.cwd(), ".cache");

const fileFor = (ns: string, key: string) =>
  path.join(DIR, ns, createHash("sha1").update(key).digest("hex") + ".json");

export async function diskGet<T>(ns: string, key: string, ttlMs: number): Promise<T | null> {
  try {
    const f = fileFor(ns, key);
    const st = await fs.stat(f);
    if (Date.now() - st.mtimeMs > ttlMs) return null;
    return JSON.parse(await fs.readFile(f, "utf8")) as T;
  } catch {
    return null;
  }
}

export async function diskSet(ns: string, key: string, value: unknown): Promise<void> {
  try {
    await fs.mkdir(path.join(DIR, ns), { recursive: true });
    await fs.writeFile(fileFor(ns, key), JSON.stringify(value));
  } catch {
    // cache write failures never break the request
  }
}
