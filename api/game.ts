import { normalizeGame } from '../src/lib/game.js';
import { errorResponse, fetchMlb, json } from './_upstream.js';

// GET /api/game?pk=123456[&timecode=YYYYMMDD_HHMMSS]
// Fetches MLB's live game feed and returns a compact normalized snapshot (~10x smaller than the
// raw feed, which matters when polling every few seconds on a phone). `timecode` replays the
// feed as it stood at that moment, which MLB supports for past games.
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const pk = params.get('pk') ?? '';
  const timecode = params.get('timecode');
  if (!/^\d{4,8}$/.test(pk)) return json({ error: 'Expected ?pk=<gamePk>' }, { status: 400 });
  if (timecode && !/^\d{8}_\d{6}$/.test(timecode)) return json({ error: 'Bad timecode' }, { status: 400 });

  try {
    const raw = await fetchMlb(`/api/v1.1/game/${pk}/feed/live${timecode ? `?timecode=${timecode}` : ''}`);
    const game = normalizeGame(raw);
    const k = game.status.kind;
    const cache =
      timecode || k === 'final' || k === 'postponed' || k === 'cancelled'
        ? { cdnSeconds: 300, swrSeconds: 600 }
        : k === 'live' || k === 'delayed'
          ? { cdnSeconds: 3, swrSeconds: 3 }
          : { cdnSeconds: 20, swrSeconds: 20 };
    return json(game, cache);
  } catch (e) {
    return errorResponse(e);
  }
}
