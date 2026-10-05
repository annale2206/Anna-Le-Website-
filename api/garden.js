// api/garden.js
//
// Seasonal play on the homepage: each season visitors add one thing to the
// tree, and it comes back every time that season returns.
//   spring → a flower on the ground      summer → a green leaf on a branch
//   fall   → a fruit on a branch          winter → a snowball or snowman
// Only the season, the item and its spot are stored: no names, no text,
// no personal data.
//
//   GET  /api/garden                → { flowers: [{ s, c, x, y, t }, ...], total }
//   POST /api/garden {s, c, x, y}   → { ok: true, flower }
//
// s = season (0 spring, 1 summer, 2 fall, 3 winter)
// c = which item in that season (spring 0-6, summer 0-3, fall 0-3, winter 0-2)
// x, y = spot on the tree drawing (0 to 1), t = time added.
//
// Uses the same Upstash Redis connection as stats.js / log-session.js
// (KV_REST_API_URL + KV_REST_API_TOKEN, already set in Vercel).
// ─────────────────────────────────────────────────────────────────────────

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const MAX_SHOWN = 400;          // newest items sent to the page (all seasons together)
const MAX_KEPT = 2000;          // older ones are trimmed away
const COOLDOWN_SECONDS = 30;    // one item per visitor every 30 seconds
const ITEMS_PER_SEASON = [7, 4, 4, 3];

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
      const { s, c, x, y } = req.body || {};
      const sNum = Number(s), cNum = Number(c), xNum = Number(x), yNum = Number(y);
      const ok = Number.isInteger(sNum) && sNum >= 0 && sNum < 4 &&
                 Number.isInteger(cNum) && cNum >= 0 && cNum < ITEMS_PER_SEASON[sNum] &&
                 xNum >= 0 && xNum <= 1 && yNum >= 0 && yNum <= 1;
      if (!ok) return res.status(400).json({ ok: false, error: 'bad item' });

      // gentle rate limit by visitor address, so nobody floods the tree
      const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
      const allowed = await redis.set(`garden_cd:${ip}`, 1, { nx: true, ex: COOLDOWN_SECONDS });
      if (!allowed) {
        return res.status(429).json({ ok: false, error: 'please wait a few seconds' });
      }

      const flower = {
        s: sNum, c: cNum,
        x: Math.round(xNum * 1000) / 1000,
        y: Math.round(yNum * 1000) / 1000,
        t: Date.now(),
      };
      await redis.rpush('garden', JSON.stringify(flower));
      await redis.ltrim('garden', -MAX_KEPT, -1);
      await redis.incr('garden_total');
      return res.status(200).json({ ok: true, flower });
    }

    return res.status(405).json({ error: 'Use GET or POST' });
  } catch (err) {
    // if the database is unavailable, the homepage still works, just without visitor items
    return res.status(200).json({ ok: false, flowers: [], total: 0, error: err.message });
  }
}
