import type {
  Bases,
  BatterGameLine,
  BatterInfo,
  BatterSeasonLine,
  BoxBatter,
  BoxPitcher,
  GameSnapshot,
  LineScoreInning,
  Pitch,
  PitcherGameLine,
  PitcherInfo,
  PitcherSeasonLine,
  PlateAppearance,
  Play,
  PlayerRef,
  TeamBox,
  TeamTotals,
} from './types.js';
import { type Json, arr, feedTimestampToIso, num, obj, rate, str } from './parse.js';
import { classifyStatus, hasStarted, isActive, isMidHalf, parseInning, statsLabelFor } from './status.js';
import { parseTeam } from './team.js';

const GAME_LABELS: Record<string, string> = {
  F: 'Wild Card',
  D: 'Division Series',
  L: 'League Championship Series',
  W: 'World Series',
  S: 'Spring Training',
  E: 'Exhibition',
  A: 'All-Star Game',
};

function ref(raw: Json): PlayerRef | null {
  const r = obj(raw);
  const id = num(r?.id);
  if (id == null) return null;
  return { id, name: str(r.fullName) ?? str(r.name) ?? 'Unknown player' };
}

function nonEmpty(o: Json): Json | null {
  const v = obj(o);
  return v && Object.keys(v).length > 0 ? v : null;
}

export function batterGame(raw: Json): BatterGameLine | null {
  const b = nonEmpty(raw);
  if (!b) return null;
  return {
    atBats: num(b.atBats),
    hits: num(b.hits),
    runs: num(b.runs),
    rbi: num(b.rbi),
    homeRuns: num(b.homeRuns),
    walks: num(b.baseOnBalls),
    strikeOuts: num(b.strikeOuts),
    summary: str(b.summary),
  };
}

export function batterSeason(raw: Json): BatterSeasonLine | null {
  const b = nonEmpty(raw);
  if (!b) return null;
  return {
    avg: rate(b.avg),
    obp: rate(b.obp),
    slg: rate(b.slg),
    ops: rate(b.ops),
    homeRuns: num(b.homeRuns),
    rbi: num(b.rbi),
  };
}

export function pitcherGame(raw: Json): PitcherGameLine | null {
  const p = nonEmpty(raw);
  if (!p) return null;
  return {
    inningsPitched: str(p.inningsPitched),
    hits: num(p.hits),
    runs: num(p.runs),
    earnedRuns: num(p.earnedRuns),
    walks: num(p.baseOnBalls),
    strikeOuts: num(p.strikeOuts),
    homeRuns: num(p.homeRuns),
    // Total pitches thrown. Never substitute strikes for this.
    pitches: num(p.numberOfPitches) ?? num(p.pitchesThrown),
    strikes: num(p.strikes),
    balls: num(p.balls),
  };
}

export function pitcherSeason(raw: Json): PitcherSeasonLine | null {
  const p = nonEmpty(raw);
  if (!p) return null;
  return {
    era: rate(p.era),
    wins: num(p.wins),
    losses: num(p.losses),
    inningsPitched: str(p.inningsPitched),
    strikeOuts: num(p.strikeOuts),
    whip: rate(p.whip),
  };
}

function parsePitch(ev: Json): Pitch | null {
  if (ev?.isPitch !== true) return null;
  const d = obj(ev.details) ?? {};
  const call = obj(d.call);
  const type = obj(d.type);
  const n = num(ev.pitchNumber);
  if (n == null) return null;
  const kind: Pitch['kind'] = d.isInPlay ? 'inplay' : d.isBall ? 'ball' : d.isStrike ? 'strike' : 'other';
  const c = obj(ev.count);
  const balls = num(c?.balls);
  const strikes = num(c?.strikes);
  return {
    number: n,
    call: str(call?.description) ?? str(d.description) ?? 'Pitch',
    code: str(call?.code) ?? str(d.code),
    kind,
    pitchType: str(type?.description),
    pitchTypeCode: str(type?.code),
    speed: num(obj(ev.pitchData)?.startSpeed),
    countAfter: balls != null && strikes != null ? { balls, strikes } : null,
  };
}

function parsePlay(p: Json): Play | null {
  const result = obj(p?.result) ?? {};
  const about = obj(p?.about) ?? {};
  if (str(result.eventType) === 'game_advisory') return null;
  const idx = num(about.atBatIndex);
  const inning = num(about.inning);
  if (idx == null || inning == null) return null;
  const matchup = obj(p.matchup) ?? {};
  const complete = about.isComplete === true;
  return {
    atBatIndex: idx,
    inning,
    half: about.isTopInning === false || str(about.halfInning) === 'bottom' ? 'bottom' : 'top',
    batter: ref(matchup.batter)?.name ?? null,
    pitcher: ref(matchup.pitcher)?.name ?? null,
    // An unfinished plate appearance carries the last in-progress event text (e.g. "Mound Visit."),
    // which is not the play's result.
    event: complete ? str(result.event) : null,
    description: complete ? str(result.description) : null,
    isScoring: complete && about.isScoringPlay === true,
    isOut: complete && result.isOut === true,
    isComplete: complete,
    rbi: num(result.rbi),
    awayScore: num(result.awayScore),
    homeScore: num(result.homeScore),
    outs: num(obj(p.count)?.outs),
  };
}

