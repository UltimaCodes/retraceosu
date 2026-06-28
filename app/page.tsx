"use client";

import { useEffect, useState } from "react";
import type { Profile } from "@/lib/osu/profile";
import type { PlaystyleSummary } from "@/lib/playstyle";
import { ProfileCard } from "@/app/components/ProfileCard";
import { PlaystyleCard } from "@/app/components/PlaystyleCard";

type ProfileResponse = { profile: Profile; playstyle: PlaystyleSummary };
type State =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "ready"; data: ProfileResponse };

export default function Home() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => {
        if (res.status === 401) return null;
        if (!res.ok) throw new Error("profile fetch failed");
        return res.json();
      })
      .then((data: ProfileResponse | null) =>
        setState(data ? { status: "ready", data } : { status: "anon" }),
      )
      .catch(() => setState({ status: "anon" }));
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-white">
          osu<span className="text-[#ff66aa]">lytics</span>
        </h1>
        {state.status === "ready" && (
          <form action="/api/auth/logout" method="post">
            <button className="text-sm text-white/40 hover:text-white/70">
              Sign out
            </button>
          </form>
        )}
      </header>

      {state.status === "loading" && (
        <p className="text-sm text-white/40">Loading…</p>
      )}

      {state.status === "anon" && (
        <div className="rounded-2xl border border-white/10 bg-[#1b1622] p-10 text-center">
          <h2 className="text-2xl font-bold text-white">
            Replay analysis for osu!
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/50">
            Sign in to profile your rank, pp and playstyle. Drop a replay next to
            see exactly where your accuracy and aim break down.
          </p>
          <a
            href="/api/auth/login"
            className="mt-6 inline-block rounded-lg bg-[#ff66aa] px-5 py-2.5 font-semibold text-white transition hover:bg-[#ff4f9c]"
          >
            Sign in with osu!
          </a>
        </div>
      )}

      {state.status === "ready" && (
        <div className="space-y-4">
          <ProfileCard profile={state.data.profile} />
          <PlaystyleCard playstyle={state.data.playstyle} />
        </div>
      )}
    </main>
  );
}
