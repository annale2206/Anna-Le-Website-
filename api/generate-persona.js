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
    'Transform this photo into a striking, high-resolution portrait of the same person. ' +
    'Keep their face, facial features, skin tone and identity clearly recognizable. ' +
    'Style: ' + style + '. ' +
    'Head-and-shoulders framing, sharp focus on the eyes, rich detail, professional photography quality. ' +
    'No text, no watermark.'
  );
}

const DEFAULT_STYLE =
  'instagram beauty filter aesthetic, glowing dewy skin, subtle glam makeup, ' +
  'soft romantic lighting, warm golden hour glow, blurred bokeh background, editorial beauty photography';

export default async function handler(req, res) {
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
