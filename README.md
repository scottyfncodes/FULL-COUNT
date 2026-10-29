# Full Count

A minimal, live MLB game dashboard. Pick a game and see the score, inning, outs, runners, count,
pitch count and the batter–pitcher matchup at a glance. It's built for the iPhone first.

## Stack

- **Vite + React + TypeScript** single-page app (`src/`)
- **Vercel Functions** (`api/`) proxy the public [MLB Stats API](https://statsapi.mlb.com) and return
  compact, normalized JSON. No API keys or database.
- Fonts are self-hosted via Fontsource (Barlow Condensed, IBM Plex Sans).

```
api/schedule.ts   GET /api/schedule?date=YYYY-MM-DD   → schedule for date±1 (client buckets by local timezone)
api/game.ts       GET /api/game?pk=<gamePk>[&timecode=YYYYMMDD_HHMMSS] → normalized live game snapshot
src/lib/          typed models + parsers (shared by the API and the tests)
src/components/   schedule, scoreboard, diamond, count, matchup, pitch sequence, line score, plays, box score
tests/            Vitest suites against real captured MLB payloads (tests/fixtures)
```

### Routes

- `/` shows today's games in the viewer's timezone, and `/?date=2026-09-27` shows a past or future day.
- `/game/:gamePk` opens the live dashboard.
- `/game/:gamePk?t=YYYYMMDD_HHMMSS` is a replay of MLB's feed as it stood at that moment, labeled "Replay".
  It's handy in the offseason, e.g. `/game/849799?t=20261029_020820` (2026 World Series Game 5, bottom 6th).

## Data and refresh

- The live game polls every 6 s, pregame every 20 s to 2 min, and the schedule every 20 s to 2 min. A final
  game stops polling.
- Requests never overlap. Polling pauses while the tab is hidden and refreshes as soon as it's visible
  again. Repeated failures back off exponentially (up to 60 s).
- On failure the last good data stays on screen, marked stale, with a Retry button. If MLB's feed
  timestamp stops moving during a live game, the status reads **Delayed data** instead of **Live**.
- The Vercel CDN caches responses briefly (3 s for live games, up to 15 min for past days), so many viewers
  share one upstream request.

The MLB Stats API is public but undocumented and has no SLA. Fields are parsed defensively. A missing
value shows as "—" and is never treated as 0.

## Develop

```bash
npm install
npm test          # parsing + polling tests
npm run lint
npm run build     # typecheck + production build
npm run dev       # UI only; set FULLCOUNT_API=https://<deployment> to proxy /api to a deployed instance
```

Deployment: Vercel builds every push to `main` (framework preset: Vite, functions in `api/`).
