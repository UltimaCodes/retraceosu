import { NextResponse, type NextRequest } from "next/server";
import { OsuApiError, osuFetch } from "@/lib/osu/client";
import { shapeProfile } from "@/lib/osu/profile";
import type { OsuMe, OsuScore } from "@/lib/osu/types";
import { analyzeTopPlays } from "@/lib/playstyle";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("osu_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const me = await osuFetch<OsuMe>(token, "/me/osu");
    const best = await osuFetch<OsuScore[]>(
      token,
      `/users/${me.id}/scores/best?mode=osu&limit=100`,
    );
    return NextResponse.json({
      profile: shapeProfile(me),
      playstyle: analyzeTopPlays(best, me.statistics.global_rank),
    });
  } catch (e) {
    const status = e instanceof OsuApiError && e.status === 401 ? 401 : 502;
    return NextResponse.json({ error: "fetch_failed" }, { status });
  }
}
