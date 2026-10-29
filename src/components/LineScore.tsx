import type { GameSnapshot } from '../lib/types';
import { isActive } from '../lib/status';

export function LineScore({ g }: { g: GameSnapshot }) {
  const cols = Math.max(g.scheduledInnings, g.innings.length);
  const final = g.status.kind === 'final';
  const byNum = new Map(g.innings.map((i) => [i.num, i]));
  const cur = isActive(g.status) && g.inning ? g.inning : null;

  const cell = (side: 'away' | 'home', n: number) => {
    const inn = byNum.get(n);
    const runs = inn?.[side].runs ?? null;
    const isCur = !!cur && cur.number === n && (cur.half === 'top' ? 'away' : 'home') === side && (cur.state === 'Top' || cur.state === 'Bottom');
    // Home team didn't need its last half inning.
    if (final && side === 'home' && runs == null && inn && n === g.innings.length) return <td key={n} className="na">X</td>;
    return (
      <td key={n} className={isCur ? 'cur' : undefined}>
        {runs ?? ''}
      </td>
    );
  };

  return (
    <section className="panel" aria-labelledby="linescore-h">
      <div className="panel-head">
        <h2 className="label" id="linescore-h">
          Line score
        </h2>
        {g.innings.length > 9 && <span className="aside">{g.innings.length} innings</span>}
      </div>
      <div className="linescore-wrap" tabIndex={0} aria-label="Line score, scrolls horizontally">
        <table className="linescore num">
          <thead>
            <tr>
              <th className="team" scope="col">
                <span className="sr-only">Team</span>
              </th>
              {Array.from({ length: cols }, (_, i) => (
                <th key={i} scope="col">
                  {i + 1}
                </th>
              ))}
              <th className="tot tot-r" scope="col">
                R
              </th>
              <th className="tot tot-h" scope="col">
                H
              </th>
              <th className="tot tot-e" scope="col">
                E
              </th>
            </tr>
          </thead>
          <tbody>
            {(['away', 'home'] as const).map((side) => (
              <tr key={side}>
                <th className="team" scope="row">
                  {g[side].team.abbreviation}
                </th>
                {Array.from({ length: cols }, (_, i) => cell(side, i + 1))}
                <td className="tot tot-r">{g[side].totals.runs ?? ''}</td>
                <td className="tot tot-h">{g[side].totals.hits ?? ''}</td>
                <td className="tot tot-e">{g[side].totals.errors ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
