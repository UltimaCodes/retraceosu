import {
  BeatmapDecoder,
  HittableObject,
  ScoreDecoder,
  SlidableObject,
  SpinnableObject,
} from "osu-parsers";
import { HitResult, type Beatmap, type Score } from "osu-classes";
import type { HitCounts, ParsedSummary, ViewerData } from "./types";
import { analyzeFromDecoded } from "./fromDecoded";
import type { Mechanics } from "./reconstruct";
import { effectiveDifficulty, modsFromBitmask, modsToString } from "./mods";

type Request = { osuText?: string; osrBuffer: ArrayBuffer };

const ctx = self as unknown as Worker;

// same-origin call to our proxy; the httpOnly osu token rides along automatically
async function fetchBeatmap(md5: string): Promise<string> {
  const res = await fetch(`/api/beatmap?checksum=${encodeURIComponent(md5)}`);
  if (!res.ok) {
    if (res.status === 401)
      throw new Error("Sign in with osu! to auto-fetch the beatmap, or drop the .osu yourself.");
    if (res.status === 404)
      throw new Error("Couldn't find this map online (unsubmitted?). Drop the .osu yourself.");
    throw new Error("Beatmap fetch failed — drop the .osu yourself.");
  }
  return (await res.json()).osu as string;
}

function readStats(score: Score): { counts: HitCounts; raw: Record<string, number> } {
  const raw: Record<string, number> = {};
  for (const [key, value] of score.info.statistics) {
    raw[typeof key === "number" ? (HitResult[key] ?? String(key)) : key] = value;
  }
  return {
    counts: {
      great: raw.Great ?? 0,
      ok: raw.Ok ?? 0,
      meh: raw.Meh ?? 0,
      miss: raw.Miss ?? 0,
    },
    raw,
  };
}

function summarize(
  beatmap: Beatmap,
  score: Score,
  mechanics: Mechanics,
  viewer: ViewerData,
): ParsedSummary {
  const objects = beatmap.hitObjects;
  const last = objects[objects.length - 1];
  const { counts, raw } = readStats(score);
  const d = beatmap.difficulty;
  const mods = modsFromBitmask(Number(score.info.rawMods));
  const eff = effectiveDifficulty(
    { cs: d.circleSize, ar: d.approachRate, od: d.overallDifficulty, hp: d.drainRate },
    mods,
  );

  return {
    beatmap: {
      artist: beatmap.metadata.artist,
      title: beatmap.metadata.title,
      version: beatmap.metadata.version,
      creator: beatmap.metadata.creator,
      mode: beatmap.mode,
      cs: eff.cs,
      ar: eff.ar,
      od: eff.od,
      hp: eff.hp,
      hitObjects: objects.length,
      circles: objects.filter((o) => o instanceof HittableObject).length,
      sliders: objects.filter((o) => o instanceof SlidableObject).length,
      spinners: objects.filter((o) => o instanceof SpinnableObject).length,
      lengthMs: last ? Math.round(last.startTime) : 0,
    },
    replay: {
      player: score.info.username,
      mods: modsToString(mods),
      rulesetId: score.info.rulesetId,
      totalScore: score.info.totalScore,
      maxCombo: score.info.maxCombo,
      accuracy: score.info.accuracy * 100,
      counts,
      frameCount: score.replay?.frames.length ?? 0,
      beatmapMD5: score.info.beatmapHashMD5,
      rawStats: raw,
    },
    mechanics,
    viewer,
  };
}

const MODE_NAMES = ["osu!standard", "osu!taiko", "osu!catch", "osu!mania"];

ctx.onmessage = async (e: MessageEvent<Request>) => {
  try {
    const score = await new ScoreDecoder().decodeFromBuffer(
      new Uint8Array(e.data.osrBuffer),
      true,
    );
    if (score.info.rulesetId !== 0) {
      throw new Error(
        `Retrace only supports osu!standard — this replay is ${MODE_NAMES[score.info.rulesetId] ?? "another mode"}.`,
      );
    }
    const osuText = e.data.osuText ?? (await fetchBeatmap(score.info.beatmapHashMD5));
    const beatmap = new BeatmapDecoder().decodeFromString(osuText);
    if (beatmap.mode !== 0) {
      throw new Error("Retrace only supports osu!standard beatmaps.");
    }
    const { mechanics, viewer } = analyzeFromDecoded(beatmap, score);
    ctx.postMessage({ ok: true, summary: summarize(beatmap, score, mechanics, viewer) });
  } catch (err) {
    ctx.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
