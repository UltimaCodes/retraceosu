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
  combo: string;
  pp: number;
  stars: number; // patched to mod-adjusted by the route for displayed plays
  acc: number;
  effBpm: number;
  ageDays: number;
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
  comboBests: { combo: string; count: number; plays: CountryPlay[] }[]; // exact combo -> top plays

  // the fun stuff
  anthem: { beatmapId: number; title: string; artist: string; count: number }[]; // maps everyone farms
  favoriteArtists: { artist: string; count: number }[];
  legacy: CountryPlay | null; // oldest play still standing in someone's bests
  speedDemon: CountryPlay | null; // highest effective bpm
  accBest: CountryPlay | null; // highest acc among the big guns
  modSplit: { combo: string; pct: number }[];
};

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

const rateOf = (acr: string[]) =>
  acr.includes("DT") || acr.includes("NC") ? 1.5 : acr.includes("HT") ? 0.75 : 1;

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

function toPlay(s: OsuScore, player: { id: number; username: string }): CountryPlay {
  const acr = acronyms(s.mods);
  return {
    beatmapId: s.beatmap.id,
    title: s.beatmapset?.title ?? s.beatmap.version,
    version: s.beatmap.version,
    mods: acr.length ? [...acr].sort().join("") : "NM",
    combo: scoreCombo(s.mods),
    pp: Math.round(s.pp ?? 0),
    stars: Math.round(s.beatmap.difficulty_rating * 100) / 100,
    acc: Math.round(s.accuracy * 10000) / 100,
    effBpm: Math.round(s.beatmap.bpm * rateOf(acr)),
    ageDays: Math.floor((Date.now() - new Date(s.created_at).getTime()) / 86_400_000),
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

  const allPlays: { play: CountryPlay; artist: string }[] = [];
  for (const s of samples) {
    for (const sc of s.plays) {
      if (sc.pp == null) continue;
      allPlays.push({ play: toPlay(sc, s.player), artist: sc.beatmapset?.artist ?? "" });
    }
  }
  // one entry per beatmap+setter keeps the big-plays list from repeating
  const seen = new Set<string>();
  const uniquePlays = allPlays
    .map(({ play }) => play)
    .sort((a, b) => b.pp - a.pp)
    .filter((play) => {
      const k = `${play.beatmapId}:${play.player.id}`;
      return seen.has(k) ? false : seen.add(k);
    });

  // top plays per exact mod combo, so HD means HD alone and not HDDT
  const byCombo = new Map<string, CountryPlay[]>();
  for (const p of uniquePlays) {
    const label = p.combo === "" ? "NM" : p.combo;
    byCombo.set(label, [...(byCombo.get(label) ?? []), p]);
  }
  const comboBests = [...byCombo.entries()]
    .map(([combo, plays]) => ({ combo, count: plays.length, plays: plays.slice(0, 5) }))
    .sort((a, b) => b.plays[0].pp - a.plays[0].pp);

  // maps that show up across many different players' bests
  const mapCounts = new Map<number, { title: string; artist: string; users: Set<number> }>();
  for (const { play, artist } of allPlays) {
    const e = mapCounts.get(play.beatmapId) ?? { title: play.title, artist, users: new Set() };
    e.users.add(play.player.id);
    mapCounts.set(play.beatmapId, e);
  }
  const anthem = [...mapCounts.entries()]
    .map(([beatmapId, e]) => ({ beatmapId, title: e.title, artist: e.artist, count: e.users.size }))
    .filter((a) => a.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const artistCounts = new Map<string, number>();
  for (const { artist } of allPlays)
    if (artist) artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
  const favoriteArtists = [...artistCounts.entries()]
    .map(([artist, count]) => ({ artist, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const comboCounts = new Map<string, number>();
  for (const { play } of allPlays) {
    const label = play.combo === "" ? "NM" : play.combo;
    comboCounts.set(label, (comboCounts.get(label) ?? 0) + 1);
  }
  const modSplit = [...comboCounts.entries()]
    .map(([combo, count]) => ({ combo, pct: Math.round((count / Math.max(1, allPlays.length)) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

  const plainPlays = allPlays.map(({ play }) => play);

  return {
    code: code.toUpperCase(),
    sampled: samples.length,
    leaders: players.slice(0, 10),
    prodigies: [...real].sort((a, b) => b.ppPerHour - a.ppPerHour).slice(0, 10),
    grinders: [...players].sort((a, b) => b.playCount - a.playCount).slice(0, 10),
    accLeaders: [...real].sort((a, b) => b.accuracy - a.accuracy).slice(0, 10),
    aggregate: {
      topPpSum: Math.round(players.reduce((s, p) => s + p.pp, 0)),
      avgAcc:
        Math.round((players.reduce((s, p) => s + p.accuracy, 0) / Math.max(1, players.length)) * 100) /
        100,
      medianPlaycount: median(players.map((p) => p.playCount)),
      totalPlaytimeSec: players.reduce((s, p) => s + p.playTimeSec, 0),
    },
    bigPlays: uniquePlays.slice(0, 10),
    comboBests,
    anthem,
    favoriteArtists,
    legacy: plainPlays.length
      ? plainPlays.reduce((a, b) => (b.ageDays > a.ageDays ? b : a))
      : null,
    speedDemon: plainPlays.length
      ? plainPlays.reduce((a, b) => (b.effBpm > a.effBpm ? b : a))
      : null,
    accBest: plainPlays.length ? plainPlays.reduce((a, b) => (b.acc > a.acc ? b : a)) : null,
    modSplit,
  };
}
