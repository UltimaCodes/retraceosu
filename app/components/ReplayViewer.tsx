"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ViewerData, ViewerFrame } from "@/lib/replay/types";
import { formatDuration } from "@/lib/format";

// internal canvas resolution + the gameplay area (512x384 playfield centred in 640x480)
const RES_W = 1024;
const RES_H = 768;
const FX0 = -64;
const FY0 = -48;
const FW = 640;
const FH = 480;
const SC = RES_W / FW;
const px = (x: number) => ((x - FX0) / FW) * RES_W;
const py = (y: number) => ((y - FY0) / FH) * RES_H;
const TRAIL_MS = 320;
const FADE_MS = 600;

function lowerBound(frames: ViewerFrame[], time: number): number {
  let lo = 0;
  let hi = frames.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (frames[m].t < time) lo = m + 1;
    else hi = m;
  }
  return lo;
}

function cursorAt(frames: ViewerFrame[], t: number) {
  if (!frames.length) return null;
  if (t <= frames[0].t) return frames[0];
  const last = frames[frames.length - 1];
  if (t >= last.t) return last;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo + 1 < hi) {
    const m = (lo + hi) >> 1;
    if (frames[m].t <= t) lo = m;
    else hi = m;
  }
  const a = frames[lo];
  const b = frames[lo + 1];
  const u = (t - a.t) / (b.t - a.t || 1);
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, k: a.k };
}

