import type { Profile } from "@/lib/osu/profile";
import {
  formatJoinDate,
  formatNumber,
  formatPlaytime,
  formatPp,
  formatRank,
} from "@/lib/format";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-white/40">{label}</div>
      <div className="text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

export function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#1b1622]">
      <div
        className="h-28 bg-cover bg-center"
        style={{
          backgroundImage: profile.coverUrl
            ? `url(${profile.coverUrl})`
            : "linear-gradient(120deg,#ff66aa33,#7d4fff33)",
        }}
      />
      <div className="flex items-end gap-4 px-6 pb-4 -mt-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={profile.avatarUrl}
          alt={profile.username}
          className="h-20 w-20 rounded-xl border-2 border-[#1b1622] bg-[#1b1622] object-cover"
        />
        <div className="pb-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white">{profile.username}</h2>
            {profile.isSupporter && (
              <span className="rounded bg-[#ff66aa] px-1.5 py-0.5 text-xs font-semibold text-white">
                osu!supporter
              </span>
            )}
          </div>
          <p className="text-sm text-white/50">
            {profile.countryName} · joined {formatJoinDate(profile.joinDate)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 px-6 pb-6 sm:grid-cols-4">
        <Stat label="Global" value={formatRank(profile.globalRank)} />
        <Stat label="Country" value={formatRank(profile.countryRank)} />
        <Stat label="PP" value={formatPp(profile.pp)} />
        <Stat label="Accuracy" value={`${profile.accuracy.toFixed(2)}%`} />
        <Stat label="Play count" value={formatNumber(profile.playCount)} />
        <Stat label="Playtime" value={formatPlaytime(profile.playTimeSec)} />
        <Stat label="Max combo" value={formatNumber(profile.maxCombo)} />
        <Stat label="Level" value={`${profile.level}`} />
      </div>
    </section>
  );
}
