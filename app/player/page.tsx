"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Nav } from "@/app/components/Nav";
import { ScrollBox } from "@/app/components/ScrollBox";
import { formatNumber, formatPlaytime, formatJoinDate, formatDuration, flagEmoji } from "@/lib/format";
import type { PlayerReport, PlayHighlight } from "@/lib/informatics/player";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "notfound" }
  | { status: "error" }
  | { status: "ready"; data: PlayerReport };

type Me = { id: number; username: string; avatarUrl: string };

// every scoring-relevant mod; NM is exclusive with the rest
const PICKER_MODS = ["NM", "HD", "DT", "HR", "HT", "EZ", "FL"] as const;

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

function PlayRow({ play, tag }: { play: PlayHighlight; tag?: string }) {
  return (
    <a
      href={`https://osu.ppy.sh/b/${play.beatmapId}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-lg bg-black/20 px-3 py-2 transition hover:bg-black/40"
    >
      {tag && (
        <span className="shrink-0 rounded bg-pink/15 px-1.5 py-0.5 text-[11px] font-bold text-pink">
          {tag}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{play.title}</p>
        <p className="truncate text-[11px] text-white/45">
          [{play.version}] · {play.mods === "NM" ? "nomod" : `+${play.mods}`} · {play.stars}★ · {play.acc}%
        </p>
      </div>
      <div className="shrink-0 text-right font-display font-bold text-pink">{play.pp}pp</div>
    </a>
  );
}

export default function PlayerPage() {
  const [name, setName] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/whoami")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && j?.username && setMe(j))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  async function search(u: string, e?: FormEvent) {
    e?.preventDefault();
    const q = u.trim();
    if (!q) return;
    setName(q);
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/player?u=${encodeURIComponent(q)}`);
      if (res.status === 404) return setState({ status: "notfound" });
      if (!res.ok) return setState({ status: "error" });
      setState({ status: "ready", data: await res.json() });
    } catch {
      setState({ status: "error" });
    }
  }

  return (
    <>
      <Nav active="/player" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-white">Player informatics</h1>
        <p className="mt-1 text-sm text-white/50">
          Type any osu! username to dig through their top 100: pick any mod combination to find
          their biggest play with it, pp milestones, fossils and more.
        </p>

        <form onSubmit={(e) => search(name, e)} className="mt-5 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="osu! username"
            suppressHydrationWarning
            className="min-w-0 flex-1 rounded-lg border border-line bg-black/30 px-4 py-2.5 text-white outline-none placeholder:text-white/30 focus:border-pink/50"
          />
          <button
            type="submit"
            disabled={state.status === "loading"}
            className="rounded-lg bg-pink px-5 py-2.5 font-display font-bold text-white transition hover:bg-pink-dark disabled:opacity-40"
          >
            {state.status === "loading" ? "Digging…" : "Look up"}
          </button>
        </form>

        <div className="mt-3 flex items-center gap-2 text-xs">
          {me ? (
            <button
              onClick={() => search(me.username)}
              className="flex items-center gap-2 rounded-full bg-black/20 px-3 py-1.5 text-white/70 transition hover:bg-black/40 hover:text-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={me.avatarUrl} alt="" className="h-4 w-4 rounded" />
              load my profile ({me.username})
            </button>
          ) : (
            <a href="/api/auth/login" className="text-white/40 transition hover:text-pink">
              sign in with osu! to load your own profile in one click
            </a>
          )}
        </div>

        {state.status === "loading" && (
          <p className="mt-6 text-sm text-white/40">
            Pulling their top 100 and mod-adjusted star ratings, takes a few seconds…
          </p>
        )}
        {state.status === "notfound" && (
          <p className="mt-6 text-sm text-white/50">No osu!standard player by that name.</p>
        )}
        {state.status === "error" && (
          <p className="mt-6 text-sm text-red-400">Lookup failed, try again in a minute.</p>
        )}

        {state.status === "ready" && <Report data={state.data} />}
      </main>
    </>
  );
}

