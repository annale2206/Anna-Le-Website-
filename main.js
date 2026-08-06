// api/stats.js
//
// Returns the live counters for the research-lab dashboard: how many
// people have participated, how many portraits have been generated, how
// many videos. Backed by Vercel KV (a small hosted key-value database),
// since serverless functions have no persistent disk of their own —
// numbers would reset on every request without a real store behind them.
//
// ─────────────────────────────────────────────────────────────────────────
// SETUP (one-time, in Vercel's dashboard, not in code):
//
// 1. Go to your Vercel project → Storage tab
// 2. Click "Create Database" → choose "KV"
// 3. Follow the prompts to create it, then click "Connect" to link it to
//    this project — Vercel automatically adds the environment variables
//    this file needs (KV_REST_API_URL, KV_REST_API_TOKEN, etc.), so
//    there's nothing to manually copy or paste here.
// 4. package.json already lists "@vercel/kv" as a dependency.
// ─────────────────────────────────────────────────────────────────────────

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Use GET' });
  }

  try {
    const [participants, portraits, videos] = await Promise.all([
      kv.get('participants'),
      kv.get('portraits'),
      kv.get('videos'),
    ]);

    return res.status(200).json({
      participants: participants || 0,
      portraits: portraits || 0,
      videos: videos || 0,
    });
  } catch (err) {
    // If KV isn't set up yet, fail quietly with zeros rather than
    // breaking the whole page — the dashboard just shows 0s until
    // storage is connected.
    return res.status(200).json({ participants: 0, portraits: 0, videos: 0 });
  }
}