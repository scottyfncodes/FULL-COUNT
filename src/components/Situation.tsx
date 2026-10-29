import type { GameSnapshot } from '../lib/types';
import { Diamond, Pips, basesText } from './bits';

export function Situation({ g }: { g: GameSnapshot }) {
  const bases = { first: !!g.bases.first, second: !!g.bases.second, third: !!g.bases.third };
  const midHalf = g.inning && (g.inning.state === 'Top' || g.inning.state === 'Bottom');
  const live = g.status.kind === 'live';
  const pa = g.plateAppearance;
  const count = live ? pa?.count ?? null : null;
  const p = g.pitcher?.game ?? null;

  let countCaption = '';
  if (!live) countCaption = g.status.detailed;
  else if (!midHalf) countCaption = 'Between innings';
  else if (!pa) countCaption = 'Count unavailable';
  else if (pa.isComplete) countCaption = 'Play complete';
  else countCaption = `${count?.balls} ball${count?.balls === 1 ? '' : 's'}, ${count?.strikes} strike${count?.strikes === 1 ? '' : 's'}`;

  const runnerNames = (['first', 'second', 'third'] as const)
    .map((k) => g.bases[k]?.name.split(' ').slice(-1)[0])
    .filter(Boolean)
    .join(', ');

  return (
    <section className="situation" aria-label="Game situation">
      <div>
        <span className="label">Bases</span>
        <Diamond bases={bases} size={66} />
        <span className="caption" title={runnerNames || undefined}>
          {midHalf && live ? basesText(bases) : '—'}
        </span>
      </div>

      <div>
        <div className="count-block" aria-label={count ? `Count ${count.balls} and ${count.strikes}, ${g.outs ?? 'unknown'} out` : 'No active count'}>
          <div className="count-row">
            <span className="k" aria-hidden="true">B</span>
            <Pips n={count?.balls ?? null} max={3} kind="b" />
          </div>
          <div className="count-row">
            <span className="k" aria-hidden="true">S</span>
            <Pips n={count?.strikes ?? null} max={2} kind="s" />
          </div>
          <div className="count-row">
            <span className="k" aria-hidden="true">O</span>
            <Pips n={midHalf ? g.outs : null} max={2} kind="o" />
          </div>
        </div>
        <span className={`count-big num${count ? '' : ' is-empty'}`} aria-hidden="true">
          {count ? `${count.balls}–${count.strikes}` : '–'}
        </span>
        <span className="caption">{countCaption}</span>
      </div>

      <div>
        <span className="label">Pitches</span>
        <span className={`pitch-total num${p?.pitches != null ? '' : ' is-empty'}`}>{p?.pitches ?? '—'}</span>
        <span className="caption num">
          {p?.strikes != null && p?.balls != null ? `${p.strikes} S · ${p.balls} B` : g.pitcher ? 'Not reported' : ''}
        </span>
      </div>
    </section>
  );
}
