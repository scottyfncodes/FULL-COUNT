import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { fetchSchedule } from '../lib/client';
import { addDays, formatDateLong, formatTime, localDate } from '../lib/dates';
import { groupGames, groupOf, type GroupName } from '../lib/schedule';
import { statusShort } from '../lib/status';
import type { ScheduleGame, ScheduleResponse } from '../lib/types';
import { navigate } from '../router';
import { usePoll } from '../hooks/usePoll';
import { Chevron, Diamond, HalfArrow, Pips, TeamMark, halfLabel } from './bits';

// In-memory cache so returning from a game renders instantly.
const cache = new Map<string, ScheduleResponse>();

function scheduleInterval(date: string, data: ScheduleResponse): number | null {
  const today = localDate();
  if (date < addDays(today, -1)) return null; // the past doesn't change
  const live = data.games.some((g) => groupOf(g) === 'live');
  if (live) return 20_000;
  const soon = data.games.some(
    (g) => groupOf(g) === 'upcoming' && new Date(g.startTime).getTime() - Date.now() < 60 * 60_000,
  );
  return soon ? 30_000 : 120_000;
}

export function ScheduleView({ date: dateParam }: { date: string | null }) {
  const today = localDate();
  const date = dateParam ?? today;
  const poll = usePoll<ScheduleResponse>({
    key: date,
    fetcher: (s) => fetchSchedule(date, s),
    interval: (d) => scheduleInterval(date, d),
    isSame: (a, b) => JSON.stringify(a.games) === JSON.stringify(b.games),
    initial: cache.get(date) ?? null,
  });
  if (poll.data) cache.set(date, poll.data);

  // Games whose first pitch falls on this local date, plus any game from an adjacent MLB date
  // that is still live today.
  const groups = useMemo(() => {
    if (!poll.data) return null;
    const seen = new Set<string>();
    const games = poll.data.games.filter((g) => {
      if (seen.has(g.key)) return false;
      seen.add(g.key);
      const start = new Date(g.startTime);
      const onDate = Number.isNaN(start.getTime()) ? g.officialDate === date : localDate(start) === date;
      return onDate || (date === today && groupOf(g) === 'live');
    });
    return groupGames(games);
  }, [poll.data, date, today]);

  // Restore scroll position when coming back from a game.
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (restored.current || !groups) return;
    restored.current = true;
    const y = Number(sessionStorage.getItem(`fc-scroll-${date}`) ?? 0);
    if (y > 0) window.scrollTo(0, y);
  }, [groups, date]);
  useEffect(() => {
    const save = () => sessionStorage.setItem(`fc-scroll-${date}`, String(window.scrollY));
    return save;
  }, [date]);

  const go = (d: string) => navigate(d === today ? '/' : `/?date=${d}`, { replace: true });
  const total = groups ? groups.live.length + groups.upcoming.length + groups.final.length : 0;

  return (
    <>
      <nav className="datenav" aria-label="Game day">
        <button className="datenav-btn" onClick={() => go(addDays(date, -1))} aria-label="Previous day">
          <Chevron dir="left" />
        </button>
        <div className="datenav-center">
          <label className="datepick">
            <span>{date === today ? `Today · ${formatDateLong(date).split(', ').slice(1).join(', ')}` : formatDateLong(date)}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && go(e.target.value)}
              aria-label="Choose a date"
            />
          </label>
          {date !== today && (
            <button className="today-link" onClick={() => go(today)}>
              Back to today
            </button>
          )}
        </div>
        <button className="datenav-btn" onClick={() => go(addDays(date, 1))} aria-label="Next day">
          <Chevron dir="right" />
        </button>
      </nav>

      {poll.data && poll.stale && (
        <div className="notice" role="status">
          <span>Couldn’t refresh the schedule. Showing the last update.</span>
          <button onClick={poll.refresh}>Retry</button>
        </div>
      )}

      {!poll.data && poll.loading && <ScheduleSkeleton />}

      {!poll.data && !poll.loading && poll.error && (
        <div className="error-state" role="alert">
          <h2>Schedule unavailable</h2>
          <p>{poll.error} MLB data couldn’t be loaded.</p>
          <button className="btn" onClick={poll.refresh}>
            Try again
          </button>
        </div>
      )}

      {groups && total === 0 && <EmptyDay data={poll.data!} date={date} onGo={go} />}

      {groups &&
        (['live', 'upcoming', 'final'] as GroupName[]).map((name) =>
          groups[name].length ? <Section key={name} name={name} games={groups[name]} /> : null,
        )}

      {groups && total > 0 && groups.live.length === 0 && date === today && (
        <p className="row-meta" style={{ paddingLeft: 0, marginTop: 16 }}>
          No games are live right now.
        </p>
      )}
    </>
  );
}

