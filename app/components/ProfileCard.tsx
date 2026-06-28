import type { Profile } from "@/lib/osu/profile";
import {
  flagEmoji,
  formatJoinDate,
  formatNumber,
  formatPlaytime,
  formatPp,
  formatRank,
} from "@/lib/format";

function BigStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-white/40">
        {label}
      </div>
      <div
        className={`font-display text-2xl font-bold ${accent ? "text-pink" : "text-white"}`}
      >
        {value}
      </div>
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
      <div className="flex flex-wrap items-end gap-4 px-6 -mt-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={profile.avatarUrl}
          alt={profile.username}
          className="h-24 w-24 rounded-xl border-4 border-surface bg-surface object-cover"
        />
        <div className="pb-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-3xl font-bold text-white">
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

      <div className="flex flex-wrap gap-x-10 gap-y-4 px-6 py-5">
        <BigStat label="Global Ranking" value={formatRank(profile.globalRank)} accent />
        <BigStat label="Country Ranking" value={formatRank(profile.countryRank)} />
        <BigStat label="Performance" value={formatPp(profile.pp)} accent />
      </div>

      <div className="grid grid-cols-2 gap-2 px-6 pb-6 sm:grid-cols-4">
        <Stat label="Accuracy" value={`${profile.accuracy.toFixed(2)}%`} />
        <Stat label="Play count" value={formatNumber(profile.playCount)} />
        <Stat label="Playtime" value={formatPlaytime(profile.playTimeSec)} />
        <Stat label="Max combo" value={formatNumber(profile.maxCombo)} />
      </div>

      <div className="px-6 pb-6">
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
