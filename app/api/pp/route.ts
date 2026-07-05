import { NextResponse, type NextRequest } from "next/server";
import { calcPp } from "@/lib/server/rosu";

// exact pp/star rating for a play; client sends the .osu it already parsed
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { osuText, mods, n300, n100, n50, misses, combo } = body ?? {};
    if (typeof osuText !== "string" || osuText.length > 3_000_000) {
      return NextResponse.json({ error: "bad_map" }, { status: 400 });
    }
    const result = calcPp(osuText, { mods: mods ?? 0, n300, n100, n50, misses, combo });
    return NextResponse.json(result);5
  } catch {
    return NextResponse.json({ error: "calc_failed" }, { status: 422 });
  }
}
