// api/stats.js
//
// Returns the live counters for the research-lab dashboard: how many
// people have participated, how many portraits have been generated, how
// many videos. Backed by Upstash Redis (connected through Vercel's
// Marketplace) — serverless functions have no persistent memory of their
// own, so a real store is needed for these numbers to survive between
// visitors instead of resetting on every request.
//
// ─────────────────────────────────────────────────────────────────────────
// SETUP: connects using the exact environment variables Vercel's Upstash
// integration created for this project (KV_REST_API_URL and
// KV_REST_API_TOKEN — the integration's older naming, kept for backward
// compatibility, rather than the newer UPSTASH_-prefixed names).
// package.json already lists "@upstash/redis" as a dependency.
// ─────────────────────────────────────────────────────────────────────────

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Use GET' });
  }

  try {
    const [participants, portraits, videos] = await Promise.all([
      redis.get('participants'),
      redis.get('portraits'),
      redis.get('videos'),
    ]);

    return res.status(200).json({
      participants: participants || 0,
      portraits: portraits || 0,
      videos: videos || 0,
    });
  } catch (err) {
    // If Redis isn't connected yet, fail quietly with zeros rather than
    // breaking the whole page — the dashboard just shows 0s until
    // storage is set up.
    return res.status(200).json({ participants: 0, portraits: 0, videos: 0 });
  }
}