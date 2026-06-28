// osu!'s signature scattered triangles, rendered as a low-opacity backdrop
const TRIANGLES = [
  { x: 90, y: 430, s: 150, o: 0.05 },
  { x: 180, y: 170, s: 90, o: 0.04 },
  { x: 300, y: 520, s: 210, o: 0.06 },
  { x: 440, y: 120, s: 120, o: 0.05 },
  { x: 560, y: 380, s: 80, o: 0.04 },
  { x: 670, y: 230, s: 170, o: 0.06 },
  { x: 790, y: 470, s: 100, o: 0.05 },
  { x: 880, y: 160, s: 140, o: 0.05 },
  { x: 950, y: 380, s: 70, o: 0.04 },
  { x: 130, y: 300, s: 60, o: 0.03 },
  { x: 500, y: 540, s: 70, o: 0.04 },
  { x: 720, y: 70, s: 90, o: 0.04 },
];

function tri(x: number, y: number, s: number): string {
  const h = s * 0.87;
  return `${x},${y - h / 2} ${x + s / 2},${y + h / 2} ${x - s / 2},${y + h / 2}`;
}

export function Triangles({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1000 600"
      preserveAspectRatio="xMidYMid slice"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    >
      {TRIANGLES.map((t, i) => (
        <polygon key={i} points={tri(t.x, t.y, t.s)} fill="#fff" opacity={t.o} />
      ))}
    </svg>
  );
}
