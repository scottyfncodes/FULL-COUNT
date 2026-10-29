import type { GameStatus, InningState, StatusKind } from './types.js';
import { type Json, num, obj, str } from './parse.js';

/**
 * Classify an MLB status object. Important: MLB reports Postponed and Cancelled games with
 * abstractGameState "Final", and Warmup with abstractGameState "Live" — neither is a finished
 * or live game, so we key off codedGameState and detailedState first.
 */
export function classifyStatus(raw: Json): GameStatus {
  const s = obj(raw) ?? {};
  const abstract = str(s.abstractGameState) ?? '';
  const code = str(s.codedGameState) ?? '';
  const detailed = str(s.detailedState) ?? (abstract || 'Unknown');
  const reason = str(s.reason);
  const d = detailed.toLowerCase();

  let kind: StatusKind;
  let inProgress = false;
  if (code === 'D' || d.startsWith('postponed')) kind = 'postponed';
  else if (code === 'C' || d.startsWith('cancel')) kind = 'cancelled';
  else if (code === 'T' || code === 'U' || d.startsWith('suspended')) {
    kind = 'suspended';
    inProgress = true;
  } else if (d.includes('delay')) {
    kind = 'delayed';
    inProgress = !d.includes('delayed start') && (code === 'I' || abstract === 'Live');
  } else if (code === 'F' || code === 'O' || abstract === 'Final') kind = 'final';
  else if (code === 'P' || d === 'warmup' || d === 'pre-game') kind = 'pregame';
  else if (abstract === 'Live') {
    kind = 'live';
    inProgress = true;
  } else if (code === 'S' || abstract === 'Preview') kind = 'scheduled';
  else kind = 'unknown';

  return { kind, detailed, reason, inProgress };
}

export function isActive(status: GameStatus): boolean {
  return status.kind === 'live' || (status.kind === 'delayed' && status.inProgress);
}

export function hasStarted(status: GameStatus): boolean {
  return status.inProgress || status.kind === 'final' || status.kind === 'live';
}

/** Short label for compact UI. */
export function statusShort(status: GameStatus): string {
  switch (status.kind) {
    case 'live':
      return 'Live';
    case 'final':
      return status.detailed === 'Final' || status.detailed === 'Game Over' ? 'Final' : status.detailed;
    case 'postponed':
      return 'Postponed';
    case 'cancelled':
      return 'Cancelled';
    case 'suspended':
      return 'Suspended';
    case 'delayed':
      return status.inProgress ? 'Delayed' : 'Delayed start';
    case 'pregame':
      return status.detailed === 'Warmup' ? 'Warmup' : 'Pregame';
    case 'scheduled':
      return 'Scheduled';
    default:
      return status.detailed;
  }
}

export function parseInning(linescore: Json): InningState | null {
  const ls = obj(linescore);
  if (!ls) return null;
  const n = num(ls.currentInning);
  const half = str(ls.inningHalf) ?? str(ls.inningState);
  if (n == null || !half) return null;
  return {
    number: n,
    half: half.toLowerCase() === 'bottom' ? 'bottom' : 'top',
    state: str(ls.inningState) ?? half,
    ordinal: str(ls.currentInningOrdinal) ?? ordinal(n),
  };
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** True when a half inning is actually being played (not the Middle/End break between halves). */
export function isMidHalf(inning: InningState | null): boolean {
  return !!inning && (inning.state === 'Top' || inning.state === 'Bottom');
}

/** Which label to put on the player stats MLB attaches to a game, by MLB gameType code. */
export function statsLabelFor(gameType: string): string {
  if (['F', 'D', 'L', 'W'].includes(gameType)) return 'Postseason';
  if (gameType === 'S' || gameType === 'E') return 'Spring';
  if (gameType === 'A') return 'All-Star';
  return 'Season';
}
