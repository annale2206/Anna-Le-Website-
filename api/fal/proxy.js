// api/fal/proxy.js
//
// Required for the realtime WebSocket mode in live-draw.html
// (fal.realtime.connect + fal.config({ proxyUrl: '/api/fal/proxy' })).
//
// WebSocket connections run directly from the browser, so the fal API
// key can never be embedded client-side. Instead, when
// fal.realtime.connect() is called, the fal client library quietly
// fetches a short-lived JWT token through THIS endpoint to authenticate
// the WebSocket — your FAL_KEY never leaves the server. This is fal's
// standard "server-side proxy" pattern, documented here:
// https://docs.fal.ai/model-apis/real-time/secrets
//
// This is a from-scratch implementation of fal's documented proxy
// contract (see link above) rather than the official @fal-ai/server-proxy
// package, since that package ships pre-built handlers for Next.js and
// Express specifically — this project uses plain Vercel serverless
// functions, so a small hand-written version keeps the same style as
// generate-draw.js (no extra framework dependency).
//
// Proxy contract (per fal's docs):
//   - The target fal URL to call arrives in the `x-fal-target-url` header.
//   - Missing header -> 400. Header pointing outside *.fal.ai/*.fal.run -> 412.
//   - Non-JSON request bodies -> 415.
//   - This proxy adds `Authorization: Key <FAL_KEY>` and forwards the request.
//   - The response (status + JSON body) is passed straight back to the client.
//
// SETUP: same FAL_KEY environment variable already used by
// generate-draw.js. No fal client library needed server-side — a plain
// fetch() call, same as the rest of this project's API routes.

export default async function handler(req, res) {
  const targetUrl = req.headers['x-fal-target-url'];
  if (!targetUrl) {
    return res.status(400).json({ error: 'x-fal-target-url header is required' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return res.status(412).json({ error: 'x-fal-target-url is not a valid URL' });
  }

  const allowedHost = /(^|\.)fal\.(ai|run)$/i.test(parsedUrl.hostname);
  if (!allowedHost) {
    return res.status(412).json({ error: 'x-fal-target-url must point to *.fal.ai or *.fal.run' });
  }

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) {
    return res.status(500).json({ error: 'FAL_KEY is not set in environment variables yet.' });
  }

  const contentType = req.headers['content-type'] || '';
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  if (hasBody && req.body && !contentType.includes('application/json')) {
    return res.status(415).json({ error: 'Only application/json request bodies are supported' });
  }

  try {
    const falRes = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: hasBody && req.body ? JSON.stringify(req.body) : undefined,
    });

    const data = await falRes.json();
    return res.status(falRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}