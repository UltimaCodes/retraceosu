import { NextResponse, type NextRequest } from "next/server";
import { OsuApiError, osuFetch } from "@/lib/osu/client";

// resolves a replay's beatmap MD5 to its .osu file: lookup id via API, then
// download the raw .osu server-side (avoids CORS and keeps the token private)
export async function GET(req: NextRequest) {
  const token = req.cookies.get("osu_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const checksum = req.nextUrl.searchParams.get("checksum");
  if (!checksum) return NextResponse.json({ error: "missing checksum" }, { status: 400 });

  try {
    const map = await osuFetch<{ id: number }>(
      token,
      `/beatmaps/lookup?checksum=${encodeURIComponent(checksum)}`,
    );
    const res = await fetch(`https://osu.ppy.sh/osu/${map.id}`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: "download_failed" }, { status: 502 });
    return NextResponse.json({ id: map.id, osu: await res.text() });
  } catch (e) {
    const status =
      e instanceof OsuApiError && (e.status === 404 || e.status === 401) ? e.status : 502;
    return NextResponse.json({ error: "lookup_failed" }, { status });
  }
}
