import { useEffect, useState } from 'react';
import { fetchGame } from '../lib/client';
import { formatDateLong, formatTime } from '../lib/dates';
import { isActive, statusShort } from '../lib/status';
import type { GameSnapshot } from '../lib/types';
import { usePoll } from '../hooks/usePoll';
import { HalfArrow, TeamMark } from './bits';
import { Situation } from './Situation';
import { Matchup } from './Matchup';
import { PitchSequence } from './PitchSequence';
import { LineScore } from './LineScore';
import { Plays } from './Plays';
import { BoxScore } from './BoxScore';

const FEED_DELAY_MS = 4 * 60_000;

export function gameInterval(g: GameSnapshot, replay: boolean): number | null {
  if (replay) return null;
  switch (g.status.kind) {
    case 'live':
      return 6_000;
    case 'delayed':
      return g.status.inProgress ? 15_000 : 30_000;
    case 'pregame':
      return 20_000;
    case 'scheduled': {
      const t = g.startTime ? new Date(g.startTime).getTime() - Date.now() : Infinity;
      return t < 30 * 60_000 ? 30_000 : 120_000;
    }
    default:
      return null; // final, postponed, cancelled, suspended: nothing left to poll for
  }
}

/** A value that bumps whenever `v` changes after the first render; used to replay a brief highlight. */
function useFlash(v: unknown): number {
  const [s, setS] = useState({ v, n: 0 });
  if (s.v !== v) setS({ v, n: s.n + 1 });
  return s.n;
}

