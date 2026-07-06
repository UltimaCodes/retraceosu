export type OsuCountry = { code: string; name: string };

export type OsuLevel = { current: number; progress: number };

export type OsuGradeCounts = {
  ss: number;
  ssh: number;
  s: number;
  sh: number;
  a: number;
};

export type OsuStatistics = {
  global_rank: number | null;
  country_rank: number | null;
  pp: number;
  hit_accuracy: number;
  play_count: number;
  play_time: number | null;
  maximum_combo: number;
  ranked_score: number;
  total_hits: number;
  replays_watched_by_others: number;
  level: OsuLevel;
  grade_counts: OsuGradeCounts;
};

export type OsuRankHistory = { mode: string; data: number[] };

export type OsuMe = {
  id: number;
  username: string;
  country_code: string;
  country?: OsuCountry;
  avatar_url: string;
  cover_url?: string;
  is_supporter: boolean;
  join_date: string;
  statistics: OsuStatistics;
  rank_history?: OsuRankHistory;
  scores_first_count?: number;
  user_achievements?: { achievement_id: number }[];
};

export type OsuBeatmap = {
  id: number;
  difficulty_rating: number;
  bpm: number;
  total_length: number;
  hit_length: number;
  cs: number;
  ar: number;
  accuracy: number;
  drain: number;
  count_circles: number;
  count_sliders: number;
  count_spinners: number;
  max_combo?: number;
  version: string;
};

// stable uses count_* keys, lazer uses great/ok/meh/miss
export type OsuScoreStatistics = {
  count_300?: number;
  count_100?: number;
  count_50?: number;
  count_miss?: number;
  great?: number;
  ok?: number;
  meh?: number;
  miss?: number;
};

// v2 returns mods either as acronym strings or {acronym} objects depending on api version
export type OsuMod = string | { acronym: string };

export type OsuBeatmapset = { title: string; artist: string; creator?: string };

export type OsuScore = {
  accuracy: number;
  mods: OsuMod[];
  pp: number | null;
  rank: string;
  max_combo: number;
  created_at: string;
  statistics?: OsuScoreStatistics;
  beatmap: OsuBeatmap;
  beatmapset?: OsuBeatmapset;
};

// from POST /beatmaps/{id}/attributes, mod-adjusted difficulty
export type OsuDifficultyAttributes = {
  star_rating: number;
  max_combo?: number;
  aim_difficulty?: number;
  speed_difficulty?: number;
  approach_rate?: number;
  overall_difficulty?: number;
  slider_factor?: number;
};
