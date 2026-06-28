import type { PlaystyleAnalysis, Spread } from "@/lib/playstyle";
import { formatDuration } from "@/lib/format";
import { SkillRadar } from "./SkillRadar";

function spreadText(s: Spread, digits = 0): string {
  const f = (n: number) => n.toFixed(digits);
  return `${f(s.median)} · ${f(s.min)}–${f(s.max)}`;
}

function lengthText(s: Spread): string {
  return `${formatDuration(s.median)} · ${formatDuration(s.min)}–${formatDuration(s.max)}`;
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-black/20 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="font-display text-base font-semibold text-white">{value}</div>
      {sub && <div className="text-[11px] text-white/40">{sub}</div>}
    </div>
  );
}

export function PlaystyleCard({ playstyle: p }: { playstyle: PlaystyleAnalysis }) {
  if (p.sampleSize === 0) {
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

  const circlePct = Math.round(p.circleRatio * 100);

  return (
    <section className="rounded-xl border border-line bg-surface p-6 shadow-lg shadow-black/30">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-white/40">
          Playstyle
        </h3>
        <span className="text-xs text-white/40">top {p.sampleSize} plays</span>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-[260px_1fr]">
        <div>
          <SkillRadar skill={p.skill} />
          <p className="mt-1 text-center text-[11px] text-white/35">
            scaled to your global rank · 100 ≈ #1
          </p>
        </div>

        <div>
          <div className="font-display text-3xl font-bold text-pink">{p.label}</div>
          {p.traits.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {p.traits.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-black/20 px-3 py-1 text-xs text-white/70"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Metric
              label="No-miss rate"
              value={`${Math.round(p.noMissRate * 100)}%`}
              sub={`avg ${p.avgMisses.toFixed(1)} miss / play`}
            />
            <Metric
              label="Accuracy"
              value={`${p.accuracy.avg.toFixed(2)}%`}
              sub={`±${p.accuracy.stdev.toFixed(2)} · ${p.accuracy.worst.toFixed(1)}–${p.accuracy.best.toFixed(1)}`}
            />
            <Metric
              label="Top play pp"
              value={`${Math.round(p.pp.top)}pp`}
              sub={`median ${Math.round(p.pp.median)} · floor ${Math.round(p.pp.floor)}`}
            />
            <Metric
              label="Recent form"
              value={`${p.recency.last90}/${p.sampleSize} ≤90d`}
              sub={`newest ${p.recency.newestDays}d · oldest ${p.recency.oldestDays}d`}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric label="Star rating" value={spreadText(p.sr, 2)} />
        <Metric label="BPM (effective)" value={spreadText(p.bpm)} />
        <Metric label="Map length" value={lengthText(p.lengthSec)} />
        <Metric label="Approach rate" value={spreadText(p.ar, 1)} />
        <Metric label="Circle size" value={spreadText(p.cs, 1)} />
        <Metric label="Overall diff" value={spreadText(p.od, 1)} />
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-[11px] uppercase tracking-wide text-white/40">
          <span>Circles {circlePct}%</span>
          <span>Sliders {100 - circlePct}%</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-black/30">
          <div className="h-full bg-pink" style={{ width: `${circlePct}%` }} />
        </div>
      </div>

      {p.modCombos.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {p.modCombos.map((m) => (
            <span
              key={m.combo}
              className="rounded bg-pink/15 px-2 py-1 text-xs font-semibold text-pink"
            >
              {m.combo} ×{m.count}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