function ModPicker({ plays }: { plays: PlayHighlight[] }) {
  const [sel, setSel] = useState<string[]>([]);

  function toggle(mod: string) {
    setSel((cur) => {
      if (mod === "NM") return cur.includes("NM") ? [] : ["NM"];
      const without = cur.filter((m) => m !== "NM");
      return without.includes(mod) ? without.filter((m) => m !== mod) : [...without, mod];
    });
  }

  const matches = useMemo(() => {
    if (sel.length === 0) return plays;
    if (sel.includes("NM")) return plays.filter((p) => p.combo === "");
    const exact = [...sel].sort().join("");
    return plays.filter((p) => p.combo === exact);
  }, [plays, sel]);

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <Title>Biggest play with any mods</Title>
      <p className="mt-1 text-[11px] text-white/35">
        toggle mods to filter their top 100, only plays with exactly that combo count
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {PICKER_MODS.map((m) => (
          <button
            key={m}
            onClick={() => toggle(m)}
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
              sel.includes(m)
                ? "bg-pink text-white"
                : "bg-black/20 text-white/60 hover:bg-black/40 hover:text-white"
            }`}
          >
            {m}
          </button>
        ))}
        {sel.length > 0 && (
          <button
            onClick={() => setSel([])}
            className="rounded-md px-3 py-1.5 text-xs text-white/40 transition hover:text-white"
          >
            clear
          </button>
        )}
      </div>
      <div className="mt-3">
        {matches.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/40">
            no play in their top 100 uses exactly {sel.join(" + ")}
          </p>
        ) : (
          <>
            <p className="mb-2 text-[11px] text-white/35">
              {matches.length} of {plays.length} plays match
            </p>
            <ScrollBox maxH="max-h-80">
              {matches.slice(0, 30).map((p, i) => (
                <PlayRow key={p.beatmapId} play={p} tag={`#${i + 1}`} />
              ))}
            </ScrollBox>
          </>
        )}
      </div>
    </section>
  );
}

