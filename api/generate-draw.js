// api/generate-draw.js
//
// Powers the live-draw page. Unlike the earlier real-time WebSocket
// attempt, this uses a plain REST call — the same reliable request/
// response pattern as generate-persona.js and generate-video.js, which
// have worked correctly since we got them running. It's called
// repeatedly (throttled to roughly every 400-600ms) while the visitor
// draws, giving near-instant updates without the WebSocket/token
// complexity that real-time mode required.
//
// ─────────────────────────────────────────────────────────────────────────
// SETUP: same FAL_KEY environment variable already set in Vercel. No fal
// client library needed here — a plain fetch() call, same style as the
// Replicate functions.
//
// SEED SUPPORT: accepts an optional `seed` from the request body. If the
// model supports it (fast-lcm-diffusion's schema should be checked to
// confirm the exact field name — this assumes `seed`, matching the
// common convention across most fal image models), passing the same
// seed with the same inputs reproduces the same result; leaving it out
// lets fal pick a random one each time. The actual seed used is returned
// back to the client either way, so a visitor can lock in a result they
// like.
// ─────────────────────────────────────────────────────────────────────────

const MODEL_URL = 'https://fal.run/fal-ai/fast-lcm-diffusion';

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) {
    return res.status(500).json({ error: 'FAL_KEY is not set in environment variables yet.' });
  }

  const { image, prompt, seed } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'No image provided' });
  }

  try {
    const requestBody = {
      prompt: prompt || 'a detailed painting, expressive brushwork',
      image_url: image,
      sync_mode: true,
    };
    if (seed != null && !Number.isNaN(seed)) {
      requestBody.seed = seed;
    }

    const falRes = await fetch(MODEL_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!falRes.ok) {
      const errText = await falRes.text();
      return res.status(502).json({ error: 'fal error: ' + errText });
    }

    const data = await falRes.json();
    const resultUrl = data.images && data.images[0] ? data.images[0].url : null;

    if (!resultUrl) {
      return res.status(502).json({ error: 'No image in fal response' });
    }

    // pass back whatever seed fal actually used — useful when the
    // visitor didn't set one, so they can lock in a result they liked
    return res.status(200).json({ image: resultUrl, seed: data.seed ?? seed ?? null });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}