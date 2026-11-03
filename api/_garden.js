// api/_garden.js  (reached through POST /api/stats?valley=1)
//
// Shared valley for Garden Life (garden-life.html). Every guest checks in here about
// once a second with where they are and how they look, and gets back everyone else
// who checked in during the last 15 seconds. This is what lets guests on different
// networks and in different countries see each other when a direct peer-to-peer link
// can't be made.
//
// Storage: the same Upstash Redis as stats.js (KV_REST_API_URL / TOKEN).
// One hash, "gl:valley" — one small entry per guest, removed when they go quiet,
// and the whole key expires after 5 minutes with nobody around. Nothing is kept.
// ─────────────────────────────────────────────────────────────────────────

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const KEY = 'gl:valley';
const STALE_MS = 15000;
const MAX_GUESTS = 60;

export default async function garden(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  try {
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
    b = b || {};
    const id = String(b.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
    if (!id) return res.status(400).json({ error: 'need id' });

    if (b.leave) { await redis.hdel(KEY, id); return res.status(200).json({ ok: true }); }

    const st = b.st;
    if (!st || typeof st !== 'object' || typeof st.x !== 'number') return res.status(400).json({ error: 'need st' });
    const entry = JSON.stringify({ t: Date.now(), st });
    if (entry.length > 2500) return res.status(413).json({ error: 'too big' });

    const p = redis.pipeline();
    p.hset(KEY, { [id]: entry });
    p.expire(KEY, 300);
    p.hgetall(KEY);
    const out = await p.exec();
    const all = out[2] || {};

    const now = Date.now(), players = {}, stale = [];
    for (const [k, v] of Object.entries(all)) {
      let o = v;
      if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) { o = null; } }
      if (!o || typeof o.t !== 'number' || now - o.t > STALE_MS) { stale.push(k); continue; }
      if (k !== id && Object.keys(players).length < MAX_GUESTS) players[k] = o;
    }
    if (stale.length) await redis.hdel(KEY, ...stale);

    return res.status(200).json({ players });
  } catch (err) {
    return res.status(200).json({ players: {}, error: 'unavailable' });
  }
}
