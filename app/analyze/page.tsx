"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { Nav } from "@/app/components/Nav";
import { parseReplay } from "@/lib/replay/parseClient";
import { recordFrom, saveReplay } from "@/lib/history";
import type { ParsedSummary, ViewerFrame, ViewerObject } from "@/lib/replay/types";
import type { Section } from "@/lib/replay/reconstruct";
import { formatDuration, formatNumber } from "@/lib/format";
import { HitErrorChart } from "@/app/components/HitErrorChart";
import { ReplayViewer, type ViewerHandle } from "@/app/components/ReplayViewer";

// round to 1 dp, dropping a trailing .0 (e.g. 8.800001 -> "8.8", 4 -> "4")
function r1(n: number): string {
  const v = Math.round(n * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-2 last:border-0">
      <span className="text-sm text-white/50">{label}</span>
      <span className="font-display text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

function Big({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg bg-black/20 px-3 py-2.5">
      <div className="truncate text-[11px] uppercase tracking-wide text-white/40">{label}</div>
      <div className={`font-display text-xl font-bold ${accent ? "text-pink" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/40">
      <span className="h-3.5 w-[3px] rounded-full bg-pink" aria-hidden />
      {children}
    </h2>
  );
}

function CoachCol({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "good" | "bad" | "pink";
}) {
  const dot = tone === "good" ? "text-[#8be04a]" : tone === "bad" ? "text-red-400" : "text-pink";
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-white/40">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-white/30">nothing here</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((t, i) => (
            <li key={i} className="flex gap-2 text-sm text-white/75">
              <span className={dot}>•</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// only speaks up when the map is a genuine outlier for this account; a typical
// map for them doesn't need a callout, that's just a normal Tuesday
function MapFitNote({ stars, ctx }: { stars: number; ctx: ReplayContext }) {
  if (!ctx.comfort) return null;
  const fit = mapFit(stars, ctx.comfort);
  if (fit === "typical") return null;
  const { lo, hi } = ctx.comfort;
  return (
    <p className="mt-3 flex gap-2 border-t border-line pt-3 text-sm text-white/75">
      <span className="text-pink">›</span>
      <span>
        {ctx.username} is a {ctx.rankTier} player who usually plays {lo}–{hi}★. This{" "}
        {stars.toFixed(2)}★ map is{" "}
        {fit === "reach" ? "well above that range, a reach." : "well below that range, a curveball or warmup."}
      </span>
    </p>
  );
}

function FilePill({
  kind,
  label,
  emptyLabel = "none",
}: {
  kind: string;
  label: string | null;
  emptyLabel?: string;
}) {
  return (
    <span
      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
        label ? "bg-pink/15 text-pink" : "bg-black/20 text-white/40"
      }`}
    >
      {kind}: {label ?? emptyLabel}
    </span>
  );
}

// who's playing, relative to the map: a 5-digit FCing something they usually
// can't and a 6-digit reaching for a map above their level need very different framing
type ReplayContext = {
  username: string;
  globalRank: number | null;
  rankTier: string;
  pp: number;
  comfort: { lo: number; hi: number } | null;
};

type MapFit = "reach" | "curveball" | "typical";

function mapFit(stars: number, comfort: { lo: number; hi: number }): MapFit {
  if (stars > comfort.hi + 0.5) return "reach";
  if (stars < comfort.lo - 0.5) return "curveball";
  return "typical";
}

// compact measured facts for the optional AI coach
function coachFacts(
  s: ParsedSummary,
  pp: { pp: number; ppFc: number; stars: number } | null,
  ctx: ReplayContext | null,
) {
  const m = s.mechanics;
  const b = s.beatmap;
  const rate = s.viewer.rate || 1;
  const fit = pp && ctx?.comfort ? mapFit(pp.stars, ctx.comfort) : null;
  return {
    map: `${b.artist} - ${b.title} [${b.version}]`,
    mods: s.replay.mods,
    player: ctx
      ? {
          rankTier: ctx.rankTier, // e.g. "5-digit", "6-digit", "top 1,000"
          globalRank: ctx.globalRank,
          pp: ctx.pp,
          usualStarRange: ctx.comfort ? [ctx.comfort.lo, ctx.comfort.hi] : undefined,
          thisMapVsUsualRange:
            fit === "reach"
              ? "this map is well above what they normally play, a reach"
              : fit === "curveball"
                ? "this map is well below what they normally play, a curveball or warmup"
                : fit
                  ? "this map is within their normal range"
                  : undefined,
        }
      : undefined,
    clockRate: rate, // DT/NC 1.5, HT 0.75; every value below is already mod-adjusted
    starRatingModAdjusted: pp ? +pp.stars.toFixed(2) : undefined,
    ppEarned: pp ? Math.round(pp.pp) : undefined,
    ppIfFc: pp ? Math.round(pp.ppFc) : undefined,
    mapDifficultyModAdjusted: { cs: +b.cs.toFixed(1), ar: +b.ar.toFixed(1), od: +b.od.toFixed(1) },
    lengthSecRealTime: Math.round(b.lengthMs / rate / 1000),
    accuracy: +s.replay.accuracy.toFixed(2),
    counts: { c300: m.count300, c100: m.count100, c50: m.count50, miss: m.countMiss },
    ur: Math.round(m.ur),
    meanErrorMs: +m.meanError.toFixed(1),
    earlyPct: Math.round(m.earlyRate * 100),
    aim: {
      avgOffsetPctOfRadius: Math.round(m.aim.avgOffset * 100),
      edgeHitPct: Math.round(m.aim.edgeHitRate * 100),
      undershootPct: Math.round(m.aim.undershootRate * 100),
      overshootPct: Math.round(m.aim.overshootRate * 100),
      jumpsSampled: m.aim.jumpsSampled,
    },
    sliderBreaks: m.sliderBreaks,
    missTimestampsSec: m.missTimes.slice(0, 8).map((t) => Math.round(t / 1000)),
    patterns: m.patterns.map((p) => ({ name: p.name, ur: Math.round(p.ur), notes: p.count })),
    sectionUr: m.sections.map((x) => Math.round(x.ur)),
    keys: m.keys
      ? {
          tapStyle: m.keys.style,
          k1Pct: m.keys.k1Pct,
          altRate: m.keys.altRate,
          startsAlternatingAtBpm: m.keys.altBpm,
          keyHoldMsMedian: m.keys.holdMsMedian,
        }
      : undefined,
    cursor: m.cursor
      ? {
          aimStyle: m.cursor.style,
          pathVsDirectRatio: m.cursor.straightness,
          missesLeftHalf: m.cursor.missLeft,
          missesRightHalf: m.cursor.missRight,
        }
      : undefined,
    // what the deterministic panel already told them; the model should build past this
    alreadyFlagged: {
      strengths: m.coaching.strengths,
      weakPoints: m.coaching.weaknesses,
      practice: m.coaching.practice,
    },
  };
}

// UR bars with the map's strain curve behind them, plus the verdict that matters:
// do you drop the hard parts (skill wall) or the easy parts (focus leak)?
function SectionsChart({ sections, strains }: { sections: Section[]; strains?: number[] }) {
  const max = Math.max(...sections.map((x) => x.ur), 1);
  const aligned = strains && strains.length === sections.length ? strains : null;

  let verdict: string | null = null;
  if (aligned && sections.length >= 4) {
    let worst = 0;
    for (let i = 1; i < sections.length; i++) if (sections[i].ur > sections[worst].ur) worst = i;
    const st = aligned[worst];
    verdict =
      st >= 70
        ? "Your shakiest stretch lines up with the map's difficulty peak. That's a skill wall, grind slightly harder maps and it moves."
        : st <= 40
          ? "Your shakiest stretch is not where the map peaks. You're dropping the easy parts, that's focus slipping, not skill missing."
          : "Your shakiest stretch sits at medium difficulty, part ceiling, part concentration.";
  }

  return (
    <>
      <div className="mt-4 flex h-24 items-end gap-1">
        {sections.map((s, i) => (
          <div key={i} className="relative h-full flex-1">
            {aligned && (
              <div
                className="absolute bottom-0 w-full rounded-t bg-white/10"
                style={{ height: `${Math.max(aligned[i], 2)}%` }}
              />
            )}
            <div
              className={`absolute bottom-0 w-full rounded-t ${s.misses > 0 ? "bg-red-400" : "bg-pink"}`}
              style={{ height: `${Math.max((s.ur / max) * 100, 3)}%` }}
              title={`${Math.round(s.fromMs / 1000)}s · UR ${s.ur.toFixed(0)}${s.misses ? ` · ${s.misses} miss` : ""}${aligned ? ` · strain ${aligned[i]}` : ""}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-white/35">
        <span>start</span>
        <span>
          UR per section · red = misses
          {aligned ? " · grey = map difficulty" : ""}
        </span>
        <span>end</span>
      </div>
      {verdict && (
        <p className="mt-3 flex gap-2 text-sm text-white/75">
          <span className="text-pink">›</span>
          <span>{verdict}</span>
        </p>
      )}
    </>
  );
}

// misses and 100s on the playfield, so side bias is visible at a glance
function MissMap({ objects }: { objects: ViewerObject[] }) {
  const misses = objects.filter((o) => o.j === 3);
  const oks = objects.filter((o) => o.j === 1 || o.j === 2);
  if (misses.length + oks.length === 0) return null;
  return (
    <div className="mt-4">
      <svg viewBox="-8 -8 528 400" className="w-full max-w-md rounded-lg bg-black/30">
        <rect x="0" y="0" width="512" height="384" fill="none" stroke="rgba(255,255,255,0.08)" />
        <line x1="256" y1="0" x2="256" y2="384" stroke="rgba(255,255,255,0.05)" />
        {oks.map((o, i) => (
          <circle key={`o${i}`} cx={o.x} cy={o.y} r="5" fill="rgba(251,191,36,0.35)" />
        ))}
        {misses.map((o, i) => (
          <circle key={`m${i}`} cx={o.x} cy={o.y} r="7" fill="rgba(248,113,113,0.85)" />
        ))}
      </svg>
      <p className="mt-2 text-[11px] text-white/35">
        where it went wrong on the playfield · red = miss, amber = 100/50
      </p>
    </div>
  );
}

// wrap-aware canvas text
function wrapText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(" ");
  let line = "";
  for (const w of words) {
    if (g.measureText(line + w).width > maxW && line) {
      g.fillText(line.trimEnd(), x, y);
      y += lh;
      line = "";
    }
    line += w + " ";
  }
  g.fillText(line.trimEnd(), x, y);
  return y;
}

function downloadCard(s: ParsedSummary, pp: { pp: number; stars: number } | null) {
  const m = s.mechanics;
  const c = document.createElement("canvas");
  c.width = 900;
  c.height = 480;
  const g = c.getContext("2d");
  if (!g) return;

  g.fillStyle = "#231b20";
  g.fillRect(0, 0, 900, 480);
  g.strokeStyle = "rgba(255,102,171,0.4)";
  g.lineWidth = 2;
  g.strokeRect(1, 1, 898, 478);

  g.fillStyle = "#ffffff";
  g.font = "bold 26px system-ui, sans-serif";
  g.fillText("re", 40, 58);
  g.fillStyle = "#ff66ab";
  g.fillText("trace", 40 + g.measureText("re").width, 58);
  g.fillStyle = "rgba(255,255,255,0.4)";
  g.font = "14px system-ui, sans-serif";
  g.fillText("replay autopsy", 40, 80);

  g.fillStyle = "#ffffff";
  g.font = "bold 30px system-ui, sans-serif";
  wrapText(g, `${s.beatmap.artist} – ${s.beatmap.title}`, 40, 140, 820, 38);
  g.fillStyle = "#ff66ab";
  g.font = "600 18px system-ui, sans-serif";
  const mods = ["None", "NM", ""].includes(s.replay.mods) ? "nomod" : `+${s.replay.mods}`;
  g.fillText(`[${s.beatmap.version}] · ${mods} · ${s.replay.player}`, 40, 172);

  const stats: [string, string][] = [
    ["ACCURACY", `${s.replay.accuracy.toFixed(2)}%`],
    ["UR", m.ur.toFixed(0)],
    ["300/100/50/X", `${m.count300}/${m.count100}/${m.count50}/${m.countMiss}`],
    ["PP", pp ? `${Math.round(pp.pp)} (${pp.stars.toFixed(2)}★)` : "n/a"],
  ];
  stats.forEach(([label, value], i) => {
    const x = 40 + i * 210;
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.fillRect(x, 210, 190, 80);
    g.fillStyle = "rgba(255,255,255,0.4)";
    g.font = "11px system-ui, sans-serif";
    g.fillText(label, x + 14, 234);
    g.fillStyle = "#ffffff";
    g.font = "bold 24px system-ui, sans-serif";
    g.fillText(value, x + 14, 268);
  });

  const verdict =
    m.coaching.weaknesses[0] ?? m.insights[0] ?? "Clean run, nothing to flag.";
  g.fillStyle = "rgba(255,255,255,0.45)";
  g.font = "11px system-ui, sans-serif";
  g.fillText("THE VERDICT", 40, 330);
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.font = "18px system-ui, sans-serif";
  wrapText(g, verdict, 40, 356, 820, 26);

  g.fillStyle = "rgba(255,255,255,0.3)";
  g.font = "13px system-ui, sans-serif";
  g.fillText("analyzed in the browser · retrace", 40, 448);

  const a = document.createElement("a");
  a.download = `retrace-${s.beatmap.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
  a.href = c.toDataURL("image/png");
  a.click();
}

export default function AnalyzePage() {
  const [osu, setOsu] = useState<File | null>(null);
  const [osrs, setOsrs] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [saved, setSaved] = useState<{ ok: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ParsedSummary | null>(null);
  const [aiReview, setAiReview] = useState<string | null>(null);
  const [pp, setPp] = useState<{
    pp: number;
    ppFc: number;
    stars: number;
    strains?: number[];
  } | null>(null);
  const [ghost, setGhost] = useState<{
    frames: ViewerFrame[];
    player: string;
    acc: number;
    ur: number;
  } | null>(null);
  const [ghostErr, setGhostErr] = useState<string | null>(null);
  const [context, setContext] = useState<ReplayContext | null>(null);
  const viewerRef = useRef<ViewerHandle>(null);

  async function loadGhost(e: ChangeEvent<HTMLInputElement>, base: ParsedSummary) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setGhostErr(null);
    try {
      const g = await parseReplay(await f.arrayBuffer(), base.osuText);
      if (g.replay.beatmapMD5 !== base.replay.beatmapMD5) {
        setGhostErr("that replay is on a different map");
        return;
      }
      setGhost({
        frames: g.viewer.frames,
        player: g.replay.player,
        acc: Math.round(g.replay.accuracy * 100) / 100,
        ur: Math.round(g.mechanics.ur),
      });
    } catch {
      setGhostErr("couldn't parse that replay");
    }
  }

  function take(files: FileList | File[]) {
    const replays: File[] = [];
    for (const f of Array.from(files)) {
      if (f.name.toLowerCase().endsWith(".osr")) replays.push(f);
      else if (f.name.toLowerCase().endsWith(".osu")) setOsu(f);
    }
    // a new drop replaces the queue; drop several .osr at once to bulk import
    if (replays.length) setOsrs(replays);
  }

  async function run() {
    if (osrs.length === 0) return;
    setBusy(true);
    setError(null);
    setSummary(null);
    setAiReview(null);
    setPp(null);
    setSaved(null);
    setGhost(null);
    setGhostErr(null);
    setContext(null);
    const total = osrs.length;
    let savedOk = 0;
    let last: ParsedSummary | null = null;
    let lastError: unknown = null;
    try {
      // a supplied .osu only makes sense for a single replay
      const osuText = osu && total === 1 ? await osu.text() : undefined;
      for (let i = 0; i < total; i++) {
        if (total > 1) setProgress({ done: i, total });
        try {
          const parsed = await parseReplay(await osrs[i].arrayBuffer(), osuText);
          last = parsed;
          try {
            await saveReplay(recordFrom(parsed));
            savedOk++;
          } catch {
            // history is best-effort; the analysis itself still shows
          }
        } catch (e) {
          lastError = e;
        }
      }
      if (!last) throw lastError ?? new Error("No replay could be parsed.");
      setSummary(last);
      setSaved({ ok: savedOk, total });
      const parsed = last;
      // exact pp first (fast, local rosu), then the coach with modded stars in hand
      const ppPromise = fetch("/api/pp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          osuText: parsed.osuText,
          mods: ["None", "NM", ""].includes(parsed.replay.mods) ? 0 : parsed.replay.mods,
          n300: parsed.replay.counts.great,
          n100: parsed.replay.counts.ok,
          n50: parsed.replay.counts.meh,
          misses: parsed.replay.counts.miss,
          combo: parsed.replay.maxCombo,
          strainSections: parsed.mechanics.sections.length || undefined,
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      ppPromise.then((j) => j?.pp != null && setPp(j));
      // who's actually playing this map, so the coach can tell a reach from a curveball
      const contextPromise = fetch(`/api/replay-context?u=${encodeURIComponent(parsed.replay.player)}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      contextPromise.then((c) => c && setContext(c));
      // optional AI review; deterministic coaching already covers the fallback
      Promise.all([ppPromise, contextPromise]).then(([ppRes, ctxRes]) =>
        fetch("/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(coachFacts(parsed, ppRes?.pp != null ? ppRes : null, ctxRes)),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => j?.review && setAiReview(j.review))
          .catch(() => {}),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <>
      <Nav active="/analyze" />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-white">Replay analysis</h1>
        <p className="mt-1 text-sm text-white/50">
          Drop a replay (.osr) and the beatmap is fetched automatically from its ID. Parsing
          runs entirely in your browser.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            take(e.dataTransfer.files);
          }}
          className={`mt-6 rounded-2xl border-2 border-dashed p-10 text-center transition ${
            drag ? "border-pink bg-pink/5" : "border-line bg-surface"
          }`}
        >
          <p className="text-white/70">
            Drag &amp; drop your .osr here, several at once for bulk import
            <span className="text-white/40"> (.osu optional, auto-fetched)</span>
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-3 text-sm">
            <label className="cursor-pointer rounded-lg bg-black/30 px-3 py-1.5 text-white/70 hover:text-white">
              Choose .osu
              <input
                type="file"
                accept=".osu"
                className="hidden"
                suppressHydrationWarning
                onChange={(e) => e.target.files && take(e.target.files)}
              />
            </label>
            <label className="cursor-pointer rounded-lg bg-black/30 px-3 py-1.5 text-white/70 hover:text-white">
              Choose .osr
              <input
                type="file"
                accept=".osr"
                multiple
                className="hidden"
                suppressHydrationWarning
                onChange={(e) => e.target.files && take(e.target.files)}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <FilePill
              kind=".osr"
              label={osrs.length === 0 ? null : osrs.length === 1 ? osrs[0].name : `${osrs.length} replays`}
            />
            <FilePill kind=".osu" label={osu?.name ?? null} emptyLabel="auto-fetch" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={run}
            disabled={osrs.length === 0 || busy}
            className="rounded-lg bg-pink px-5 py-2.5 font-display font-bold text-white transition hover:bg-pink-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy
              ? progress
                ? `Parsing ${progress.done + 1}/${progress.total}…`
                : "Parsing…"
              : osrs.length > 1
                ? `Analyze ${osrs.length} replays`
                : "Analyze"}
          </button>
          {error && <span className="text-sm text-red-400">{error}</span>}
          {saved && saved.ok > 0 && !busy && (
            <span className="text-sm text-white/50">
              {saved.total > 1 ? `${saved.ok}/${saved.total} saved to ` : "saved to "}
              <Link href="/history" className="text-pink hover:underline">
                history
              </Link>
            </span>
          )}
          {summary && !busy && (
            <button
              onClick={() => downloadCard(summary, pp)}
              className="rounded-lg border border-line bg-black/20 px-3 py-2 text-sm text-white/70 transition hover:border-pink/40 hover:text-white"
            >
              Share card ↓
            </button>
          )}
        </div>

        {summary && (
          <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <section className="rounded-xl border border-line bg-surface p-6">
              <SectionTitle>Beatmap</SectionTitle>
              <p className="mt-1 font-display text-lg font-bold text-white">
                {summary.beatmap.artist} – {summary.beatmap.title}
              </p>
              <p className="text-sm text-pink">[{summary.beatmap.version}]</p>
              <div className="mt-4">
                <Row label="Mapper" value={summary.beatmap.creator} />
                <Row label="Mode" value={summary.beatmap.mode === 0 ? "osu!" : `mode ${summary.beatmap.mode}`} />
                <Row
                  label="CS / AR / OD / HP"
                  value={`${r1(summary.beatmap.cs)} / ${r1(summary.beatmap.ar)} / ${r1(summary.beatmap.od)} / ${r1(summary.beatmap.hp)}`}
                />
                <Row label="Length" value={formatDuration(summary.beatmap.lengthMs / 1000)} />
                <Row
                  label="Objects"
                  value={`${summary.beatmap.hitObjects} (${summary.beatmap.circles}c / ${summary.beatmap.sliders}s / ${summary.beatmap.spinners}sp)`}
                />
              </div>
            </section>

            <section className="rounded-xl border border-line bg-surface p-6">
              <SectionTitle>Replay</SectionTitle>
              <p className="mt-1 font-display text-lg font-bold text-white">{summary.replay.player}</p>
              <p className="text-sm text-pink">
                {["None", "NM", ""].includes(summary.replay.mods)
                  ? "nomod"
                  : `+${summary.replay.mods}`}
                {pp && (
                  <span className="ml-2 rounded bg-pink/15 px-1.5 py-0.5 text-[11px] font-semibold">
                    {Math.round(pp.pp)}pp · {pp.stars.toFixed(2)}★
                    {pp.ppFc - pp.pp > 5 && ` · FC ≈ ${Math.round(pp.ppFc)}pp`}
                  </span>
                )}
                {context && (
                  <span className="ml-2 rounded bg-black/25 px-1.5 py-0.5 text-[11px] font-semibold text-white/50">
                    {context.rankTier}
                    {context.globalRank ? ` · #${formatNumber(context.globalRank)}` : ""}
                  </span>
                )}
              </p>
              <div className="mt-4">
                <Row label="Accuracy" value={`${summary.replay.accuracy.toFixed(2)}%`} />
                <Row label="Max combo" value={`${formatNumber(summary.replay.maxCombo)}x`} />
                <Row label="Score" value={formatNumber(summary.replay.totalScore)} />
                <Row
                  label="300 / 100 / 50 / X"
                  value={`${summary.replay.counts.great} / ${summary.replay.counts.ok} / ${summary.replay.counts.meh} / ${summary.replay.counts.miss}`}
                />
                <Row label="Cursor frames" value={formatNumber(summary.replay.frameCount)} />
                <Row label="Beatmap MD5" value={summary.replay.beatmapMD5.slice(0, 12) + "…"} />
              </div>
              {pp && context?.comfort && (
                <MapFitNote stars={pp.stars} ctx={context} />
              )}
            </section>
          </div>

          {summary.viewer.frames.length > 0 && (
            <section className="mt-4 rounded-xl border border-line bg-surface p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionTitle>watch it back</SectionTitle>
                <div className="flex items-center gap-2 text-xs">
                  {ghost ? (
                    <>
                      <span className="text-[#8be04a]">
                        ghost: {ghost.player} · {ghost.acc}% · UR {ghost.ur}
                      </span>
                      <button
                        onClick={() => setGhost(null)}
                        className="rounded px-1.5 py-0.5 text-white/40 transition hover:bg-black/30 hover:text-white"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <label className="cursor-pointer rounded-md bg-black/20 px-2.5 py-1 text-white/60 transition hover:bg-black/40 hover:text-white">
                      + ghost .osr (same map)
                      <input
                        type="file"
                        accept=".osr"
                        className="hidden"
                        suppressHydrationWarning
                        onChange={(e) => loadGhost(e, summary)}
                      />
                    </label>
                  )}
                  {ghostErr && <span className="text-red-400">{ghostErr}</span>}
                </div>
              </div>
              <div className="mt-4">
                <ReplayViewer
                  ref={viewerRef}
                  viewer={summary.viewer}
                  hitErrors={summary.mechanics.hitErrors}
                  ghostFrames={ghost?.frames}
                />
              </div>
              {summary.mechanics.missTimes.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-white/35">jump to:</span>
                  {summary.mechanics.missTimes.slice(0, 16).map((t, i) => (
                    <button
                      key={i}
                      onClick={() => viewerRef.current?.seekTo(Math.max(0, t - 2000))}
                      className="rounded bg-red-400/15 px-2 py-1 text-[11px] font-semibold text-red-300 transition hover:bg-red-400/30"
                    >
                      miss @ {formatDuration(t / 1000)}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="mt-4 rounded-xl border border-line bg-surface p-6">
            <div className="flex items-baseline justify-between">
              <SectionTitle>what the cursor did</SectionTitle>
              <span className="text-xs text-white/40">
                {formatNumber(summary.mechanics.objects)} tap objects
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Big label="Unstable rate" value={summary.mechanics.ur.toFixed(0)} accent />
              <Big
                label="Timing bias"
                value={`${Math.abs(summary.mechanics.meanError).toFixed(1)}ms ${
                  summary.mechanics.meanError < 0 ? "early" : "late"
                }`}
              />
              <Big
                label="Early / late"
                value={`${Math.round(summary.mechanics.earlyRate * 100)}/${
                  100 - Math.round(summary.mechanics.earlyRate * 100)
                }`}
              />
              <Big
                label="300 / 100 / 50 / X"
                value={`${summary.mechanics.count300}/${summary.mechanics.count100}/${summary.mechanics.count50}/${summary.mechanics.countMiss}`}
              />
            </div>
            <div className="mt-5">
              <HitErrorChart errors={summary.mechanics.hitErrors} />
            </div>
            {summary.mechanics.insights.length > 0 && (
              <ul className="mt-5 space-y-1.5">
                {summary.mechanics.insights.map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm text-white/75">
                    <span className="text-pink">›</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-[11px] text-white/35">
              UR and hit errors come from your cursor stream vs the hit objects;
              sliders are judged by follow-circle and spinners by spin count, so
              reconstructed totals track the replay closely.
            </p>
          </section>

          {(summary.mechanics.keys || summary.mechanics.cursor) && (
            <section className="mt-4 rounded-xl border border-line bg-surface p-4 sm:p-6">
              <SectionTitle>hands and aim style</SectionTitle>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {summary.mechanics.keys && (
                  <>
                    <Big label="Tap style" value={summary.mechanics.keys.style} accent />
                    <Big
                      label="K1 / K2 split"
                      value={`${summary.mechanics.keys.k1Pct}/${100 - summary.mechanics.keys.k1Pct}`}
                    />
                    <Big label="Key hold" value={`${summary.mechanics.keys.holdMsMedian}ms`} />
                  </>
                )}
                {summary.mechanics.cursor && (
                  <Big label="Aim style" value={summary.mechanics.cursor.style} accent />
                )}
              </div>
              <ul className="mt-4 space-y-1.5 text-sm text-white/75">
                {summary.mechanics.keys?.altBpm != null && (
                  <li className="flex gap-2">
                    <span className="text-pink">›</span>
                    <span>
                      You single-tap until roughly {summary.mechanics.keys.altBpm}bpm streams,
                      then switch to alternating.
                    </span>
                  </li>
                )}
                {summary.mechanics.keys && (
                  <li className="flex gap-2">
                    <span className="text-pink">›</span>
                    <span>
                      {Math.round(summary.mechanics.keys.altRate * 100)}% of your fast presses
                      alternate keys ({summary.mechanics.keys.k1} left, {summary.mechanics.keys.k2}{" "}
                      right).
                    </span>
                  </li>
                )}
                {summary.mechanics.cursor && (
                  <li className="flex gap-2">
                    <span className="text-pink">›</span>
                    <span>
                      Your cursor travels {summary.mechanics.cursor.straightness}x the straight
                      line into jumps
                      {summary.mechanics.cursor.style === "snap"
                        ? ", textbook snap aim."
                        : summary.mechanics.cursor.style === "flow"
                          ? ", you carry momentum through patterns (flow aim)."
                          : ", somewhere between snap and flow."}
                    </span>
                  </li>
                )}
                {summary.mechanics.cursor &&
                  summary.mechanics.cursor.missLeft + summary.mechanics.cursor.missRight >= 4 &&
                  Math.max(summary.mechanics.cursor.missLeft, summary.mechanics.cursor.missRight) >=
                    (summary.mechanics.cursor.missLeft + summary.mechanics.cursor.missRight) *
                      0.7 && (
                    <li className="flex gap-2">
                      <span className="text-pink">›</span>
                      <span>
                        Most of your misses land on the{" "}
                        {summary.mechanics.cursor.missLeft > summary.mechanics.cursor.missRight
                          ? "left"
                          : "right"}{" "}
                        half of the playfield ({summary.mechanics.cursor.missLeft} left /{" "}
                        {summary.mechanics.cursor.missRight} right).
                      </span>
                    </li>
                  )}
              </ul>
              <MissMap objects={summary.viewer.objects} />
            </section>
          )}

          {summary.mechanics.sections.length > 0 && (
            <section className="mt-4 rounded-xl border border-line bg-surface p-4 sm:p-6">
              <SectionTitle>start to finish</SectionTitle>
              <SectionsChart sections={summary.mechanics.sections} strains={pp?.strains} />
            </section>
          )}

          {summary.mechanics.patterns.length > 0 && (
            <section className="mt-4 rounded-xl border border-line bg-surface p-4 sm:p-6">
              <SectionTitle>where it breaks down</SectionTitle>
              <div className="mt-4 space-y-2.5">
                {summary.mechanics.patterns.map((p) => {
                  const max = Math.max(...summary.mechanics.patterns.map((x) => x.ur), 1);
                  return (
                    <div key={p.name} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-sm text-white/60 sm:w-32">{p.name}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/30">
                        <div className="h-full rounded-full bg-pink" style={{ width: `${(p.ur / max) * 100}%` }} />
                      </div>
                      <span className="w-16 shrink-0 text-right font-display text-sm text-white">
                        {p.ur.toFixed(0)}
                      </span>
                      <span className="w-8 shrink-0 text-right text-[11px] text-white/35">×{p.count}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {summary.mechanics.coaching.strengths.length +
            summary.mechanics.coaching.weaknesses.length +
            summary.mechanics.coaching.practice.length >
            0 && (
            <section className="mt-4 rounded-xl border border-line bg-surface p-4 sm:p-6">
              <SectionTitle>strengths and leaks</SectionTitle>
              <div className="mt-4 grid gap-5 sm:grid-cols-3">
                <CoachCol title="Strengths" items={summary.mechanics.coaching.strengths} tone="good" />
                <CoachCol title="Weak points" items={summary.mechanics.coaching.weaknesses} tone="bad" />
                <CoachCol title="Practice" items={summary.mechanics.coaching.practice} tone="pink" />
              </div>
              <p className="mt-4 text-[11px] text-white/35">
                Based on this single replay. Analyze more to build a fuller picture.
              </p>
            </section>
          )}

          {aiReview && (
            <section className="mt-4 rounded-xl border border-line bg-surface p-4 sm:p-6">
              <SectionTitle>the game plan</SectionTitle>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/80">
                {aiReview}
              </div>
              <p className="mt-3 text-[11px] text-white/35">
                Reads the measured facts above and calls the one thing to fix first. Every number
                comes from the reconstruction, not the model.
              </p>
            </section>
          )}
          </>
        )}
      </main>
    </>
  );
}
