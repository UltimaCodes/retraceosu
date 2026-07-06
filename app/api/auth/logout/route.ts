import { NextResponse, type NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.nextUrl.origin), 303);
  res.cookies.delete("osu_token");
  res.cookies.delete("osu_refresh");
  return res;
}
