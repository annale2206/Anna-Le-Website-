// api/show.js
//
// Lets the projector windows run on a DIFFERENT computer from the machine.
// The machine (identity-machine.html) posts what each wall should show:
//   · the state of participant A and B (idle, scanning, reading, portrait, film…)
//   · the live brainwaves during the scan, a few times a second
// and the projector windows (projection.html) read it from here.
// When everything runs in one browser, the windows talk directly instead and
// this route is only a backup.
//
// Storage: the same Upstash Redis as the stats (KV_REST_API_URL / TOKEN).
// States expire after 6 hours, live brainwaves after 10 seconds.
// ─────────────────────────────────────────────────────────────────────────

import { Redis } from '@upstash/redis';
import { hasValidToken } from './_auth.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const KEY = { a: 'im:show:a', b: 'im:show:b', live: 'im:show:live' };

export default async function handler(req, res) {
  if (!hasValidToken(req)) return res.status(401).json({ error: 'locked' });
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'POST') {
      const body = req.body || {};
      if (body.state && (body.state.k === 'a' || body.state.k === 'b')) {
        const s = JSON.stringify({ s: body.state.s || { mode: 'idle' }, t: Date.now() });
        if (s.length > 20000) return res.status(400).json({ error: 'too large' });
        await redis.set(KEY[body.state.k], s, { ex: 6 * 3600 });
      }
      if (body.live) {
        const s = JSON.stringify({ ...body.live, t: Date.now() });
        if (s.length > 20000) return res.status(400).json({ error: 'too large' });
        await redis.set(KEY.live, s, { ex: 10 });
      }
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET') {
      const [a, b, live] = await redis.mget(KEY.a, KEY.b, KEY.live);
      const parse = x => (x == null ? null : typeof x === 'string' ? JSON.parse(x) : x);
      return res.status(200).json({ a: parse(a), b: parse(b), live: parse(live), now: Date.now() });
    }

    return res.status(405).json({ error: 'Use GET or POST' });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  }
}
