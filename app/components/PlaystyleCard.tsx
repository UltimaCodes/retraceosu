import type { PlaystyleSummary, Spread } from "@/lib/playstyle";
import { formatDuration } from "@/lib/format";

function spreadText(s: Spread, digits = 0): string {
  const f = (n: number) => n.toFixed(digits);
  return `${f(s.median)} (${f(s.min)}–${f(s.max)})`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-2.5 last:border-0">
      <span className="text-sm text-white/50">{label}</span>
      <span className="font-display text-sm font-semibold text-white">
        {value}
      </span>
    </div>
  );
}

export function PlaystyleCard({ playstyle }: { playstyle: PlaystyleSummary }) {
  if (playstyle.sampleSize === 0) {
    return (
      <section className="rounded-xl border border-line bg-surface p-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-white/40">
          Playstyle
        </h3>
        <p className="mt-2 text-sm text-white/50">
          No ranked top plays found to profile yet.
        </p>
      </section>
    );
  }

  const topMods = Object.entries(playstyle.mods)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const circlePct = Math.round(playstyle.circleRatio * 100);

  return (
    <section className="rounded-xl border border-line bg-surface p-6 shadow-lg shadow-black/30">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-white/40">
          Playstyle
        </h3>
        <span className="text-xs text-white/40">
          top {playstyle.sampleSize} plays
        </span>
      </div>

      <div className="mt-2 font-display text-3xl font-bold text-pink">
        {playstyle.label}
      </div>
      {playstyle.traits.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {playstyle.traits.map((t) => (
            <span
              key={t}
              className="rounded-full bg-black/20 px-3 py-1 text-xs text-white/70"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5">
        <Row label="Star rating" value={spreadText(playstyle.sr, 2)} />
        <Row label="BPM (effective)" value={spreadText(playstyle.bpm)} />
        <Row label="Avg length" value={formatDuration(playstyle.avgLengthSec)} />
        <Row
          label="Circles / sliders"
          value={`${circlePct}% / ${100 - circlePct}%`}
        />
        <Row label="Avg accuracy" value={`${playstyle.avgAccuracy.toFixed(2)}%`} />
        <Row label="Avg OD" value={playstyle.avgOd.toFixed(1)} />
      </div>

      {topMods.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {topMods.map(([mod, count]) => (
            <span
              key={mod}
              className="rounded bg-pink/15 px-2 py-1 text-xs font-semibold text-pink"
            >
              {mod} ×{count}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
