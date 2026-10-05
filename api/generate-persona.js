// api/generate-persona.js
//
// Screen 2 of the identity machine: takes the visitor's captured selfie and
// restyles it into a synthetic portrait, using the brain-reading prompt from
// the page.
//
// MODEL (Oct 2026): Google Nano Banana 2 on Replicate — higher resolution
// (up to 4K) and better at keeping the person recognizable than InstantID.
// Same REPLICATE_API_TOKEN as before, already set in Vercel.
//
// To go back to InstantID, restore the previous version of this file from
// git:   git checkout d411dd2 -- api/generate-persona.js
//
// ASYNC: this route only STARTS the job and returns { id } right away.
// The page then checks /api/prediction?id=... until the image is ready,
// so Vercel never times out.
// ─────────────────────────────────────────────────────────────────────────

import Replicate from 'replicate';
import { hasValidToken } from './_auth.js';

export const config = {
  maxDuration: 30, // only starts the job
};

const MODEL = 'google/nano-banana-2';

// Settings you can change:
//   RESOLUTION: '512px' | '1K' | '2K' | '4K'  (higher = sharper but slower)
//   ASPECT_RATIO: '4:3' matches the kiosk screen; '16:9' matches the video
const RESOLUTION = '2K';
const ASPECT_RATIO = '4:3';

// Wraps the style prompt so the model edits THIS person rather than
// inventing a stranger.
function buildPrompt(style) {
  return (
    'Turn this photo into a hyperrealistic, high-resolution natural portrait photograph of the same person outdoors in nature. ' +
    'Keep their face, facial features, skin tone and identity exactly as they are. ' +
    'Show their natural beauty with flattering soft natural light. ' +
    'Do not reshape the face or change their features; no fantasy or special effects. ' +
    'Any skin retouching or beauty filter should follow the style notes below. ' +
    'Setting and light: ' + style + '. ' +
    'Head-and-shoulders framing, sharp focus on the eyes, true-to-life colors, like a professional outdoor portrait photograph. No text, no watermark.'
  );
}

const DEFAULT_STYLE =
  'in a quiet green garden, soft overcast daylight, relaxed natural expression';

export default async function handler(req, res) {
  // only visitors who entered the access code on the page get a valid pass
  if (!hasValidToken(req)) {
    return res.status(401).json({ error: 'locked: enter the access code first' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  const { image, prompt } = req.body; // image: base64 selfie, prompt: style from the brain reading

  if (!image) {
    return res.status(400).json({ error: 'No image provided' });
  }

  if (!process.env.REPLICATE_API_TOKEN) {
    return res.status(500).json({
      error: 'REPLICATE_API_TOKEN is not set in this project\'s environment variables yet.'
    });
  }

  const style = (prompt && prompt.trim()) ? prompt.trim() : DEFAULT_STYLE;

  try {
    const replicate = new Replicate();

    const input = {
      prompt: buildPrompt(style),
      image_input: [image],
      resolution: RESOLUTION,
      aspect_ratio: ASPECT_RATIO,
      output_format: 'jpg'
    };

    // start the job and return right away — the page polls /api/prediction
    const prediction = await replicate.predictions.create({ model: MODEL, input });
    return res.status(200).json({ id: prediction.id, status: prediction.status });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
