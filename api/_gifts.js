// api/_gifts.js  (reached through POST /api/stats?gifts=1)
//
// Gifts on the porch for Garden Life (garden-life.html). A guest wraps a few things
// from their basket (and/or a note) for a friend by name. The gift waits on the
// friend's cabin porch until they next visit, even days later and from another country.
//
//   {op:"send",  to, from, items:{strawberry:3}, note}  -> {ok:true}
//   {op:"peek",  name}                                  -> {gifts:[{id,from,items,note,t}]}
//   {op:"claim", name, id}                              -> {ok:true}  (only the first claim wins)
//
// Storage: the same Upstash Redis as stats.js. One hash per recipient,
// "gl:gifts:<name>", one field per gift. Unopened gifts fade after 60 days.
// Names are matched loosely (case and accents ignored), the same way guests see each other.
// ─────────────────────────────────────────────────────────────────────────

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const TTL = 60 * 60 * 24 * 60; // 60 days
const MAX_ON_PORCH = 30;

export const nameKey = (n) => String(n || '')
  .toLowerCase().replace(/\u0111/g, 'd')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '').slice(0, 24);

const cleanText = (v, max) => String(v || '')
  .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '')
  .replace(/\s+/g, ' ').trim().slice(0, max);

function cleanItems(items) {
  const out = {};
  if (!items || typeof items !== 'object' || Array.isArray(items)) return out;
  for (const [k, v] of Object.entries(items)) {
    if (!/^[a-z]{2,16}$/.test(k)) continue;
    const n = Math.max(0, Math.min(10, Math.floor(Number(v) || 0)));
    if (n) out[k] = n;
    if (Object.keys(out).length >= 5) break;
  }
  return out;
}

const parse = (v) => {
  if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return null; } }
  return v && typeof v === 'object' ? v : null;
};

export default async function gifts(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};

  try {
    if (b.op === 'send') {
      const to = nameKey(b.to);
      const from = cleanText(b.from, 24);
      if (!to) return res.status(400).json({ error: 'need a name' });
      if (to === nameKey(from)) return res.status(400).json({ error: 'not to yourself' });
      const items = cleanItems(b.items);
      const note = cleanText(b.note, 200);
      if (!note && !Object.keys(items).length) return res.status(400).json({ error: 'empty gift' });

      const key = 'gl:gifts:' + to;
      if ((await redis.hlen(key)) >= MAX_ON_PORCH) return res.status(429).json({ error: 'porch full' });
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const gift = { id, from, items, note, t: Date.now() };
      const p = redis.pipeline();
      p.hset(key, { [id]: JSON.stringify(gift) });
      p.expire(key, TTL);
      await p.exec();
      return res.status(200).json({ ok: true });
    }

    if (b.op === 'peek') {
      const me = nameKey(b.name);
      if (!me) return res.status(200).json({ gifts: [] });
      const all = (await redis.hgetall('gl:gifts:' + me)) || {};
      const list = Object.values(all).map(parse).filter(g => g && g.id)
        .sort((a, c) => (a.t || 0) - (c.t || 0)).slice(0, 10);
      return res.status(200).json({ gifts: list });
    }

    if (b.op === 'claim') {
      const me = nameKey(b.name);
      const id = String(b.id || '').replace(/[^a-z0-9]/g, '').slice(0, 24);
      if (!me || !id) return res.status(400).json({ error: 'need name and id' });
      const n = await redis.hdel('gl:gifts:' + me, id);
      return res.status(200).json({ ok: n === 1 });
    }

    return res.status(400).json({ error: 'unknown op' });
  } catch (err) {
    return res.status(503).json({ error: 'unavailable' });
  }
}
