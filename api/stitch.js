// api/stitch.js
//
// "Crochet the tree" on the homepage: every visitor can add one stitch to
// the yarn wrapping the big tree. Only a running count is stored, no
// personal data. The page works out where each stitch sits from its number.
//
//   GET  /api/stitch   → { count }
//   POST /api/stitch   → { count }   (adds one stitch)
//
// The count lives under 'stitches_v2' (changing this name starts again from 0).
//
// Uses the same Upstash Redis connection as stats.js / log-session.js
// (KV_REST_API_URL + KV_REST_API_TOKEN, already set in Vercel).

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      return res.status(200).json({ count: Number(await redis.get('stitches_v2')) || 0 });
    }
    if (req.method === 'POST') {
      return res.status(200).json({ count: await redis.incr('stitches_v2') });
    }
    return res.status(405).json({ error: 'Use GET or POST' });
  } catch (err) {
    // if the database is unavailable, the homepage still works
    return res.status(200).json({ count: 0, error: err.message });
  }
}
