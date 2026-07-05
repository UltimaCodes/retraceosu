"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/app/components/Nav";
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

type Choke = {
  beatmapId: number;
  title: string;
  version: string;
  mods: string;
  stars: number;
  currentPp: number;
  currentAcc: number;
  misses: number;
  potentialPp: number;
  gain: number;
  reason: "choke" | "acc";
  targetAcc: number;
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
  chokes: Choke[];
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

const PAGE = 25;

export default function FarmPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [tab, setTab] = useState<"recs" | "chokes">("recs");
  const [limit, setLimit] = useState(PAGE);
  const [refreshing, setRefreshing] = useState(false);

  async function load(refresh = false) {
    if (refresh) setRefreshing(true);
    try {
      const res = await fetch(`/api/recommend${refresh ? "?refresh=1" : ""}`);
      if (res.status === 401) return setState({ status: "anon" });
      if (res.status === 422) return setState({ status: "thin" });
      if (!res.ok) return setState({ status: "error" });
      setState({ status: "ready", data: await res.json() });
      setLimit(PAGE);
    } catch {
      setState({ status: "error" });
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    // fetch on mount; state only updates after the awaited response, not synchronously
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  return (
    <>
      <Nav active="/farm" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Farm maps</h1>
            <p className="mt-1 text-sm text-white/50">
              Ranked maps worth pp to you, priced for your usual mods and accuracy at an FC.
            </p>
          </div>
          {state.status === "ready" && (
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="shrink-0 rounded-lg border border-line bg-black/20 px-3 py-2 text-sm text-white/70 transition hover:border-pink/40 hover:text-white disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "↻ Refresh plays"}
            </button>
          )}
        </div>

        {state.status === "loading" && (
          <p className="mt-8 text-sm text-white/40">Crunching your top plays…</p>
        )}
        {state.status === "anon" && (
          <div className="mt-8 rounded-xl border border-line bg-surface p-8 text-center">
            <p className="text-white/60">Sign in with osu! first, recommendations are built from your top plays.</p>
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
            Not enough ranked plays to profile yet, set some scores first.
          </p>
        )}
        {state.status === "error" && (
          <p className="mt-8 text-sm text-red-400">Couldn&apos;t build recommendations, try again in a minute.</p>
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

            <div className="mt-5 inline-flex rounded-lg border border-line bg-black/20 p-1 text-sm">
              <button
                onClick={() => setTab("recs")}
                className={`rounded-md px-4 py-1.5 font-semibold transition ${
                  tab === "recs" ? "bg-pink text-white" : "text-white/50 hover:text-white"
                }`}
              >
                Worth farming
              </button>
              <button
                onClick={() => setTab("chokes")}
                className={`rounded-md px-4 py-1.5 font-semibold transition ${
                  tab === "chokes" ? "bg-pink text-white" : "text-white/50 hover:text-white"
                }`}
              >
                Fix your plays ({state.data.chokes.length})
              </button>
            </div>

            {tab === "recs" ? (
              <RecsBox
                recs={state.data.recommendations}
                floor={state.data.profile.floor}
                limit={limit}
                onMore={() => setLimit((l) => l + PAGE)}
              />
            ) : (
              <ChokesBox chokes={state.data.chokes} />
            )}

            <p className="mt-4 text-[11px] text-white/35">
              {tab === "recs"
                ? "Pool: popular ranked maps in your comfort star range, minus your top 100. Each is priced under your real mod combos at that combo's median accuracy, capped near your best play, and ranked toward your measured aim/speed lean."
                : "Plays already in your top 100 where an FC or a realistic accuracy bump would net real pp. Clean 98%+ runs you'd only marginally improve are left out."}
            </p>
          </>
        )}
      </main>
    </>
  );
}

function RecsBox({
  recs,
  floor,
  limit,
  onMore,
}: {
  recs: Rec[];
  floor: number;
  limit: number;
  onMore: () => void;
}) {
  if (recs.length === 0) {
    return (
      <p className="mt-4 text-sm text-white/50">
        Nothing beats your pp floor in this pool right now, try refreshing later (the pool rotates
        with popular maps).
      </p>
    );
  }
  const shown = recs.slice(0, limit);
  return (
    <>
      <div className="mt-4 max-h-[560px] space-y-2 overflow-y-auto rounded-xl border border-line bg-black/10 p-2 pr-3">
        {shown.map((r) => (
          <a
            key={r.beatmapId}
            href={`https://osu.ppy.sh/b/${r.beatmapId}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-4 rounded-lg border border-line bg-surface p-4 transition hover:border-pink/40"
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
              <div className="font-display text-xl font-bold text-pink">~{r.expectedPp}pp</div>
              <div className="text-[11px] text-white/40">+{r.expectedPp - floor} over floor</div>
            </div>
          </a>
        ))}
      </div>
      {recs.length > limit && (
        <button
          onClick={onMore}
          className="mt-3 w-full rounded-lg border border-line bg-black/20 py-2.5 text-sm font-semibold text-white/70 transition hover:border-pink/40 hover:text-white"
        >
          Show more ({recs.length - limit} left)
        </button>
      )}
    </>
  );
}

function ChokesBox({ chokes }: { chokes: Choke[] }) {
  if (chokes.length === 0) {
    return (
      <p className="mt-4 text-sm text-white/50">
        No obvious chokes or weak-accuracy plays in your top 100, your bests are clean.
      </p>
    );
  }
  return (
    <div className="mt-4 max-h-[560px] space-y-2 overflow-y-auto rounded-xl border border-line bg-black/10 p-2 pr-3">
      {chokes.map((c) => (
        <a
          key={c.beatmapId}
          href={`https://osu.ppy.sh/b/${c.beatmapId}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-4 rounded-lg border border-line bg-surface p-4 transition hover:border-pink/40"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-display font-bold text-white">{c.title}</p>
            <p className="truncate text-sm text-white/50">
              [{c.version}] · {c.stars}★ · {c.mods === "NM" ? "nomod" : `+${c.mods}`}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
              {c.reason === "choke" ? (
                <span className="rounded bg-red-400/15 px-1.5 py-0.5 font-semibold text-red-300">
                  {c.misses} miss · FC it
                </span>
              ) : (
                <span className="rounded bg-amber-400/15 px-1.5 py-0.5 font-semibold text-amber-300">
                  push acc to {c.targetAcc}%
                </span>
              )}
              <span className="text-white/45">now {c.currentPp}pp @ {c.currentAcc}%</span>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-display text-xl font-bold text-pink">~{c.potentialPp}pp</div>
            <div className="text-[11px] text-[#8be04a]">+{c.gain} if you clean it</div>
          </div>
        </a>
      ))}
    </div>
  );
}
