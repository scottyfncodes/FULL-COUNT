import { useState } from 'react';
import type { Half, Team } from '../lib/types';
import { teamLogoUrl } from '../lib/team';

export function TeamMark({ team, size = 28 }: { team: Team; size?: number }) {
  const [failed, setFailed] = useState(false);
  const style = { '--mark': `${size}px` } as React.CSSProperties;
  if (failed || !team.id) {
    return (
      <span className="mark mark--text" style={style} aria-hidden="true">
        {team.abbreviation.slice(0, 3)}
      </span>
    );
  }
  return (
    <span className="mark" style={style} aria-hidden="true">
      <picture>
        <source media="(prefers-color-scheme: light)" srcSet={teamLogoUrl(team.id, 'light')} />
        <img src={teamLogoUrl(team.id, 'dark')} alt="" width={size} height={size} loading="lazy" decoding="async" onError={() => setFailed(true)} />
      </picture>
    </span>
  );
}

export function HalfArrow({ half, size = 10 }: { half: Half; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      {half === 'top' ? <path d="M5 1.5 9 8H1z" fill="currentColor" /> : <path d="M5 8.5 1 2h8z" fill="currentColor" />}
    </svg>
  );
}

export const halfLabel = (half: Half) => (half === 'top' ? 'Top' : 'Bottom');

const BASE_NAMES = ['first', 'second', 'third'] as const;

export function basesText(b: { first: boolean; second: boolean; third: boolean }): string {
  const on = BASE_NAMES.filter((k) => b[k]);
  if (on.length === 0) return 'Bases empty';
  if (on.length === 3) return 'Bases loaded';
  const short: Record<string, string> = { first: '1st', second: '2nd', third: '3rd' };
  return on.length === 1 ? `Runner on ${short[on[0]]}` : `Runners on ${on.map((k) => short[k]).join(' & ')}`;
}

/**
 * Compact diamond. Occupied bases are filled; empty bases are hollow outlines, so occupancy reads
 * without color. Geometry: second base at top, first at right, third at left, plate at bottom.
 */
export function Diamond({
  bases,
  size = 64,
  label = true,
}: {
  bases: { first: boolean; second: boolean; third: boolean };
  size?: number;
  label?: boolean;
}) {
  const b = 9; // half-diagonal of a base square in viewBox units
  const pts = { second: [32, 12], first: [52, 32], third: [12, 32] } as const;
  return (
    <svg
      className="diamond"
      width={size}
      height={size * 0.82}
      viewBox="0 2 64 52"
      role={label ? 'img' : undefined}
      aria-label={label ? basesText(bases) : undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path className="basepath" d="M32 50 52 32 32 12 12 32Z" />
      {BASE_NAMES.map((k) => (
        <rect
          key={k}
          className={`base${bases[k] ? ' on' : ''}`}
          x={pts[k][0] - b / 1.414}
          y={pts[k][1] - b / 1.414}
          width={(b * 2) / 1.414}
          height={(b * 2) / 1.414}
          transform={`rotate(45 ${pts[k][0]} ${pts[k][1]})`}
          rx="1"
        />
      ))}
      <path className="plate" d="M28.5 47h7v3.5L32 53l-3.5-2.5z" />
    </svg>
  );
}

export function Pips({ n, max, kind }: { n: number | null; max: number; kind: 'b' | 's' | 'o' }) {
  return (
    <span className={`pips pips--${kind}`} aria-hidden="true">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`pip${n != null && i < n ? ' on' : ''}`} />
      ))}
    </span>
  );
}

export function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        d={dir === 'left' ? 'M11 3 5 9l6 6' : 'M7 3l6 6-6 6'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo() {
  // A home-plate-to-second-base diamond with a single occupied base: the product mark.
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 2 18 10 10 18 2 10Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="7.6" y="2.6" width="4.8" height="4.8" transform="rotate(45 10 5)" fill="var(--green)" />
    </svg>
  );
}

/** Format a nullable stat. Missing values render as an em dash, never zero. */
export const fmt = (v: number | string | null | undefined): string => (v == null ? '—' : String(v));
