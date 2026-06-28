import type { SkillDimensions } from "@/lib/playstyle";

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

export function SkillRadar({ skill }: { skill: SkillDimensions }) {
  const rings = [25, 50, 75, 100];
  const data = AXES.map((a, i) => point(i, skill[a.key]).join(",")).join(" ");

  return (
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
        return (
          <g key={a.key}>
            <line x1={CX} y1={CY} x2={x} y2={y} stroke="#ffffff14" />
            <text
              x={lx}
              y={ly}
              fill="#ffffff99"
              fontSize="11"
              textAnchor={lx > CX + 4 ? "start" : lx < CX - 4 ? "end" : "middle"}
              dominantBaseline="middle"
            >
              {a.label}
            </text>
            <text
              x={lx}
              y={ly + 12}
              fill="#ff66ab"
              fontSize="10"
              fontWeight="700"
              textAnchor={lx > CX + 4 ? "start" : lx < CX - 4 ? "end" : "middle"}
              dominantBaseline="middle"
            >
              {skill[a.key]}
            </text>
          </g>
        );
      })}
      <polygon points={data} fill="#ff66ab40" stroke="#ff66ab" strokeWidth="2" />
    </svg>
  );
}
