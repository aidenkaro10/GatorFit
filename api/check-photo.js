// ============================================================
// POST /api/check-photo  (Vercel serverless function)
// The browser sends a workout photo, Claude says if it looks like a workout.
// Body: { image: base64 with no "data:" prefix, mediaType: "image/jpeg" }
// Answer: { ok, checked }
//   ok: false only when Claude looked and said NO.
//   checked: false when we couldn't check (no key, error). Never blocks the user.
// The Anthropic key lives ONLY in Vercel env vars / .env, never in app/.
// ============================================================
import Anthropic from "@anthropic-ai/sdk";

const PHOTO_PROMPT =
  "You check photos for a college fitness app. Answer YES if the photo shows any of these: a person exercising, gym equipment, a gym or weight room, running or a running trail, a yoga mat or yoga pose, a cold plunge tub or ice bath, workout clothes being worn after a workout, or a post-workout selfie. Answer NO for anything else, like food, a screenshot, a meme, a random room, or a blank image. Reply with exactly one word: YES or NO.";

const MAX_BASE64 = 5 * 1024 * 1024; // 5 MB of base64 text

export default async function handler(req, res) {
  // Only POST is allowed
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: true, checked: false });
  }

  try {
    // Vercel usually parses JSON for us, but handle a raw string too
    let body = req.body || {};
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const { image, mediaType } = body;

    // Missing or too big: don't check, but never block the user
    if (typeof image !== "string" || !image || image.length > MAX_BASE64) {
      return res.status(400).json({ ok: true, checked: false });
    }

    // No key set up yet: skip the check
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(200).json({ ok: true, checked: false });
    }

    const client = new Anthropic(); // reads ANTHROPIC_API_KEY
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 256,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: image } },
          { type: "text", text: PHOTO_PROMPT },
        ],
      }],
    });

    // Claude declined to answer: don't block
    if (response.stop_reason === "refusal") {
      return res.status(200).json({ ok: true, checked: false });
    }

    // Join the text blocks: "YES" means it's a workout
    const answer = (response.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
      .toUpperCase();

    if (answer.startsWith("YES")) return res.status(200).json({ ok: true, checked: true });
    return res.status(200).json({ ok: false, checked: true });
  } catch (err) {
    // Anything goes wrong: log it and let the workout through
    console.error("check-photo error:", err);
    return res.status(200).json({ ok: true, checked: false });
  }
}
