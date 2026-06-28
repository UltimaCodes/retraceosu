// scatter of signed hit error (ms) over the course of the play
export function HitErrorChart({
  errors,
}: {
  errors: { time: number; error: number }[];
}) {
  if (errors.length === 0) {
    return <p className="text-sm text-white/40">No timed hits to chart.</p>;
  }

  const W = 600;
  const H = 150;
  const pad = 10;
  const maxAbs = Math.max(40, ...errors.map((e) => Math.abs(e.error)));
  const tMin = errors[0].time;
  const tMax = errors[errors.length - 1].time;
  const tRange = tMax - tMin || 1;
  const xOf = (t: number) => pad + ((t - tMin) / tRange) * (W - 2 * pad);
  const yOf = (e: number) => H / 2 - (e / maxAbs) * (H / 2 - pad);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#ffffff33" strokeWidth="1" />
        <text x={2} y={pad + 4} fill="#ffffff55" fontSize="9">
          +{Math.round(maxAbs)}ms late
        </text>
        <text x={2} y={H - 4} fill="#ffffff55" fontSize="9">
          −{Math.round(maxAbs)}ms early
        </text>
        {errors.map((e, i) => (
          <circle
            key={i}
            cx={xOf(e.time)}
            cy={yOf(e.error)}
            r={1.8}
            fill={e.error < 0 ? "#5fd0ff" : "#ff8f5f"}
            opacity={0.75}
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-center gap-4 text-[11px] text-white/40">
        <span>
          <span className="text-[#5fd0ff]">●</span> early
        </span>
        <span>
          <span className="text-[#ff8f5f]">●</span> late
        </span>
      </div>
    </div>
  );
}
