// api/fal/token.js
//
// Mints a short-lived JWT token for fal's realtime WebSocket auth.
// Required because fal.realtime.connect()'s older "just point at a
// proxy" auto-token behavior is now deprecated (as of the client
// version live-draw.html pulls from jsDelivr) — the console showed:
//   "[fal.realtime] Using the default token provider is deprecated.
//    Please provide a `tokenProvider` function..."
// That deprecated path was silently stalling instead of connecting,
// which is why the page hung on "connecting..." with no visible error.
//
// This is the endpoint live-draw.html's tokenProvider calls:
//   GET /api/fal/token?app=fal-ai%2Ffast-lcm-diffusion%2Frealtime
// It returns { token } — a short-lived credential scoped to that one
// app, which the browser then uses to open the WebSocket directly.
// FAL_KEY itself never reaches the browser at any point.
//
// SECURITY NOTE (per fal's own docs): a token endpoint like this
// should normally check that the request comes from an authenticated
// user before minting a token, since anyone who can hit it can spend
// your fal credits. This project has no user accounts / auth system,
// so that check is intentionally omitted here — acceptable for a
// portfolio piece, but worth knowing if this endpoint ever needs
// stricter protection (e.g. if traffic/cost becomes a concern).

const TOKEN_DURATION_SECONDS = 120;

export default async function handler(req, res) {
  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) {
    return res.status(500).json({ error: 'FAL_KEY is not set in environment variables yet.' });
  }

  const app = req.query && req.query.app;
  if (!app) {
    return res.status(400).json({ error: 'Missing app parameter' });
  }

  try {
    const falRes = await fetch('https://rest.fal.ai/tokens/realtime', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${FAL_KEY}`,
      },
      body: JSON.stringify({
        allowed_apps: [app],
        duration: TOKEN_DURATION_SECONDS,
      }),
    });

    if (!falRes.ok) {
      const errText = await falRes.text();
      return res.status(502).json({ error: 'fal token error: ' + errText });
    }

    const data = await falRes.json();
    return res.status(200).json({ token: data.token });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}