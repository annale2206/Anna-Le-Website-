import { fal } from "@fal-ai/client";

export const config = {
  maxDuration: 15,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  const FAL_KEY = process.env.FAL_KEY;

  if (!FAL_KEY) {
    return res.status(500).json({
      error: "FAL_KEY is not set in Vercel environment variables.",
    });
  }

  const { app } = req.body || {};

  if (!app) {
    return res.status(400).json({
      error: "Missing app in request body",
    });
  }

  try {
    fal.config({
      credentials: FAL_KEY,
    });

    const token = await fal.auth.getTemporaryAuthToken(app);

    res.setHeader("Content-Type", "text/plain");
    return res.status(200).send(token);
  } catch (err) {
    console.error("fal realtime token error:", err);

    return res.status(500).json({
      error: err?.message || "Failed to create fal realtime token",
    });
  }
}