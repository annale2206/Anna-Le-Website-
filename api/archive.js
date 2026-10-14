// api/archive.js
//
// Keeps a permanent copy of every film the identity machine makes.
// Replicate deletes its files after one hour, so as soon as a film part is
// finished, the page sends its link here and this route copies the file into
// your own Vercel Blob storage, in a folder per day and per visitor:
//
//   identity-machine/videos/2026-10-07/1430-k3x9/part-1.mp4
//   identity-machine/videos/2026-10-07/1430-k3x9/part-2.mp4
//   identity-machine/videos/2026-10-07/1430-k3x9/info.json   (their words + EEG summary)
// The two-person machine saves each participant's parts in a/ and b/, and
// info.json then also records how long the pair was in sync.
//
// Only visitors who ticked "save my film" on the words screen are archived.
//
// SETUP (once): Vercel dashboard → your project → Storage → Create → Blob →
// connect it to this project. That adds BLOB_READ_WRITE_TOKEN automatically.
// To see the files: Vercel dashboard → Storage → your Blob store → Browser.
// ─────────────────────────────────────────────────────────────────────────

import { put } from '@vercel/blob';
import { hasValidToken } from './_auth.js';
import { cleanVisitorWords } from './_words.js';

export const config = { maxDuration: 60 };

const FOLDER = 'identity-machine/videos';
// only copy files that come from Replicate, so this route can't be used to
// store anything else
const FROM_REPLICATE = /^https:\/\/([a-z0-9-]+\.)*replicate\.delivery\//i;
const MAX_BYTES = 60 * 1024 * 1024;

export default async function handler(req, res) {
  if (!hasValidToken(req)) return res.status(401).json({ error: 'locked' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(200).json({ ok: false, error: 'Blob storage is not connected yet (see setup notes in api/archive.js)' });
  }

  const { kind, visitorId, day, part, url, info, person } = req.body || {};
  // visitor folder name like "1430-k3x9", day like "2026-10-07"
  if (!/^[0-9]{4}-[a-z0-9]{4,8}$/.test(String(visitorId)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(day))) {
    return res.status(400).json({ error: 'bad visitor id' });
  }
  const base = `${FOLDER}/${day}/${visitorId}`;

  try {
    if (kind === 'video') {
      const n = Math.max(1, Math.min(9, Number(part) || 1));
      if (!FROM_REPLICATE.test(String(url))) return res.status(400).json({ error: 'not a Replicate file' });
      const r = await fetch(url);
      if (!r.ok) throw new Error('could not download the video: ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > MAX_BYTES) throw new Error('video too large');
      // two-person machine: each participant's film goes in their own subfolder (a/ or b/)
      const sub = person === 'a' || person === 'b' ? `${person}/` : '';
      const blob = await put(`${base}/${sub}part-${n}.mp4`, buf, {
        access: 'public', contentType: 'video/mp4', addRandomSuffix: false, allowOverwrite: true,
      });
      return res.status(200).json({ ok: true, url: blob.url });
    }

    if (kind === 'info') {
      const i = info || {};
      const one = p => {
        p = p || {};
        return {
          words: cleanVisitorWords(p.words),
          state: String(p.state || '').slice(0, 60),
          reading: String(p.meta || '').slice(0, 200),
          baseline: p.personal ? 'personal' : 'typical',
          parts: (Array.isArray(p.parts) ? p.parts : []).slice(0, 9).map(x => ({
            band: String(x.band || '').slice(0, 10),
            change: Math.round(Number(x.change || 0) * 100) / 100,
          })),
        };
      };
      const num = v => Math.round(Number(v || 0) * 1000) / 1000;
      const record = i.pair
        ? { time: new Date().toISOString(), pair: true, a: one(i.a), b: one(i.b),
            sync: i.sync ? { seconds: num(i.sync.seconds), fraction: num(i.sync.fraction), moments: Math.round(Number(i.sync.moments || 0)),
                             peak: num(i.sync.peak), mean: num(i.sync.mean), level: String(i.sync.level || '').slice(0, 12) } : null }
        : { time: new Date().toISOString(), ...one(i) };
      const blob = await put(`${base}/info.json`, JSON.stringify(record, null, 2), {
        access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true,
      });
      return res.status(200).json({ ok: true, url: blob.url });
    }

    return res.status(400).json({ error: 'unknown kind' });
  } catch (err) {
    // never interrupt the visitor's experience because of the archive
    return res.status(200).json({ ok: false, error: err.message });
  }
}
