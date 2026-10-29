// Framework-free polling engine: no overlapping requests, exponential backoff on failure,
// pause while hidden, keep the last good data when a refresh fails.

export interface PollState<T> {
  data: T | null;
  error: string | null;
  /** Epoch ms of the last successful fetch. */
  lastSuccess: number | null;
  /** Consecutive failures since the last success. */
  failures: number;
  loading: boolean;
}

export interface PollerOptions<T> {
  fetcher: (signal: AbortSignal) => Promise<T>;
  /** Delay before the next poll after a success, in ms. Null stops polling (e.g. final games). */
  interval: (data: T) => number | null;
  onChange: (state: PollState<T>) => void;
  /** Return true when new data is equivalent to old, to avoid needless re-renders. */
  isSame?: (prev: T, next: T) => boolean;
  timeoutMs?: number;
  maxBackoffMs?: number;
  now?: () => number;
}

export const initialPollState = <T>(): PollState<T> => ({
  data: null,
  error: null,
  lastSuccess: null,
  failures: 0,
  loading: true,
});

export function backoffDelay(baseMs: number, failures: number, maxMs = 60_000): number {
  if (failures <= 0) return baseMs;
  return Math.min(baseMs * 2 ** (failures - 1), maxMs);
}

/**
 * Data is stale when the most recent attempt failed, or when no success has landed for well
 * over the expected refresh interval (e.g. the tab was throttled).
 */
export function isStale(state: PollState<unknown>, intervalMs: number | null, now: number): boolean {
  if (state.lastSuccess == null) return false;
  if (state.failures > 0) return true;
  if (intervalMs == null) return false;
  return now - state.lastSuccess > intervalMs * 3 + 5_000;
}

export class Poller<T> {
  private state: PollState<T> = initialPollState<T>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inflight: AbortController | null = null;
  private stopped = true;
  private paused = false;
  private lastInterval = 5_000;
  private readonly opts: PollerOptions<T>;

  constructor(opts: PollerOptions<T>) {
    this.opts = opts;
  }

  get current(): PollState<T> {
    return this.state;
  }

  start(): void {
    this.stopped = false;
    void this.tick();
  }

  stop(): void {
    this.stopped = true;
    this.clearTimer();
    this.inflight?.abort();
    this.inflight = null;
  }

  /** Stop scheduling while the page is hidden. */
  pause(): void {
    this.paused = true;
    this.clearTimer();
  }

  /** Resume and refresh promptly. */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.refresh();
  }

  /** Fetch now (e.g. user tapped Retry). Ignored if a request is already in flight. */
  refresh(): void {
    if (this.stopped) return;
    this.clearTimer();
    void this.tick();
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private set(patch: Partial<PollState<T>>) {
    this.state = { ...this.state, ...patch };
    this.opts.onChange(this.state);
  }

  private schedule(ms: number | null) {
    this.clearTimer();
    if (ms == null || this.stopped || this.paused) return;
    this.timer = setTimeout(() => void this.tick(), ms);
  }

  private async tick(): Promise<void> {
    if (this.stopped || this.inflight) return;
    const now = this.opts.now ?? Date.now;
    const ctrl = new AbortController();
    this.inflight = ctrl;
    const timeout = setTimeout(() => ctrl.abort(), this.opts.timeoutMs ?? 10_000);
    try {
      const data = await this.opts.fetcher(ctrl.signal);
      if (this.stopped) return;
      const prev = this.state.data;
      const same = prev != null && this.opts.isSame?.(prev, data) === true;
      this.set({ data: same ? prev : data, error: null, lastSuccess: now(), failures: 0, loading: false });
      const next = this.opts.interval(data);
      if (next != null) this.lastInterval = next;
      this.inflight = null;
      this.schedule(next);
    } catch (e) {
      if (this.stopped) return;
      const failures = this.state.failures + 1;
      const message =
        (e as Error)?.name === 'AbortError' ? 'The request timed out.' : (e as Error)?.message || 'Network error';
      this.set({ error: message, failures, loading: false });
      this.inflight = null;
      this.schedule(backoffDelay(this.lastInterval, failures, this.opts.maxBackoffMs));
    } finally {
      clearTimeout(timeout);
      if (this.inflight === ctrl) this.inflight = null;
    }
  }
}