export function GameView({ pk, timecode, onTitle }: { pk: number; timecode: string | null; onTitle: (t: TopbarInfo | null) => void }) {
  const replay = timecode != null;
  const poll = usePoll<GameSnapshot>({
    key: `${pk}-${timecode ?? ''}`,
    fetcher: (s) => fetchGame(pk, timecode, s),
    interval: (g) => gameInterval(g, replay),
    isSame: (a, b) => a.updatedAt != null && a.updatedAt === b.updatedAt && a.status.detailed === b.status.detailed,
  });
  const g = poll.data;
  const [boxOpen, setBoxOpen] = useState(false);

  const feedAge = g?.updatedAt ? poll.now - new Date(g.updatedAt).getTime() : null;
  const feedBehind = !replay && g?.status.kind === 'live' && feedAge != null && feedAge > FEED_DELAY_MS;

  const tag: TopbarInfo['tag'] | null = !g
    ? null
    : replay
      ? { text: 'Replay', tone: 'warn' }
      : g.status.kind === 'live'
        ? poll.stale || feedBehind
          ? { text: 'Delayed data', tone: 'warn' }
          : { text: 'Live', tone: 'live' }
        : g.status.kind === 'final'
          ? { text: 'Final', tone: 'final' }
          : ['delayed', 'suspended', 'postponed', 'cancelled'].includes(g.status.kind)
            ? { text: statusShort(g.status), tone: 'warn' }
            : { text: statusShort(g.status), tone: 'plain' };

  useEffect(() => {
    if (!g) return onTitle(null);
    onTitle({ tag: tag!, label: g.gameLabel });
    document.title = `${g.away.team.abbreviation} ${g.away.totals.runs ?? ''}–${g.home.totals.runs ?? ''} ${g.home.team.abbreviation} · Full Count`.replace(' – ', ' @ ');
  }, [g, tag?.text, tag?.tone]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    document.title = 'Full Count';
    onTitle(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!g) {
    if (poll.loading) return <GameSkeleton />;
    return (
      <div className="error-state" role="alert">
        <h2>Game unavailable</h2>
        <p>{poll.error ?? 'This game could not be loaded.'}</p>
        <button className="btn" onClick={poll.refresh}>
          Try again
        </button>
      </div>
    );
  }

  const inProgress = isActive(g.status) || g.status.kind === 'suspended';
  const showMatchup = isActive(g.status) && (g.batter || g.pitcher);

  return (
    <div className="game-grid">
      <div className="col-wide">
        <Scoreboard g={g} />
        <BoardMeta g={g} stale={poll.stale} error={poll.error} onRetry={poll.refresh} replay={replay} feedBehind={feedBehind} />
      </div>

      <div className="col-main">
        {inProgress && <Situation g={g} />}
        {showMatchup && <Matchup g={g} onOpenStats={() => setBoxOpen(true)} />}
        {!inProgress && <Summary g={g} />}
        {isActive(g.status) && g.plateAppearance && <PitchSequence pa={g.plateAppearance} />}
      </div>

      <div className="col-side">
        <LineScore g={g} />
        <Plays g={g} />
        {g.box && (
          <div style={{ paddingTop: 12 }}>
            <button className="btn" style={{ width: '100%' }} onClick={() => setBoxOpen(true)}>
              Box score
            </button>
          </div>
        )}
      </div>

      {g.box && <BoxScore g={g} open={boxOpen} onClose={() => setBoxOpen(false)} />}
    </div>
  );
}

export interface TopbarInfo {
  tag: { text: string; tone: 'live' | 'warn' | 'final' | 'plain' };
  label: string | null;
}

function Scoreboard({ g }: { g: GameSnapshot }) {
  const final = g.status.kind === 'final';
  const awayR = g.away.totals.runs;
  const homeR = g.home.totals.runs;
  const awayFlash = useFlash(awayR);
  const homeFlash = useFlash(homeR);
  const loser = (side: 'away' | 'home') =>
    final && awayR != null && homeR != null && (side === 'away' ? awayR < homeR : homeR < awayR);

  const side = (s: 'away' | 'home', flash: number) => {
    const t = g[s].team;
    const r = g[s].totals.runs;
    return (
      <div className={`board-team board-team--${s}`}>
        <div className="board-id">
          <span className="board-abbr">
            <TeamMark team={t} size={30} />
            {t.abbreviation}
          </span>
          <span className="board-name">{t.teamName}</span>
          {g.battingSide === s && <span className="at-bat">At bat</span>}
        </div>
        <span
          key={flash}
          className={`board-score num${flash ? ' tick' : ''}${loser(s) ? ' is-loser' : ''}${r == null ? ' is-empty' : ''}`}
          aria-label={r == null ? `${t.name}, no score yet` : `${t.name} ${r}`}
        >
          {r ?? '–'}
        </span>
      </div>
    );
  };

  return (
    <section className="board" aria-label="Scoreboard">
      {side('away', awayFlash)}
      <div className="board-center">
        <BoardCenter g={g} />
      </div>
      {side('home', homeFlash)}
    </section>
  );
}

function BoardCenter({ g }: { g: GameSnapshot }) {
  const k = g.status.kind;
  if (k === 'final') {
    const n = g.innings.length;
    return (
      <>
        <span className="board-inning">{n && n !== g.scheduledInnings ? `F/${n}` : 'Final'}</span>
        {g.status.detailed !== 'Final' && g.status.detailed !== 'Game Over' && <span className="board-sub">{g.status.detailed}</span>}
      </>
    );
  }
  if (g.inning && (isActive(g.status) || k === 'suspended')) {
    const i = g.inning;
    const mid = i.state === 'Middle' || i.state === 'End';
    return (
      <>
        <span className="board-inning" aria-label={`${mid ? i.state : i.half === 'top' ? 'Top' : 'Bottom'} of the ${i.ordinal}`}>
          {mid ? <span style={{ fontSize: 15, color: 'var(--text-2)' }}>{i.state === 'Middle' ? 'Mid' : 'End'}</span> : <HalfArrow half={i.half} size={12} />}
          {i.ordinal}
        </span>
        <span className="board-sub" style={k !== 'live' ? { color: 'var(--amber)' } : undefined}>
          {k === 'live' ? (mid ? 'Between innings' : `${g.outs ?? '–'} out${g.outs === 1 ? '' : 's'}`) : statusShort(g.status)}
        </span>
      </>
    );
  }
  if (k === 'scheduled' || k === 'pregame' || k === 'delayed') {
    return (
      <>
        <span className="board-inning">{g.startTime ? formatTime(g.startTime) : 'TBD'}</span>
        <span className="board-sub" style={k === 'delayed' ? { color: 'var(--amber)' } : undefined}>
          {statusShort(g.status)}
        </span>
      </>
    );
  }
  return (
    <>
      <span className="board-inning" style={{ fontSize: 18, color: 'var(--amber)' }}>
        {statusShort(g.status)}
      </span>
      {g.status.reason && <span className="board-sub">{g.status.reason}</span>}
    </>
  );
}

function BoardMeta({
  g,
  stale,
  error,
  onRetry,
  replay,
  feedBehind,
}: {
  g: GameSnapshot;
  stale: boolean;
  error: string | null;
  onRetry: () => void;
  replay: boolean;
  feedBehind: boolean;
}) {
  const updated = g.updatedAt ?? g.fetchedAt;
  const time = new Date(updated).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  let left: React.ReactNode;
  if (replay) left = <span className="warn">Replay of the MLB feed as of {time}</span>;
  else if (stale)
    left = (
      <span className="warn" role="status">
        {error ? 'Connection lost. ' : 'Refresh delayed. '}Last update {time}.{' '}
        <button onClick={onRetry}>Retry</button>
      </span>
    );
  else if (feedBehind) left = <span className="warn">MLB feed last changed at {time}</span>;
  else left = <span>{isActive(g.status) ? `Updated ${time}` : g.venue ?? ''}</span>;
  const right = g.gameLabel ?? (g.startTime && !isActive(g.status) ? formatDateLong(g.startTime.slice(0, 10)) : g.venue);
  return (
    <div className="board-meta">
      {left}
      <span style={{ textAlign: 'right' }}>{right}</span>
    </div>
  );
}

function Summary({ g }: { g: GameSnapshot }) {
  const k = g.status.kind;
  const rows: Array<[string, React.ReactNode]> = [];
  if (k === 'final' && g.decisions) {
    if (g.decisions.winner) rows.push(['Win', g.decisions.winner]);
    if (g.decisions.loser) rows.push(['Loss', g.decisions.loser]);
    if (g.decisions.save) rows.push(['Save', g.decisions.save]);
  }
  if (k === 'scheduled' || k === 'pregame' || (k === 'delayed' && !g.status.inProgress)) {
    rows.push([
      'Probables',
      g.away.probablePitcher || g.home.probablePitcher ? (
        <span>
          {g.away.probablePitcher ?? 'TBD'} <span className="muted">vs</span> {g.home.probablePitcher ?? 'TBD'}
        </span>
      ) : (
        <span className="muted">Not announced</span>
      ),
    ]);
  }
  if (g.venue && k !== 'final') rows.push(['Venue', g.venue]);

  let headline: string | null = null;
  let sub: string | null = null;
  if (k === 'scheduled' || k === 'pregame') {
    headline = g.startTime ? `First pitch ${formatTime(g.startTime)}` : 'Start time TBD';
    sub = g.startTime ? formatDateLong(localYmd(g.startTime)) : null;
  } else if (k === 'postponed' || k === 'cancelled' || k === 'delayed') {
    headline = g.status.detailed;
    sub = g.status.reason;
  }

  return (
    <>
      {headline && (
        <div className="summary-big">
          <div className="t">{headline}</div>
          {sub && <p>{sub}</p>}
        </div>
      )}
      {rows.length > 0 && (
        <div className="summary">
          {rows.map(([k2, v]) => (
            <div className="summary-row" key={k2}>
              <span className="label" style={{ paddingTop: 2 }}>
                {k2}
              </span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function localYmd(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function GameSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading game">
      <div className="board">
        <span className="skel" style={{ height: 64, width: '80%' }} />
        <span className="skel" style={{ height: 24, width: 56 }} />
        <span className="skel" style={{ height: 64, width: '80%', justifySelf: 'end' }} />
      </div>
      <div className="situation">
        <span />
        <span />
        <span />
      </div>
      <div style={{ padding: '16px 0' }}>
        <span className="skel" style={{ display: 'block', height: 18, width: '60%', marginBottom: 10 }} />
        <span className="skel" style={{ display: 'block', height: 14, width: '80%' }} />
      </div>
    </div>
  );
}
