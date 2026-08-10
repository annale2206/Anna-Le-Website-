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
// QUALITY TUNING (adjusted after real-world testing produced poor
// results with the original defaults):
//      - `guidance_scale` raised from 5 to 7.5 (the model's actual
//        default) — 5 was too low, causing vague, muddy results with
//        weak prompt adherence.
//      - `num_inference_steps` raised from the default 30 to 50 — more
//        denoising steps generally means sharper, more coherent detail,
//        at the cost of a few extra seconds of generation time (there's
//        headroom for this now that the timeout is 120s).
//      - `output_quality` raised from the default 80 to 95, to reduce
//        compression artifacts in the final image.
//      - `controlnet_conditioning_scale` lowered from 0.8 to 0.7, and
//        `ip_adapter_scale` from 0.8 to 0.65 — both were locking too
//        rigidly onto the source selfie, which can produce warped or
//        uncanny results when combined with a stylistically different
//        prompt. Lowering both gives the model a bit more creative room.
//      - Negative prompt expanded to explicitly rule out plastic/waxy
//        skin and asymmetrical features, two common InstantID failure
//        modes.
//    These are a reasonable starting point, not guaranteed perfect —
//    image model quality is genuinely trial-and-error. If results are
//    still off, the next things worth adjusting (in rough order of
//    impact) are the prompt wording itself, then
//    controlnet_conditioning_scale further, then trying a different
//    sdxl_weights preset.
//
// STYLE UPDATE: swapped the flat grey studio-headshot look for a warmer
// "Instagram beauty filter" aesthetic — glowing/dewy skin, soft romantic
// lighting, blurred bokeh background instead of a plain backdrop. Note
// this deliberately removed "plastic skin, waxy" from the negative
// prompt, since a beauty-filter look is SUPPOSED to smooth skin — that
// negative term was actively fighting the desired look. If results start
// looking too smoothed/artificial, that's the first thing to reintroduce
// or dial back via a lower ip_adapter_scale.
//
// 5. Still worth testing once you have a real token: the schema types
//    `image` and `pose_image` as `uri`. The captured selfie starts as a
//    base64 data URL from the browser's canvas — Replicate generally
//    accepts base64 data URIs directly for uri-typed image inputs, but
//    confirm this with one real end-to-end test run before the show.
// ─────────────────────────────────────────────────────────────────────────

import Replicate from 'replicate';

// Vercel's default timeout (5-10s on the Hobby plan) is far too short for
// AI image generation, which commonly takes 10-30+ seconds. With Fluid
// Compute enabled in project settings, this can go up to 300 seconds —
// 120 gives a healthy safety margin for InstantID specifically.
export const config = {
  maxDuration: 120,
};

const MODEL = 'zsxkib/instant-id:2e4785a4d80dadf580077b2244c8d7c05d8e3faac04a04c02d8e099dd2876789';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  const { image, prompt } = req.body; // image: base64 selfie, prompt: visitor's own description

  const DEFAULT_PROMPT = 'instagram beauty filter aesthetic, flawless glowing skin, ' +
    'soft dewy radiant complexion, smooth even skin tone, subtle glam makeup, ' +
    'bright sparkling eyes, soft romantic lighting, warm golden hour glow, ' +
    'blurred bokeh background, editorial beauty photography, professional ' +
    'retouching, 85mm lens, shallow depth of field, photorealistic, high detail';

  const finalPrompt = (prompt && prompt.trim()) ? prompt.trim() : DEFAULT_PROMPT;

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
      prompt: finalPrompt,
      negative_prompt: '(lowres, low quality, worst quality:1.3), (text:1.3), ' +
              'watermark, painting, drawing, illustration, cartoon, 3d render, ' +
              'grey background, plain background, flat lighting, harsh ' +
              'shadows, glitch, deformed, mutated, cross-eyed, asymmetrical ' +
              'eyes, extra fingers, ugly, disfigured, blurry, overexposed, ' +
              'oversaturated',
      sdxl_weights: 'protovision-xl-high-fidel',
      guidance_scale: 7.5,
      num_inference_steps: 50,
      output_quality: 95,
      controlnet_conditioning_scale: 0.7,
      ip_adapter_scale: 0.65
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