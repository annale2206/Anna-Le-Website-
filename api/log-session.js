// api/log-session.js
//
// Called at three points during a visit: when someone unlocks the machine
// (counts as a participant), when a portrait finishes generating, and when
// a video finishes generating. Increments the relevant counter and appends
// a record (URL + timestamp) to that stage's log — this IS the "folder"
// of archived photos/videos/information: since generated images and
// videos already live on Replicate's own hosting, this log is a list of
// references to them plus a timestamp, rather than copies of the files
// themselves. Uses the same Vercel KV database as stats.js.
//
// ─────────────────────────────────────────────────────────────────────────
// SETUP: same Vercel KV database as stats.js — nothing extra to configure
// here once that's connected.
// ─────────────────────────────────────────────────────────────────────────

import { kv } from '@vercel/kv';

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
      await kv.incr('participants');
    }
    if (stage === 'portrait') {
      await kv.incr('portraits');
      if (url) {
        await kv.rpush('portrait_log', JSON.stringify({ url, ts: Date.now() }));
      }
    }
    if (stage === 'video') {
      await kv.incr('videos');
      if (url) {
        await kv.rpush('video_log', JSON.stringify({ url, ts: Date.now() }));
      }
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    // Logging failures shouldn't interrupt the visitor's experience —
    // fail quietly here rather than surfacing an error mid-installation.
    return res.status(200).json({ ok: false, error: err.message });
  }
}