export function ReplayViewer({
  viewer,
  hitErrors,
}: {
  viewer: ViewerData;
  hitErrors: { time: number; error: number }[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const rangeRef = useRef<HTMLInputElement>(null);
  const tRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const length = viewer.lengthMs || 1;

  const draw = useCallback(
    (t: number) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, RES_W, RES_H);

      // playfield bounds
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.strokeRect(px(0), py(0), px(512) - px(0), py(384) - py(0));

      const r = viewer.radius * SC;

      // later objects first so the earliest sits on top, like the game
      for (let i = viewer.objects.length - 1; i >= 0; i--) {
        const o = viewer.objects[i];
        const end = o.end ?? o.t;
        if (t < o.t - viewer.preempt || t > end + FADE_MS) continue;
        const ox = px(o.x);
        const oy = py(o.y);

        // post-time: judgement feedback, then skip the normal body
        if (t > end) {
          const k = 1 - (t - end) / FADE_MS;
          if (o.j === 3) {
            ctx.strokeStyle = `rgba(255,80,80,${0.9 * k})`;
            ctx.lineWidth = 4;
            const s = r * 0.55;
            ctx.beginPath();
            ctx.moveTo(ox - s, oy - s);
            ctx.lineTo(ox + s, oy + s);
            ctx.moveTo(ox + s, oy - s);
            ctx.lineTo(ox - s, oy + s);
            ctx.stroke();
          } else if (o.j === 1 || o.j === 2) {
            ctx.strokeStyle = `rgba(255,180,90,${0.7 * k})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(ox, oy, r * 0.6, 0, Math.PI * 2);
            ctx.stroke();
          }
          continue;
        }

        const appr = Math.min(1, Math.max(0, (t - (o.t - viewer.preempt)) / viewer.preempt));
        ctx.globalAlpha = 0.2 + 0.6 * appr;

        if (o.type === 2) {
          // spinner: big centre ring
          ctx.strokeStyle = "rgba(255,255,255,0.25)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(px(256), py(192), 180 * SC, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          continue;
        }

        // slider body along the real curve
        if (o.type === 1 && o.path && o.path.length >= 4) {
          ctx.strokeStyle = "rgba(255,102,171,0.30)";
          ctx.lineWidth = r * 1.8;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          ctx.moveTo(px(o.path[0]), py(o.path[1]));
          for (let p = 2; p < o.path.length; p += 2) {
            ctx.lineTo(px(o.path[p]), py(o.path[p + 1]));
          }
          ctx.stroke();
        }

        ctx.strokeStyle = "#ff66ab";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ox, oy, r, 0, Math.PI * 2);
        ctx.stroke();
        if (t < o.t) {
          ctx.globalAlpha = 0.3 * appr;
          ctx.beginPath();
          ctx.arc(ox, oy, r * (1 + 2.5 * (1 - appr)), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // cursor trail
      const frames = viewer.frames;
      const lo = lowerBound(frames, t - TRAIL_MS);
      const hi = lowerBound(frames, t);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      for (let i = Math.max(1, lo + 1); i <= hi && i < frames.length; i++) {
        const a = frames[i - 1];
        const b = frames[i];
        const fade = Math.max(0, 1 - (t - b.t) / TRAIL_MS);
        ctx.strokeStyle = `rgba(95,208,255,${fade * 0.7})`;
        ctx.beginPath();
        ctx.moveTo(px(a.x), py(a.y));
        ctx.lineTo(px(b.x), py(b.y));
        ctx.stroke();
      }

      const cur = cursorAt(frames, t);
      if (cur) {
        ctx.fillStyle = cur.k ? "#ff66ab" : "#ffffff";
        ctx.beginPath();
        ctx.arc(px(cur.x), py(cur.y), 6, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [viewer],
  );

  // update everything for a new time without a React render
  const present = useCallback(
    (t: number) => {
      tRef.current = t;
      draw(t);
      if (playheadRef.current) playheadRef.current.style.left = `${(t / length) * 100}%`;
      if (timeRef.current)
        timeRef.current.textContent = `${formatDuration(t / 1000)} / ${formatDuration(length / 1000)}`;
      if (rangeRef.current) rangeRef.current.value = String(Math.round(t));
    },
    [draw, length],
  );

  const seek = useCallback(
    (nt: number) => present(Math.max(0, Math.min(length, nt))),
    [present, length],
  );

  useEffect(() => {
    present(tRef.current);
  }, [present]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let raf = 0;
    const rate = viewer.rate || 1;
    const step = (ts: number) => {
      const nt = tRef.current + (ts - last) * rate;
      last = ts;
      if (nt >= length) {
        present(length);
        setPlaying(false);
        return;
      }
      present(nt);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, length, viewer.rate, present]);

  const maxAbs = useMemo(
    () => Math.max(40, ...hitErrors.map((e) => Math.abs(e.error))),
    [hitErrors],
  );
  const ticks = useMemo(
    () =>
      hitErrors.map((e, i) => (
        <div
          key={i}
          className="absolute w-px"
          style={{
            left: `${(e.time / length) * 100}%`,
            top: "50%",
            height: `${(Math.abs(e.error) / maxAbs) * 16}px`,
            transform: `translate(-50%, ${e.error < 0 ? "-100%" : "0"})`,
            background: e.error < 0 ? "#5fd0ff" : "#ff8f5f",
          }}
        />
      )),
    [hitErrors, length, maxAbs],
  );

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={RES_W}
        height={RES_H}
        className="block w-full max-w-full rounded-lg bg-black/40"
        style={{ aspectRatio: "4 / 3" }}
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => {
            if (tRef.current >= length) seek(0);
            setPlaying((p) => !p);
          }}
          className="w-9 rounded-md bg-pink py-1.5 text-sm font-semibold text-white hover:bg-pink-dark"
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <input
          ref={rangeRef}
          type="range"
          min={0}
          max={length}
          step={1}
          defaultValue={0}
          onInput={(e) => {
            setPlaying(false);
            seek(Number((e.target as HTMLInputElement).value));
          }}
          className="h-1 flex-1 cursor-pointer accent-pink"
        />
        {viewer.rate !== 1 && (
          <span className="shrink-0 rounded bg-pink/15 px-1.5 py-0.5 text-[11px] font-semibold text-pink">
            {viewer.rate}×
          </span>
        )}
        <span
          ref={timeRef}
          className="w-24 shrink-0 text-right font-display text-xs tabular-nums text-white/60"
        >
          0:00 / {formatDuration(length / 1000)}
        </span>
      </div>

      {/* error ticks · click to jump */}
      <div
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setPlaying(false);
          seek(((e.clientX - rect.left) / rect.width) * length);
        }}
        className="relative mt-2 h-9 cursor-pointer overflow-hidden rounded-md bg-black/30"
        title="click to seek"
      >
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/15" />
        {ticks}
        <div ref={playheadRef} className="absolute top-0 h-full w-0.5 bg-white" style={{ left: 0 }} />
      </div>
      <p className="mt-1 text-[11px] text-white/35">
        Cursor trace · × = miss, ○ = 100/50 · click the timeline to jump there.
      </p>
    </div>
  );
}
