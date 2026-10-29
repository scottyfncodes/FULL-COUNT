# Fixtures

Real MLB Stats API responses (statsapi.mlb.com), captured through this app's server-side proxy on 2026-10-29.
They are trimmed only by removing unused keys (hot/cold zone data, non-matchup players in live snapshots,
and pitch events from older plays in the final-game feed); the structure is unchanged.

| File | Source |
| --- | --- |
| `schedule-2026-09-27.json` | `/api/v1/schedule?sportId=1&date=2026-09-27&hydrate=linescore,team,probablePitcher,seriesStatus` — 14 finals (one in 10 innings) and one cancellation |
| `feed-live-b6-noRunners.json` | `/api/v1.1/game/849799/feed/live?timecode=20261029_020820` — 2026 World Series Game 5, bottom 6th, 1-2 count |
| `feed-live-runners.json` | `/api/v1.1/game/849799/feed/live?timecode=20261029_014812` — same game, top 6th, runners on 1st and 3rd, pitching change |
| `feed-final-extras.json` | `/api/v1.1/game/823164/feed/live` — Dodgers at Giants, 2026-09-27, final in 10 innings |
