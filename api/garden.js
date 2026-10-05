// api/garden.js
//
// The visitor garden on the homepage: every visitor can plant one small
// flower in the grass under the tree, and it stays there for everyone who
// comes after. Only a position and a color are stored, no names, no text,
// no personal data.
//
//   GET  /api/garden            → { flowers: [{ x, c, s, t }, ...], total }
//   POST /api/garden {x, c}     → { ok: true, flower }
//
// x = position along the grass (0 to 1), c = color index (0 to 6),
// s = size (picked by the server), t = time planted.
//
// Uses the same Upstash Redis connection as stats.js / log-session.js
// (KV_REST_API_URL + KV_REST_API_TOKEN, already set in Vercel).
// ─────────────────────────────────────────────────────────────────────────

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const MAX_SHOWN = 160;        // how many of the newest flowers are drawn
const MAX_KEPT = 1000;        // older ones are trimmed away
const COOLDOWN_SECONDS = 60;  // one flower per visitor per minute
const COLOR_COUNT = 7;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      const [raw, total] = await Promise.all([
        redis.lrange('garden', -MAX_SHOWN, -1),
        redis.get('garden_total'),
      ]);
      const flowers = (raw || [])
        .map(item => (typeof item === 'string' ? JSON.parse(item) : item))
        .filter(Boolean);
      return res.status(200).json({ flowers, total: total || flowers.length });
    }

    if (req.method === 'POST') {
      const { x, c } = req.body || {};
      const xNum = Number(x), cNum = Number(c);
      if (!(xNum >= 0 && xNum <= 1) || !Number.isInteger(cNum) || cNum < 0 || cNum >= COLOR_COUNT) {
        return res.status(400).json({ ok: false, error: 'bad flower' });
      }

      // gentle rate limit by visitor address, so nobody floods the garden
      const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
      const allowed = await redis.set(`garden_cd:${ip}`, 1, { nx: true, ex: COOLDOWN_SECONDS });
      if (!allowed) {
        return res.status(429).json({ ok: false, error: 'please wait a minute before planting again' });
      }

      const flower = {
        x: Math.round(xNum * 1000) / 1000,
        c: cNum,
        s: 14 + Math.floor(Math.random() * 8),
        t: Date.now(),
      };
      await redis.rpush('garden', JSON.stringify(flower));
      await redis.ltrim('garden', -MAX_KEPT, -1);
      await redis.incr('garden_total');
      return res.status(200).json({ ok: true, flower });
    }

    return res.status(405).json({ error: 'Use GET or POST' });
  } catch (err) {
    // if the database is unavailable, the homepage still works, just without the garden
    return res.status(200).json({ ok: false, flowers: [], total: 0, error: err.message });
  }
}
