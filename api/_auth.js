// api/_auth.js  (files starting with "_" are helpers, not web addresses)
//
// Access pass for the identity machine. The 4-digit code is checked on the
// server by api/unlock.js, which hands back a pass that lasts 8 hours.
// generate-persona, generate-video and prediction refuse requests without a
// valid pass, so nobody can spend the Replicate credits by calling the API
// directly.
//
// Optional Vercel environment variables:
//   IM_ACCESS_CODE  the code visitors type (falls back to the current code)
//   IM_SECRET       any long random text used to sign passes
//                   (falls back to a value derived from REPLICATE_API_TOKEN)

import crypto from 'crypto';

const PASS_HOURS = 8;

export function accessCode() {
  return String(process.env.IM_ACCESS_CODE || '2206');
}

function secret() {
  return process.env.IM_SECRET || ('im-pass:' + (process.env.REPLICATE_API_TOKEN || 'dev'));
}

function sign(text) {
  return crypto.createHmac('sha256', secret()).update(text).digest('hex');
}

export function makeToken() {
  const exp = Date.now() + PASS_HOURS * 3600 * 1000;
  return `${exp}.${sign(String(exp))}`;
}

export function hasValidToken(req) {
  const token = String(req.headers['x-im-token'] || '');
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign(exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}

export function sameCode(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
