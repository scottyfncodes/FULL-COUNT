// Normalized application models. UI components render these and never touch raw MLB payloads.

export type StatusKind =
  | 'scheduled' // not started, no pregame activity yet
  | 'pregame' // pre-game / warmup: still not live
  | 'live'
  | 'delayed' // a delay, either before first pitch or mid-game
  | 'suspended'
  | 'final'
  | 'postponed'
  | 'cancelled'
  | 'unknown';

export interface GameStatus {
  kind: StatusKind;
  /** MLB's human-readable state, e.g. "In Progress", "Delayed: Rain", "Completed Early". */
  detailed: string;
  reason: string | null;
  /** True if the game had already started when the delay/suspension happened. */
  inProgress: boolean;
}

export interface Team {
  id: number;
  name: string; // "Milwaukee Brewers"
  abbreviation: string; // "MIL"
  teamName: string; // "Brewers"
  record: { wins: number; losses: number } | null;
}

export type Half = 'top' | 'bottom';

export interface InningState {
  number: number;
  half: Half;
  /** "Top" | "Middle" | "Bottom" | "End" */
  state: string;
  ordinal: string; // "6th"
}

export interface ScheduleGame {
  /** Unique per schedule entry (a resumed suspended game appears on two dates). */
  key: string;
  gamePk: number;
  gameType: string;
  startTime: string; // ISO
  startTimeTBD: boolean;
  officialDate: string;
  status: GameStatus;
  away: ScheduleSide;
  home: ScheduleSide;
  inning: InningState | null;
  outs: number | null;
  /** Occupied bases while a half inning is in play; null otherwise. */
  bases: { first: boolean; second: boolean; third: boolean } | null;
  /** Innings played when a final game ran longer or shorter than scheduled (F/10, F/7). */
  finalInnings: number | null;
  doubleHeader: 'N' | 'Y' | 'S';
  gameNumber: number;
  series: string | null; // "World Series · Game 5"
  seriesStatus: string | null; // "MIL wins 4-1"
  venue: string | null;
  resumeDate: string | null;
  rescheduleDate: string | null;
}

export interface ScheduleSide {
  team: Team;
  score: number | null;
  isWinner: boolean | null;
  probablePitcher: string | null;
}

export interface ScheduleResponse {
  date: string; // requested date
  games: ScheduleGame[]; // covers date-1..date+1 so the client can bucket by local timezone
  prevGameDate: string | null; // only filled when the window has no games
  nextGameDate: string | null;
  fetchedAt: string;
}

export interface PlayerRef {
  id: number;
  name: string;
}

export interface BatterGameLine {
  atBats: number | null;
  hits: number | null;
  runs: number | null;
  rbi: number | null;
  homeRuns: number | null;
  walks: number | null;
  strikeOuts: number | null;
  summary: string | null; // MLB's own e.g. "1-3 | HR, 2 RBI"
}

export interface BatterSeasonLine {
  avg: string | null;
  obp: string | null;
  slg: string | null;
  ops: string | null;
  homeRuns: number | null;
  rbi: number | null;
}

export interface PitcherGameLine {
  inningsPitched: string | null;
  hits: number | null;
  runs: number | null;
  earnedRuns: number | null;
  walks: number | null;
  strikeOuts: number | null;
  homeRuns: number | null;
  pitches: number | null; // total pitches thrown
  strikes: number | null;
  balls: number | null;
}

export interface PitcherSeasonLine {
  era: string | null;
  wins: number | null;
  losses: number | null;
  inningsPitched: string | null;
  strikeOuts: number | null;
  whip: string | null;
}

export interface BatterInfo extends PlayerRef {
  batSide: string | null; // "L" | "R" | "S"
  position: string | null;
  game: BatterGameLine | null;
  season: BatterSeasonLine | null;
}

export interface PitcherInfo extends PlayerRef {
  pitchHand: string | null;
  game: PitcherGameLine | null;
  season: PitcherSeasonLine | null;
}

export interface Pitch {
  number: number;
  call: string; // "Called Strike", "Ball", "In play, out(s)"
  code: string | null;
  kind: 'ball' | 'strike' | 'inplay' | 'other';
  pitchType: string | null; // "Four-Seam Fastball"
  pitchTypeCode: string | null; // "FF"
  speed: number | null; // mph, release speed
  countAfter: { balls: number; strikes: number } | null;
}

export interface PlateAppearance {
  atBatIndex: number;
  batter: PlayerRef | null;
  /** Count for this plate appearance only. Null when there is no active plate appearance. */
  count: { balls: number; strikes: number } | null;
  pitches: Pitch[];
  isComplete: boolean;
}

export interface Bases {
  first: PlayerRef | null;
  second: PlayerRef | null;
  third: PlayerRef | null;
}

export interface LineScoreInning {
  num: number;
  away: { runs: number | null; hits: number | null; errors: number | null };
  home: { runs: number | null; hits: number | null; errors: number | null };
}

export interface TeamTotals {
  runs: number | null;
  hits: number | null;
  errors: number | null;
  leftOnBase: number | null;
}

export interface Play {
  atBatIndex: number;
  inning: number;
  half: Half;
  batter: string | null;
  pitcher: string | null;
  event: string | null; // "Strikeout"
  description: string | null;
  isScoring: boolean;
  isOut: boolean;
  isComplete: boolean;
  rbi: number | null;
  awayScore: number | null;
  homeScore: number | null;
  /** Outs after the play, if supplied. */
  outs: number | null;
}

export interface BoxBatter extends PlayerRef {
  position: string | null;
  battingOrder: number | null; // 100, 101 (substitute), 200 ...
  isSubstitute: boolean;
  game: BatterGameLine;
  season: BatterSeasonLine | null;
}

export interface BoxPitcher extends PlayerRef {
  game: PitcherGameLine;
  season: PitcherSeasonLine | null;
  note: string | null; // "W, 2-0" etc. when supplied
}

export interface TeamBox {
  batters: BoxBatter[];
  pitchers: BoxPitcher[];
  totals: { atBats: number | null; runs: number | null; hits: number | null; rbi: number | null; walks: number | null; strikeOuts: number | null };
}

export interface GameSnapshot {
  gamePk: number;
  gameType: string;
  /** Label for the player "season" stats MLB attaches to this game: regular season, postseason, or spring. */
  statsLabel: string;
  /** Feed timestamp (UTC ISO) from MLB metaData; when the data last changed upstream. */
  updatedAt: string | null;
  /** MLB's recommended polling interval in seconds, if supplied. */
  recommendedWait: number | null;
  fetchedAt: string;
  status: GameStatus;
  startTime: string | null;
  venue: string | null;
  /** "World Series", "Spring Training"... null for ordinary regular-season games. */
  gameLabel: string | null;
  away: { team: Team; totals: TeamTotals; probablePitcher: string | null };
  home: { team: Team; totals: TeamTotals; probablePitcher: string | null };
  inning: InningState | null;
  /** Which side is batting right now, if the game is in an active half inning. */
  battingSide: 'away' | 'home' | null;
  outs: number | null;
  bases: Bases;
  batter: BatterInfo | null;
  pitcher: PitcherInfo | null;
  onDeck: PlayerRef | null;
  plateAppearance: PlateAppearance | null;
  scheduledInnings: number;
  innings: LineScoreInning[];
  plays: Play[]; // chronological
  box: { away: TeamBox; home: TeamBox } | null;
  decisions: { winner: string | null; loser: string | null; save: string | null } | null;
}
