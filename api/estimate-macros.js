// ============================================================
// POST /api/estimate-macros  (Vercel serverless function)
// The browser sends a meal description and/or a food photo,
// Claude estimates protein, carbs, and fat.
// Body: { text?: string (max 300 chars), image?: base64 with no "data:" prefix, mediaType?: "image/jpeg" }
// Answer: { ok: true, meal } or { ok: false, error }
// The Anthropic key lives ONLY in Vercel env vars / .env, never in app/.
// ============================================================
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT =
  "You estimate macros for a college fitness app at the University of Florida. Given a meal description or a photo of food, list each food item with a realistic portion and its protein, carbs, and fat in grams, then the totals. Handle home-cooked meals, restaurant meals, and college dining hall plates. For home-cooked food, break it into ingredients (for example '2 eggs scrambled with cheese' becomes eggs, cheese, and butter or oil) and use the amounts described, or a normal single serving if none are given. Know common Gainesville and chain meals (Chipotle, Pub Subs from Publix, Chick-fil-A, Starbucks, dining hall plates). If a portion is unclear, assume a normal single serving. Totals must equal the sum of the items. The note is one short casual sentence a college student would say, like 'solid protein, easy on the fat', with no em dashes. If the input is not food, return zero items, all totals 0, confidence low, and note 'That doesn't look like food'. For each item also give grams (your best estimate of the portion weight) and usda_query (a short generic ingredient name that the USDA FoodData Central database would recognize, no brand names).";

// The exact JSON shape Claude must answer with
const MEAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items", "total_protein_g", "total_carbs_g", "total_fat_g", "confidence", "note"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "protein_g", "carbs_g", "fat_g", "grams", "usda_query"],
        properties: {
          name: { type: "string" },
          grams: { type: "integer" },
          usda_query: { type: "string" },
          protein_g: { type: "integer" },
          carbs_g: { type: "integer" },
          fat_g: { type: "integer" },
        },
      },
    },
    total_protein_g: { type: "integer" },
    total_carbs_g: { type: "integer" },
    total_fat_g: { type: "integer" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    note: { type: "string" },
  },
};

const MAX_TEXT = 300;
const MAX_BASE64 = 5 * 1024 * 1024; // 5 MB of base64 text
const READ_FAIL = "Couldn't read that meal. Try describing it.";

// Keeps a number sane: whole grams between 0 and 400
function clamp(n) {
  const x = Math.round(Number(n) || 0);
  return Math.min(400, Math.max(0, x));
}

// Turns Claude's JSON into a clean meal, or null if it's broken
function cleanMeal(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.items)) return null;
  const items = raw.items
    .filter((it) => it && typeof it === "object")
    .map((it) => ({
      name: String(it.name || "Food").slice(0, 80),
      protein_g: clamp(it.protein_g),
      carbs_g: clamp(it.carbs_g),
      fat_g: clamp(it.fat_g),
      // Portion weight in grams (0 means unknown, so we skip USDA for it)
      grams: Math.min(3000, Math.max(0, Math.round(Number(it.grams) || 0))),
      usda_query: String(it.usda_query || "").trim().slice(0, 80),
    }));
  return {
    items,
    total_protein_g: clamp(raw.total_protein_g),
    total_carbs_g: clamp(raw.total_carbs_g),
    total_fat_g: clamp(raw.total_fat_g),
    confidence: ["high", "medium", "low"].includes(raw.confidence) ? raw.confidence : "low",
    note: String(raw.note || "").slice(0, 200),
  };
}

// ---------- USDA FoodData Central step ----------
// Claude splits the meal into items with a weight. USDA gives verified
// nutrition per 100 g. We scale it: per100g * grams / 100.
const USDA_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";
const USDA_TIMEOUT_MS = 4000; // each lookup gets 4 seconds, then we keep Claude's numbers
// USDA nutrient ids (and old-style numbers) we read, checked with a real request
const NUTRIENTS = {
  protein_g: { id: 1003, num: "203" }, // Protein
  fat_g: { id: 1004, num: "204" }, // Total lipid (fat)
  carbs_g: { id: 1005, num: "205" }, // Carbohydrate, by difference
};

// Finds one nutrient's per-100 g value in a USDA food, or null
function nutrientValue(food, { id, num }) {
  const list = Array.isArray(food && food.foodNutrients) ? food.foodNutrients : [];
  const hit = list.find((n) => Number(n.nutrientId) === id || String(n.nutrientNumber) === num);
  const v = hit ? Number(hit.value) : NaN;
  return Number.isFinite(v) && v >= 0 ? v : null;
}

