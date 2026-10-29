import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Poller, initialPollState, isStale, type PollState } from '../lib/poller';

interface Options<T> {
  /** Changing the key restarts polling (e.g. a different game or date). */
  key: string;
  fetcher: (signal: AbortSignal) => Promise<T>;
  interval: (data: T) => number | null;
  isSame?: (a: T, b: T) => boolean;
  /** Seed data (e.g. from an in-memory cache) shown instantly while the first fetch runs. */
  initial?: T | null;
}

export interface PollResult<T> extends PollState<T> {
  stale: boolean;
  intervalMs: number | null;
  /** Wall clock, re-sampled every few seconds, for age/staleness display. */
  now: number;
  refresh: () => void;
}

export function usePoll<T>({ key, fetcher, interval, isSame, initial = null }: Options<T>): PollResult<T> {
  const seed = (): PollState<T> => ({ ...initialPollState<T>(), data: initial });
  const [entry, setEntry] = useState(() => ({ key, state: seed() }));
  // A new key starts from a clean slate (derived-state pattern; no effect round-trip).
  const current = entry.key === key ? entry : { key, state: seed() };
  if (entry.key !== key) setEntry(current);

  const pollerRef = useRef<Poller<T> | null>(null);
  const fns = useRef({ fetcher, interval, isSame });
  useLayoutEffect(() => {
    fns.current = { fetcher, interval, isSame };
  });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const poller = new Poller<T>({
      fetcher: (s) => fns.current.fetcher(s),
      interval: (d) => fns.current.interval(d),
      isSame: (a, b) => fns.current.isSame?.(a, b) ?? false,
      onChange: (s) =>
        setEntry({ key, state: s.data == null && initial != null ? { ...s, data: initial } : s }),
    });
    pollerRef.current = poller;
    poller.start();
    const onVis = () => (document.hidden ? poller.pause() : poller.resume());
    const onOnline = () => poller.refresh();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onOnline);
    if (document.hidden) poller.pause();
    return () => {
      poller.stop();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onOnline);
    };
    // `initial` is only a seed for a new key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Re-evaluate staleness periodically even when no fetch completes (e.g. a stuck network).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(() => pollerRef.current?.refresh(), []);
  const state = current.state;
  const intervalMs = state.data != null ? interval(state.data) : null;
  const clock = Math.max(now, state.lastSuccess ?? 0);
  return { ...state, stale: isStale(state, intervalMs, clock), intervalMs, now: clock, refresh };
}