function totals(raw: Json, started: boolean): TeamTotals {
  const t = obj(raw) ?? {};
  return started
    ? { runs: num(t.runs), hits: num(t.hits), errors: num(t.errors), leftOnBase: num(t.leftOnBase) }
    : { runs: null, hits: null, errors: null, leftOnBase: null };
}

function teamBox(raw: Json): TeamBox {
  const t = obj(raw) ?? {};
  const players = obj(t.players) ?? {};
  const batters: BoxBatter[] = [];
  for (const p of Object.values<Json>(players)) {
    const order = num(p?.battingOrder);
    const person = ref(p?.person);
    if (order == null || !person) continue;
    batters.push({
      ...person,
      position: str(obj(p.position)?.abbreviation),
      battingOrder: order,
      isSubstitute: order % 100 !== 0,
      game: batterGame(obj(p.stats)?.batting) ?? emptyBatterGame(),
      season: batterSeason(obj(p.seasonStats)?.batting),
    });
  }
  batters.sort((a, b) => (a.battingOrder ?? 0) - (b.battingOrder ?? 0));

  const pitchers: BoxPitcher[] = [];
  for (const id of arr(t.pitchers)) {
    const p = players[`ID${id}`];
    const person = ref(p?.person);
    if (!person) continue;
    pitchers.push({
      ...person,
      game: pitcherGame(obj(p.stats)?.pitching) ?? emptyPitcherGame(),
      season: pitcherSeason(obj(p.seasonStats)?.pitching),
      note: str(obj(obj(p.stats)?.pitching)?.note),
    });
  }
  const bt = obj(obj(t.teamStats)?.batting) ?? {};
  return {
    batters,
    pitchers,
    totals: {
      atBats: num(bt.atBats),
      runs: num(bt.runs),
      hits: num(bt.hits),
      rbi: num(bt.rbi),
      walks: num(bt.baseOnBalls),
      strikeOuts: num(bt.strikeOuts),
    },
  };
}

const emptyBatterGame = (): BatterGameLine => ({
  atBats: null, hits: null, runs: null, rbi: null, homeRuns: null, walks: null, strikeOuts: null, summary: null,
});
const emptyPitcherGame = (): PitcherGameLine => ({
  inningsPitched: null, hits: null, runs: null, earnedRuns: null, walks: null, strikeOuts: null, homeRuns: null,
  pitches: null, strikes: null, balls: null,
});

