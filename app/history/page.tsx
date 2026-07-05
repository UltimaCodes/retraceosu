"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/app/components/Nav";
import { ScrollBox } from "@/app/components/ScrollBox";
import { clearReplays, deleteReplay, listReplays, type ReplayRecord } from "@/lib/history";

// recurring-leak buckets matched against stored weakness lines
const THEMES = [
  { label: "Aim / jumps", re: /jump|undershoot|overshoot|edge|aim/i },
  { label: "Streams / speed", re: /stream|burst|finger/i },
  { label: "Timing offset", re: /early|late|timing/i },
  { label: "Stamina / focus", re: /stamina|fade|back half|consistency/i },
  { label: "Slider control", re: /slider/i },
  { label: "Misses / chokes", re: /miss/i },
];

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-black/20 px-3 py-2.5">
      <div className="truncate text-[11px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="font-display text-sm font-bold text-white sm:text-base">{value}</div>
      {sub && <div className="truncate text-[11px] text-white/40">{sub}</div>}
    </div>
  );
}

function Title({ children }: { children: string }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wide text-white/40">{children}</h2>;
}

export default function HistoryPage() {
  const [records, setRecords] = useState<ReplayRecord[] | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    let live = true;
    listReplays()
      .then((r) => live && setRecords(r))
      .catch(() => live && setRecords([]));
    return () => {
      live = false;
    };
  }, []);

  async function remove(id: string) {
    await deleteReplay(id).catch(() => {});
    setRecords((cur) => cur?.filter((r) => r.id !== id) ?? cur);
  }

  async function clearAll() {
    if (!confirmClear) return setConfirmClear(true);
    await clearReplays().catch(() => {});
    setRecords([]);
    setConfirmClear(false);
  }

  return (
    <>
      <Nav active="/history" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Replay history</h1>
            <p className="mt-1 text-sm text-white/50">
              Every replay you analyze is kept in your browser. The more you feed it, the
              clearer your recurring leaks get.
            </p>
          </div>
          {records && records.length > 0 && (
            <button
              onClick={clearAll}
              onBlur={() => setConfirmClear(false)}
              className={`shrink-0 rounded-lg border px-3 py-2 text-sm transition ${
                confirmClear
                  ? "border-red-400/60 bg-red-400/10 text-red-300"
                  : "border-line bg-black/20 text-white/50 hover:text-white"
              }`}
            >
              {confirmClear ? "click again to wipe" : "Clear all"}
            </button>
          )}
        </div>

        {records === null && <p className="mt-8 text-sm text-white/40">Loading…</p>}

        {records !== null && records.length === 0 && (
          <div className="mt-8 rounded-xl border border-line bg-surface p-8 text-center">
            <p className="text-white/60">Nothing here yet, analyze a replay first.</p>
            <p className="mt-1 text-sm text-white/40">
              Tip: drop several .osr files at once on the analyze page to bulk import.
            </p>
            <Link
              href="/analyze"
              className="mt-4 inline-block rounded-lg bg-pink px-5 py-2.5 font-display font-bold text-white hover:bg-pink-dark"
            >
              Analyze a replay
            </Link>
          </div>
        )}

        {records !== null && records.length > 0 && <Aggregate records={records} onDelete={remove} />}
      </main>
    </>
  );
}

function Aggregate({
  records,
  onDelete,
}: {
  records: ReplayRecord[];
  onDelete: (id: string) => void;
}) {
  const n = records.length;
  const avg = (f: (r: ReplayRecord) => number) =>
    records.reduce((s, r) => s + f(r), 0) / Math.max(1, n);
  const avgUr = Math.round(avg((r) => r.ur));
  const avgBias = avg((r) => r.meanError);
  const totalMisses = records.reduce((s, r) => s + r.misses, 0);
  const clean = records.filter((r) => r.misses === 0 && r.sliderBreaks === 0).length;

  const themes = THEMES.map((t) => ({
    label: t.label,
    count: records.filter((r) => r.weaknesses.some((w) => t.re.test(w))).length,
  }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);

  const practiceCounts = new Map<string, number>();
  for (const r of records)
    for (const p of r.practice) practiceCounts.set(p, (practiceCounts.get(p) ?? 0) + 1);
  const topPractice = [...practiceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // oldest -> newest so the trend reads left to right
  const trend = [...records].sort((a, b) => a.savedAt - b.savedAt).slice(-20);
  const maxUr = Math.max(...trend.map((r) => r.ur), 1);

  return (
    <div className="mt-6 space-y-4">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Replays" value={`${n}`} />
        <Stat label="Avg UR" value={`${avgUr}`} />
        <Stat
          label="Avg timing bias"
          value={`${Math.abs(avgBias).toFixed(1)}ms ${avgBias < 0 ? "early" : "late"}`}
        />
        <Stat label="Clean runs" value={`${clean}/${n}`} sub={`${totalMisses} misses total`} />
      </section>

      {themes.length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-5">
          <Title>Recurring leaks</Title>
          <p className="mt-1 text-[11px] text-white/35">
            how often each problem shows up across your analyzed replays
          </p>
          <div className="mt-3 space-y-2.5">
            {themes.map((t) => (
              <div key={t.label} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-sm text-white/60 sm:w-36">{t.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/30">
                  <div
                    className="h-full rounded-full bg-pink"
                    style={{ width: `${(t.count / n) * 100}%` }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right font-display text-sm text-white">
                  {t.count}/{n}
                </span>
              </div>
            ))}
          </div>
          {topPractice.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <Title>What to grind</Title>
              <ul className="mt-2 space-y-1.5">
                {topPractice.map(([p, c]) => (
                  <li key={p} className="flex gap-2 text-sm text-white/75">
                    <span className="text-pink">›</span>
                    <span>
                      {p} <span className="text-white/35">(flagged {c}×)</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {trend.length >= 3 && (
        <section className="rounded-xl border border-line bg-surface p-5">
          <Title>UR trend</Title>
          <div className="mt-3 flex h-20 items-end gap-1">
            {trend.map((r) => (
              <div
                key={r.id}
                className={`flex-1 rounded-t ${r.misses > 0 ? "bg-red-400" : "bg-pink"}`}
                style={{ height: `${Math.max((r.ur / maxUr) * 100, 4)}%` }}
                title={`${r.title} · UR ${r.ur}${r.misses ? ` · ${r.misses} miss` : ""}`}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-white/35">
            <span>older</span>
            <span>lower is steadier · red had misses</span>
            <span>newer</span>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface p-5">
        <Title>Analyzed replays</Title>
        <div className="mt-3">
          <ScrollBox maxH="max-h-[480px]">
            {records.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-lg bg-black/20 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {r.artist} – {r.title}
                  </p>
                  <p className="truncate text-[11px] text-white/45">
                    [{r.version}] · {["None", "NM", ""].includes(r.mods) ? "nomod" : `+${r.mods}`} ·{" "}
                    {r.acc}% · UR {r.ur}
                    {r.misses > 0 && ` · ${r.misses} miss`}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-white/35">
                  {new Date(r.savedAt).toLocaleDateString()}
                </span>
                <button
                  onClick={() => onDelete(r.id)}
                  title="remove"
                  className="shrink-0 rounded px-2 py-1 text-white/30 transition hover:bg-black/40 hover:text-red-300"
                >
                  ✕
                </button>
              </div>
            ))}
          </ScrollBox>
        </div>
      </section>
    </div>
  );
}
