"use client";

import { useState, type FormEvent } from "react";
import { Nav } from "@/app/components/Nav";
import { formatNumber, formatPlaytime, formatDuration, flagEmoji } from "@/lib/format";
import type { PlayerReport } from "@/lib/informatics/player";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; msg: string }
  | { status: "ready"; a: PlayerReport; b: PlayerReport };

// higher is better unless flipped
type RowDef = {
  label: string;
  value: (r: PlayerReport) => number | null;
  show: (r: PlayerReport) => string;
  lowerWins?: boolean;
};

const ROWS: RowDef[] = [
  { label: "Total pp", value: (r) => r.user.pp, show: (r) => `${formatNumber(r.user.pp)}pp` },
  {
    label: "Global rank",
    value: (r) => r.user.globalRank,
    show: (r) => (r.user.globalRank ? `#${formatNumber(r.user.globalRank)}` : "unranked"),
    lowerWins: true,
  },
  {
    label: "Accuracy",
    value: (r) => r.user.accuracy,
    show: (r) => `${r.user.accuracy.toFixed(2)}%`,
  },
  {
    label: "Top play",
    value: (r) => r.ppStats.top,
    show: (r) => (r.top ? `${r.ppStats.top}pp (${r.top.title})` : "n/a"),
  },
  {
    label: "pp per hour",
    value: (r) => r.efficiency.ppPerHour,
    show: (r) => `${r.efficiency.ppPerHour}`,
  },
  {
    label: "Playtime",
    value: (r) => r.user.playTimeSec,
    show: (r) => formatPlaytime(r.user.playTimeSec),
  },
  {
    label: "Median SR (modded)",
    value: (r) => r.spread.srMedian,
    show: (r) => `${r.spread.srMedian}★`,
  },
  {
    label: "Effective BPM",
    value: (r) => r.spread.bpmMedian,
    show: (r) => `${r.spread.bpmMedian}`,
  },
  {
    label: "Mod of choice",
    value: () => null,
    show: (r) => (r.modUsage[0] ? `${r.modUsage[0].mod} ${r.modUsage[0].pct}%` : "NM"),
  },
  {
    label: "No-miss bests",
    value: (r) => r.consistency.noMissRate,
    show: (r) => `${Math.round(r.consistency.noMissRate * 100)}%`,
  },
  {
    label: "Chokes in bests",
    value: (r) => r.novelty.chokes.plays,
    show: (r) => `${r.novelty.chokes.plays} (${r.novelty.chokes.misses} misses)`,
    lowerWins: true,
  },
  {
    label: "Oldest standing play",
    value: (r) => r.novelty.fossil?.ageDays ?? 0,
    show: (r) =>
      r.novelty.fossil ? `${Math.floor(r.novelty.fossil.ageDays / 30.4)} months` : "n/a",
  },
  {
    label: "Bests set in last 90d",
    value: (r) => r.recency.last90,
    show: (r) => `${r.recency.last90}/100`,
  },
  {
    label: "Longest best",
    value: (r) => r.novelty.longest?.lengthSec ?? 0,
    show: (r) => (r.novelty.longest ? formatDuration(r.novelty.longest.lengthSec) : "n/a"),
  },
];

function Head({ r }: { r: PlayerReport }) {
  return (
    <a
      href={`https://osu.ppy.sh/users/${r.user.id}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 transition hover:border-pink/40"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={r.user.avatarUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
      <div className="min-w-0">
        <p className="truncate font-display text-lg font-bold text-white">{r.user.username}</p>
        <p className="truncate text-sm text-white/50">
          {flagEmoji(r.user.countryCode)} #{r.user.globalRank ? formatNumber(r.user.globalRank) : "?"}
        </p>
      </div>
    </a>
  );
}

export default function ComparePage() {
  const [nameA, setNameA] = useState("");
  const [nameB, setNameB] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  async function go(e: FormEvent) {
    e.preventDefault();
    const a = nameA.trim();
    const b = nameB.trim();
    if (!a || !b) return;
    setState({ status: "loading" });
    try {
      const [ra, rb] = await Promise.all([
        fetch(`/api/player?u=${encodeURIComponent(a)}`),
        fetch(`/api/player?u=${encodeURIComponent(b)}`),
      ]);
      if (!ra.ok || !rb.ok) {
        return setState({
          status: "error",
          msg: !ra.ok ? `couldn't find ${a}` : `couldn't find ${b}`,
        });
      }
      setState({ status: "ready", a: await ra.json(), b: await rb.json() });
    } catch {
      setState({ status: "error", msg: "lookup failed, try again in a minute" });
    }
  }

  return (
    <>
      <Nav active="/compare" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-white">Compare players</h1>
        <p className="mt-1 text-sm text-white/50">
          Two names, one table. Pink cell wins the row.
        </p>

        <form onSubmit={go} className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input
            value={nameA}
            onChange={(e) => setNameA(e.target.value)}
            placeholder="first player"
            suppressHydrationWarning
            className="min-w-0 flex-1 rounded-lg border border-line bg-black/30 px-4 py-2.5 text-white outline-none placeholder:text-white/30 focus:border-pink/50"
          />
          <span className="hidden items-center text-white/30 sm:flex">vs</span>
          <input
            value={nameB}
            onChange={(e) => setNameB(e.target.value)}
            placeholder="second player"
            suppressHydrationWarning
            className="min-w-0 flex-1 rounded-lg border border-line bg-black/30 px-4 py-2.5 text-white outline-none placeholder:text-white/30 focus:border-pink/50"
          />
          <button
            type="submit"
            disabled={state.status === "loading"}
            className="rounded-lg bg-pink px-5 py-2.5 font-display font-bold text-white transition hover:bg-pink-dark disabled:opacity-40"
          >
            {state.status === "loading" ? "Fetching…" : "Compare"}
          </button>
        </form>

        {state.status === "loading" && (
          <div className="mt-6 animate-pulse space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="h-20 rounded-xl bg-white/5" />
              <div className="h-20 rounded-xl bg-white/5" />
            </div>
            <div className="h-96 rounded-xl bg-white/5" />
          </div>
        )}
        {state.status === "error" && (
          <p className="mt-6 text-sm text-red-400">{state.msg}</p>
        )}

        {state.status === "ready" && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Head r={state.a} />
              <Head r={state.b} />
            </div>
            <section className="overflow-hidden rounded-xl border border-line bg-surface">
              {ROWS.map((row) => {
                const va = row.value(state.a);
                const vb = row.value(state.b);
                let winA = false;
                let winB = false;
                if (va != null && vb != null && va !== vb) {
                  const aBetter = row.lowerWins ? va < vb : va > vb;
                  winA = aBetter;
                  winB = !aBetter;
                }
                return (
                  <div
                    key={row.label}
                    className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-line px-4 py-2.5 last:border-0"
                  >
                    <span
                      className={`truncate text-sm ${winA ? "font-semibold text-pink" : "text-white/75"}`}
                    >
                      {row.show(state.a)}
                    </span>
                    <span className="text-center text-[11px] uppercase tracking-wide text-white/35">
                      {row.label}
                    </span>
                    <span
                      className={`truncate text-right text-sm ${winB ? "font-semibold text-pink" : "text-white/75"}`}
                    >
                      {row.show(state.b)}
                    </span>
                  </div>
                );
              })}
            </section>
            <p className="text-[11px] text-white/35">
              All rows come from live top-100 crunching, star ratings are mod-adjusted.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
