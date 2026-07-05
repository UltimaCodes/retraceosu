const API_BASE = "https://osu.ppy.sh/api/v2";

export class OsuApiError extends Error {
  constructor(public status: number, body: string) {
    super(`osu! API ${status}: ${body.slice(0, 200)}`);
  }
}

// retries default to 0 (backward compatible); informatics routes fan out and pass a few
export async function osuFetch<T>(token: string, path: string, retries = 0): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) return res.json() as Promise<T>;
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < retries) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      continue;
    }
    throw new OsuApiError(res.status, await res.text());
  }
}
