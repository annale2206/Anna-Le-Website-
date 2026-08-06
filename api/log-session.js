// api/log-session.js
//
// Called at three points during a visit: when someone unlocks the machine
// (counts as a participant), when a portrait finishes generating, and when
// a video finishes generating. Increments the relevant counter and appends
// a record (URL + timestamp) to that stage's log — this IS the "folder" of
// archived photos/videos/information: since generated images and videos
// already live on Replicate's own hosting, this log is a list of
// references to them plus a timestamp, rather than copies of the files
// themselves. Uses the same Upstash Redis connection as stats.js.
// ─────────────────────────────────────────────────────────────────────────
// SETUP: same KV_REST_API_URL / KV_REST_API_TOKEN connection as stats.js.
// ─────────────────────────────────────────────────────────────────────────

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  const { stage, url } = req.body;

  if (!stage) {
    return res.status(400).json({ error: 'Missing stage' });
  }

  try {
    if (stage === 'participant') {
      await redis.incr('participants');
    }
    if (stage === 'portrait') {
      await redis.incr('portraits');
      if (url) {
        await redis.rpush('portrait_log', JSON.stringify({ url, ts: Date.now() }));
      }
    }
    if (stage === 'video') {
      await redis.incr('videos');
      if (url) {
        await redis.rpush('video_log', JSON.stringify({ url, ts: Date.now() }));
      }
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    // Logging failures shouldn't interrupt the visitor's experience —
    // fail quietly here rather than surfacing an error mid-installation.
    return res.status(200).json({ ok: false, error: err.message });
  }
}