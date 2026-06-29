"use client";

import { useEffect, useRef, useState } from "react";
import type { ViewerData, ViewerFrame } from "@/lib/replay/types";
import { formatDuration } from "@/lib/format";

const PF_W = 512;
const PF_H = 384;
const RES_W = 1024;
const SCALE = RES_W / PF_W;
const TRAIL_MS = 350;

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
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const tRef = useRef(0);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const length = viewer.lengthMs || 1;

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let raf = 0;
    const step = (ts: number) => {
      const nt = tRef.current + (ts - last);
      last = ts;
      if (nt >= length) {
        setT(length);
        setPlaying(false);
        return;
      }
      setT(nt);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, length]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const W = RES_W;
    const H = RES_W * (PF_H / PF_W);
    ctx.clearRect(0, 0, W, H);
    const r = viewer.radius * SCALE;

    for (const o of viewer.objects) {
      const end = o.end ?? o.t;
      if (t < o.t - viewer.preempt || t > end + 150) continue;
      const ox = o.x * SCALE;
      const oy = o.y * SCALE;
      const appr = Math.min(1, Math.max(0, (t - (o.t - viewer.preempt)) / viewer.preempt));
      ctx.globalAlpha = 0.25 + 0.55 * appr;
      if (o.type === 1 && o.ex != null && o.ey != null) {
        ctx.strokeStyle = "rgba(255,102,171,0.45)";
        ctx.lineWidth = r * 0.7;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(o.ex * SCALE, o.ey * SCALE);
        ctx.stroke();
      }
      ctx.strokeStyle = "#ff66ab";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.stroke();
      if (t < o.t) {
        ctx.globalAlpha = 0.35 * appr;
        ctx.beginPath();
        ctx.arc(ox, oy, r * (1 + 2 * (1 - appr)), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

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
      ctx.moveTo(a.x * SCALE, a.y * SCALE);
      ctx.lineTo(b.x * SCALE, b.y * SCALE);
      ctx.stroke();
    }

    const cur = cursorAt(frames, t);
    if (cur) {
      ctx.fillStyle = cur.k ? "#ff66ab" : "#ffffff";
      ctx.beginPath();
      ctx.arc(cur.x * SCALE, cur.y * SCALE, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [t, viewer]);

  const maxAbs = Math.max(40, ...hitErrors.map((e) => Math.abs(e.error)));

  function seekFromBar(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setPlaying(false);
    setT(((e.clientX - rect.left) / rect.width) * length);
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={RES_W}
        height={RES_W * (PF_H / PF_W)}
        className="w-full rounded-lg bg-black/40"
        style={{ aspectRatio: `${PF_W}/${PF_H}` }}
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => {
            if (t >= length) {
              setT(0);
              setPlaying(true);
            } else {
              setPlaying((p) => !p);
            }
          }}
          className="rounded-md bg-pink px-3 py-1.5 text-sm font-semibold text-white hover:bg-pink-dark"
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <span className="font-display text-xs tabular-nums text-white/60">
          {formatDuration(t / 1000)} / {formatDuration(length / 1000)}
        </span>
      </div>

      {/* clickable error timeline */}
      <div
        onClick={seekFromBar}
        className="relative mt-2 h-10 cursor-pointer rounded-md bg-black/30"
        title="click to seek"
      >
        <div className="absolute left-0 right-0 top-1/2 h-px bg-white/15" />
        {hitErrors.map((e, i) => (
          <div
            key={i}
            className="absolute w-0.5 -translate-x-1/2"
            style={{
              left: `${(e.time / length) * 100}%`,
              top: "50%",
              height: `${(Math.abs(e.error) / maxAbs) * 18}px`,
              transform: `translate(-50%, ${e.error < 0 ? "-100%" : "0"})`,
              background: e.error < 0 ? "#5fd0ff" : "#ff8f5f",
            }}
          />
        ))}
        <div
          className="absolute top-0 h-full w-0.5 bg-white"
          style={{ left: `${(t / length) * 100}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-white/35">
        Cursor trace over the map · click the bar to jump to a moment.
      </p>
    </div>
  );
}
