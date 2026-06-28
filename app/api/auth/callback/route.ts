import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/osu/oauth";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get("osu_oauth_state")?.value;
  const home = new URL("/", req.nextUrl.origin);

  if (!code || !state || state !== expected) {
    home.searchParams.set("auth", "error");
    return NextResponse.redirect(home);
  }

  try {
    const token = await exchangeCode(code);
    const res = NextResponse.redirect(home);
    res.cookies.set("osu_token", token.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: token.expires_in,
    });
    res.cookies.delete("osu_oauth_state");
    return res;
  } catch {
    home.searchParams.set("auth", "error");
    return NextResponse.redirect(home);
  }
}
