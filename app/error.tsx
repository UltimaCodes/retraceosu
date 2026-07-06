"use client";

// route-level crash guard so a bad fetch never white-screens the app
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-bold text-white">Something broke</h1>
      <p className="mt-2 text-sm text-white/50">
        Probably a hiccup talking to the osu! API. Your local data is fine.
      </p>
      <button
        onClick={reset}
        className="mt-5 rounded-lg bg-pink px-5 py-2.5 font-display font-bold text-white transition hover:bg-pink-dark"
      >
        Try again
      </button>
    </main>
  );
}
