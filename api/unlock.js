// api/unlock.js
//
// Checks the identity machine's access code on the server and returns a
// pass (see _auth.js). The code itself never appears in the page.
//   POST /api/unlock { code } → { token }  or  401

import { accessCode, makeToken, sameCode } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const { code } = req.body || {};
  if (code && sameCode(code, accessCode())) {
    return res.status(200).json({ token: makeToken() });
  }
  await new Promise(r => setTimeout(r, 400));   // slow down guessing
  return res.status(401).json({ error: 'wrong code' });
}