// Looks up one item on USDA. Returns the upgraded item, or null to keep Claude's numbers.
async function usdaLookup(item, fetchFn = fetch) {
  if (!item.usda_query || !item.grams) return null;
  const key = process.env.USDA_API_KEY || "DEMO_KEY";
  // POST with a JSON body: the GET version of this search randomly answers 400 Bad Request
  const url = `${USDA_URL}?api_key=${encodeURIComponent(key)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), USDA_TIMEOUT_MS);
  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: item.usda_query, pageSize: 3, dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"] }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const foods = Array.isArray(json && json.foods) ? json.foods : [];
    // Keep the top results that have all three nutrients
    const scale = (v) => clamp((v * item.grams) / 100);
    const candidates = [];
    for (const food of foods) {
      const per100 = {};
      for (const [k, spec] of Object.entries(NUTRIENTS)) per100[k] = nutrientValue(food, spec);
      if (Object.values(per100).some((v) => v === null)) continue;
      const m = { protein_g: scale(per100.protein_g), carbs_g: scale(per100.carbs_g), fat_g: scale(per100.fat_g) };
      // How far this USDA match is from what Claude saw (e.g. "grilled with sauce" vs plain grilled)
      const dist = Math.abs(m.protein_g - item.protein_g) + Math.abs(m.carbs_g - item.carbs_g) + Math.abs(m.fat_g - item.fat_g);
      candidates.push({ food, m, dist });
    }
    if (!candidates.length) return null;
    // USDA ranks by text match; among its top hits, pick the variant closest to the meal Claude described
    const best = candidates.reduce((a, c) => (c.dist < a.dist ? c : a));
    return {
      ...item,
      ...best.m,
      source: "usda",
      usda_name: String(best.food.description || "USDA food").slice(0, 60),
    };
  } catch {
    return null; // timeout, network error, bad JSON: keep Claude's numbers
  } finally {
    clearTimeout(timer);
  }
}

// Runs every item through USDA in parallel and rebuilds the totals.
// Never throws. If USDA is down, the meal comes back as Claude said it, with source "ai".
export async function verifyWithUsda(meal, fetchFn = fetch) {
  const results = await Promise.all(
    meal.items.map((it) => usdaLookup(it, fetchFn).catch(() => null))
  );
  const items = meal.items.map((it, i) => {
    const out = results[i] || { ...it, source: "ai" };
    delete out.usda_query; // only needed server side
    return out;
  });
  const usda_count = items.filter((it) => it.source === "usda").length;
  const sum = (k) => clamp(items.reduce((s, it) => s + it[k], 0));
  return {
    ...meal,
    items,
    // Only recompute when USDA changed something, so "USDA down" is exactly the old answer
    ...(usda_count
      ? { total_protein_g: sum("protein_g"), total_carbs_g: sum("carbs_g"), total_fat_g: sum("fat_g") }
      : {}),
    usda_count,
  };
}

export default async function handler(req, res) {
  // Only POST is allowed
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  try {
    // Vercel usually parses JSON for us, but handle a raw string too
    let body = req.body || {};
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
    const image = typeof body.image === "string" && body.image.length <= MAX_BASE64 ? body.image : "";
    const mediaType = typeof body.mediaType === "string" ? body.mediaType : "image/jpeg";

    // Need a description or a photo
    if (!text && !image) {
      return res.status(400).json({ ok: false, error: "Tell me what you ate" });
    }

    // No key set up yet
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(200).json({ ok: false, error: "AI isn't set up yet" });
    }

    // Photo first (if any), then the words
    const content = [];
    if (image) content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: image } });
    content.push({ type: "text", text: text || "Estimate the macros for the food in this photo." });

    const client = new Anthropic(); // reads ANTHROPIC_API_KEY
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: MEAL_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });

    // Claude declined to answer
    if (response.stop_reason === "refusal") {
      return res.status(200).json({ ok: false, error: READ_FAIL });
    }

    // Join the text blocks and parse the JSON
    const raw = (response.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    let meal = null;
    try { meal = cleanMeal(JSON.parse(raw)); } catch { meal = null; }
    if (!meal) return res.status(200).json({ ok: false, error: READ_FAIL });

    // Swap in verified USDA numbers where we can (never fails the request)
    try { meal = await verifyWithUsda(meal); } catch {
      const items = meal.items.map(({ usda_query, ...it }) => ({ ...it, source: "ai" }));
      meal = { ...meal, items, usda_count: 0 };
    }

    return res.status(200).json({ ok: true, meal });
  } catch (err) {
    // Anything goes wrong: log it, never 500
    console.error("estimate-macros error:", err);
    return res.status(200).json({ ok: false, error: "Couldn't reach the AI. Try again." });
  }
}
