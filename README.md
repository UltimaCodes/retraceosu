# Retrace

Replay autopsy for osu!standard. Drop a .osr and it reconstructs the play hit by hit (UR, timing bias, patterns, aim style, tap style), tells you what actually went wrong, and can recommend farm maps priced by your real mods and accuracy. Everything replay-related runs client-side, only pp math and osu! API calls touch the server.

Live at [retrace-osu.vercel.app](https://retrace-osu.vercel.app).

## What it does

- **Replay analysis**: drop a .osr (beatmap auto-fetched by hash), get UR, timing bias, section/pattern breakdown, key balance and tap style, snap vs flow aim, a miss heatmap, and a strain-vs-UR overlay that tells you whether you're hitting a skill wall or losing focus on easy parts.
- **Replay viewer**: full media player controls, variable speed, frame stepping, keyboard shortcuts, click-to-seek misses, and a ghost overlay to compare two replays of the same map.
- **Coaching**: deterministic strengths/weaknesses/practice from the measured numbers, plus an optional AI review that only ever sees real facts (mod-adjusted stars, real clock rate) so it can't make things up.
- **Farm maps**: profiles your top 100 (real mod combos, comfort star band, aim/speed lean) and recommends maps ranked by actual pp gain to your weighted total, not raw fantasy numbers. Also flags chokes and bad-acc plays worth fixing.
- **Player and country informatics**: look up any username or country, mod-combination picker over someone's top 100, pp milestones, rank history, and a pile of trivia (oldest surviving play, most farmed mapper, closest rivalry, national anthem map, etc).
- **History**: replays you analyze save locally (IndexedDB), with recurring-weakness tracking and per-map progress across attempts.

## Setup

1. Create an OAuth app at https://osu.ppy.sh/home/account/edit (Application Callback URL = `http://localhost:3000/api/auth/callback`).
2. Copy `.env.example` to `.env.local` and fill in the client ID/secret. The AI coach is optional, leave `COACH_API_KEY` empty to skip it.
3. Install and run:

```bash
npm install
npm run dev
```

## Stack

Next.js (App Router, Turbopack) + TypeScript, Tailwind v4. `osu-parsers`/`osu-classes`/`osu-standard-stable` for decoding replays and running the actual ruleset in-browser, `rosu-pp-js` (WASM) server-side for pp and strain calculations. No database, just in-memory + disk caching for the osu! API.
