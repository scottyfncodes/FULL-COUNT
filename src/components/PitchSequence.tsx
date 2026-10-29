import type { PlateAppearance } from '../lib/types';

export function PitchSequence({ pa }: { pa: PlateAppearance }) {
  const pitches = pa.pitches;
  const strikes = pitches.filter((p) => p.kind === 'strike').length;
  return (
    <section className="panel" aria-labelledby="pitch-seq">
      <div className="panel-head">
        <h2 className="label" id="pitch-seq">
          {pa.isComplete ? 'Last at-bat' : 'This at-bat'}
        </h2>
        <span className="aside">
          {pa.batter?.name}
          {pitches.length > 0 && ` · ${pitches.length} pitch${pitches.length === 1 ? '' : 'es'}`}
        </span>
      </div>
      {pitches.length === 0 ? (
        <p className="panel-empty">No pitches yet in this plate appearance.</p>
      ) : (
        <ol className="pitches" aria-label={`${pitches.length} pitches, ${strikes} called or swinging strikes`}>
          {pitches.map((p, i) => (
            <li key={p.number} className={`pitch pitch--${p.kind}${i === pitches.length - 1 ? ' is-latest' : ''}`}>
              <span className="pitch-n" aria-label={`Pitch ${p.number}`}>
                <span>{p.number}</span>
              </span>
              <span className="pitch-type">
                {p.pitchType ?? <span className="muted">Type not reported</span>}
              </span>
              <span className="pitch-right">
                <span>{p.call}</span>
                <span className="mph num">{p.speed != null ? `${p.speed.toFixed(1)}` : '—'}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {pitches.some((p) => p.speed != null) && (
        <p className="box-note" style={{ marginTop: 6 }}>
          Velocity in mph at release.
        </p>
      )}
    </section>
  );
}
