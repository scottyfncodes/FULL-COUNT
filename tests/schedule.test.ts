import { describe, expect, it } from 'vitest';
import { groupGames, groupOf, normalizeSchedule, normalizeScheduleGame } from '../src/lib/schedule';
import { classifyStatus } from '../src/lib/status';
import { clone, fixture } from './helpers';

const day = fixture('schedule-2026-09-27.json'); // real hydrated schedule: finals, an extra-inning game, a cancellation

describe('schedule parsing', () => {
  const games = normalizeSchedule(day);

  it('parses every game with teams and scores', () => {
    expect(games).toHaveLength(15);
    const nym = games.find((g) => g.gamePk === 822679)!;
    expect(nym.away.team).toMatchObject({ abbreviation: 'NYM', teamName: 'Mets', id: 121 });
    expect(nym.home.team.abbreviation).toBe('WSH');
    expect(nym.away.score).toBe(4);
    expect(nym.home.score).toBe(6);
    expect(nym.status.kind).toBe('final');
    expect(nym.inning).toBeNull(); // final games show FINAL, not an inning
    expect(nym.finalInnings).toBeNull();
  });

  it('marks extra-inning finals', () => {
    expect(games.find((g) => g.gamePk === 823164)!.finalInnings).toBe(10);
  });

  it('treats a cancelled game as cancelled, not final, and gives it no score', () => {
    const c = games.find((g) => g.gamePk === 823490)!;
    expect(c.status.kind).toBe('cancelled');
    expect(c.away.score).toBeNull();
    expect(groupOf(c)).toBe('final');
  });

  it('sinks non-completed games below finished ones', () => {
    const { final, live, upcoming } = groupGames(games);
    expect(live).toHaveLength(0);
    expect(upcoming).toHaveLength(0);
    expect(final.at(-1)!.gamePk).toBe(823490);
  });

  it('carries postseason series labels only for postseason games', () => {
    const raw = clone(day.dates[0].games[0]);
    expect(normalizeScheduleGame(raw)!.series).toBeNull();
    raw.gameType = 'W';
    raw.seriesDescription = 'World Series';
    raw.seriesGameNumber = 5;
    expect(normalizeScheduleGame(raw)!.series).toBe('World Series · Game 5');
  });

  it('groups live, upcoming and final with sensible ordering', () => {
    const base = day.dates[0].games[0];
    const mk = (pk: number, status: object, gameDate: string, extra: object = {}) =>
      normalizeScheduleGame({ ...clone(base), gamePk: pk, status, gameDate, ...extra })!;
    const live = { abstractGameState: 'Live', codedGameState: 'I', detailedState: 'In Progress' };
    const pre = { abstractGameState: 'Preview', codedGameState: 'S', detailedState: 'Scheduled' };
    const delayed = { abstractGameState: 'Live', codedGameState: 'I', detailedState: 'Delayed: Rain', reason: 'Rain' };
    const g = groupGames([
      mk(1, pre, '2026-09-27T23:10:00Z'),
      mk(2, live, '2026-09-27T19:10:00Z'),
      mk(3, delayed, '2026-09-27T17:10:00Z'),
      mk(4, pre, '2026-09-27T20:10:00Z'),
      mk(5, live, '2026-09-27T17:05:00Z', { doubleHeader: 'S', gameNumber: 1 }),
    ]);
    expect(g.live.map((x) => x.gamePk)).toEqual([5, 2, 3]);
    expect(g.upcoming.map((x) => x.gamePk)).toEqual([4, 1]);
    expect(g.live[0].doubleHeader).toBe('S');
    expect(g.live[0].inning).toMatchObject({ number: 9 });
  });

  it('returns nothing for an empty offseason day', () => {
    expect(normalizeSchedule({ dates: [] })).toEqual([]);
    expect(normalizeSchedule(null)).toEqual([]);
  });
});

describe('status classification (MLB codes observed in the 2026 season)', () => {
  it.each([
    [{ abstractGameState: 'Final', codedGameState: 'D', detailedState: 'Postponed', reason: 'Rain' }, 'postponed'],
    [{ abstractGameState: 'Final', codedGameState: 'C', detailedState: 'Cancelled' }, 'cancelled'],
    [{ abstractGameState: 'Final', codedGameState: 'F', detailedState: 'Completed Early' }, 'final'],
    [{ abstractGameState: 'Final', codedGameState: 'F', detailedState: 'Final' }, 'final'],
    [{ abstractGameState: 'Live', codedGameState: 'P', detailedState: 'Warmup' }, 'pregame'],
    [{ abstractGameState: 'Preview', codedGameState: 'P', detailedState: 'Pre-Game' }, 'pregame'],
    [{ abstractGameState: 'Preview', codedGameState: 'S', detailedState: 'Scheduled' }, 'scheduled'],
    [{ abstractGameState: 'Live', codedGameState: 'I', detailedState: 'In Progress' }, 'live'],
    [{ abstractGameState: 'Live', codedGameState: 'M', detailedState: 'Manager challenge' }, 'live'],
    [{ abstractGameState: 'Live', codedGameState: 'I', detailedState: 'Delayed: Rain' }, 'delayed'],
    [{ abstractGameState: 'Preview', codedGameState: 'P', detailedState: 'Delayed Start: Rain' }, 'delayed'],
    [{ abstractGameState: 'Live', codedGameState: 'T', detailedState: 'Suspended: Rain' }, 'suspended'],
  ])('%o → %s', (raw, kind) => {
    expect(classifyStatus(raw).kind).toBe(kind);
  });

  it('distinguishes a mid-game delay from a delayed start', () => {
    expect(classifyStatus({ abstractGameState: 'Live', codedGameState: 'I', detailedState: 'Delayed: Rain' }).inProgress).toBe(true);
    expect(classifyStatus({ abstractGameState: 'Preview', codedGameState: 'P', detailedState: 'Delayed Start: Rain' }).inProgress).toBe(false);
  });
});
