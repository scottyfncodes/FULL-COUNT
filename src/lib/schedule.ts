import type { ScheduleGame, ScheduleSide } from './types.js';
import { type Json, arr, num, obj, str } from './parse.js';
import { classifyStatus, hasStarted, isActive, isMidHalf, parseInning } from './status.js';
import { parseTeam } from './team.js';

const POSTSEASON = ['F', 'D', 'L', 'W'];

function parseSide(raw: Json, started: boolean): ScheduleSide {
  const s = obj(raw) ?? {};
  return {
    team: parseTeam(s.team, s.leagueRecord),
    // A score of 0 before first pitch is not a real score.
    score: started ? num(s.score) : null,
    isWinner: typeof s.isWinner === 'boolean' ? s.isWinner : null,
    probablePitcher: str(obj(s.probablePitcher)?.fullName),
  };
}

export function seriesLabel(g: Json): string | null {
  const type = str(g.gameType) ?? '';
  if (!POSTSEASON.includes(type)) return null;
  const desc = str(g.seriesDescription);
  const n = num(g.seriesGameNumber);
  if (!desc) return null;
  return n ? `${desc} · Game ${n}` : desc;
}

export function normalizeScheduleGame(g: Json): ScheduleGame | null {
  const gamePk = num(g?.gamePk);
  if (gamePk == null) return null;
  const status = classifyStatus(g.status);
  const started = hasStarted(status);
  const ls = obj(g.linescore);
  const active = isActive(status) || status.kind === 'suspended';
  const officialDate = str(g.officialDate) ?? '';
  const dh = str(g.doubleHeader);
  const seriesStatus = obj(g.seriesStatus);
  const inning = active ? parseInning(ls) : null;
  const off = obj(ls?.offense);
  const playing = isActive(status) && isMidHalf(inning);
  return {
    key: `${gamePk}-${officialDate}`,
    gamePk,
    gameType: str(g.gameType) ?? 'R',
    startTime: str(g.gameDate) ?? '',
    startTimeTBD: obj(g.status)?.startTimeTBD === true,
    officialDate,
    status,
    away: parseSide(obj(g.teams)?.away, started),
    home: parseSide(obj(g.teams)?.home, started),
    inning,
    outs: playing && ls ? num(ls.outs) : null,
    bases: playing ? { first: !!obj(off?.first), second: !!obj(off?.second), third: !!obj(off?.third) } : null,
    finalInnings:
      status.kind === 'final' && num(ls?.currentInning) != null && num(ls?.currentInning) !== (num(ls?.scheduledInnings) ?? 9)
        ? num(ls?.currentInning)
        : null,
    doubleHeader: dh === 'Y' || dh === 'S' ? dh : 'N',
    gameNumber: num(g.gameNumber) ?? 1,
    series: seriesLabel(g),
    seriesStatus: POSTSEASON.includes(str(g.gameType) ?? '') ? str(seriesStatus?.result) : null,
    venue: str(obj(g.venue)?.name),
    resumeDate: str(g.resumeDate),
    rescheduleDate: str(g.rescheduleDate),
  };
}

/** MLB only. Drops anything without a gamePk; keeps every date in the response. */
export function normalizeSchedule(raw: Json): ScheduleGame[] {
  const games: ScheduleGame[] = [];
  for (const d of arr(obj(raw)?.dates)) {
    for (const g of arr(d?.games)) {
      const n = normalizeScheduleGame(g);
      if (n) games.push(n);
    }
  }
  return games;
}

export type GroupName = 'live' | 'upcoming' | 'final';

export function groupOf(g: ScheduleGame): GroupName {
  const k = g.status.kind;
  if (k === 'live' || (k === 'delayed' && g.status.inProgress)) return 'live';
  if (k === 'scheduled' || k === 'pregame' || k === 'delayed') return 'upcoming';
  return 'final';
}

const byStart = (a: ScheduleGame, b: ScheduleGame) =>
  a.startTime.localeCompare(b.startTime) || a.gameNumber - b.gameNumber || a.gamePk - b.gamePk;

// Postponed / cancelled / suspended games sink below games that actually finished.
const finalRank = (g: ScheduleGame) => (g.status.kind === 'final' ? 0 : 1);

export function groupGames(games: ScheduleGame[]): Record<GroupName, ScheduleGame[]> {
  const out: Record<GroupName, ScheduleGame[]> = { live: [], upcoming: [], final: [] };
  for (const g of games) out[groupOf(g)].push(g);
  // Live: games actively being played first, then delays; each chronologically.
  out.live.sort((a, b) => Number(a.status.kind !== 'live') - Number(b.status.kind !== 'live') || byStart(a, b));
  out.upcoming.sort(byStart);
  out.final.sort((a, b) => finalRank(a) - finalRank(b) || byStart(a, b));
  return out;
}
