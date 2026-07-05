"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDuration } from "@/lib/format";

type Rec = {
  beatmapId: number;
  setId: number;
  artist: string;
  title: string;
  version: string;
  mods: string;
  accUsed: number;
  expectedPp: number;
  stars: number;
  bpm: number;
  lengthSec: number;
  lean: "aim" | "speed" | "balanced";
};

type FarmData = {
  profile: {
    combos: { mods: string; acc: number }[];
    floor: number;
    top: number;
    srLo: number;
    srHi: number;
    lean: "aim" | "speed" | "balanced" | null;
  };
  recommendations: Rec[];
};

const LEAN_STYLE: Record<Rec["lean"], string> = {
  aim: "bg-[#7d4fff]/20 text-[#b79aff]",
  speed: "bg-[#5fd0ff]/15 text-[#5fd0ff]",
  balanced: "bg-white/10 text-white/60",
};

type State =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "thin" }
  | { status: "error" }
  | { status: "ready"; data: FarmData };

export default function FarmPage() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    fetch("/api/recommend")
      .then(async (res) => {
        if (res.status === 401) return setState({ status: "anon" });
        if (res.status === 422) return setState({ status: "thin" });
        if (!res.ok) return setState({ status: "error" });
        setState({ status: "ready", data: await res.json() });
      })
      .catch(() => setState({ status: "error" }));
  }, []);

  return (
    <>
      <nav className="sticky top-0 z-20 border-b border-line bg-[#231b20]">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="font-display text-xl font-bold tracking-tight text-white">
            Re<span className="text-pink">trace</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/analyze" className="text-white/50 transition hover:text-white">
              Analyze replay
            </Link>
            <Link href="/" className="text-white/50 transition hover:text-white">
              Profile
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-white">Farm maps</h1>
        <p className="mt-1 text-sm text-white/50">
          Ranked maps worth pp to you — expected pp is computed for your usual mods and
          accuracy, assuming an FC.
        </p>

        {state.status === "loading" && (
          <p className="mt-8 text-sm text-white/40">Crunching your top plays…</p>
        )}
        {state.status === "anon" && (
          <div className="mt-8 rounded-xl border border-line bg-surface p-8 text-center">
            <p className="text-white/60">Sign in with osu! first — recommendations are built from your top plays.</p>
            <a
              href="/api/auth/login"
              className="mt-4 inline-block rounded-lg bg-pink px-5 py-2.5 font-display font-bold text-white hover:bg-pink-dark"
            >
              Sign in with osu!
            </a>
          </div>
        )}
        {state.status === "thin" && (
          <p className="mt-8 text-sm text-white/50">
            Not enough ranked plays to profile yet — set some scores first.
          </p>
        )}
        {state.status === "error" && (
          <p className="mt-8 text-sm text-red-400">Couldn&apos;t build recommendations — try again in a minute.</p>
        )}

        {state.status === "ready" && (
          <>
            <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
              {state.data.profile.combos.map((c) => (
                <span key={c.mods} className="rounded-full bg-black/20 px-3 py-1 text-white/70">
                  {c.mods} @ {c.acc}%
                </span>
              ))}
              <span className="rounded-full bg-black/20 px-3 py-1 text-white/70">
                pp {state.data.profile.floor}–{state.data.profile.top}
              </span>
              <span className="rounded-full bg-black/20 px-3 py-1 text-white/70">
                {state.data.profile.srLo}–{state.data.profile.srHi}★ pool
              </span>
              {state.data.profile.lean && (
                <span className={`rounded-full px-3 py-1 ${LEAN_STYLE[state.data.profile.lean]}`}>
                  {state.data.profile.lean} player
                </span>
              )}
            </div>

            {state.data.recommendations.length === 0 ? (
              <p className="mt-8 text-sm text-white/50">
                Nothing beats your pp floor in this pool right now — try again later
                (the pool rotates with popular maps).
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {state.data.recommendations.map((r) => (
                  <a
                    key={r.beatmapId}
                    href={`https://osu.ppy.sh/b/${r.beatmapId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4 transition hover:border-pink/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display font-bold text-white">
                        {r.artist} – {r.title}
                      </p>
                      <p className="truncate text-sm text-white/50">
                        [{r.version}] · {r.stars}★ · {r.bpm}bpm · {formatDuration(r.lengthSec)}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="rounded bg-pink/15 px-1.5 py-0.5 font-semibold text-pink">
                          {r.mods === "NM" ? "nomod" : `+${r.mods}`}
                        </span>
                        <span className="text-white/45">needs FC @ {r.accUsed}%</span>
                        <span className={`rounded px-1.5 py-0.5 font-semibold ${LEAN_STYLE[r.lean]}`}>
                          {r.lean}
                        </span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-display text-xl font-bold text-pink">
                        ~{r.expectedPp}pp
                      </div>
                      <div className="text-[11px] text-white/40">
                        +{r.expectedPp - state.data.profile.floor} over floor
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
            <p className="mt-4 text-[11px] text-white/35">
              Pool: popular ranked maps in your comfort star range, minus your top 100.
              Each map is priced under your real mod combos at that combo&apos;s median
              accuracy, capped near your best play (no fantasy FCs), and ranked toward
              your measured aim/speed lean.
            </p>
          </>
        )}
      </main>
    </>
  );
}
