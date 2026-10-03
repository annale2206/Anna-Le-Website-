// api/prediction.js
//
// Checks on a Replicate job started by generate-persona.js or generate-video.js.
// The identity machine page calls  GET /api/prediction?id=<id>  every few
// seconds until status is "succeeded" (or "failed"/"canceled").
//
// Returns: { status, output, error }
//   output is a single URL string (first image for InstantID, the video for Kling)

import Replicate from 'replicate';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  const id = req.query && req.query.id;
  if (!id || !/^[a-z0-9]+$/i.test(id)) {
    return res.status(400).json({ error: 'Missing or invalid id' });
  }
  if (!process.env.REPLICATE_API_TOKEN) {
    return res.status(500).json({ error: 'REPLICATE_API_TOKEN is not set in this project\'s environment variables yet.' });
  }
  try {
    const replicate = new Replicate();
    const p = await replicate.predictions.get(id);
    const output = Array.isArray(p.output) ? p.output[0] : p.output;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ status: p.status, output: output || null, error: p.error || null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
