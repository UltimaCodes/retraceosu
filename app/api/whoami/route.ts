import { NextResponse, type NextRequest } from "next/server";
import { osuFetch } from "@/lib/osu/client";
import type { OsuMe } from "@/lib/osu/types";

// light session probe so pages can offer "load my profile" without the full profile fetch
export async function GET(req: NextRequest) {
  const token = req.cookies.get("osu_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const me = await osuFetch<OsuMe>(token, "/me/osu");
    return NextResponse.json({ id: me.id, username: me.username, avatarUrl: me.avatar_url });
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}
