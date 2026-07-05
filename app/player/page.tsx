"use client";

import { useState, type FormEvent } from "react";
import { Nav } from "@/app/components/Nav";
import { formatNumber, formatPlaytime, formatJoinDate, flagEmoji } from "@/lib/format";
import type { PlayerReport, PlayHighlight } from "@/lib/informatics/player";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "notfound" }
  | { status: "error" }
  | { status: "ready"; data: PlayerReport };

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

  async function search(e?: FormEvent) {
    e?.preventDefault();
    const u = name.trim();
    if (!u) return;
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/player?u=${encodeURIComponent(u)}`);
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
          Type any osu! username to break down their top 100: best play per mod, pp profile,
          farming efficiency and consistency.
        </p>

        <form onSubmit={search} className="mt-5 flex gap-2">
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
            {state.status === "loading" ? "Looking…" : "Look up"}
          </button>
        </form>

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

function Report({ data }: { data: PlayerReport }) {
  const u = data.user;
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

      <section className="rounded-xl border border-line bg-surface p-5">
        <Title>Best play by mod</Title>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {data.modBests.map(
            (m) =>
              m.play && (
                <PlayRow key={m.mod} play={m.play} tag={`${m.mod} ·${m.count}`} />
              ),
          )}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <Title>Biggest plays by combo</Title>
        <div className="mt-3 space-y-2">
          {data.comboBests.map((c) => (
            <PlayRow key={c.combo} play={c.play} tag={`${c.combo === "" ? "NM" : c.combo} ·${c.count}`} />
          ))}
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
          <Title>Map diet (top 100 median)</Title>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Star rating" value={`${data.spread.srMedian}★`} />
            <Stat label="BPM (effective)" value={`${data.spread.bpmMedian}`} />
            <Stat label="Approach rate" value={`${data.spread.arMedian}`} />
            <Stat label="Length" value={`${Math.floor(data.spread.lengthMedianSec / 60)}:${String(data.spread.lengthMedianSec % 60).padStart(2, "0")}`} />
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
