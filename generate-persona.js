// api/generate-persona.js
//
// Screen 2 of the identity machine: takes the visitor's captured selfie and
// generates a professional studio portrait — clean background, new synthetic
// identity — using InstantID on Replicate, via Replicate's official Node.js
// client library.
//
// ─────────────────────────────────────────────────────────────────────────
// SETUP:
//
// 1. REPLICATE_API_TOKEN is already set in Vercel's Environment Variables
//    (same one generate-video.js uses). The client below picks it up
//    automatically — nothing to paste here.
//
// 2. package.json already lists "replicate" as a dependency, so Vercel
//    installs it automatically on deploy.
//
// 3. Confirmed model: zsxkib/instant-id. InstantID takes a face photo
//    (`image`) plus an optional `pose_image` (controls framing/composition
//    of the output — since the installation only has one captured photo,
//    this file reuses the same selfie for both).
//
// 4. Confirmed from the model's full schema:
//      - Output type is `uri[]` — an array of plain URL strings, which is
//        exactly what the fallback logic below already handles.
//      - `sdxl_weights` default is "stable-diffusion-xl-base-1.0"; this
//        file deliberately uses "protovision-xl-high-fidel" instead (a
//        different available preset, shown in Replicate's own example) —
//        change it if you want to compare looks.
//      - `controlnet_conditioning_scale` (default 0.8, max 1.5) directly
//        controls how strongly the output resembles the input face —
//        worth experimenting with for "identity machine" specifically:
//        higher = more recognizably *you*, lower = more of a stranger.
//      - `ip_adapter_scale` (default 0.8) is a related fidelity/detail
//        knob, similarly worth testing against a few real faces before
//        the show.
//
// 5. Still worth testing once you have a real token: the schema types
//    `image` and `pose_image` as `uri`. The captured selfie starts as a
//    base64 data URL from the browser's canvas — Replicate generally
//    accepts base64 data URIs directly for uri-typed image inputs, but
//    confirm this with one real end-to-end test run before the show.
// ─────────────────────────────────────────────────────────────────────────

import Replicate from 'replicate';

// Vercel's default timeout (5-10s on the Hobby plan) is far too short for
// AI image generation, which commonly takes 10-30+ seconds. This extends
// it to 60 seconds — the maximum allowed on Hobby without upgrading.
export const config = {
  maxDuration: 60,
};

const MODEL = 'zsxkib/instant-id:2e4785a4d80dadf580077b2244c8d7c05d8e3faac04a04c02d8e099dd2876789';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  const { image } = req.body; // base64 data URL of the captured selfie

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
      image: image,
      pose_image: image,
      prompt: 'professional studio portrait, clean neutral background, ' +
              'soft even studio lighting, sharp focus, a new synthetic ' +
              'identity, high detail, photorealistic',
      negative_prompt: '(lowres, low quality, worst quality:1.2), (text:1.2), ' +
              'watermark, painting, drawing, illustration, glitch, deformed, ' +
              'mutated, cross-eyed, ugly, disfigured',
      sdxl_weights: 'protovision-xl-high-fidel',
      guidance_scale: 5
    };

    const output = await replicate.run(MODEL, { input });

    // InstantID returns an array of outputs — take the first
    const resultUrl = Array.isArray(output)
      ? (typeof output[0].url === 'function' ? output[0].url() : output[0])
      : output;

    return res.status(200).json({ image: resultUrl });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}