import type { GameSnapshot, ScheduleResponse } from './types';

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal, cache: 'no-store', headers: { accept: 'application/json' } });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error(navigator.onLine === false ? 'You appear to be offline.' : 'Could not reach Full Count.');
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status}).`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      /* non-JSON error body */
    }
    if (res.status === 404) msg = 'Game not found.';
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const fetchSchedule = (date: string, signal: AbortSignal) =>
  getJson<ScheduleResponse>(`/api/schedule?date=${encodeURIComponent(date)}`, signal);

export const fetchGame = (pk: number, timecode: string | null, signal: AbortSignal) =>
  getJson<GameSnapshot>(`/api/game?pk=${pk}${timecode ? `&timecode=${encodeURIComponent(timecode)}` : ''}`, signal);
