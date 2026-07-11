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
  netGain: number;
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
  netGain: number;
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
    totalPp: number;
    chokeCeiling: { total: number; gain: number };
  };
  recommendations: Rec[];
  chokes: Choke[];
  cursor: string | null; // search pool cursor, null once the pool is truly exhausted
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
const HIDDEN_KEY = "retrace-hidden-recs";

type LenFilter = "any" | "short" | "long";
type BpmFilter = "any" | "slow" | "fast";

function Chip({
  on,
  label,
  onClick,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
        on ? "bg-pink text-white" : "bg-black/20 text-white/50 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

export default function FarmPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [tab, setTab] = useState<"recs" | "chokes">("recs");
  const [limit, setLimit] = useState(PAGE);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lenF, setLenF] = useState<LenFilter>("any");
  const [bpmF, setBpmF] = useState<BpmFilter>("any");
  const [hidden, setHidden] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "[]") as number[]);
    } catch {
      return new Set();
    }
  });

  function hide(id: number) {
    setHidden((prev) => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function unhideAll() {
    localStorage.removeItem(HIDDEN_KEY);
    setHidden(new Set());
  }

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

  const filtered =
    state.status === "ready"
      ? state.data.recommendations
          .filter((r) => !hidden.has(r.beatmapId))
          .filter((r) =>
            lenF === "any" ? true : lenF === "short" ? r.lengthSec < 120 : r.lengthSec >= 120,
          )
          .filter((r) =>
            bpmF === "any" ? true : bpmF === "fast" ? r.bpm >= 200 : r.bpm < 200,
          )
      : [];

  // reveal what's already fetched first; once that runs dry, pull the next
  // slice of the search pool so the list can grow for as long as they keep clicking
  async function loadMore() {
    if (state.status !== "ready") return;
    if (filtered.length > limit) {
      setLimit((l) => l + PAGE);
      return;
    }
    const cur = state.data.cursor;
    if (!cur || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/recommend?cursor=${encodeURIComponent(cur)}`);
      if (!res.ok) return;
      const j: { recommendations: Rec[]; cursor: string | null } = await res.json();
      setState((s) => {
        if (s.status !== "ready") return s;
        const have = new Set(s.data.recommendations.map((r) => r.beatmapId));
        return {
          status: "ready",
          data: {
            ...s.data,
            recommendations: [
              ...s.data.recommendations,
              ...j.recommendations.filter((r) => !have.has(r.beatmapId)),
            ],
            cursor: j.cursor,
          },
        };
      });
      setLimit((l) => l + PAGE);
    } catch {
      // keep the list as is, the button stays pressable
    } finally {
      setLoadingMore(false);
    }
  }

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
              {state.data.profile.chokeCeiling.gain > 0 && (
                <span
                  className="rounded-full bg-[#8be04a]/10 px-3 py-1 text-[#8be04a]"
                  title="your total pp if every listed choke got cleaned"
                >
                  ceiling {state.data.profile.chokeCeiling.total}pp (+
                  {state.data.profile.chokeCeiling.gain})
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
              <>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-white/35">length</span>
                  <Chip on={lenF === "any"} label="any" onClick={() => setLenF("any")} />
                  <Chip on={lenF === "short"} label="under 2:00" onClick={() => setLenF("short")} />
                  <Chip on={lenF === "long"} label="2:00+" onClick={() => setLenF("long")} />
                  <span className="ml-2 text-[11px] text-white/35">bpm</span>
                  <Chip on={bpmF === "any"} label="any" onClick={() => setBpmF("any")} />
                  <Chip on={bpmF === "slow"} label="<200" onClick={() => setBpmF("slow")} />
                  <Chip on={bpmF === "fast"} label="200+" onClick={() => setBpmF("fast")} />
                  {hidden.size > 0 && (
                    <button
                      onClick={unhideAll}
                      className="ml-auto text-[11px] text-white/40 transition hover:text-white"
                    >
                      {hidden.size} hidden · reset
                    </button>
                  )}
                </div>
                <RecsBox
                  recs={filtered}
                  limit={limit}
                  hasMore={state.data.cursor != null}
                  loadingMore={loadingMore}
                  onMore={loadMore}
                  onHide={hide}
                />
              </>
            ) : (
              <ChokesBox chokes={state.data.chokes} />
            )}

            <p className="mt-4 text-[11px] text-white/35">
              {tab === "recs"
                ? "Pool: popular ranked maps in your comfort star range, minus your top 100. Each is priced under your real mod combos at that combo's median accuracy and ranked toward your measured aim/speed lean. Load more keeps digging deeper into the pool for as long as you want."
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
  limit,
  hasMore,
  loadingMore,
  onMore,
  onHide,
}: {
  recs: Rec[];
  limit: number;
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onHide: (id: number) => void;
}) {
  const shown = recs.slice(0, limit);
  return (
    <>
      {recs.length === 0 ? (
        <p className="mt-4 text-sm text-white/50">
          Nothing matches here right now, loosen the filters
          {hasMore ? " or load more maps from deeper in the pool" : ""}.
        </p>
      ) : (
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
              <div className="text-[11px] text-[#8be04a]">+{r.netGain} to your total</div>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onHide(r.beatmapId);
              }}
              title="hide this map"
              className="shrink-0 self-start rounded p-1 text-white/25 transition hover:bg-black/40 hover:text-red-300"
            >
              ✕
            </button>
          </a>
        ))}
      </div>
      )}
      {(recs.length > limit || hasMore) && (
        <button
          onClick={onMore}
          disabled={loadingMore}
          className="mt-3 w-full rounded-lg border border-line bg-black/20 py-2.5 text-sm font-semibold text-white/70 transition hover:border-pink/40 hover:text-white disabled:opacity-50"
        >
          {loadingMore
            ? "Digging deeper into the pool…"
            : recs.length > limit
              ? `Show more (${recs.length - limit} ready)`
              : "Load more maps"}
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
                  {c.misses} miss · FC ≈ {c.targetAcc}%
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
            <div className="text-[11px] text-[#8be04a]">+{c.netGain} to your total</div>
          </div>
        </a>
      ))}
    </div>
  );
}
