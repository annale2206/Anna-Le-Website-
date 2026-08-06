// api/generate-video.js
//
// Screen 3 of the identity machine: takes the studio portrait from screen 2
// and animates it into a short video, using Kling v3 Omni Video on
// Replicate — via Replicate's official Node.js client library.
//
// ─────────────────────────────────────────────────────────────────────────
// SETUP:
//
// 1. Same REPLICATE_API_TOKEN as generate-persona.js, already set in
//    Vercel's Environment Variables. The Replicate client below picks it
//    up automatically from that environment variable — no need to paste
//    it anywhere in this file.
//
// 2. package.json (in the project root) already lists "replicate" as a
//    dependency, so Vercel installs it automatically on deploy.
//
// 3. Confirmed input field for the starting image: `start_image` (a URI).
//    Constraints from the model's schema, worth knowing:
//      - format: .jpg / .jpeg / .png
//      - max size: 10MB
//      - minimum dimension: 300px
//      - aspect ratio: between 1:2.5 and 2.5:1
//    The `image` value coming from generate-persona.js will already be a
//    real hosted URL (Replicate returns one after generating the studio
//    portrait), so it satisfies the "uri" requirement automatically —
//    nothing extra to convert here.
//
// 4. Confirmed from a real 422 error: this model also requires a
//    `prompt` field alongside `start_image` — it's not optional. The
//    prompt below describes subtle, natural motion (breathing, slight
//    head turn, blinking) rather than anything dramatic, to keep the
//    animation feeling like a living portrait rather than a music video.
//    Adjust the wording if you want more or less movement in the result.
// ─────────────────────────────────────────────────────────────────────────

import Replicate from 'replicate';

// Video generation (Kling) commonly takes even longer than image
// generation. With Fluid Compute enabled in Vercel's project settings,
// the platform allows up to 300 seconds — this uses 280 to leave a small
// safety margin under that ceiling.
export const config = {
  maxDuration: 280,
};

const MODEL = 'kwaivgi/kling-v3-omni-video';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  const { image, style } = req.body; // image: portrait URL, style: visitor's preset choice

  const STYLE_PROMPTS = {
    minimal: 'subtle natural motion, gentle breathing, slight head turn, ' +
             'soft blinking, cinematic portrait animation, minimal camera movement',
    expressive: 'expressive motion, animated facial expression, confident ' +
             'head movement, engaged eye contact, lively cinematic portrait',
    surreal: 'dreamlike motion, slow otherworldly drift, surreal shifting ' +
             'light, ethereal atmosphere, ambient particle motion around the subject',
  };
  const chosenPrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.minimal;

  if (!image) {
    return res.status(400).json({ error: 'No image provided' });
  }

  if (!process.env.REPLICATE_API_TOKEN) {
    return res.status(500).json({
      error: 'REPLICATE_API_TOKEN is not set in this project\'s environment variables yet.'
    });
  }

  try {
    const replicate = new Replicate();

    const input = {
      start_image: image,
      duration: 5,
      prompt: chosenPrompt
    };

    const output = await replicate.run(MODEL, { input });

    // Replicate's Node client returns a file-like object with a .url()
    // method for video outputs — this matches the pattern in their docs.
    const videoUrl = typeof output.url === 'function' ? output.url() : output;

    return res.status(200).json({ video: videoUrl });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}