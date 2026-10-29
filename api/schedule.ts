import { normalizeSchedule } from '../src/lib/schedule.js';
import { addDays, isIsoDate } from '../src/lib/dates.js';
import type { ScheduleResponse } from '../src/lib/types.js';
import { errorResponse, fetchMlb, json } from './_upstream.js';

// GET /api/schedule?date=YYYY-MM-DD
// Returns MLB games for date-1..date+1 (normalized) so the client can bucket by the viewer's
// local timezone. When the window is empty (offseason), also returns the nearest game days.
export async function GET(request: Request): Promise<Response> {
  const date = new URL(request.url).searchParams.get('date') ?? '';
  if (!isIsoDate(date)) return json({ error: 'Expected ?date=YYYY-MM-DD' }, { status: 400 });

  try {
    const start = addDays(date, -1);
    const end = addDays(date, 1);
    const raw = await fetchMlb(
      `/api/v1/schedule?sportId=1&startDate=${start}&endDate=${end}&hydrate=linescore,team,probablePitcher,seriesStatus`,
    );
    const games = normalizeSchedule(raw);

    let prevGameDate: string | null = null;
    let nextGameDate: string | null = null;
    if (!games.some((g) => g.officialDate === date)) {
      const span = await fetchMlb(
        `/api/v1/schedule?sportId=1&startDate=${addDays(date, -240)}&endDate=${addDays(date, 240)}&fields=dates,date`,
      );
      const dates: string[] = ((span as { dates?: { date?: string }[] })?.dates ?? [])
        .map((d) => d.date)
        .filter((d): d is string => typeof d === 'string');
      prevGameDate = dates.filter((d) => d < date).pop() ?? null;
      nextGameDate = dates.find((d) => d > date) ?? null;
    }

    const body: ScheduleResponse = { date, games, prevGameDate, nextGameDate, fetchedAt: new Date().toISOString() };
    const anyLive = games.some((g) => g.status.kind === 'live' || g.status.inProgress);
    const anyPending = games.some((g) => ['scheduled', 'pregame', 'delayed'].includes(g.status.kind));
    return json(body, anyLive ? { cdnSeconds: 10, swrSeconds: 10 } : anyPending ? { cdnSeconds: 60, swrSeconds: 60 } : { cdnSeconds: 900, swrSeconds: 3600 });
  } catch (e) {
    return errorResponse(e);
  }
}
