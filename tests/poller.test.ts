import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Poller, backoffDelay, initialPollState, isStale, type PollState } from '../src/lib/poller';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const flush = () => vi.advanceTimersByTimeAsync(0);

describe('backoff and staleness', () => {
  it('backs off exponentially and caps', () => {
    expect(backoffDelay(5000, 0)).toBe(5000);
    expect(backoffDelay(5000, 1)).toBe(5000);
    expect(backoffDelay(5000, 2)).toBe(10000);
    expect(backoffDelay(5000, 3)).toBe(20000);
    expect(backoffDelay(5000, 10)).toBe(60000);
  });

  it('marks data stale after a failed refresh or a long silence', () => {
    const s: PollState<number> = { ...initialPollState<number>(), data: 1, lastSuccess: 1000, loading: false };
    expect(isStale(s, 5000, 2000)).toBe(false);
    expect(isStale({ ...s, failures: 1 }, 5000, 2000)).toBe(true);
    expect(isStale(s, 5000, 1000 + 25000)).toBe(true);
    expect(isStale({ ...s, lastSuccess: null }, 5000, 99999)).toBe(false);
  });
});

describe('Poller', () => {
  it('keeps the last good data when a refresh fails, then recovers', async () => {
    const results: Array<number | Error> = [1, new Error('offline'), new Error('offline'), 2];
    const states: PollState<number>[] = [];
    const p = new Poller<number>({
      fetcher: async () => {
        const r = results.shift()!;
        if (r instanceof Error) throw r;
        return r;
      },
      interval: () => 1000,
      onChange: (s) => states.push(s),
    });
    p.start();
    await flush();
    expect(p.current).toMatchObject({ data: 1, failures: 0 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(p.current).toMatchObject({ data: 1, failures: 1, error: 'offline' });
    await vi.advanceTimersByTimeAsync(1000); // backoff 1000 * 2^0
    expect(p.current.failures).toBe(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(p.current.failures).toBe(2); // still waiting: backoff is 2000
    await vi.advanceTimersByTimeAsync(1);
    expect(p.current).toMatchObject({ data: 2, failures: 0, error: null });
    p.stop();
  });

  it('never overlaps requests', async () => {
    let active = 0;
    let maxActive = 0;
    const p = new Poller<number>({
      fetcher: () => {
        active++;
        maxActive = Math.max(maxActive, active);
        return new Promise((r) => setTimeout(() => { active--; r(1); }, 3000));
      },
      interval: () => 1000,
      onChange: () => {},
    });
    p.start();
    p.refresh();
    p.refresh();
    await vi.advanceTimersByTimeAsync(10000);
    expect(maxActive).toBe(1);
    p.stop();
  });

  it('stops polling when interval returns null (final game) and pauses while hidden', async () => {
    const fetcher = vi.fn(async () => 1);
    const p = new Poller<number>({ fetcher, interval: () => null, onChange: () => {} });
    p.start();
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    p.stop();

    const f2 = vi.fn(async () => 1);
    const q = new Poller<number>({ fetcher: f2, interval: () => 1000, onChange: () => {} });
    q.start();
    await flush();
    q.pause();
    await vi.advanceTimersByTimeAsync(10000);
    expect(f2).toHaveBeenCalledTimes(1);
    q.resume();
    await flush();
    expect(f2).toHaveBeenCalledTimes(2);
    q.stop();
  });

  it('reuses previous data object when unchanged', async () => {
    let n = 0;
    const p = new Poller<{ v: number }>({
      fetcher: async () => ({ v: n++ < 2 ? 1 : 2 }),
      interval: () => 1000,
      isSame: (a, b) => a.v === b.v,
      onChange: () => {},
    });
    p.start();
    await flush();
    const first = p.current.data;
    await vi.advanceTimersByTimeAsync(1000);
    expect(p.current.data).toBe(first);
    await vi.advanceTimersByTimeAsync(1000);
    expect(p.current.data).not.toBe(first);
    p.stop();
  });
});
