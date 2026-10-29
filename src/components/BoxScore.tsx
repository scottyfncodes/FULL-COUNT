import { useEffect, useRef, useState } from 'react';
import type { GameSnapshot, TeamBox } from '../lib/types';
import { fmt } from './bits';

export function BoxScore({ g, open, onClose }: { g: GameSnapshot; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [side, setSide] = useState<'away' | 'home'>(g.battingSide ?? 'away');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setSide(g.battingSide ?? 'away');
      d.showModal();
    } else if (!open && d.open) d.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const box = g.box![side];
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="box-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="sheet-inner">
        <div className="sheet-head">
          <h2 id="box-title">Box score</h2>
          <button className="close" onClick={onClose} aria-label="Close box score">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M4 4l10 10M14 4 4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="sheet-body">
          <div className="seg" role="tablist" aria-label="Team">
            {(['away', 'home'] as const).map((s) => (
              <button key={s} role="tab" aria-selected={side === s} onClick={() => setSide(s)}>
                {g[s].team.abbreviation} {g[s].team.teamName}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            <Batting box={box} label={g.statsLabel} />
            <Pitching box={box} label={g.statsLabel} />
            <p className="box-note">
              Game stats from MLB’s live box score. AVG, OPS and ERA are {g.statsLabel.toLowerCase()} figures including this game.
            </p>
          </div>
        </div>
      </div>
    </dialog>
  );
}

function Batting({ box, label }: { box: TeamBox; label: string }) {
  if (!box.batters.length) return <p className="panel-empty">Lineup not yet available.</p>;
  return (
    <div className="box-wrap">
      <table className="box num">
        <caption className="label">Batting</caption>
        <thead>
          <tr>
            <th scope="col">Batter</th>
            <th scope="col">AB</th>
            <th scope="col">R</th>
            <th scope="col">H</th>
            <th scope="col">RBI</th>
            <th scope="col">BB</th>
            <th scope="col">K</th>
            <th scope="col" className="season" title={`${label} batting average`}>
              AVG
            </th>
            <th scope="col" title={`${label} OPS`}>
              OPS
            </th>
          </tr>
        </thead>
        <tbody>
          {box.batters.map((b) => (
            <tr key={b.id} className={b.isSubstitute ? 'sub' : undefined}>
              <th scope="row" style={{ fontWeight: 500 }}>
                {b.name}
                {b.position && <span className="pos">{b.position}</span>}
              </th>
              <td>{fmt(b.game.atBats)}</td>
              <td>{fmt(b.game.runs)}</td>
              <td>{fmt(b.game.hits)}</td>
              <td>{fmt(b.game.rbi)}</td>
              <td>{fmt(b.game.walks)}</td>
              <td>{fmt(b.game.strikeOuts)}</td>
              <td className="season">{fmt(b.season?.avg)}</td>
              <td>{fmt(b.season?.ops)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Totals</td>
            <td>{fmt(box.totals.atBats)}</td>
            <td>{fmt(box.totals.runs)}</td>
            <td>{fmt(box.totals.hits)}</td>
            <td>{fmt(box.totals.rbi)}</td>
            <td>{fmt(box.totals.walks)}</td>
            <td>{fmt(box.totals.strikeOuts)}</td>
            <td className="season" />
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Pitching({ box, label }: { box: TeamBox; label: string }) {
  if (!box.pitchers.length) return null;
  return (
    <div className="box-wrap">
      <table className="box num">
        <caption className="label">Pitching</caption>
        <thead>
          <tr>
            <th scope="col">Pitcher</th>
            <th scope="col">IP</th>
            <th scope="col">H</th>
            <th scope="col">R</th>
            <th scope="col">ER</th>
            <th scope="col">BB</th>
            <th scope="col">K</th>
            <th scope="col">HR</th>
            <th scope="col" title="Pitches–strikes">
              P–S
            </th>
            <th scope="col" className="season" title={`${label} ERA`}>
              ERA
            </th>
          </tr>
        </thead>
        <tbody>
          {box.pitchers.map((p) => (
            <tr key={p.id}>
              <th scope="row" style={{ fontWeight: 500 }}>
                {p.name}
                {p.note && <span className="pos">{p.note}</span>}
              </th>
              <td>{fmt(p.game.inningsPitched)}</td>
              <td>{fmt(p.game.hits)}</td>
              <td>{fmt(p.game.runs)}</td>
              <td>{fmt(p.game.earnedRuns)}</td>
              <td>{fmt(p.game.walks)}</td>
              <td>{fmt(p.game.strikeOuts)}</td>
              <td>{fmt(p.game.homeRuns)}</td>
              <td>{p.game.pitches != null ? `${p.game.pitches}–${fmt(p.game.strikes)}` : '—'}</td>
              <td className="season">{fmt(p.season?.era)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
