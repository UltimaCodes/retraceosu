"use client";

import { useState } from "react";
import type { MapHighlight, SkillDimensions } from "@/lib/playstyle";

const AXES: { key: keyof SkillDimensions; label: string }[] = [
  { key: "aim", label: "Aim" },
  { key: "speed", label: "Speed" },
  { key: "stamina", label: "Stamina" },
  { key: "reading", label: "Reading" },
  { key: "accuracy", label: "Accuracy" },
  { key: "tech", label: "Tech" },
];

const CX = 150;
const CY = 120;
const R = 82;

function point(i: number, value: number): [number, number] {
  const angle = (-90 + i * 60) * (Math.PI / 180);
  const r = (R * value) / 100;
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
}

export function SkillRadar({
  skill,
  highlights,
}: {
  skill: SkillDimensions;
  highlights: Partial<Record<keyof SkillDimensions, MapHighlight>>;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const rings = [25, 50, 75, 100];
  const data = AXES.map((a, i) => point(i, skill[a.key]).join(",")).join(" ");
  const active = hover != null ? highlights[AXES[hover].key] : undefined;
  const [tipX, tipY] = hover != null ? point(hover, 112) : [0, 0];

  return (
    <div className="relative">
      <svg viewBox="0 0 300 250" className="w-full">
        {rings.map((ring) => (
          <polygon
            key={ring}
            points={AXES.map((_, i) => point(i, ring).join(",")).join(" ")}
            fill="none"
            stroke="#ffffff14"
          />
        ))}
        {AXES.map((a, i) => {
          const [x, y] = point(i, 100);
          const [lx, ly] = point(i, 124);
          const anchor = lx > CX + 4 ? "start" : lx < CX - 4 ? "end" : "middle";
          return (
            <g key={a.key}>
              <line x1={CX} y1={CY} x2={x} y2={y} stroke="#ffffff14" />
              <text x={lx} y={ly} fill="#ffffff99" fontSize="11" textAnchor={anchor} dominantBaseline="middle">
                {a.label}
              </text>
              <text x={lx} y={ly + 12} fill="#ff66ab" fontSize="10" fontWeight="700" textAnchor={anchor} dominantBaseline="middle">
                {skill[a.key]}
              </text>
            </g>
          );
        })}
        <polygon points={data} fill="#ff66ab40" stroke="#ff66ab" strokeWidth="2" />
        {AXES.map((a, i) => {
          const [dx, dy] = point(i, skill[a.key]);
          const [hx, hy] = point(i, 100);
          return (
            <g key={`hit-${a.key}`}>
              <circle cx={dx} cy={dy} r={hover === i ? 4 : 2.5} fill="#ff66ab" />
              <circle
                cx={hx}
                cy={hy}
                r={28}
                fill="transparent"
                className={highlights[a.key] ? "cursor-pointer" : ""}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute z-10 w-44 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-[#120e18] p-2 text-left shadow-xl shadow-black/50"
          style={{ left: `${(tipX / 300) * 100}%`, top: `${(tipY / 250) * 100}%` }}
        >
          <div className="truncate text-xs font-semibold text-white">{active.title}</div>
          <div className="truncate text-[11px] text-white/50">
            [{active.version}] {active.mods}
          </div>
          <div className="mt-0.5 text-[11px] font-semibold text-pink">
            {active.stars}★ · {active.metric}
          </div>
        </div>
      )}
    </div>
  );
}