const TITLES: Record<GroupName, string> = { live: 'Live', upcoming: 'Upcoming', final: 'Final' };

function Section({ name, games }: { name: GroupName; games: ScheduleGame[] }) {
  const id = `sec-${name}`;
  return (
    <section className="section" aria-labelledby={id}>
      <div className="section-head">
        {name === 'live' && <span className="live-dot" aria-hidden="true" />}
        <h2 className="label" id={id} style={{ margin: 0, color: name === 'live' ? 'var(--red)' : undefined }}>
          {TITLES[name]} <span className="count">{games.length}</span>
        </h2>
      </div>
      <ul className="games">
        {games.map((g) => (
          <li key={g.key}>
            <GameRow g={g} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function rowAriaLabel(g: ScheduleGame): string {
  const a = g.away.team.name;
  const h = g.home.team.name;
  const k = g.status.kind;
  const score = g.away.score != null && g.home.score != null ? `, ${g.away.score} to ${g.home.score}` : '';
  if (k === 'live' && g.inning) return `${a} at ${h}${score}, ${halfLabel(g.inning.half)} of the ${g.inning.ordinal}`;
  if (k === 'scheduled' || k === 'pregame')
    return `${a} at ${h}, ${g.startTimeTBD ? 'time to be determined' : `starts ${formatTime(g.startTime)}`}`;
  return `${a} at ${h}${score}, ${g.status.detailed}`;
}

function GameRow({ g }: { g: ScheduleGame }) {
  const href = `/game/${g.gamePk}`;
  const group = groupOf(g);
  const isFinal = g.status.kind === 'final';
  const loser = (side: 'away' | 'home') => isFinal && g[side].isWinner === false;
  const showScores = g.away.score != null && g.home.score != null;
  return (
    <a
      href={href}
      className={`game-row${group === 'live' ? ' game-row--live' : ''}`}
      aria-label={rowAriaLabel(g)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        sessionStorage.setItem(`fc-scroll-${new URLSearchParams(location.search).get('date') ?? localDate()}`, String(window.scrollY));
        navigate(href);
      }}
    >
      <div className="teams">
        {(['away', 'home'] as const).map((side) => (
          <div key={side} className={`team-line${loser(side) ? ' is-loser' : ''}`}>
            <TeamMark team={g[side].team} size={26} />
            <span className="abbr">{g[side].team.abbreviation}</span>
            <span className="name">
              {g[side].team.teamName}
              {g[side].team.record && group !== 'live' && (
                <span className="rec">
                  {g[side].team.record.wins}–{g[side].team.record.losses}
                </span>
              )}
            </span>
            <span className="score">{showScores ? g[side].score : ''}</span>
          </div>
        ))}
      </div>
      <RowStatus g={g} />
      <RowMeta g={g} />
    </a>
  );
}

function RowStatus({ g }: { g: ScheduleGame }) {
  const k = g.status.kind;
  if ((k === 'live' || (k === 'delayed' && g.status.inProgress)) && g.inning) {
    const midHalf = g.inning.state === 'Top' || g.inning.state === 'Bottom';
    return (
      <div className="row-status">
        <span className="big row-mini">
          {midHalf ? <HalfArrow half={g.inning.half} /> : <span className="small">{g.inning.state.slice(0, 3)}</span>}
          {g.inning.number}
        </span>
        {k === 'delayed' ? (
          <span className="small small--warn">Delayed</span>
        ) : midHalf && g.bases ? (
          <span className="row-mini" aria-hidden="true">
            <Diamond bases={g.bases} size={22} label={false} />
            <Pips n={g.outs} max={2} kind="o" />
          </span>
        ) : (
          <span className="small small--live">Live</span>
        )}
      </div>
    );
  }
  if (k === 'scheduled' || k === 'pregame' || (k === 'delayed' && !g.status.inProgress)) {
    return (
      <div className="row-status">
        <span className="big">{g.startTimeTBD ? 'TBD' : formatTime(g.startTime)}</span>
        <span className={`small${k === 'delayed' ? ' small--warn' : ''}`}>{statusShort(g.status)}</span>
      </div>
    );
  }
  if (k === 'final') {
    return (
      <div className="row-status">
        <span className="big">{g.finalInnings ? `F/${g.finalInnings}` : 'Final'}</span>
        {g.status.detailed !== 'Final' && g.status.detailed !== 'Game Over' && (
          <span className="small">{g.status.detailed}</span>
        )}
      </div>
    );
  }
  return (
    <div className="row-status">
      <span className="small small--warn" style={{ fontSize: 12 }}>
        {statusShort(g.status)}
      </span>
      {g.status.reason && <span className="small">{g.status.reason}</span>}
    </div>
  );
}

function RowMeta({ g }: { g: ScheduleGame }) {
  const bits: React.ReactNode[] = [];
  if (g.series) bits.push(<strong key="s">{g.series}</strong>);
  if (g.seriesStatus) bits.push(<span key="ss">{g.seriesStatus}</span>);
  if (g.doubleHeader !== 'N') bits.push(<span key="dh">Doubleheader · Game {g.gameNumber}</span>);
  if (g.status.kind === 'suspended' && g.resumeDate) bits.push(<span key="r">Resumes {formatDateLong(g.resumeDate)}</span>);
  if (g.status.kind === 'postponed' && g.rescheduleDate) bits.push(<span key="r">Rescheduled to {formatDateLong(g.rescheduleDate)}</span>);
  if ((g.status.kind === 'scheduled' || g.status.kind === 'pregame') && g.away.probablePitcher && g.home.probablePitcher)
    bits.push(
      <span key="pp">
        {g.away.probablePitcher.split(' ').slice(-1)} vs {g.home.probablePitcher.split(' ').slice(-1)}
      </span>,
    );
  if (!bits.length) return null;
  return (
    <div className="row-meta">
      {bits.map((b, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          {b}
        </span>
      ))}
    </div>
  );
}

function EmptyDay({ data, date, onGo }: { data: ScheduleResponse; date: string; onGo: (d: string) => void }) {
  return (
    <div className="empty">
      <h2>No MLB games</h2>
      <p>
        There are no Major League games on {formatDateLong(date)}.
        {data.nextGameDate == null && data.prevGameDate != null && ' The season is over.'}
      </p>
      <div className="empty-actions">
        {data.prevGameDate && (
          <button className="btn" onClick={() => onGo(data.prevGameDate!)}>
            <Chevron dir="left" /> {formatDateLong(data.prevGameDate)}
          </button>
        )}
        {data.nextGameDate && (
          <button className="btn" onClick={() => onGo(data.nextGameDate!)}>
            {formatDateLong(data.nextGameDate)} <Chevron dir="right" />
          </button>
        )}
      </div>
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading games" style={{ marginTop: 20 }}>
      <div className="section-head">
        <span className="skel" style={{ width: 60, height: 12 }} />
      </div>
      {Array.from({ length: 6 }, (_, i) => (
        <div className="skel-row" key={i}>
          <span className="skel" style={{ width: 26, height: 26, borderRadius: '50%' }} />
          <span className="skel" style={{ width: '40%' }} />
          <span style={{ flex: 1 }} />
          <span className="skel" style={{ width: 48 }} />
        </div>
      ))}
    </div>
  );
}
