import type { NextRequest, NextResponse } from "next/server";
import { refreshAccessToken, type TokenResponse } from "./oauth";

// the access cookie expires with the token; if only the refresh cookie is left,
// mint a new access token and hand back a cookie-writer for the response
export type Session = {
  token: string;
  commit?: (res: NextResponse) => void;
};

const inflight = new Map<string, Promise<TokenResponse>>();

export function applyTokenCookies(res: NextResponse, t: TokenResponse) {
  const secure = process.env.NODE_ENV === "production";
  const base = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
  // expire the cookie a bit before the token so we never send a dead token
  res.cookies.set("osu_token", t.access_token, {
    ...base,
    maxAge: Math.max(60, t.expires_in - 300),
  });
  if (t.refresh_token) {
    res.cookies.set("osu_refresh", t.refresh_token, {
      ...base,
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

export async function getSession(req: NextRequest): Promise<Session | null> {
  const access = req.cookies.get("osu_token")?.value;
  if (access) return { token: access };

  const refresh = req.cookies.get("osu_refresh")?.value;
  if (!refresh) return null;
  try {
    // single-flight: parallel requests must not burn the same rotating refresh token
    let p = inflight.get(refresh);
    if (!p) {
      p = refreshAccessToken(refresh).finally(() => inflight.delete(refresh));
      inflight.set(refresh, p);
    }
    const t = await p;
    return { token: t.access_token, commit: (res) => applyTokenCookies(res, t) };
  } catch {
    return null;
  }
}