function Report({ data }: { data: PlayerReport }) {
  const u = data.user;
  const n = data.novelty;
  const maxBand = Math.max(...data.ppBands.map((b) => b.count), 1);
  return (
    <div className="mt-6 space-y-4">
      <section className="flex items-center gap-4 rounded-xl border border-line bg-surface p-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={u.avatarUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <a
            href={`https://osu.ppy.sh/users/${u.id}`}
            target="_blank"
            rel="noreferrer"
            className="font-display text-2xl font-bold text-white hover:text-pink"
          >
            {u.username}
          </a>
          <p className="text-sm text-white/50">
            {flagEmoji(u.countryCode)} {u.countryName} · joined {formatJoinDate(u.joinDate)}
            {u.supporter && <span className="ml-1 text-pink">♥</span>}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-2xl font-bold text-pink">{formatNumber(u.pp)}pp</div>
          <div className="text-sm text-white/50">
            {u.globalRank ? `#${formatNumber(u.globalRank)}` : "unranked"}
            {u.countryRank ? ` · ${u.countryCode} #${formatNumber(u.countryRank)}` : ""}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Accuracy" value={`${u.accuracy.toFixed(2)}%`} />
        <Stat label="Playtime" value={formatPlaytime(u.playTimeSec)} sub={`${formatNumber(u.playCount)} plays`} />
        <Stat
          label="pp / hour"
          value={data.efficiency.ppPerHour ? `${data.efficiency.ppPerHour}` : "n/a"}
          sub="raw pp per hour played"
        />
        <Stat label="Level" value={`${u.level}`} sub={`${data.efficiency.playsPerDay}/day since join`} />
      </section>

      <ModPicker plays={data.plays} />

      <section className="rounded-xl border border-line bg-surface p-5">
        <Title>PP profile</Title>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Top play" value={`${data.ppStats.top}pp`} />
          <Stat label="Median (top 100)" value={`${data.ppStats.median}pp`} />
          <Stat label="#100 floor" value={data.ppStats.floor ? `${data.ppStats.floor}pp` : "n/a"} />
        </div>
        <div className="mt-4 flex h-20 items-end gap-1.5">
          {data.ppBands.map((b, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-pink"
              style={{ height: `${Math.max((b.count / maxBand) * 100, 4)}%` }}
              title={`${b.from}-${b.to}pp · ${b.count} plays`}
            />
          ))}
        </div>
        <div className="mt-1 flex gap-1.5 text-[10px] text-white/35">
          {data.ppBands.map((b, i) => (
            <span key={i} className="flex-1 text-center">
              {b.from}
            </span>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-white/35">
          top-100 plays bucketed by pp. A tall left side means the profile leans on a few big scores.
        </p>
      </section>

      {data.milestones.length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-5">
          <Title>PP milestones</Title>
          <p className="mt-1 text-[11px] text-white/35">
            first play still standing worth each step
          </p>
          <div className="mt-3 space-y-1.5">
            {data.milestones.map((m) => (
              <div key={m.pp} className="flex items-center gap-3 text-sm">
                <span className="w-16 shrink-0 text-right font-display font-bold text-pink">
                  {m.pp}pp
                </span>
                <span className="min-w-0 flex-1 truncate text-white/70">{m.title}</span>
                <span className="shrink-0 text-[11px] text-white/40">{m.ageDays}d ago</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface p-5">
        <Title>Trivia</Title>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {n.fossil && (
            <PlayRow play={n.fossil} tag={`fossil · ${Math.floor(n.fossil.ageDays / 365) || "<1"}y`} />
          )}
          {n.scrappiest && <PlayRow play={n.scrappiest} tag={`scrappiest · ${n.scrappiest.acc}%`} />}
          {n.longest && (
            <PlayRow play={n.longest} tag={`marathon · ${formatDuration(n.longest.lengthSec)}`} />
          )}
          {data.top && <PlayRow play={data.top} tag="magnum opus" />}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Chokes in bests"
            value={`${n.chokes.plays}`}
            sub={n.chokes.plays ? `${n.chokes.misses} total misses` : "all clean"}
          />
          <Stat label="Comfort zone" value={`${n.comfort.lo}–${n.comfort.hi}★`} sub="middle 50% of bests" />
          <Stat
            label="Favorite artist"
            value={n.favoriteArtists[0]?.artist ?? "varied"}
            sub={n.favoriteArtists[0] ? `${n.favoriteArtists[0].count} of their bests` : "no repeats"}
          />
          <Stat
            label="Recent form"
            value={`${data.recency.last90}/100`}
            sub="bests set in last 90d"
          />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <Title>Biggest plays by combo</Title>
        <div className="mt-3">
          <ScrollBox maxH="max-h-80">
            {data.comboBests.map((c) => (
              <PlayRow
                key={c.combo}
                play={c.play}
                tag={`${c.combo === "" ? "NM" : c.combo} ·${c.count}`}
              />
            ))}
          </ScrollBox>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-5">
          <Title>Consistency</Title>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Avg accuracy" value={`${data.consistency.accAvg}%`} sub={`±${data.consistency.accStdev}`} />
            <Stat label="No-miss rate" value={`${Math.round(data.consistency.noMissRate * 100)}%`} sub={`avg ${data.consistency.avgMisses} miss`} />
          </div>
          <div className="mt-4">
            <Title>Recent form</Title>
            <p className="mt-2 text-sm text-white/70">
              {data.recency.last90} of the top 100 were set in the last 90 days. Newest is{" "}
              {data.recency.newestDays}d old, oldest {data.recency.oldestDays}d.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <Title>Map diet (top 100 median, modded)</Title>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Star rating" value={`${data.spread.srMedian}★`} />
            <Stat label="BPM (effective)" value={`${data.spread.bpmMedian}`} />
            <Stat label="Approach rate" value={`${data.spread.arMedian}`} />
            <Stat label="Length" value={formatDuration(data.spread.lengthMedianSec)} />
          </div>
          {data.modUsage.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {data.modUsage.map((m) => (
                <span key={m.mod} className="rounded bg-pink/15 px-2 py-1 text-xs font-semibold text-pink">
                  {m.mod} {m.pct}%
                </span>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
