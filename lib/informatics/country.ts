import type { OsuScore } from "../osu/types";
import { acronyms, scoreCombo } from "../osu/scoreMods";

// one entry of /rankings/osu/performance
export type RankingItem = {
  pp: number;
  hit_accuracy: number;
  play_count: number;
  play_time?: number | null;
  global_rank?: number | null;
  user: { id: number; username: string; avatar_url: string; country_code: string };
};

export type CountryPlayer = {
  id: number;
  username: string;
  avatarUrl: string;
  countryRank: number;
  globalRank: number | null;
  pp: number;
  accuracy: number;
  playCount: number;
  playTimeSec: number;
  ppPerHour: number;
};

export type CountryPlay = {
  beatmapId: number;
  title: string;
  version: string;
  mods: string;
  pp: number;
  stars: number;
  acc: number;
  player: { id: number; username: string };
};

export type CountryReport = {
  code: string;
  sampled: number;
  leaders: CountryPlayer[];
  prodigies: CountryPlayer[];
  grinders: CountryPlayer[];
  accLeaders: CountryPlayer[];
  aggregate: { topPpSum: number; avgAcc: number; medianPlaycount: number; totalPlaytimeSec: number };
  bigPlays: CountryPlay[];
  modLeaders: { mod: string; play: CountryPlay }[];
};

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

function toPlayer(r: RankingItem, rank: number): CountryPlayer {
  const playTimeSec = r.play_time ?? 0;
  return {
    id: r.user.id,
    username: r.user.username,
    avatarUrl: r.user.avatar_url,
    countryRank: rank,
    globalRank: r.global_rank ?? null,
    pp: Math.round(r.pp),
    accuracy: Math.round(r.hit_accuracy * 100) / 100,
    playCount: r.play_count,
    playTimeSec,
    ppPerHour: playTimeSec > 0 ? Math.round((r.pp / (playTimeSec / 3600)) * 10) / 10 : 0,
  };
}

const SPLIT_MODS = ["NM", "HD", "DT", "HR", "FL", "EZ"];
const hasMod = (combo: string, mod: string) =>
  mod === "NM" ? combo === "" : combo.includes(mod);

function toPlay(s: OsuScore, player: { id: number; username: string }): CountryPlay {
  const acr = acronyms(s.mods);
  return {
    beatmapId: s.beatmap.id,
    title: s.beatmapset?.title ?? s.beatmap.version,
    version: s.beatmap.version,
    mods: acr.length ? [...acr].sort().join("") : "NM",
    pp: Math.round(s.pp ?? 0),
    stars: Math.round(s.beatmap.difficulty_rating * 100) / 100,
    acc: Math.round(s.accuracy * 10000) / 100,
    player,
  };
}

export function buildCountryReport(
  code: string,
  ranking: RankingItem[],
  samples: { player: { id: number; username: string }; plays: OsuScore[] }[],
): CountryReport {
  const players = ranking.map((r, i) => toPlayer(r, i + 1));

  // enough playtime/plays to be signal, not a stub account
  const real = players.filter((p) => p.playCount >= 500 && p.playTimeSec >= 36_000);

  const allPlays: { combo: string; play: CountryPlay }[] = [];
  for (const s of samples) {
    for (const sc of s.plays) {
      if (sc.pp == null) continue;
      allPlays.push({ combo: scoreCombo(sc.mods), play: toPlay(sc, s.player) });
    }
  }
  // one entry per beatmap+setter keeps the big-plays list from repeating
  const seen = new Set<string>();
  const uniquePlays = allPlays
    .sort((a, b) => b.play.pp - a.play.pp)
    .filter(({ play }) => {
      const k = `${play.beatmapId}:${play.player.id}`;
      return seen.has(k) ? false : seen.add(k);
    });

  const modLeaders = SPLIT_MODS.map((mod) => {
    const best = uniquePlays.find(({ combo }) => hasMod(combo, mod));
    return best ? { mod, play: best.play } : null;
  }).filter((x): x is { mod: string; play: CountryPlay } => x != null);

  return {
    code: code.toUpperCase(),
    sampled: samples.length,
    leaders: players.slice(0, 20),
    prodigies: [...real].sort((a, b) => b.ppPerHour - a.ppPerHour).slice(0, 8),
    grinders: [...players].sort((a, b) => b.playCount - a.playCount).slice(0, 8),
    accLeaders: [...real].sort((a, b) => b.accuracy - a.accuracy).slice(0, 8),
    aggregate: {
      topPpSum: Math.round(players.reduce((s, p) => s + p.pp, 0)),
      avgAcc: Math.round((players.reduce((s, p) => s + p.accuracy, 0) / Math.max(1, players.length)) * 100) / 100,
      medianPlaycount: median(players.map((p) => p.playCount)),
      totalPlaytimeSec: players.reduce((s, p) => s + p.playTimeSec, 0),
    },
    bigPlays: uniquePlays.slice(0, 8).map(({ play }) => play),
    modLeaders,
  };
}
