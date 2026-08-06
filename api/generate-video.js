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

  const { image } = req.body; // the studio portrait URL from generate-persona.js

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
      duration: 5
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