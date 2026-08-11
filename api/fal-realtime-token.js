// api/fal-realtime-token.js
//
// Called by the explicit tokenProvider in live-draw.html. Takes the
// model "app" name the client wants to connect to, mints a short-lived
// token from fal.ai using the real FAL_KEY (server-side only), and
// returns that token as plain text to the browser.
//
// ─────────────────────────────────────────────────────────────────────────
// HONESTY NOTE — this is the one piece of the whole build I could not
// fully confirm without live access to a fal.ai account:
//
// fal's own docs and examples consistently show the CLIENT-side shape
// (fetch a token from your own backend, return response.text()), but do
// not publish the exact underlying REST call your backend should make to
// fal.ai to actually mint that token. The URL below
// (https://rest.alpha.fal.ai/tokens) is a best-effort inference based on
// fal's known REST API structure (rest.alpha.fal.ai is confirmed to host
// other utility endpoints, like file storage), not a confirmed-correct
// endpoint.
//
// IF THIS DOESN'T WORK: open Developer Tools → Network tab, trigger a
// connection attempt, and look for any request fal's client library
// itself tries to make that fails or 404s BEFORE it reaches this file —
// the exact URL it was trying to hit (visible in the Network tab's
// request details, even if the console shortened it to "undefined") is
// the strongest clue to what the real endpoint should be. Update the
// TOKEN_ENDPOINT constant below to match.
// ─────────────────────────────────────────────────────────────────────────

const TOKEN_ENDPOINT = 'https://rest.alpha.fal.ai/tokens';

export const config = {
  maxDuration: 15,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) {
    return res.status(500).json({ error: 'FAL_KEY is not set in environment variables yet.' });
  }

  const { app } = req.body;
  if (!app) {
    return res.status(400).json({ error: 'Missing app in request body' });
  }

  try {
    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        allowed_apps: [app],
        token_expiration: 300, // seconds
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return res.status(502).json({ error: 'fal token request failed: ' + errText });
    }

    const token = await tokenRes.text();
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(token);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}