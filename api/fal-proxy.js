// api/fal-proxy.js
//
// The real-time drawing page connects to fal.ai directly from the browser
// via a persistent WebSocket (that's how sub-second latency is possible —
// there's no time for a normal request/response round-trip to your own
// server on every brush stroke). But that means the fal.ai client library
// needs SOME way to authenticate those in-browser connections without the
// real secret key ever being visible in your page's source code.
//
// fal.ai's own client library solves this with a "proxy" pattern: the
// browser talks to a small endpoint on YOUR server (this file), which
// attaches the real secret key and forwards the request on to fal.ai.
// The key lives only here, in this server-side file, backed by a Vercel
// environment variable — never in the browser.
//
// ─────────────────────────────────────────────────────────────────────────
// SETUP:
// 1. Sign up at fal.ai, get an API key from your account/dashboard.
// 2. In Vercel: Settings → Environment Variables → add
//      name:  FAL_KEY
//      value: your real fal.ai key
// 3. package.json needs "@fal-ai/serverless-client" or the current
//    fal proxy helper — CHECK fal.ai's own "Next.js / server proxy"
//    documentation before deploying, since their exact recommended
//    proxy implementation can change. This file implements the general
//    shape of that pattern (forward the request, attach the key,
//    return the response) but should be checked against their current
//    docs at https://fal.ai/docs — proxy integration details are the
//    one part of this whole build I could not verify against a live
//    account.
// ─────────────────────────────────────────────────────────────────────────

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) {
    return res.status(500).json({ error: 'FAL_KEY is not set in environment variables yet.' });
  }

  // The fal client sends the target fal.ai path in a header when using
  // the proxy pattern — forward the request there, attaching the real key.
  const targetPath = req.headers['x-fal-target-url'];
  if (!targetPath) {
    return res.status(400).json({ error: 'Missing x-fal-target-url header' });
  }

  try {
    const falRes = await fetch(targetPath, {
      method: req.method,
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const data = await falRes.text();
    res.status(falRes.status);
    res.setHeader('Content-Type', falRes.headers.get('content-type') || 'application/json');
    return res.send(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}