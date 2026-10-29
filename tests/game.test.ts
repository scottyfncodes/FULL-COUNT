import { describe, expect, it } from 'vitest';
import { normalizeGame } from '../src/lib/game';
import { clone, fixture } from './helpers';

const liveNoRunners = fixture('feed-live-b6-noRunners.json'); // 2026 WS G5, bottom 6th, 1-2 count
const liveRunners = fixture('feed-live-runners.json'); // 2026 WS G5, top 6th, runners on 1st & 3rd
const finalExtras = fixture('feed-final-extras.json'); // LAD @ SF 2026-09-27, final in 10

describe('live game: bottom of the 6th', () => {
  const g = normalizeGame(liveNoRunners);

  it('reads status, inning, half and outs', () => {
    expect(g.status.kind).toBe('live');
    expect(g.inning).toMatchObject({ number: 6, half: 'bottom', ordinal: '6th' });
    expect(g.outs).toBe(0);
    expect(g.battingSide).toBe('home');
  });

  it('reads scores and R/H/E as game totals', () => {
    expect(g.away.team.abbreviation).toBe('MIL');
    expect(g.home.team.abbreviation).toBe('TB');
    expect(g.away.totals).toMatchObject({ runs: 4, hits: 7, errors: 1 });
    expect(g.home.totals).toMatchObject({ runs: 0, hits: 2, errors: 0 });
  });

  it('reads the count of the active plate appearance', () => {
    expect(g.plateAppearance?.count).toEqual({ balls: 1, strikes: 2 });
    expect(g.plateAppearance?.isComplete).toBe(false);
  });

  it('has empty bases from structured runner data', () => {
    expect(g.bases).toEqual({ first: null, second: null, third: null });
  });

  it('builds the pitch sequence from pitches only (not actions like timeouts)', () => {
    const p = g.plateAppearance!.pitches;
    expect(p.map((x) => x.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(p[0]).toMatchObject({ pitchType: 'Four-Seam Fastball', pitchTypeCode: 'FF', speed: 99.8, call: 'Called Strike', kind: 'strike' });
    expect(p[3]).toMatchObject({ kind: 'ball', speed: 100.4 });
    expect(p[5]).toMatchObject({ kind: 'inplay', pitchType: 'Curveball' });
  });

  it('separates batter game stats from season (postseason) stats', () => {
    expect(g.statsLabel).toBe('Postseason');
    expect(g.batter).toMatchObject({ name: 'Jonathan Aranda', batSide: 'L' });
    expect(g.batter?.game).toMatchObject({ atBats: 2, hits: 0, rbi: 0 });
    expect(g.batter?.season).toMatchObject({ avg: '.255', homeRuns: 1, rbi: 5 });
  });

  it('reads the pitcher line, keeping total pitches distinct from strikes', () => {
    expect(g.pitcher).toMatchObject({ name: 'Jacob Misiorowski', pitchHand: 'R' });
    expect(g.pitcher?.game).toMatchObject({
      pitches: 80, strikes: 54, balls: 26, inningsPitched: '5.0', hits: 2, runs: 0, earnedRuns: 0, walks: 1, strikeOuts: 2,
    });
    expect(g.pitcher?.season?.era).toBe('1.96');
  });

  it('reads on-deck batter and feed timestamp', () => {
    expect(g.onDeck?.name).toBe('Junior Caminero');
    expect(g.updatedAt).toBe('2026-10-29T02:08:20Z');
    expect(g.recommendedWait).toBe(10);
  });
});

describe('live game: runners on the corners, new plate appearance', () => {
  const g = normalizeGame(liveRunners);

  it('reads base occupancy', () => {
    expect(g.bases.first?.name).toBe('Brice Turang');
    expect(g.bases.second).toBeNull();
    expect(g.bases.third?.name).toBe('William Contreras');
  });

  it('starts the new batter at 0-0 rather than carrying the previous count', () => {
    expect(g.batter?.name).toBe('Sal Frelick');
    expect(g.plateAppearance?.count).toEqual({ balls: 0, strikes: 0 });
    expect(g.plateAppearance?.pitches).toEqual([]);
    expect(g.battingSide).toBe('away');
  });

  it('lists completed plays chronologically and flags the active one', () => {
    const done = g.plays.filter((p) => p.isComplete);
    expect(done.map((p) => p.atBatIndex)).toEqual([40, 41]);
    expect(done[0]).toMatchObject({ isScoring: true, batter: 'William Contreras', awayScore: 3 });
    const active = g.plays.find((p) => !p.isComplete);
    expect(active).toMatchObject({ atBatIndex: 42, description: null, event: null });
  });

  it('reflects a pitching change: the new pitcher is the current pitcher', () => {
    expect(g.pitcher?.name).toBe('Garrett Cleavinger');
  });
});

describe('final game in extra innings', () => {
  const g = normalizeGame(finalExtras);

  it('is final, with no live count, runners or matchup', () => {
    expect(g.status.kind).toBe('final');
    expect(g.plateAppearance).toBeNull();
    expect(g.batter).toBeNull();
    expect(g.pitcher).toBeNull();
    expect(g.outs).toBeNull();
    expect(g.battingSide).toBeNull();
    expect(g.bases).toEqual({ first: null, second: null, third: null });
  });

  it('keeps all 10 innings of the line score', () => {
    expect(g.innings).toHaveLength(10);
    expect(g.innings.map((i) => i.away.runs)).toEqual([0, 0, 0, 1, 0, 0, 0, 0, 0, 4]);
    expect(g.away.totals.runs).toBe(5);
    expect(g.home.totals.runs).toBe(1);
  });

  it('builds a box score in batting order with substitutes', () => {
    const b = g.box!.away.batters;
    expect(b[0]).toMatchObject({ name: 'Shohei Ohtani', battingOrder: 100, isSubstitute: false });
    expect(b[1]).toMatchObject({ name: 'Dalton Rushing', battingOrder: 101, isSubstitute: true });
    expect(g.box!.home.pitchers.length).toBeGreaterThan(0);
    expect(g.box!.home.totals).toMatchObject({ atBats: 33, hits: 5, strikeOuts: 16 });
    expect(g.statsLabel).toBe('Season');
  });

  it('reads decisions and drops status advisories from plays', () => {
    expect(g.decisions).toMatchObject({ winner: 'Alex Vesia', loser: 'Duncan Davitt', save: null });
    expect(g.plays.every((p) => p.isComplete)).toBe(true);
    expect(g.plays.at(-1)).toMatchObject({ event: 'Strikeout', inning: 10, half: 'bottom' });
  });
});

describe('state transitions and missing data', () => {
  it('shows no count and no runners during the middle of an inning', () => {
    const raw = clone(liveRunners);
    raw.liveData.linescore.inningState = 'Middle';
    const g = normalizeGame(raw);
    expect(g.inning?.state).toBe('Middle');
    expect(g.plateAppearance).toBeNull();
    expect(g.bases.first).toBeNull();
    expect(g.battingSide).toBeNull();
  });

  it('shows no count once the plate appearance is complete, and moves to the next batter', () => {
    const raw = clone(liveNoRunners);
    raw.liveData.plays.currentPlay.about.isComplete = true;
    raw.liveData.linescore.offense.batter = { id: 691406, fullName: 'Junior Caminero' };
    const g = normalizeGame(raw);
    expect(g.plateAppearance?.count).toBeNull();
    expect(g.plateAppearance?.batter?.name).toBe('Jonathan Aranda');
    expect(g.batter?.name).toBe('Junior Caminero');
  });

  it('a new batter replaces the previous matchup', () => {
    const a = normalizeGame(liveNoRunners);
    const raw = clone(liveNoRunners);
    raw.liveData.plays.currentPlay.matchup.batter = { id: 691406, fullName: 'Junior Caminero' };
    raw.liveData.plays.currentPlay.count = { balls: 0, strikes: 0, outs: 1 };
    raw.liveData.plays.currentPlay.playEvents = [];
    const b = normalizeGame(raw);
    expect(a.batter?.name).toBe('Jonathan Aranda');
    expect(b.batter?.name).toBe('Junior Caminero');
    expect(b.plateAppearance?.count).toEqual({ balls: 0, strikes: 0 });
  });

  it('never turns missing stats into zero', () => {
    const raw = clone(liveNoRunners);
    const p = raw.liveData.boxscore.teams.away.players.ID694819;
    delete p.stats.pitching.numberOfPitches;
    delete p.stats.pitching.pitchesThrown;
    p.seasonStats.pitching.era = '-.--';
    delete raw.liveData.boxscore.teams.home.players.ID666018.seasonStats;
    const g = normalizeGame(raw);
    expect(g.pitcher?.game?.pitches).toBeNull();
    expect(g.pitcher?.game?.strikes).toBe(54);
    expect(g.pitcher?.season?.era).toBeNull();
    expect(g.batter?.season).toBeNull();
  });

  it('pregame: no live state, no scores, probable pitchers available', () => {
    const raw = clone(liveNoRunners);
    raw.gameData.status = { abstractGameState: 'Live', codedGameState: 'P', detailedState: 'Warmup', statusCode: 'PW' };
    raw.gameData.probablePitchers = { away: { id: 1, fullName: 'Jacob Misiorowski' }, home: { id: 2, fullName: 'Drew Rasmussen' } };
    const g = normalizeGame(raw);
    expect(g.status.kind).toBe('pregame');
    expect(g.inning).toBeNull();
    expect(g.away.totals.runs).toBeNull();
    expect(g.plateAppearance).toBeNull();
    expect(g.batter).toBeNull();
    expect(g.away.probablePitcher).toBe('Jacob Misiorowski');
  });

  it('rejects malformed feeds', () => {
    expect(() => normalizeGame({})).toThrow();
    expect(() => normalizeGame(null)).toThrow();
  });
});
