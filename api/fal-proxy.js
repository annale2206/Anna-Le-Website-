// api/fal-proxy.js
//
// A hand-built proxy matching fal.ai's own documented "custom proxy, any
// framework" contract exactly (from their proxy-setup docs):
//   1. Accept all HTTP methods (GET, POST, PUT, DELETE, OPTIONS)
//   2. Read the target URL from the x-fal-target-url header
//   3. Add the real API key via the Authorization header
//   4. Forward the request to fal and pipe the response back
//
// This replaces an earlier attempt using @fal-ai/server-proxy/express —
// that package assumes a real Express app underneath it (route matching,
// query parsing, etc.), which a raw Vercel serverless function doesn't
// fully provide, and it was returning 400s in testing. This version talks
// to fal's documented protocol directly instead, which should be more
// robust in a plain Vercel function.
//
// ─────────────────────────────────────────────────────────────────────────
// SETUP:
// 1. FAL_KEY must be set in Vercel's Environment Variables.
// 2. No special package needed for this version — just plain fetch().
//    (@fal-ai/server-proxy can be removed from package.json if this
//    version is kept, though leaving it there does no harm.)
// 3. STILL NEEDS A REAL LIVE TEST — this is the second attempt at this
//    proxy, and real-time WebSocket auth has proven to be the most
//    particular, hardest-to-verify-blind part of this whole build.
// ─────────────────────────────────────────────────────────────────────────

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  // CORS preflight — some environments send an OPTIONS request before
  // the real one; without handling it explicitly, that preflight can
  // itself come back as an error and block the real request.
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-fal-target-url, Authorization');
    return res.status(204).end();
  }

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) {
    return res.status(500).json({ error: 'FAL_KEY is not set in environment variables yet.' });
  }

  // fal's client library sends the real fal.ai endpoint to call in this
  // header — check a couple of casings/variants defensively, since header
  // handling can differ slightly across runtimes.
  const targetUrl =
    req.headers['x-fal-target-url'] ||
    req.headers['X-Fal-Target-Url'] ||
    req.query['x-fal-target-url'];

  if (!targetUrl) {
    return res.status(400).json({
      error: 'Missing x-fal-target-url header',
      receivedHeaders: Object.keys(req.headers),
    });
  }

  try {
    const forwardHeaders = {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': req.headers['content-type'] || 'application/json',
    };

    const falRes = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: (req.method !== 'GET' && req.method !== 'HEAD')
        ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
        : undefined,
    });

    const data = await falRes.text();

    res.status(falRes.status);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', falRes.headers.get('content-type') || 'application/json');
    return res.send(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}