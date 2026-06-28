export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatRank(n: number | null): string {
  return n == null ? "—" : `#${formatNumber(n)}`;
}

export function formatPlaytime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  if (hours < 1) return `${Math.floor(seconds / 60)}m`;
  const days = Math.floor(hours / 24);
  if (days < 1) return `${hours}h`;
  return `${formatNumber(days)}d ${hours % 24}h`;
}

export function formatPp(pp: number): string {
  return `${formatNumber(Math.round(pp))}pp`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });
}

// ISO country code -> regional-indicator flag emoji
export function flagEmoji(code: string): string {
  if (code.length !== 2) return "";
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}
