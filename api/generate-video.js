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
import { hasValidToken } from './_auth.js';
import { cleanVisitorWords } from './_words.js';

// ASYNC UPDATE (Oct 2026): this route no longer waits for the video (Vercel
// was timing out). It starts the job and returns { id } right away; the page
// polls /api/prediction?id=... until the video is ready.

// Video generation (Kling) commonly takes even longer than image
// generation. With Fluid Compute enabled in Vercel's project settings,
// the platform allows up to 300 seconds — this uses 280 to leave a small
// safety margin under that ceiling.
export const config = {
  maxDuration: 30, // only starts the job now
};

// MODEL SWITCH (Oct 2026): Kling → Google Veo 3.1 Fast on Replicate.
// Same REPLICATE_API_TOKEN, no new key needed. To go back to Kling, set
// MODEL back to 'kwaivgi/kling-v3-omni-video' and use `start_image` instead
// of `image` in the input below (Kling also used duration 5).
const MODEL = 'google/veo-3.1-fast';

// Veo options: duration 4, 6 or 8 seconds · resolution '720p' or '1080p'
// aspect_ratio '16:9' or '9:16'. Veo can also make matching sound — the
// kiosk page plays videos muted, so it's off here; set to true to try it.
const DURATION = 8;                 // default; the page asks for 8 s per scene
const ALLOWED_DURATIONS = [4, 6, 8];
const RESOLUTION = '720p';
const GENERATE_AUDIO = false;

export default async function handler(req, res) {
  // only visitors who entered the access code on the page get a valid pass
  if (!hasValidToken(req)) {
    return res.status(401).json({ error: 'locked: enter the access code first' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  // image: portrait URL · prompt: motion from the brain reading (one scene)
  // visitor: the visitor's own words · duration: 4, 6 or 8 seconds
  // part: 0 for the first part of the film; later parts start from the last
  // frame of the part before (sent as a JPEG data URL), so the film continues.
  const { image, prompt, visitor, duration, part } = req.body;
  const partNum = Math.max(0, Math.min(9, Number(part) || 0));
  const seconds = ALLOWED_DURATIONS.includes(Number(duration)) ? Number(duration) : DURATION;
  const words = cleanVisitorWords(visitor);

  const DEFAULT_MOTION_PROMPT = 'subtle natural motion, gentle breathing, ' +
    'slight head turn, soft blinking, cinematic portrait animation, minimal camera movement';

  const eegPart = (prompt && String(prompt).trim()) ? String(prompt).trim().slice(0, 900) : DEFAULT_MOTION_PROMPT;
  let finalPrompt;
  if (words) {
    // the visitor's words lead: they say what the person DOES;
    // the brain reading sets the energy, light and camera
    finalPrompt =
      'The person in this image is ' + words + '. Show them clearly acting this out with visible, ' +
      'expressive movement of the whole body (for example dancing, performing, walking, gesturing), ' +
      'not just small facial motion. Energy and light from their brain reading: ' + eegPart;
  } else {
    finalPrompt = eegPart;
  }
  if (partNum > 0) finalPrompt += '. This continues an earlier shot: start exactly from this frame and keep the same place, light and camera direction';
  finalPrompt += '. Keep the same person, face and identity throughout, realistic motion.';

  if (!image || typeof image !== 'string' ||
      !(/^https:\/\//.test(image) || /^data:image\/(jpeg|png);base64,/.test(image)) ||
      image.length > 4000000) {
    return res.status(400).json({ error: 'No usable image provided' });
  }

  if (!process.env.REPLICATE_API_TOKEN) {
    return res.status(500).json({
      error: 'REPLICATE_API_TOKEN is not set in this project\'s environment variables yet.'
    });
  }

  try {
    const replicate = new Replicate();

    const input = {
      image: image,                 // the portrait from stage 02 = first frame
      prompt: finalPrompt,
      duration: seconds,
      resolution: RESOLUTION,
      aspect_ratio: '16:9',
      generate_audio: GENERATE_AUDIO,
      negative_prompt: 'distorted face, warped features, extra limbs, text, watermark'
    };

    // start the job and return right away — the page polls /api/prediction
    const prediction = await replicate.predictions.create({ model: MODEL, input });
    return res.status(200).json({ id: prediction.id, status: prediction.status });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}