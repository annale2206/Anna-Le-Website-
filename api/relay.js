// api/relay.js
//
// Two-device mode for the identity machine. When one laptop cannot keep two
// Muse headbands streaming at once, headband B is connected to a SECOND
// device (another laptop, or an Android phone with Chrome) that opens
// muse-partner.html. That page sends B's raw brainwave samples here twice a
// second, and the main machine (identity-machine.html?muse=1&partner=remote)
// collects them from here and treats them exactly like a headband of its own.
//
// Storage: the same Upstash Redis as the stats (KV_REST_API_URL / TOKEN).
// Only the last ~20 seconds are kept, and the key expires after a minute of
// silence, so nothing piles up. Raw EEG is never stored permanently.
// ─────────────────────────────────────────────────────────────────────────

import { Redis } from '@upstash/redis';
import { hasValidToken } from './_auth.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const KEY = 'im:relay:b';
const KEEP = 40;          // chunks kept (about 20 s at 2 per second)
const MAX_SAMPLES = 160;  // per channel per chunk

export default async function handler(req, res) {
  if (!hasValidToken(req)) return res.status(401).json({ error: 'locked' });
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'POST') {
      const { t, ch, name } = req.body || {};
      if (!Array.isArray(ch) || ch.length !== 4) return res.status(400).json({ error: 'need 4 channels' });
      const clean = ch.map(a => (Array.isArray(a) ? a : []).slice(0, MAX_SAMPLES).map(v => {
        const n = Number(v); return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
      }));
      const item = { t: Number(t) || Date.now(), name: String(name || '').slice(0, 30), ch: clean };
      const p = redis.pipeline();
      p.rpush(KEY, JSON.stringify(item));
      p.ltrim(KEY, -KEEP, -1);
      p.expire(KEY, 60);
      await p.exec();
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET') {
      const since = Number(req.query.since) || 0;
      const raw = await redis.lrange(KEY, 0, -1);
      const items = (raw || [])
        .map(x => (typeof x === 'string' ? JSON.parse(x) : x))
        .filter(x => x && x.t > since);
      return res.status(200).json({ items });
    }

    return res.status(405).json({ error: 'Use GET or POST' });
  } catch (err) {
    return res.status(200).json({ items: [], error: err.message });
  }
}
