"use client";

import { useState } from "react";
import { Nav } from "@/app/components/Nav";
import { formatNumber, formatPlaytime, flagEmoji } from "@/lib/format";
import type { CountryReport, CountryPlayer, CountryPlay } from "@/lib/informatics/country";

const QUICK: Record<string, string> = {
  US: "United States", JP: "Japan", KR: "South Korea", CN: "China", DE: "Germany",
  FR: "France", PL: "Poland", RU: "Russia", GB: "United Kingdom", CA: "Canada",
  BR: "Brazil", AU: "Australia", PH: "Philippines", ID: "Indonesia", TW: "Taiwan", PK: "Pakistan",
};

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: CountryReport };

function Title({ children }: { children: string }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wide text-white/40">{children}</h2>;
}

function PlayerLine({ p, metric }: { p: CountryPlayer; metric: string }) {
  return (
    <a
      href={`https://osu.ppy.sh/users/${p.id}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-lg bg-black/20 px-3 py-2 transition hover:bg-black/40"
    >
      <span className="w-6 shrink-0 text-center text-sm font-bold text-white/40">#{p.countryRank}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{p.username}</span>
      <span className="shrink-0 text-right font-display text-sm font-bold text-pink">{metric}</span>
    </a>
  );
}

function PlayLine({ play, tag }: { play: CountryPlay; tag?: string }) {
  return (
    <a
      href={`https://osu.ppy.sh/b/${play.beatmapId}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-lg bg-black/20 px-3 py-2 transition hover:bg-black/40"
    >
      {tag && (
        <span className="shrink-0 rounded bg-pink/15 px-1.5 py-0.5 text-[11px] font-bold text-pink">{tag}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{play.title}</p>
        <p className="truncate text-[11px] text-white/45">
          {play.player.username} · {play.mods === "NM" ? "nomod" : `+${play.mods}`} · {play.stars}★ · {play.acc}%
        </p>
      </div>
      <span className="shrink-0 text-right font-display font-bold text-pink">{play.pp}pp</span>
    </a>
  );
}

export default function CountryPage() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  async function load(c: string) {
    const cc = c.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) return;
    setCode(cc);
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/country?code=${cc}`);
      if (!res.ok) return setState({ status: "error" });
      setState({ status: "ready", data: await res.json() });
    } catch {
      setState({ status: "error" });
    }
  }

  return (
    <>
      <Nav active="/country" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-white">Country informatics</h1>
        <p className="mt-1 text-sm text-white/50">
          Pick a country to see its top players, hidden prodigies (most pp per hour played),
          biggest plays and the best score set under each mod.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(code);
          }}
          className="mt-5 flex gap-2"
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 2))}
            placeholder="2-letter code (US, JP…)"
            suppressHydrationWarning
            className="w-48 rounded-lg border border-line bg-black/30 px-4 py-2.5 uppercase text-white outline-none placeholder:text-white/30 focus:border-pink/50"
          />
          <button
            type="submit"
            disabled={state.status === "loading"}
            className="rounded-lg bg-pink px-5 py-2.5 font-display font-bold text-white transition hover:bg-pink-dark disabled:opacity-40"
          >
            {state.status === "loading" ? "Loading…" : "Go"}
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(QUICK).map(([c, name]) => (
            <button
              key={c}
              onClick={() => load(c)}
              className="rounded-full bg-black/20 px-3 py-1 text-xs text-white/60 transition hover:bg-black/40 hover:text-white"
            >
              {flagEmoji(c)} {name}
            </button>
          ))}
        </div>

        {state.status === "error" && (
          <p className="mt-6 text-sm text-red-400">Couldn&apos;t load that country, try again in a minute.</p>
        )}
        {state.status === "loading" && (
          <p className="mt-6 text-sm text-white/40">Aggregating top players…</p>
        )}
        {state.status === "ready" && <Report data={state.data} />}
      </main>
    </>
  );
}

function Report({ data }: { data: CountryReport }) {
  return (
    <div className="mt-6 space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-5">
        <div>
          <div className="font-display text-2xl font-bold text-white">
            {flagEmoji(data.code)} {QUICK[data.code] ?? data.code}
          </div>
          <p className="text-sm text-white/50">top {data.leaders.length} shown · {data.sampled} players deep-scanned</p>
        </div>
        <div className="flex gap-2 text-right">
          <div className="rounded-lg bg-black/20 px-3 py-2">
            <div className="text-[11px] uppercase text-white/40">Top-50 pp</div>
            <div className="font-display font-bold text-pink">{formatNumber(data.aggregate.topPpSum)}</div>
          </div>
          <div className="rounded-lg bg-black/20 px-3 py-2">
            <div className="text-[11px] uppercase text-white/40">Avg acc</div>
            <div className="font-display font-bold text-white">{data.aggregate.avgAcc}%</div>
          </div>
          <div className="rounded-lg bg-black/20 px-3 py-2">
            <div className="text-[11px] uppercase text-white/40">Total playtime</div>
            <div className="font-display font-bold text-white">{formatPlaytime(data.aggregate.totalPlaytimeSec)}</div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <Title>Prodigies, most pp per hour played</Title>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {data.prodigies.map((p) => (
            <PlayerLine key={p.id} p={p} metric={`${p.ppPerHour}/h`} />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-white/35">
          Raw pp divided by hours played. High means a lot of rank for little grind.
        </p>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <Title>Biggest plays</Title>
        <div className="mt-3 space-y-2">
          {data.bigPlays.map((play, i) => (
            <PlayLine key={i} play={play} tag={`#${i + 1}`} />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <Title>Best score per mod</Title>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {data.modLeaders.map((m) => (
            <PlayLine key={m.mod} play={m.play} tag={m.mod} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-5">
          <Title>Grinders, most play count</Title>
          <div className="mt-3 space-y-2">
            {data.grinders.map((p) => (
              <PlayerLine key={p.id} p={p} metric={formatNumber(p.playCount)} />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <Title>Sharpest accuracy</Title>
          <div className="mt-3 space-y-2">
            {data.accLeaders.map((p) => (
              <PlayerLine key={p.id} p={p} metric={`${p.accuracy}%`} />
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <Title>{`Top ${data.leaders.length} by pp`}</Title>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {data.leaders.map((p) => (
            <PlayerLine key={p.id} p={p} metric={`${formatNumber(p.pp)}pp`} />
          ))}
        </div>
      </section>
    </div>
  );
}
