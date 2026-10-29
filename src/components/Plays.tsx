import { useState } from 'react';
import type { GameSnapshot, Play } from '../lib/types';
import { HalfArrow } from './bits';

const COLLAPSED = 6;

export function Plays({ g }: { g: GameSnapshot }) {
  const [expanded, setExpanded] = useState(false);
  const all = [...g.plays].reverse(); // newest first; the feed order is preserved underneath
  if (all.length === 0) {
    return (
      <section className="panel" aria-labelledby="plays-h">
        <div className="panel-head">
          <h2 className="label" id="plays-h">
            Plays
          </h2>
        </div>
        <p className="panel-empty">No plays yet.</p>
      </section>
    );
  }
  const shown = expanded ? all : all.slice(0, COLLAPSED);
  const latestComplete = all.find((p) => p.isComplete);
  return (
    <section className="panel" aria-labelledby="plays-h">
      <div className="panel-head">
        <h2 className="label" id="plays-h">
          Plays
        </h2>
        <span className="aside">Newest first</span>
      </div>
      <ol className="plays" reversed>
        {shown.map((p) => (
          <PlayItem key={p.atBatIndex} p={p} g={g} latest={p === latestComplete} />
        ))}
      </ol>
      {all.length > COLLAPSED && (
        <button className="more" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
          {expanded ? 'Show fewer' : `Show all ${all.length} plays`}
        </button>
      )}
    </section>
  );
}

function PlayItem({ p, g, latest }: { p: Play; g: GameSnapshot; latest: boolean }) {
  const cls = ['play', p.isScoring && 'play--scoring', latest && 'play--latest', !p.isComplete && 'play--active']
    .filter(Boolean)
    .join(' ');
  return (
    <li className={cls}>
      <span className="play-inn" aria-label={`${p.half === 'top' ? 'Top' : 'Bottom'} ${p.inning}`}>
        <HalfArrow half={p.half} size={9} />
        {p.inning}
      </span>
      <div className="play-body">
        {p.isComplete ? (
          <>
            {p.event && <span className="play-event">{p.event}</span>}
            {latest && <span className="latest-flag">Latest</span>}
            <div className="play-desc">{p.description ?? p.batter}</div>
            {p.isScoring && p.awayScore != null && p.homeScore != null && (
              <span className="play-score num">
                {g.away.team.abbreviation} {p.awayScore} · {g.home.team.abbreviation} {p.homeScore}
              </span>
            )}
          </>
        ) : (
          <div className="play-desc">
            {p.batter ? `${p.batter} at bat` : 'Plate appearance'} <span className="muted">· in progress</span>
          </div>
        )}
      </div>
    </li>
  );
}
