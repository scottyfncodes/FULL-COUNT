import type { GameSnapshot } from '../lib/types';
import { fmt } from './bits';

const HAND: Record<string, string> = { L: 'Left', R: 'Right', S: 'Switch' };

function Stat({ v, k }: { v: number | string | null; k: string }) {
  return (
    <span className="stat">
      <b className="num">{fmt(v)}</b>
      <small>{k}</small>
    </span>
  );
}

export function Matchup({ g, onOpenStats }: { g: GameSnapshot; onOpenStats: () => void }) {
  const b = g.batter;
  const p = g.pitcher;
  const season = g.statsLabel;
  return (
    <section className="matchup" aria-label="Current matchup">
      {b && (
        <button className="player" onClick={onOpenStats} aria-label={`At bat: ${b.name}. Open box score`}>
          <span className="player-role label">
            At bat
            {b.batSide && <span className="hand">Bats {HAND[b.batSide] ?? b.batSide}</span>}
          </span>
          <span>
            <span className="player-name">
              {b.name}
              {b.position && <span className="pos">{b.position}</span>}
            </span>
            <span className="statline">
              <span className="k">Today</span>
              {b.game && b.game.atBats != null && b.game.hits != null ? (
                <span className="stat">
                  <b className="num">
                    {b.game.hits}-{b.game.atBats}
                  </b>
                  {b.game.summary?.includes('|') && <small>{b.game.summary.split('|')[1].trim()}</small>}
                </span>
              ) : (
                <span className="muted">No line yet</span>
              )}
            </span>
            {b.season && (
              <span className="statline statline--season">
                <span className="k">{season}</span>
                <Stat v={b.season.avg} k="AVG" />
                <Stat v={b.season.homeRuns} k="HR" />
                <Stat v={b.season.rbi} k="RBI" />
                {b.season.ops && <Stat v={b.season.ops} k="OPS" />}
              </span>
            )}
          </span>
        </button>
      )}

      {p && (
        <button className="player" onClick={onOpenStats} aria-label={`Pitching: ${p.name}. Open box score`}>
          <span className="player-role label">
            Pitching
            {p.pitchHand && <span className="hand">Throws {HAND[p.pitchHand] ?? p.pitchHand}</span>}
          </span>
          <span>
            <span className="player-name">{p.name}</span>
            {p.game ? (
              <span className="statline">
                <span className="k">Today</span>
                <Stat v={p.game.inningsPitched} k="IP" />
                <Stat v={p.game.hits} k="H" />
                <Stat v={p.game.runs} k="R" />
                <Stat v={p.game.earnedRuns} k="ER" />
                <Stat v={p.game.walks} k="BB" />
                <Stat v={p.game.strikeOuts} k="K" />
              </span>
            ) : (
              <span className="statline muted">No line yet</span>
            )}
            {p.season && (
              <span className="statline statline--season">
                <span className="k">{season}</span>
                <Stat v={p.season.era} k="ERA" />
                {p.season.wins != null && p.season.losses != null && (
                  <span className="stat">
                    <b className="num">
                      {p.season.wins}–{p.season.losses}
                    </b>
                  </span>
                )}
                <Stat v={p.season.inningsPitched} k="IP" />
              </span>
            )}
          </span>
        </button>
      )}

      {g.onDeck && (
        <div className="ondeck">
          <span className="label" style={{ marginRight: 8 }}>
            On deck
          </span>
          {g.onDeck.name}
        </div>
      )}
    </section>
  );
}
