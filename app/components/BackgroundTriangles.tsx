// osu!-style triangles slowly drifting upward behind the content.
// fixed list (no Math.random) so server and client markup match.
const TRIS = [
  { left: 4, size: 80, dur: 38, delay: 3, op: 0.06 },
  { left: 13, size: 44, dur: 28, delay: 12, op: 0.05 },
  { left: 21, size: 120, dur: 52, delay: 22, op: 0.05 },
  { left: 30, size: 60, dur: 33, delay: 6, op: 0.06 },
  { left: 39, size: 30, dur: 24, delay: 17, op: 0.04 },
  { left: 47, size: 96, dur: 46, delay: 30, op: 0.05 },
  { left: 55, size: 50, dur: 30, delay: 9, op: 0.05 },
  { left: 63, size: 140, dur: 58, delay: 40, op: 0.04 },
  { left: 71, size: 36, dur: 26, delay: 14, op: 0.05 },
  { left: 79, size: 72, dur: 40, delay: 25, op: 0.06 },
  { left: 87, size: 54, dur: 32, delay: 4, op: 0.05 },
  { left: 94, size: 100, dur: 50, delay: 19, op: 0.04 },
  { left: 9, size: 28, dur: 22, delay: 36, op: 0.04 },
  { left: 50, size: 24, dur: 20, delay: 44, op: 0.04 },
  { left: 67, size: 64, dur: 36, delay: 49, op: 0.05 },
];

export function BackgroundTriangles() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {TRIS.map((t, i) => (
        <span
          key={i}
          className="bg-tri"
          style={{
            left: `${t.left}%`,
            width: t.size,
            height: t.size * 0.87,
            opacity: t.op,
            animationDuration: `${t.dur}s`,
            animationDelay: `-${t.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
