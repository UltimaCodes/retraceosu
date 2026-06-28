import type { Profile } from "@/lib/osu/profile";
import {
  flagEmoji,
  formatCompact,
  formatJoinDate,
  formatNumber,
  formatPlaytime,
  formatPp,
  formatRank,
} from "@/lib/format";
import { Sparkline } from "./Sparkline";

const GRADE_STYLES: Record<string, string> = {
  SS: "text-[#ffd24a]",
  S: "text-[#ffd24a]",
  A: "text-[#8be04a]",
};

function Grade({ grade, count }: { grade: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-black/20 px-2.5 py-1">
      <span className={`font-display text-sm font-bold ${GRADE_STYLES[grade]}`}>
        {grade}
      </span>
      <span className="text-sm text-white/70">{formatNumber(count)}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/20 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-white/40">
        {label}
      </div>
      <div className="font-display text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

export function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-lg shadow-black/30">
      <div
        className="relative h-36 bg-cover bg-center"
        style={{
          backgroundImage: profile.coverUrl
            ? `linear-gradient(to top, #2a2227 4%, transparent 70%), url(${profile.coverUrl})`
            : "linear-gradient(120deg,#ff66ab33,#7d4fff33)",
        }}
      />
      <div className="flex flex-wrap items-end gap-4 px-4 sm:px-6 -mt-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={profile.avatarUrl}
          alt={profile.username}
          className="h-24 w-24 rounded-xl border-4 border-surface bg-surface object-cover"
        />
        <div className="min-w-0 pb-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-bold break-words text-white sm:text-3xl">
              {profile.username}
            </h2>
            {profile.isSupporter && (
              <span className="text-pink" title="osu!supporter">
                ♥
              </span>
            )}
          </div>
          <p className="text-sm text-white/50">
            <span className="mr-1">{flagEmoji(profile.countryCode)}</span>
            {profile.countryName} · joined {formatJoinDate(profile.joinDate)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 px-4 py-5 sm:gap-x-10 sm:px-6">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-white/40">
            Global Ranking
          </div>
          <div className="font-display text-2xl font-bold text-pink">
            {formatRank(profile.globalRank)}
          </div>
          {profile.rankHistory.length > 1 && (
            <div className="mt-1 w-32 opacity-70">
              <Sparkline values={profile.rankHistory} />
            </div>
          )}
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-white/40">
            Country Ranking
          </div>
          <div className="font-display text-2xl font-bold text-white">
            {flagEmoji(profile.countryCode)} {formatRank(profile.countryRank)}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-white/40">
            Performance
          </div>
          <div className="font-display text-2xl font-bold text-pink">
            {formatPp(profile.pp)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 px-4 sm:px-6 pb-4">
        <Grade grade="SS" count={profile.grades.ss + profile.grades.ssh} />
        <Grade grade="S" count={profile.grades.s + profile.grades.sh} />
        <Grade grade="A" count={profile.grades.a} />
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 sm:px-6 pb-6 sm:grid-cols-4">
        <Stat label="Accuracy" value={`${profile.accuracy.toFixed(2)}%`} />
        <Stat label="Play count" value={formatNumber(profile.playCount)} />
        <Stat label="Playtime" value={formatPlaytime(profile.playTimeSec)} />
        <Stat label="Max combo" value={formatNumber(profile.maxCombo)} />
        <Stat label="Ranked score" value={formatCompact(profile.rankedScore)} />
        <Stat label="Total hits" value={formatCompact(profile.totalHits)} />
        <Stat label="Replays watched" value={formatNumber(profile.replaysWatched)} />
        <Stat label="Level" value={`${profile.level}`} />
      </div>

      <div className="px-4 sm:px-6 pb-6">
        <div className="mb-1 flex items-center justify-between text-xs text-white/40">
          <span>Level {profile.level}</span>
          <span>{profile.levelProgress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/30">
          <div
            className="h-full rounded-full bg-pink"
            style={{ width: `${profile.levelProgress}%` }}
          />
        </div>
      </div>
    </section>
  );
}
