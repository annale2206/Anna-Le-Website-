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
    const response = await fetch(
      "https://rest.fal.ai/tokens/realtime",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${FAL_KEY}`,
        },
        body: JSON.stringify({
          allowed_apps: [app],
          duration: 120,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("fal token error:", data);

      return res.status(response.status).json({
        error: data,
      });
    }

    if (!data.token) {
      return res.status(500).json({
        error: "fal returned no token",
        response: data,
      });
    }

    res.setHeader("Content-Type", "text/plain");

    return res.status(200).send(data.token);

  } catch (err) {
    console.error("fal realtime token error:", err);

    return res.status(500).json({
      error: err?.message || String(err),
    });
  }
}