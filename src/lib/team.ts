import type { Team } from './types.js';
import { type Json, num, obj, str } from './parse.js';

export function parseTeam(raw: Json, recordRaw?: Json): Team {
  const t = obj(raw) ?? {};
  const name = str(t.name) ?? 'Unknown team';
  const rec = obj(recordRaw) ?? obj(t.record);
  const wins = num(rec?.wins);
  const losses = num(rec?.losses);
  return {
    id: num(t.id) ?? 0,
    name,
    abbreviation: str(t.abbreviation) ?? name.slice(0, 3).toUpperCase(),
    teamName: str(t.teamName) ?? str(t.clubName) ?? name,
    record: wins != null && losses != null ? { wins, losses } : null,
  };
}

/** Official MLB team mark (served by MLB's static CDN), designed for dark backgrounds. */
export function teamLogoUrl(teamId: number, variant: 'dark' | 'light' = 'dark'): string {
  return variant === 'dark'
    ? `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${teamId}.svg`
    : `https://www.mlbstatic.com/team-logos/team-cap-on-light/${teamId}.svg`;
}