export function normalizeGame(raw: Json, fetchedAt = new Date().toISOString()): GameSnapshot {
  const root = obj(raw);
  if (!root || !obj(root.gameData) || !obj(root.liveData)) throw new Error('Malformed game feed');
  const gd = root.gameData;
  const ld = root.liveData;
  const ls = obj(ld.linescore) ?? {};
  const bx = obj(ld.boxscore);
  const gameType = str(obj(gd.game)?.type) ?? 'R';
  const status = classifyStatus(gd.status);
  const started = hasStarted(status);
  const active = isActive(status);
  const inning = started ? parseInning(ls) : null;
  const playing = active && isMidHalf(inning);

  const players = obj(gd.players) ?? {};
  const boxPlayer = (id: number): Json | null =>
    obj(bx?.teams?.away?.players?.[`ID${id}`]) ?? obj(bx?.teams?.home?.players?.[`ID${id}`]);

  const offense = obj(ls.offense) ?? {};
  const defense = obj(ls.defense) ?? {};
  const emptyBases: Bases = { first: null, second: null, third: null };
  // Structured runner data only, and only while a half inning is in play.
  const bases: Bases = playing
    ? { first: ref(offense.first), second: ref(offense.second), third: ref(offense.third) }
    : emptyBases;

  // Current plate appearance: must belong to the half inning being played.
  const cp = obj(obj(ld.plays)?.currentPlay);
  const cpAbout = obj(cp?.about) ?? {};
  const cpBelongs =
    playing &&
    !!cp &&
    num(cpAbout.inning) === inning?.number &&
    (cpAbout.isTopInning === true ? 'top' : 'bottom') === inning?.half &&
    str(obj(cp.result)?.eventType) !== 'game_advisory';

  let plateAppearance: PlateAppearance | null = null;
  if (cpBelongs && cp) {
    const complete = cpAbout.isComplete === true;
    const c = obj(cp.count) ?? {};
    const balls = num(c.balls);
    const strikes = num(c.strikes);
    plateAppearance = {
      atBatIndex: num(cpAbout.atBatIndex) ?? -1,
      batter: ref(obj(cp.matchup)?.batter),
      count:
        !complete && balls != null && strikes != null
          ? { balls: Math.min(Math.max(balls, 0), 3), strikes: Math.min(Math.max(strikes, 0), 2) }
          : null,
      pitches: arr(cp.playEvents).map(parsePitch).filter((p): p is Pitch => p !== null),
      isComplete: complete,
    };
  }

  const cpIncomplete = plateAppearance && !plateAppearance.isComplete;
  const batterRef = playing
    ? (cpIncomplete ? ref(obj(cp?.matchup)?.batter) : null) ?? ref(offense.batter)
    : null;
  const pitcherRef = playing ? ref(defense.pitcher) ?? ref(obj(cp?.matchup)?.pitcher) : null;

  let batter: BatterInfo | null = null;
  if (batterRef) {
    const bp = boxPlayer(batterRef.id);
    const side =
      str(obj(players[`ID${batterRef.id}`]?.batSide)?.code) ??
      (cpIncomplete && ref(cp?.matchup?.batter)?.id === batterRef.id ? str(obj(cp?.matchup?.batSide)?.code) : null);
    batter = {
      ...batterRef,
      batSide: side,
      position: str(obj(bp?.position)?.abbreviation),
      game: batterGame(obj(bp?.stats)?.batting),
      season: batterSeason(obj(bp?.seasonStats)?.batting),
    };
  }

  let pitcher: PitcherInfo | null = null;
  if (pitcherRef) {
    const pp = boxPlayer(pitcherRef.id);
    const hand =
      str(obj(players[`ID${pitcherRef.id}`]?.pitchHand)?.code) ??
      (ref(cp?.matchup?.pitcher)?.id === pitcherRef.id ? str(obj(cp?.matchup?.pitchHand)?.code) : null);
    pitcher = {
      ...pitcherRef,
      pitchHand: hand,
      game: pitcherGame(obj(pp?.stats)?.pitching),
      season: pitcherSeason(obj(pp?.seasonStats)?.pitching),
    };
  }

  const innings: LineScoreInning[] = arr(ls.innings)
    .map((i: Json) => {
      const n = num(i?.num);
      if (n == null) return null;
      const side = (s: Json) => ({ runs: num(s?.runs), hits: num(s?.hits), errors: num(s?.errors) });
      return { num: n, away: side(i.away), home: side(i.home) };
    })
    .filter((x): x is LineScoreInning => x !== null);

  const plays = arr(obj(ld.plays)?.allPlays)
    .map(parsePlay)
    .filter((p): p is Play => p !== null && (p.isComplete || active));

  const dec = obj(ld.decisions);
  const probable = obj(gd.probablePitchers) ?? {};
  const meta = obj(root.metaData) ?? {};
  const venue = obj(gd.venue);

  return {
    gamePk: num(root.gamePk) ?? num(obj(gd.game)?.pk) ?? 0,
    gameType,
    statsLabel: statsLabelFor(gameType),
    updatedAt: feedTimestampToIso(meta.timeStamp),
    recommendedWait: num(meta.wait),
    fetchedAt,
    status,
    startTime: str(obj(gd.datetime)?.dateTime),
    venue: str(venue?.name),
    gameLabel: GAME_LABELS[gameType] ?? null,
    away: {
      team: parseTeam(gd.teams?.away),
      totals: totals(obj(ls.teams)?.away, started),
      probablePitcher: str(obj(probable.away)?.fullName),
    },
    home: {
      team: parseTeam(gd.teams?.home),
      totals: totals(obj(ls.teams)?.home, started),
      probablePitcher: str(obj(probable.home)?.fullName),
    },
    inning,
    battingSide: playing && inning ? (inning.half === 'top' ? 'away' : 'home') : null,
    outs: playing ? num(ls.outs) : null,
    bases,
    batter,
    pitcher,
    onDeck: playing ? ref(offense.onDeck) : null,
    plateAppearance,
    scheduledInnings: num(ls.scheduledInnings) ?? 9,
    innings,
    plays,
    box: bx ? { away: teamBox(bx.teams?.away), home: teamBox(bx.teams?.home) } : null,
    decisions: dec
      ? { winner: ref(dec.winner)?.name ?? null, loser: ref(dec.loser)?.name ?? null, save: ref(dec.save)?.name ?? null }
      : null,
  };
}
