// ============================================================
// PP.ai: the AI meal tracker (browser side).
// Sends a meal description or photo to OUR server (/api/estimate-macros).
// The Anthropic key is never here. Only the server has it.
// In DEMO MODE, or if the server can't be reached, we use a local
// offline guess so the button never dead-ends.
// Always returns { ok, meal, offline, error }. Never throws.
// ============================================================

window.PP = window.PP || {};

(function () {
  const TIMEOUT_MS = 20000; // give the AI 20 seconds, then give up

  // Extra words that point at a food in the 17-food list
  const ALIASES = {
    "Chicken breast (6 oz)": ["chicken"],
    "White rice (1 cup)": ["rice"],
    "Eggs (2)": ["egg", "eggs"],
    "Oatmeal (1 cup)": ["oatmeal", "oats"],
    "Greek yogurt (1 cup)": ["yogurt"],
    "Protein shake": ["shake"],
    "Banana": ["banana"],
    "Chipotle bowl": ["chipotle", "burrito bowl"],
    "Salmon (6 oz)": ["salmon"],
    "Pasta (2 cups)": ["pasta", "spaghetti"],
    "Avocado": ["avocado", "guac"],
    "Peanut butter (2 tbsp)": ["peanut butter", "pb"],
    "Bagel": ["bagel"],
    "Steak (8 oz)": ["steak"],
    "Sweet potato": ["sweet potato"],
    "Pub Sub (half)": ["pub sub", "pubsub", "publix"],
    "Almonds (1 oz)": ["almond", "almonds"],
  };

  const clamp = (n) => Math.min(400, Math.max(0, Math.round(Number(n) || 0)));

  // Recomputes totals from the items, so totals always equal the sum
  function fixTotals(meal) {
    const items = (meal.items || []).map((it) => ({
      name: String(it.name || "Food"),
      protein_g: clamp(it.protein_g),
      carbs_g: clamp(it.carbs_g),
      fat_g: clamp(it.fat_g),
      // USDA fields from the server (offline guesses are always "ai")
      grams: Math.max(0, Math.round(Number(it.grams) || 0)),
      source: it.source === "usda" ? "usda" : "ai",
      usda_name: it.source === "usda" ? String(it.usda_name || "") : "",
    }));
    const sum = (k) => clamp(items.reduce((s, it) => s + it[k], 0));
    return {
      ...meal,
      items,
      total_protein_g: sum("protein_g"),
      total_carbs_g: sum("carbs_g"),
      total_fat_g: sum("fat_g"),
      usda_count: items.filter((it) => it.source === "usda").length,
    };
  }

  // Does the text mention this word or phrase as a whole word?
  function mentions(text, phrase) {
    const safe = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${safe}\\b`, "i").test(text);
  }

  // Offline guess: match words against the 17 foods and add them up
  async function offlineGuess(text) {
    await new Promise((r) => setTimeout(r, 1200)); // feels like the AI is thinking
    const t = String(text || "").toLowerCase();
    const foods = (PP.mock && PP.mock.foods) || [];
    const hits = foods.filter((f) => {
      const base = f.name.replace(/\s*\(.*\)\s*/g, "").toLowerCase();
      const words = [base].concat(ALIASES[f.name] || []);
      return t && words.some((w) => mentions(t, w));
    });

    // "chipotle bowl chicken" should not also add a plain chicken breast
    const hasBowl = hits.some((f) => f.name === "Chipotle bowl");
    const picked = hasBowl
      ? hits.filter((f) => !["Chicken breast (6 oz)", "White rice (1 cup)", "Avocado"].includes(f.name))
      : hits;

    let meal;
    if (picked.length) {
      meal = {
        items: picked.map((f) => ({ name: f.name, protein_g: f.p, carbs_g: f.c, fat_g: f.f })),
        confidence: "medium",
        note: "Quick guess from our food list, AI is offline right now",
      };
    } else {
      meal = {
        items: [{ name: String(text || "").trim().slice(0, 60) || "Your meal", protein_g: 30, carbs_g: 50, fat_g: 15 }],
        confidence: "low",
        note: "Rough guess, AI is offline right now",
      };
    }
    return { ok: true, meal: fixTotals(meal), offline: true, error: null };
  }

  async function estimateMacros({ text, file } = {}) {
    const words = String(text || "").trim().slice(0, 300);
    try {
      if (!words && !file) return { ok: false, meal: null, offline: false, error: "Tell me what you ate" };

      // DEMO MODE has no server, go straight to the offline guess
      if (PP.db && PP.db.mode === "demo") return offlineGuess(words);

      // Build the request body
      const body = { text: words || undefined };
      if (file) {
        const dataUrl = await PP.ui.shrinkImage(file, 1024);
        body.image = dataUrl.slice(dataUrl.indexOf(",") + 1); // drop the "data:...;base64," part
        body.mediaType = "image/jpeg";
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let res, json;
      try {
        res = await fetch("/api/estimate-macros", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        json = await res.json().catch(() => null);
      } finally {
        clearTimeout(timer);
      }

      // No server (404, no JSON): offline guess
      if (!json || (res.status >= 404 && !("ok" in json))) return offlineGuess(words);

      if (json.ok && json.meal) return { ok: true, meal: fixTotals(json.meal), offline: false, error: null };

      // The server answered but the AI isn't set up: still don't dead-end
      if (json.error === "AI isn't set up yet") return offlineGuess(words);

      return { ok: false, meal: null, offline: false, error: json.error || "Couldn't reach the AI. Try again." };
    } catch (err) {
      // Network error, timeout, bad photo: offline guess
      try {
        return await offlineGuess(words);
      } catch (e) {
        return { ok: false, meal: null, offline: true, error: "Couldn't reach the AI. Try again." };
      }
    }
  }

  PP.ai = { estimateMacros, _test: { fixTotals, offlineGuess } };
})();
