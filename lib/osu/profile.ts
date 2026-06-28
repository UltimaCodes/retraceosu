import type { OsuGradeCounts, OsuMe } from "./types";

export type Profile = {
  id: number;
  username: string;
  countryCode: string;
  countryName: string;
  avatarUrl: string;
  coverUrl: string | null;
  isSupporter: boolean;
  joinDate: string;
  globalRank: number | null;
  countryRank: number | null;
  pp: number;
  accuracy: number;
  playCount: number;
  playTimeSec: number;
  maxCombo: number;
  rankedScore: number;
  totalHits: number;
  replaysWatched: number;
  level: number;
  levelProgress: number;
  grades: OsuGradeCounts;
  rankHistory: number[]; // oldest -> newest global rank
};

export function shapeProfile(me: OsuMe): Profile {
  const s = me.statistics;
  return {
    id: me.id,
    username: me.username,
    countryCode: me.country_code,
    countryName: me.country?.name ?? me.country_code,
    avatarUrl: me.avatar_url,
    coverUrl: me.cover_url ?? null,
    isSupporter: me.is_supporter,
    joinDate: me.join_date,
    globalRank: s.global_rank,
    countryRank: s.country_rank,
    pp: s.pp,
    accuracy: s.hit_accuracy,
    playCount: s.play_count,
    playTimeSec: s.play_time ?? 0,
    maxCombo: s.maximum_combo,
    rankedScore: s.ranked_score,
    totalHits: s.total_hits,
    replaysWatched: s.replays_watched_by_others,
    level: s.level.current,
    levelProgress: s.level.progress,
    grades: s.grade_counts,
    rankHistory: me.rank_history?.data ?? [],
  };
}
