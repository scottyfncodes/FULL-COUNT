import { useEffect, useState } from 'react';

export type Route =
  | { view: 'schedule'; date: string | null }
  | { view: 'game'; pk: number; timecode: string | null };

export function parseRoute(loc: Location = window.location): Route {
  const m = /^\/game\/(\d{4,8})\/?$/.exec(loc.pathname);
  const q = new URLSearchParams(loc.search);
  if (m) {
    const t = q.get('t');
    return { view: 'game', pk: Number(m[1]), timecode: t && /^\d{8}_\d{6}$/.test(t) ? t : null };
  }
  const d = q.get('date');
  return { view: 'schedule', date: d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null };
}

const listeners = new Set<() => void>();

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  const state = { fc: true, from: window.location.pathname + window.location.search };
  if (opts.replace) window.history.replaceState(state, '', path);
  else window.history.pushState(state, '', path);
  listeners.forEach((l) => l());
}

/** Go back within the app when possible (restores scroll and date), otherwise go to `fallback`. */
export function goBack(fallback: string) {
  const s = window.history.state as { fc?: boolean } | null;
  if (s?.fc) window.history.back();
  else navigate(fallback, { replace: true });
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute());
  useEffect(() => {
    const update = () => setRoute(parseRoute());
    listeners.add(update);
    window.addEventListener('popstate', update);
    return () => {
      listeners.delete(update);
      window.removeEventListener('popstate', update);
    };
  }, []);
  return route;
}
