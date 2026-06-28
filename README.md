# osulytics

Client-side replay analysis and playstyle profiling for osu!.

## Setup

1. Create an OAuth app at https://osu.ppy.sh/home/account/edit (Application Callback URL = `http://localhost:3000/api/auth/callback`).
2. Copy `.env.example` to `.env.local` and fill in the client ID/secret.
3. Install and run:

```bash
npm install
npm run dev
```

## Status

- [x] osu! OAuth sign-in + profile/playstyle (Phase 1)
- [ ] Replay (.osr) + beatmap (.osu) parsing
- [ ] Judgement reconstruction + UR / hit-error
- [ ] In-browser replay viewer + diagnostics
- [ ] Coaching review
