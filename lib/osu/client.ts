const API_BASE = "https://osu.ppy.sh/api/v2";

export class OsuApiError extends Error {
  constructor(public status: number, body: string) {
    super(`osu! API ${status}: ${body.slice(0, 200)}`);
  }
}

export async function osuFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new OsuApiError(res.status, await res.text());
  return res.json() as Promise<T>;
}
