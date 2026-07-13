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

## Stack

Next.js (App Router, Turbopack) + TypeScript, Tailwind v4. `osu-parsers`/`osu-classes`/`osu-standard-stable` for decoding replays and running the actual ruleset in-browser, `rosu-pp-js` (WASM) server-side for pp and strain calculations. No database, just in-memory + disk caching for the osu! API.

## Running locally

### Prerequisites

- **Node.js 20.9+** (required by Next.js 16) and npm

### 1. Clone and install

```bash
git clone https://github.com/UltimaCodes/retraceosu.git
cd retraceosu
npm install
```

### 2. Create an osu! OAuth application

The app talks to the osu! API, so you need your own OAuth client:

1. Go to your [osu! account settings](https://osu.ppy.sh/home/account/edit) → **OAuth** → **New OAuth Application**
2. Set the **Application Callback URL** to `http://localhost:3000/api/auth/callback`
3. Copy the **Client ID** and **Client Secret**

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```bash
# Required — from your osu! OAuth application
OSU_CLIENT_ID=your_client_id
OSU_CLIENT_SECRET=your_client_secret
```

Optional variables:

| Variable | Default | Purpose |
|---|---|---|
| `OSU_REDIRECT_URI` | `http://localhost:3000/api/auth/callback` | OAuth callback URL (change for non-local deployments) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Public base URL used in page metadata |
| `COACH_API_KEY` | *(unset)* | API key for the AI coach. If unset, the app falls back to deterministic coaching only |
| `COACH_API_URL` | `https://api.groq.com/openai/v1` | Any OpenAI-compatible chat endpoint (Groq, OpenRouter, xAI, etc.) |
| `COACH_MODEL` | `llama-3.3-70b-versatile` | Model name for the AI coach |

### 4. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). That's it — there's no database to set up. A `.cache/` directory is created automatically for osu! API disk caching (git-ignored).

Other commands:

```bash
npm run build   # production build
npm run start   # serve the production build
npm run lint    # eslint
```