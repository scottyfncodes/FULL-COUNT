// Shared helpers for the MLB Stats API proxy functions. Files prefixed with "_" are not routes.

const BASE = 'https://statsapi.mlb.com';
const TIMEOUT_MS = 8000;

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function fetchMlb(path: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE + path, {
      signal: ctrl.signal,
      headers: { accept: 'application/json', 'user-agent': 'FullCount/1.0 (+https://github.com/scottyfncodes/FULL-COUNT)' },
    });
    if (res.status === 404) throw new UpstreamError('Not found', 404);
    if (!res.ok) throw new UpstreamError(`MLB responded ${res.status}`, 502);
    return await res.json();
  } catch (e) {
    if (e instanceof UpstreamError) throw e;
    if ((e as Error).name === 'AbortError') throw new UpstreamError('MLB data request timed out', 504);
    throw new UpstreamError('MLB data is unreachable', 502);
  } finally {
    clearTimeout(timer);
  }
}

export function json(body: unknown, init: { status?: number; cdnSeconds?: number; swrSeconds?: number } = {}): Response {
  const { status = 200, cdnSeconds = 0, swrSeconds = 0 } = init;
  const cache =
    status === 200 && cdnSeconds > 0
      ? `public, max-age=0, s-maxage=${cdnSeconds}, stale-while-revalidate=${swrSeconds}`
      : 'no-store';
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache },
  });
}

export function errorResponse(e: unknown): Response {
  const status = e instanceof UpstreamError ? e.status : 500;
  const message = e instanceof Error ? e.message : 'Unexpected error';
  return json({ error: message }, { status });
}
