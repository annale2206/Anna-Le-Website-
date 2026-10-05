// api/garden.js
//
// Seasonal play on the homepage: each season visitors add things to the
// tree, and they come back every time that season returns.
//   spring → flowers on the ground      summer → green leaves on the branches
//   fall   → fruits on the branches      winter → snowballs and snowmen
// Visitors can add as many as they like. Each season holds up to 50 items;
// the 51st clears that season and the tree starts fresh.
// Only the season, the item and its spot are stored: no personal data.
//
//   GET  /api/garden                → { flowers: [{ s, c, x, y, t }, ...] }
//   POST /api/garden {s, c, x, y}   → { ok: true, flower, fresh }
//
// s = season (0 spring, 1 summer, 2 fall, 3 winter)
// c = which item in that season (spring 0-6, summer 0-3, fall 0-15, winter 0-2)
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

const LIMIT = 50;                         // items per season before it starts fresh
const ITEMS_PER_SEASON = [7, 4, 16, 3];   // spring flowers, summer leaves, fall fruits, winter snow
const key = s => `garden:${s}`;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      const lists = await Promise.all([0, 1, 2, 3].map(s => redis.lrange(key(s), 0, -1)));
      const flowers = lists.flat()
        .map(item => (typeof item === 'string' ? JSON.parse(item) : item))
        .filter(Boolean);
      return res.status(200).json({ flowers });
    }

    if (req.method === 'POST') {
      const { s, c, x, y } = req.body || {};
      const sNum = Number(s), cNum = Number(c), xNum = Number(x), yNum = Number(y);
      const ok = Number.isInteger(sNum) && sNum >= 0 && sNum < 4 &&
                 Number.isInteger(cNum) && cNum >= 0 && cNum < ITEMS_PER_SEASON[sNum] &&
                 xNum >= 0 && xNum <= 1 && yNum >= 0 && yNum <= 1;
      if (!ok) return res.status(400).json({ ok: false, error: 'bad item' });

      // full season → start fresh
      let fresh = false;
      if ((await redis.llen(key(sNum))) >= LIMIT) {
        await redis.del(key(sNum));
        fresh = true;
      }

      const flower = {
        s: sNum, c: cNum,
        x: Math.round(xNum * 1000) / 1000,
        y: Math.round(yNum * 1000) / 1000,
        t: Date.now(),
      };
      await redis.rpush(key(sNum), JSON.stringify(flower));
      return res.status(200).json({ ok: true, flower, fresh });
    }

    return res.status(405).json({ error: 'Use GET or POST' });
  } catch (err) {
    // if the database is unavailable, the homepage still works, just without visitor items
    return res.status(200).json({ ok: false, flowers: [], error: err.message });
  }
}
