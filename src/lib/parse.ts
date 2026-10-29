// Small defensive readers for untyped JSON. Missing or malformed values become null, never 0.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

export function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

/** Rate stats like ".255" or "3.21". MLB uses "-.--" / ".---" / "-" for undefined values. */
export function rate(v: unknown): string | null {
  const s = str(v);
  if (!s || /^[-.]+$/.test(s) || s === '-') return null;
  return s;
}

export function obj(v: unknown): Json | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

export function arr(v: unknown): Json[] {
  return Array.isArray(v) ? v : [];
}

/** MLB feed timestamps look like "20261029_020820" (UTC). */
export function feedTimestampToIso(ts: unknown): string | null {
  const s = str(ts);
  const m = s && /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/.exec(s);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}
