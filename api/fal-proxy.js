// api/fal-proxy.js
//
// Uses fal.ai's OFFICIAL @fal-ai/server-proxy package instead of a
// hand-built proxy. This matters specifically for the real-time/WebSocket
// flow: fal.realtime.connect() needs to fetch short-lived JWT tokens
// through the proxy in a particular way, and a hand-rolled generic
// pass-through (what this file used to be) doesn't correctly implement
// that — it produced exactly the errors seen during testing (a
// deprecated "default token provider" warning, and a request to an
// undefined URL). fal's own package is built and maintained specifically
// to get this right.
//
// ─────────────────────────────────────────────────────────────────────────
// SETUP:
// 1. FAL_KEY must already be set in Vercel's Environment Variables.
// 2. package.json now lists "@fal-ai/server-proxy" as a dependency.
// 3. This needs a real test against a live account — this was the one
//    part of the whole build flagged from the start as unverified, and
//    real-time WebSocket auth is inherently more particular than the
//    request/response APIs used everywhere else on this site.
// ─────────────────────────────────────────────────────────────────────────

import * as falProxy from '@fal-ai/server-proxy/express';

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  try {
    await falProxy.handler(req, res);
  } catch (err) {
    console.error('fal-proxy error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}