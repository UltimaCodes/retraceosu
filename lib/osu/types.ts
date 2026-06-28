export type OsuCountry = { code: string; name: string };

export type OsuLevel = { current: number; progress: number };

export type OsuStatistics = {
  global_rank: number | null;
  country_rank: number | null;
  pp: number;
  hit_accuracy: number;
  play_count: number;
  play_time: number | null;
  maximum_combo: number;
  level: OsuLevel;
};

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
  version: string;
};

// v2 returns mods either as acronym strings or {acronym} objects depending on api version
export type OsuMod = string | { acronym: string };

export type OsuScore = {
  accuracy: number;
  mods: OsuMod[];
  pp: number | null;
  rank: string;
  created_at: string;
  beatmap: OsuBeatmap;
};
