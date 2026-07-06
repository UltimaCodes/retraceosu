import { NextResponse, type NextRequest } from "next/server";
import { osuFetch } from "@/lib/osu/client";
import { getSession } from "@/lib/osu/session";
import type { OsuMe } from "@/lib/osu/types";

// light session probe so pages can offer "load my profile" without the full profile fetch
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const me = await osuFetch<OsuMe>(session.token, "/me/osu");
    const out = NextResponse.json({ id: me.id, username: me.username, avatarUrl: me.avatar_url });
    session.commit?.(out);
    return out;
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}
