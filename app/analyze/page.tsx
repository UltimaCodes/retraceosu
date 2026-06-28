"use client";

import { useState } from "react";
import Link from "next/link";
import { parseReplay } from "@/lib/replay/parseClient";
import type { ParsedSummary } from "@/lib/replay/types";
import { formatDuration, formatNumber } from "@/lib/format";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-2 last:border-0">
      <span className="text-sm text-white/50">{label}</span>
      <span className="font-display text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

function FilePill({ kind, file }: { kind: string; file: File | null }) {
  return (
    <span
      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
        file ? "bg-pink/15 text-pink" : "bg-black/20 text-white/40"
      }`}
    >
      {kind}: {file ? file.name : "none"}
    </span>
  );
}

export default function AnalyzePage() {
  const [osu, setOsu] = useState<File | null>(null);
  const [osr, setOsr] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ParsedSummary | null>(null);

  function take(files: FileList | File[]) {
    for (const f of Array.from(files)) {
      if (f.name.toLowerCase().endsWith(".osr")) setOsr(f);
      else if (f.name.toLowerCase().endsWith(".osu")) setOsu(f);
    }
  }

  async function run() {
    if (!osu || !osr) return;
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const [osuText, osrBuffer] = await Promise.all([osu.text(), osr.arrayBuffer()]);
      setSummary(await parseReplay(osuText, osrBuffer));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <nav className="sticky top-0 z-20 border-b border-line bg-[#231b20]">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="font-display text-xl font-bold tracking-tight text-white">
            Re<span className="text-pink">trace</span>
          </Link>
          <Link href="/" className="text-sm text-white/50 transition hover:text-white">
            ← Profile
          </Link>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-white">Replay analysis</h1>
        <p className="mt-1 text-sm text-white/50">
          Drop a replay (.osr) and its beatmap (.osu). Everything is parsed in your browser.
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
          <p className="text-white/70">Drag & drop your .osr and .osu here</p>
          <div className="mt-3 flex flex-wrap justify-center gap-3 text-sm">
            <label className="cursor-pointer rounded-lg bg-black/30 px-3 py-1.5 text-white/70 hover:text-white">
              Choose .osu
              <input
                type="file"
                accept=".osu"
                className="hidden"
                onChange={(e) => e.target.files && take(e.target.files)}
              />
            </label>
            <label className="cursor-pointer rounded-lg bg-black/30 px-3 py-1.5 text-white/70 hover:text-white">
              Choose .osr
              <input
                type="file"
                accept=".osr"
                className="hidden"
                onChange={(e) => e.target.files && take(e.target.files)}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <FilePill kind=".osu" file={osu} />
            <FilePill kind=".osr" file={osr} />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={run}
            disabled={!osu || !osr || busy}
            className="rounded-lg bg-pink px-5 py-2.5 font-display font-bold text-white transition hover:bg-pink-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Parsing…" : "Analyze"}
          </button>
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>

        {summary && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <section className="rounded-xl border border-line bg-surface p-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Beatmap
              </h2>
              <p className="mt-1 font-display text-lg font-bold text-white">
                {summary.beatmap.artist} – {summary.beatmap.title}
              </p>
              <p className="text-sm text-pink">[{summary.beatmap.version}]</p>
              <div className="mt-4">
                <Row label="Mapper" value={summary.beatmap.creator} />
                <Row label="Mode" value={summary.beatmap.mode === 0 ? "osu!" : `mode ${summary.beatmap.mode}`} />
                <Row
                  label="CS / AR / OD / HP"
                  value={`${summary.beatmap.cs} / ${summary.beatmap.ar.toFixed(1)} / ${summary.beatmap.od} / ${summary.beatmap.hp}`}
                />
                <Row label="Length" value={formatDuration(summary.beatmap.lengthMs / 1000)} />
                <Row
                  label="Objects"
                  value={`${summary.beatmap.hitObjects} (${summary.beatmap.circles}c / ${summary.beatmap.sliders}s / ${summary.beatmap.spinners}sp)`}
                />
              </div>
            </section>

            <section className="rounded-xl border border-line bg-surface p-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Replay
              </h2>
              <p className="mt-1 font-display text-lg font-bold text-white">{summary.replay.player}</p>
              <p className="text-sm text-pink">
                {["None", "NM", ""].includes(summary.replay.mods)
                  ? "nomod"
                  : `+${summary.replay.mods}`}
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
            </section>
          </div>
        )}
      </main>
    </>
  );
}
