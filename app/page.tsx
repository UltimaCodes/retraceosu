"use client";

import { useEffect, useState } from "react";
import type { Profile } from "@/lib/osu/profile";
import type { PlaystyleAnalysis } from "@/lib/playstyle";
import { ProfileCard } from "@/app/components/ProfileCard";
import { PlaystyleCard } from "@/app/components/PlaystyleCard";
import { Triangles } from "@/app/components/Triangles";

type ProfileResponse = { profile: Profile; playstyle: PlaystyleAnalysis };
type State =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "ready"; data: ProfileResponse };

function Wordmark() {
  return (
    <span className="font-display text-xl font-bold tracking-tight text-white">
      osu<span className="text-pink">!</span>lytics
    </span>
  );
}

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
    <>
      <nav className="sticky top-0 z-20 border-b border-line bg-[#231b20]">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Wordmark />
          {state.status === "ready" && (
            <form action="/api/auth/logout" method="post">
              <button className="text-sm text-white/50 transition hover:text-white">
                Sign out
              </button>
            </form>
          )}
        </div>
      </nav>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {state.status === "loading" && (
          <p className="text-sm text-white/40">Loading…</p>
        )}

        {state.status === "anon" && (
          <div className="relative mt-6 overflow-hidden rounded-2xl border border-line bg-surface px-6 py-16 text-center">
            <Triangles />
            <div className="relative">
              <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
                Replay analysis for osu<span className="text-pink">!</span>
              </h1>
              <p className="mx-auto mt-3 max-w-md text-white/55">
                Sign in to profile your rank, pp and playstyle — then drop a
                replay to see exactly where your accuracy and aim break down.
              </p>
              <a
                href="/api/auth/login"
                className="mt-7 inline-block rounded-xl bg-pink px-6 py-3 font-display font-bold text-white shadow-lg shadow-pink/20 transition hover:bg-pink-dark"
              >
                Sign in with osu!
              </a>
            </div>
          </div>
        )}

        {state.status === "ready" && (
          <div className="space-y-4">
            <ProfileCard profile={state.data.profile} />
            <PlaystyleCard playstyle={state.data.playstyle} />
          </div>
        )}
      </main>
    </>
  );
}
