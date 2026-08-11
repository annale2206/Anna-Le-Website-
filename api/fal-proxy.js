// api/fal-proxy.js
//
// Secure proxy for fal.ai.
// Your FAL_KEY stays on Vercel and is never exposed in the browser.
//
// Required Vercel environment variable:
//
// FAL_KEY=your_fal_key_here

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  // -----------------------------
  // CORS / preflight
  // -----------------------------
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, x-fal-target-url, Authorization"
    );

    return res.status(204).end();
  }

  // -----------------------------
  // Only support fal proxy methods
  // -----------------------------
  if (
    !["GET", "POST", "PUT", "DELETE"].includes(req.method)
  ) {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  // -----------------------------
  // Read server-side fal key
  // -----------------------------
  const FAL_KEY = process.env.FAL_KEY;

  if (!FAL_KEY) {
    return res.status(500).json({
      error:
        "FAL_KEY is missing from Vercel environment variables.",
    });
  }

  // -----------------------------
  // fal client tells us where
  // the request must be forwarded
  // -----------------------------
  const targetUrl =
    req.headers["x-fal-target-url"];

  if (!targetUrl) {
    return res.status(400).json({
      error: "Missing x-fal-target-url header",
    });
  }

  // -----------------------------
  // Security check
  // Only proxy fal.ai / fal.run
  // -----------------------------
  let parsedUrl;

  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return res.status(412).json({
      error: "Invalid fal target URL",
    });
  }

  const hostname = parsedUrl.hostname;

  const allowed =
    hostname === "fal.ai" ||
    hostname.endsWith(".fal.ai") ||
    hostname === "fal.run" ||
    hostname.endsWith(".fal.run");

  if (!allowed) {
    return res.status(412).json({
      error: "Target URL is not a fal.ai domain",
    });
  }

  try {
    const headers = {
      Authorization: `Key ${FAL_KEY}`,
      "Content-Type": "application/json",
    };

    const fetchOptions = {
      method: req.method,
      headers,
    };

    if (
      req.method !== "GET" &&
      req.method !== "HEAD"
    ) {
      fetchOptions.body =
        typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body || {});
    }

    console.log(
      "[fal proxy]",
      req.method,
      targetUrl
    );

    const falResponse =
      await fetch(targetUrl, fetchOptions);

    const responseBody =
      await falResponse.text();

    console.log(
      "[fal proxy response]",
      falResponse.status
    );

    // Forward useful fal response headers.
    falResponse.headers.forEach(
      (value, key) => {
        if (
          key.toLowerCase() !==
            "content-length" &&
          key.toLowerCase() !==
            "content-encoding"
        ) {
          try {
            res.setHeader(key, value);
          } catch {
            // Ignore headers unsupported by Vercel.
          }
        }
      }
    );

    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );

    return res
      .status(falResponse.status)
      .send(responseBody);

  } catch (error) {
    console.error(
      "[fal proxy error]",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "fal proxy request failed",
    });
  }
}