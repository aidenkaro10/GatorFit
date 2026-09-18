// ============================================================
// PP.pages.log: the Log page. This is where every point gets earned.
// Three sections: Workout, Eating, Wellness (journal + meditation).
// Owned by the Log agent. Every data-action here starts with "log-".
//
// Rules we check here BEFORE saving (the database checks them again):
// - Max 2 workouts a day, each worth 3, 6, or 9 points
// - One macros point, one journal point, one meditation point per day
// Workout and journal photos are NEVER saved to the database.
// ============================================================

window.PP = window.PP || {};
PP.pages = PP.pages || {};

(function () {
  // ---------- The food list (same 17 foods as the MVP) ----------
  // p = protein, c = carbs, f = fat, all in grams
  const FOODS = [
    { name: "Chicken breast (6 oz)", p: 53, c: 0, f: 6 },
    { name: "White rice (1 cup)", p: 4, c: 45, f: 0 },
    { name: "Eggs (2)", p: 12, c: 1, f: 10 },
    { name: "Oatmeal (1 cup)", p: 6, c: 27, f: 3 },
    { name: "Greek yogurt (1 cup)", p: 20, c: 9, f: 0 },
    { name: "Protein shake", p: 25, c: 3, f: 2 },
    { name: "Banana", p: 1, c: 27, f: 0 },
    { name: "Chipotle bowl", p: 45, c: 70, f: 22 },
    { name: "Salmon (6 oz)", p: 34, c: 0, f: 18 },
    { name: "Pasta (2 cups)", p: 16, c: 86, f: 2 },
    { name: "Avocado", p: 3, c: 12, f: 21 },
    { name: "Peanut butter (2 tbsp)", p: 7, c: 7, f: 16 },
    { name: "Bagel", p: 10, c: 48, f: 2 },
    { name: "Steak (8 oz)", p: 56, c: 0, f: 28 },
    { name: "Sweet potato", p: 2, c: 26, f: 0 },
    { name: "Pub Sub (half)", p: 30, c: 60, f: 20 },
    { name: "Almonds (1 oz)", p: 6, c: 6, f: 14 },
  ];

  const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB
  const BAD_FILE_MSG = "That file won't work. Try a photo under 10 MB.";

  // ---------- Page memory (lives while the app is open) ----------
  let tab = "workout"; // which section is showing

  // The workout photo. It only lives in this browser tab, never saved.
  // status: "none" | "checking" | "ok" | "bad"
  const photo = { status: "none", checked: false, url: null, token: 0 };

  // What's ticked in the workout form, so a redraw doesn't wipe it
  const form = { peakPulse: false, ufEvent: false, other: false, partnerId: "" };

  let pastPartners = new Set(); // people I've already worked out with
  let saving = false;           // stops double clicks on "Log workout"
  let busy = false;             // stops double clicks on food / goals / journal

  // The last place we drew, so we can redraw after a save
  let lastRoot = null;
  let lastCtx = null;

  // Meditation session (null when nothing is running)
  let med = null;

  // AI meal tracker. text/file = what the user gave us, result = PP.ai answer.
  const ai = { text: "", file: null, loading: false, result: null, token: 0 };

  const esc = (s) => PP.ui.esc(s);
  const toast = (m) => PP.ui.toast(m);

  // ---------- Small pure helpers (easy to test) ----------

  // Adds up protein / carbs / fat for a list of meals
  function mealTotals(meals) {
    const t = { p: 0, c: 0, f: 0 };
    (meals || []).forEach((m) => {
      t.p += Number(m.protein_g) || 0;
      t.c += Number(m.carbs_g) || 0;
      t.f += Number(m.fat_g) || 0;
    });
    return t;
  }

  // My goals from my profile, shaped { p, c, f }
  function goalsOf(me) {
    return {
      p: Number(me && me.goal_protein_g) || 0,
      c: Number(me && me.goal_carbs_g) || 0,
      f: Number(me && me.goal_fat_g) || 0,
    };
  }

  // Did I hit my macros? Goals must be real numbers, or a 0 goal would give a free point.
  function hitMacros(totals, goals) {
    const goalsOk = goals.p > 0 && goals.c > 0 && goals.f > 0;
    return goalsOk && PP.points.macrosHit(totals, goals);
  }

  // Turns the ticked boxes into the event_types list the database wants
  function eventTypes(f) {
    const out = [];
    if (f.peakPulse) out.push("peak_pulse");
    if (f.ufEvent) out.push("uf_event");
    if (f.other) out.push("other");
    return out;
  }

  // Works out the workout: multiplier, reason, points. Uses PP.points, no own math.
  function workoutPlan(f, pastSet, myId) {
    const partnerId = f.partnerId && f.partnerId !== myId ? f.partnerId : "";
    const newPartner = !!partnerId && !pastSet.has(partnerId);
    const opts = { peakPulse: !!f.peakPulse, ufEvent: !!f.ufEvent, newPartner };
    const { multiplier, reason } = PP.points.workoutMultiplier(opts);
    return {
      multiplier,
      reason,
      points: PP.points.workoutPoints(opts),
      newPartner,
      partnerId,
      event_types: eventTypes(f),
    };
  }

  const countKind = (logs, kind) => (logs || []).filter((l) => l.kind === kind).length;
  const sumPoints = (logs) => (logs || []).reduce((s, l) => s + (Number(l.points) || 0), 0);

  // Is this file OK to use? Images only, 10 MB max.
  function fileOk(file) {
    return !!file && /^image\//.test(file.type || "") && file.size <= MAX_PHOTO_BYTES;
  }

  // ---------- Journal photos: saved ONLY in this browser ----------
  function journalKey(me) {
    return `peakpulse-journal-${me.id}`;
  }
  function readJournal(me) {
    try {
      const list = JSON.parse(localStorage.getItem(journalKey(me)) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }
  // Returns true if it saved, false if the browser said no (full, private mode...)
  function saveJournalPhoto(me, entry) {
    try {
      const list = readJournal(me);
      list.push(entry);
      localStorage.setItem(journalKey(me), JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
  }

  function deleteJournalPhoto(me, index) {
    try {
      const list = readJournal(me);
      if (index < 0 || index >= list.length) return false;
      list.splice(index, 1);
      localStorage.setItem(journalKey(me), JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
  }

  // ============================================================
  // DRAWING
  // ============================================================

  const icon = (name, size) => PP.ui.icon(name, size);

  // Small round "done" dot: brand with a check when done, an empty ring when not
  const doneDot = (done) =>
    `<span class="log-dot ${done ? "on" : ""}">${done ? icon("check", 12) : ""}</span>`;

  // TODAY: one card, 4 stat columns + points on the right, streak row underneath
  function todayCardHTML(logs, streak) {
    const w = countKind(logs, "workout");
    const max = PP.points.RULES.maxWorkoutsPerDay;
    const cell = (ico, label, value, done) => `
      <div class="log-stat ${done ? "done" : ""}">
        <div class="log-stat-label">${icon(ico, 14)}<span>${label}</span></div>
        <div class="log-stat-value">${value}</div>
      </div>`;
    const pts = sumPoints(logs);
    return `
      <div class="card log-today">
        <div class="log-strip">
          ${cell("dumbbell", "Workouts", `<b>${w}</b><span class="log-of">/${max}</span>${w >= max ? doneDot(true) : ""}`, w >= max)}
          ${cell("utensils", "Macros", doneDot(countKind(logs, "macros") > 0), countKind(logs, "macros") > 0)}
          ${cell("book-open", "Journal", doneDot(countKind(logs, "journal") > 0), countKind(logs, "journal") > 0)}
          ${cell("brain", "Meditate", doneDot(countKind(logs, "meditation") > 0), countKind(logs, "meditation") > 0)}
          <div class="log-pts">
            <b>${pts}</b>
            <span>${pts === 1 ? "pt" : "pts"} today</span>
          </div>
        </div>
        ${streakHTML(streak)}
      </div>`;
  }

  // Trophy-style week calendar: the last 7 days, filled when that day is part of the streak.
  // Built from getMyStreak(): { current, best, loggedToday }.
  function streakHTML(streak) {
    const s = streak || { current: 0, best: 0, loggedToday: false };
    const current = Number(s.current) || 0;
    const letters = ["S", "M", "T", "W", "T", "F", "S"];
    const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    // The streak ends today if I logged today, otherwise yesterday
    const first = s.loggedToday ? 0 : 1;
    const days = [];
    for (let back = 6; back >= 0; back--) {
      const d = new Date();
      d.setDate(d.getDate() - back);
      const on = back >= first && back < first + current;
      const isToday = back === 0;
      days.push(`
        <div class="log-day">
          <span class="log-day-box ${on ? "on" : ""} ${isToday ? "today" : ""}"
            title="${names[d.getDay()]}${on ? ", logged" : ""}">${on ? icon("check", 14) : ""}</span>
          <span class="log-day-letter ${isToday ? "today" : ""}">${letters[d.getDay()]}</span>
        </div>`);
    }
    const best = Number(s.best) || 0;
    const text = current > 0
      ? `🔥 <b>${current}-day</b> streak`
      : `No streak yet`;
    const sub = current > 0
      ? (s.loggedToday ? `Best ${best} ${best === 1 ? "day" : "days"}` : "Log anything today to keep it")
      : "Log anything today to start one";
    return `
      <div class="log-streak">
        <div class="log-streak-text">
          <div class="log-streak-count">${text}</div>
          <div class="muted">${sub}</div>
        </div>
        <div class="log-week" role="list" aria-label="Last 7 days">${days.join("")}</div>
      </div>`;
  }

  function segHTML() {
    const b = (v, ico, label) =>
      `<button class="${tab === v ? "active" : ""}" data-action="log-tab" data-v="${v}">${icon(ico, 16)}${label}</button>`;
    return `<div class="seg log-seg">${b("workout", "dumbbell", "Workout")}${b("eating", "utensils", "Eating")}${b("wellness", "brain", "Wellness")}</div>`;
  }

  // The photo line under the drop zone. Redrawn on its own so the form keeps its ticks.
  function photoStatusText() {
    if (photo.status === "checking") return `<span class="icon-spin">${icon("loader", 14)}</span>Checking photo...`;
    if (photo.status === "ok") return `${icon("check", 14)}${photo.checked ? "Looks like a workout" : "Couldn't check it, honor system it is"}`;
    if (photo.status === "bad") return `${icon("alert-triangle", 14)}That doesn't look like a workout. Try another photo.`;
    return "";
  }
  function photoAreaHTML() {
    const input = `<input type="file" accept="image/*" capture="environment" id="logWPhoto" hidden />`;
    const zone = photo.url
      ? `<div class="log-photo-frame">
          <label class="log-photo-pick" title="Tap to change">
            <img class="log-photo-img" src="${esc(photo.url)}" alt="Your workout photo" />
            ${input}
          </label>
          <button class="log-photo-x" data-action="log-remove-wphoto" title="Remove this photo">${icon("x", 14)}Remove</button>
        </div>`
      : `<label class="log-drop-zone">
          <span class="log-drop-icon">${icon("camera", 20)}</span>
          <span class="log-drop-title">Add your workout photo</span>
          <span class="log-drop-sub">Drop it here or tap to take one</span>
          ${input}
        </label>`;
    const cls = photo.status === "bad" ? "log-bad" : photo.status === "ok" && photo.checked ? "log-ok" : "";
    return `${zone}<div id="logWPhotoStatus" class="log-photo-status ${cls}">${photoStatusText()}</div>`;
  }

  function workoutHTML(d) {
    const done = countKind(d.logs, "workout");
    const max = PP.points.RULES.maxWorkoutsPerDay;
    if (done >= max) {
      return `
        <div class="card">
          <div class="empty">
            <div class="empty-icon">${icon("check", 22)}</div>
            <div class="empty-title">Both workouts logged</div>
            <div class="empty-text">That's the max for today. Rest up and come back tomorrow.</div>
          </div>
        </div>`;
    }

    const option = (p) => {
      const isNew = !pastPartners.has(p.id);
      const sel = form.partnerId === p.id ? " selected" : "";
      return `<option value="${esc(p.id)}"${sel}>${esc(p.display_name)}${isNew ? " (new, 3x)" : ""}</option>`;
    };
    // Option card: still a real checkbox (same ids, same behavior), styled like a radio card
    const box = (id, key, text, sub, mult) => `
      <label class="log-opt">
        <span class="check"><input type="checkbox" id="${id}" ${form[key] ? "checked" : ""} /></span>
        <span class="log-opt-text"><span class="log-opt-title">${text}</span>${sub ? `<span class="log-opt-sub">${sub}</span>` : ""}</span>
        <span class="badge log-opt-mult">${mult}</span>
      </label>`;
    const step = (n, title, sub) => `
      <div class="log-step-head">
        <span class="log-step-num">${n}</span>
        <div><div class="log-step-title">${title}</div>${sub ? `<div class="log-step-sub">${sub}</div>` : ""}</div>
      </div>`;

    return `
      <div class="card log-wcard">
        <div class="card-header">
          <div>
            <div class="card-title">Log a workout</div>
            <div class="card-sub">${done} of ${max} logged today</div>
          </div>
        </div>

        <section class="log-step">
          ${step(1, "Photo", "Proof you showed up. It stays on this device.")}
          <div id="logPhotoArea" class="log-drop" data-log-drop="workout">${photoAreaHTML()}</div>
        </section>

        <section class="log-step">
          ${step(2, "What did you go to?", "Multipliers don't stack. You get the biggest one.")}
          <div class="log-opts">
            ${box("logWPP", "peakPulse", "Peak Pulse event", "Run, cold plunge, and yoga count as one workout", "3x")}
            ${box("logWUF", "ufEvent", "UF event", "Run club, intramurals", "2x")}
            ${box("logWOther", "other", "Something else", "", "1x")}
          </div>
        </section>

        <section class="log-step">
          ${step(3, "Work out with someone?", "First time with someone new is 3x.")}
          <select id="logWPartner" class="select">
            <option value="">Nobody this time</option>
            ${d.fromSessions.length ? `<optgroup label="From your sessions">${d.fromSessions.map(option).join("")}</optgroup>` : ""}
            <optgroup label="Everyone">${d.everyone.map(option).join("")}</optgroup>
          </select>
        </section>

        <div class="log-summary">
          <div class="log-summary-text" id="logWPreview">${previewHTML(d.me)}</div>
          <button class="btn btn-primary" data-action="log-workout" id="logWSubmit" ${saving ? "disabled" : ""}>${saving ? "Saving..." : "Log workout"}</button>
        </div>
      </div>`;
  }

  // "This workout: 9 pts · 3x Peak Pulse"
  function previewHTML(me) {
    const plan = workoutPlan(form, pastPartners, me && me.id);
    let why = "base";
    if (plan.multiplier > 1) {
      const reasons = [];
      if (form.peakPulse) reasons.push("Peak Pulse");
      if (plan.newPartner) reasons.push("new partner");
      if (form.ufEvent) reasons.push("UF event");
      why = reasons.join(" / ");
    }
    return `<span class="log-summary-label">This workout:</span> <b>${plan.points} pts</b> <span class="log-summary-why">· ${plan.multiplier}x ${why}</span>`;
  }

  function eatingHTML(d) {
    const goals = goalsOf(d.me);
    const totals = mealTotals(d.meals);
    const got = countKind(d.logs, "macros") > 0;
    const bar = (label, key) => {
      const goal = goals[key];
      const pct = goal > 0 ? Math.min(100, Math.round((totals[key] / goal) * 100)) : 0;
      const hit = goal > 0 && totals[key] >= goal * PP.points.RULES.macroHitPercent;
      return `
        <div class="log-macro ${hit ? "hit" : ""}">
          <div class="log-macro-row">
            <span class="log-macro-name">${label}</span>
            <span class="log-macro-num"><b>${totals[key]}</b> / ${goal} g ${hit ? icon("check", 14) : ""}</span>
          </div>
          <div class="bar ${hit ? "full" : ""}"><div style="width:${pct}%"></div></div>
        </div>`;
    };
    const list = d.meals.length
      ? `<ul class="log-food-list">${d.meals
          .map((m) => `
            <li>
              <span class="log-food-name">${esc(m.food_name)}</span>
              <span class="log-food-macros">${Number(m.protein_g) || 0}p · ${Number(m.carbs_g) || 0}c · ${Number(m.fat_g) || 0}f</span>
              <button class="log-x" data-action="log-remove-food" data-id="${esc(m.id)}" title="Remove" aria-label="Remove ${esc(m.food_name)}">${icon("x", 14)}</button>
            </li>`)
          .join("")}</ul>`
      : `<p class="log-food-empty">Nothing logged yet today.</p>`;

    return `
      <div class="log-eat">
        <div class="log-eat-main">
          <div class="card log-ai-card">
            <div id="logAi" class="log-ai">${aiHTML()}</div>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">Eaten today</div></div>
            <div class="log-quick">
              <select id="logFood" class="select" aria-label="Quick add a food">${FOODS.map((f, i) => `<option value="${i}">${esc(f.name)}</option>`).join("")}</select>
              <button class="btn btn-secondary" data-action="log-add-food">Add</button>
            </div>
            ${list}
          </div>
        </div>
        <div class="log-eat-side">
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">Macros</div>
                <div class="card-sub">Hit all 3 to earn 1 point</div>
              </div>
              ${got ? `<span class="badge badge-success">${icon("check", 12)}+1 today</span>` : ""}
            </div>
            ${bar("Protein", "p")}${bar("Carbs", "c")}${bar("Fat", "f")}
            <details class="log-goals">
              <summary class="btn btn-ghost btn-sm">${icon("target", 14)}Goals</summary>
              <div class="log-goals-body">
                <div class="log-goals-grid">
                  <label><span>Protein</span><input type="number" min="1" id="logGP" value="${goals.p}" placeholder="Protein" title="Protein" /></label>
                  <label><span>Carbs</span><input type="number" min="1" id="logGC" value="${goals.c}" placeholder="Carbs" title="Carbs" /></label>
                  <label><span>Fat</span><input type="number" min="1" id="logGF" value="${goals.f}" placeholder="Fat" title="Fat" /></label>
                </div>
                <button class="btn btn-primary btn-sm" data-action="log-save-goals">Save goals</button>
              </div>
            </details>
          </div>
        </div>
      </div>`;
  }

  function wellnessHTML(d) {
    const journaled = countKind(d.logs, "journal") > 0;
    const meditated = countKind(d.logs, "meditation") > 0;
    const all = readJournal(d.me);
    // newest first, and remember each photo's real spot in the saved list
    const photos = all.map((p, i) => ({ ...p, i })).slice(-8).reverse();
    const doneBadge = `<span class="badge badge-success">${icon("check", 12)}+1 today</span>`;
    const len = (sec, label) =>
      `<button data-action="log-meditate" data-sec="${sec}">${label}</button>`;
    return `
      <div class="log-well">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">${icon("book-open", 18)}Journal</div>
              <div class="card-sub">Write on paper, date it, snap a photo. It stays on this device.</div>
            </div>
            ${journaled ? doneBadge : ""}
          </div>
          <div class="log-drop" data-log-drop="journal">
            <label class="log-drop-zone log-drop-sm">
              <span class="log-drop-icon">${icon("camera", 18)}</span>
              <span class="log-drop-title">Add a journal page</span>
              <span class="log-drop-sub">Drop it here or tap to take one</span>
              <input type="file" accept="image/*" capture="environment" id="logJPhoto" hidden />
            </label>
          </div>
          ${photos.length ? `<div class="log-jgrid">${photos
            .map((p) => `<div class="log-jitem"><img src="${esc(p.img)}" alt="Journal page" /><span class="log-jdate">${esc(p.date)}</span>
              <button class="log-jphoto-x" data-action="log-remove-jphoto" data-i="${p.i}" title="Delete this photo" aria-label="Delete this photo">${icon("x", 12)}</button></div>`)
            .join("")}</div>` : ""}
        </div>
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">${icon("brain", 18)}Meditate</div>
              <div class="card-sub">Your screen locks in. Leave the tab and the session ends.</div>
            </div>
            ${meditated ? doneBadge : ""}
          </div>
          <div class="log-med-label">Pick a length to start</div>
          <div class="seg log-med-seg">
            ${len(10, "Demo 10s")}${len(300, "5 min")}${len(600, "10 min")}${len(900, "15 min")}
          </div>
        </div>
      </div>`;
  }

  // Loads the partner lists: hosts of sessions I joined, then everyone else
  async function loadPartners(me) {
    const [sessions, profiles, past] = await Promise.all([
      PP.db.listUpcomingSessions(),
      PP.db.listProfiles(),
      PP.db.getPastPartnerIds(),
    ]);
    const joins = sessions.length ? await PP.db.listJoins(sessions.map((s) => s.id)) : [];
    const mySessionIds = new Set(joins.filter((j) => j.profile_id === me.id).map((j) => j.session_id));
    const hostIds = [];
    sessions.forEach((s) => {
      if (mySessionIds.has(s.id) && s.host_id !== me.id && !hostIds.includes(s.host_id)) hostIds.push(s.host_id);
    });
    const others = profiles.filter((p) => p.id !== me.id); // never list myself
    const fromSessions = hostIds.map((id) => others.find((p) => p.id === id)).filter(Boolean);
    const everyone = others.filter((p) => !hostIds.includes(p.id));
    return { fromSessions, everyone, past };
  }

  // ============================================================
  // RENDER
  // ============================================================
  async function render(root, ctx) {
    // If something redraws the page mid-meditation, end the session (no point)
    if (med) stopMeditation("Session ended early. No point this time.");

    lastRoot = root;
    lastCtx = ctx;
    const me = ctx.me;

    const [board, logs, meals, streak] = await Promise.all([
      PP.db.getMonthLeaderboard(),
      PP.db.getTodayLogs(),
      tab === "eating" ? PP.db.listTodayMeals() : Promise.resolve([]),
      // Streak is only for the calendar. It never throws, but stay safe if it's missing.
      PP.db.getMyStreak ? PP.db.getMyStreak().catch(() => null) : Promise.resolve(null),
    ]);
    let partners = { fromSessions: [], everyone: [], past: pastPartners };
    if (tab === "workout" && countKind(logs, "workout") < PP.points.RULES.maxWorkoutsPerDay) {
      partners = await loadPartners(me);
    }
    pastPartners = partners.past;
    // Forget a picked partner who isn't in the list anymore
    const allIds = partners.fromSessions.concat(partners.everyone).map((p) => p.id);
    if (form.partnerId && !allIds.includes(form.partnerId)) form.partnerId = "";

    const rows = PP.points.rankRows(board, me.id);
    const d = { me, logs, meals, fromSessions: partners.fromSessions, everyone: partners.everyone };

    let body;
    if (tab === "workout") body = `<div class="log-narrow">${workoutHTML(d)}</div>`;
    else if (tab === "eating") body = eatingHTML(d);
    else body = wellnessHTML(d);

    root.innerHTML = `
      <div class="log-page" data-page="log">
        ${PP.ui.greetingHTML("Log it", PP.points.nextUp(rows))}
        ${todayCardHTML(logs, streak)}
        ${segHTML()}
        ${body}
      </div>`;
    wireDropZones(root, ctx);
  }

  // Redraw with the last root and ctx (after a save)
  async function redraw(ctx) {
    if (!lastRoot) return;
    await render(lastRoot, ctx || lastCtx);
  }

  // Lets you drag a photo onto the dashed boxes. The boxes are new each render, so no leaks.
  function wireDropZones(root, ctx) {
    root.querySelectorAll("[data-log-drop]").forEach((zone) => {
      zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("log-drag"); });
      zone.addEventListener("dragleave", () => zone.classList.remove("log-drag"));
      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("log-drag");
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (zone.dataset.logDrop === "workout") onWorkoutPhoto(file, lastCtx || ctx);
        else onJournalPhoto(file, lastCtx || ctx);
      });
    });
  }

  // ============================================================
  // WORKOUT
  // ============================================================

  // Just redraws the photo box and the preview, so ticked boxes stay ticked
  function drawPhotoArea() {
    const area = document.getElementById("logPhotoArea");
    if (area) area.innerHTML = photoAreaHTML();
  }
  function drawPreview(ctx) {
    const box = document.getElementById("logWPreview");
    if (box) box.innerHTML = previewHTML(ctx.me);
  }

  function clearPhoto() {
    if (photo.url) URL.revokeObjectURL(photo.url);
    photo.url = null;
    photo.status = "none";
    photo.checked = false;
    photo.token++; // any check still running gets ignored
  }

  async function onWorkoutPhoto(file, ctx) {
    if (!file) return;
    if (!fileOk(file)) return toast(BAD_FILE_MSG);
    clearPhoto();
    const myToken = photo.token;
    photo.url = URL.createObjectURL(file); // only a local preview link, nothing is uploaded or saved
    photo.status = "checking";
    drawPhotoArea();
    let res;
    try {
      res = await PP.db.checkWorkoutPhoto(file);
    } catch (e) {
      res = { ok: true, checked: false }; // same fallback db.js uses
    }
    if (myToken !== photo.token) return; // a newer photo was picked, ignore this result
    photo.status = res && res.ok ? "ok" : "bad";
    photo.checked = !!(res && res.ok && res.checked);
    if (photo.status === "ok") PP.share && PP.share.setPhoto(file); // for the story card, memory only
    drawPhotoArea();
  }

  async function logWorkout(el, ctx) {
    if (saving) return;
    saving = true;
    if (el) { el.disabled = true; el.textContent = "Saving..."; }
    const stop = (msg) => {
      saving = false;
      if (el && el.isConnected) { el.disabled = false; el.textContent = "Log workout"; }
      if (msg) toast(msg);
    };

    try {
      // Checks in order. Uses today's date at click time (in case midnight passed).
      const logs = await PP.db.getTodayLogs();
      if (countKind(logs, "workout") >= PP.points.RULES.maxWorkoutsPerDay) return stop("Max 2 workouts a day");
      if (photo.status !== "ok") return stop("Snap your workout photo first");
      if (!form.peakPulse && !form.ufEvent && !form.other) return stop("Pick what you went to");

      // Fresh partner list, so "new partner" is right even if another tab logged one
      const past = await PP.db.getPastPartnerIds();
      pastPartners = past;
      const plan = workoutPlan(form, past, ctx.me.id);

      // OLD must be read BEFORE saving, or the gator never fires
      const oldPts = Number(await PP.db.getMyMonthPoints()) || 0;
      await PP.db.addPointLog({
        kind: "workout",
        points: plan.points,
        multiplier: plan.multiplier,
        multiplier_reason: plan.reason,
        event_types: plan.event_types,
        partner_profile_id: plan.partnerId || null,
      });
      const newPts = oldPts + plan.points;

      // Saved. Forget the photo and the form for next time.
      clearPhoto();
      form.peakPulse = form.ufEvent = form.other = false;
      form.partnerId = "";
      saving = false;

      ctx.refreshSidebar();
      await ctx.go("leaderboard", { from: oldPts, to: newPts });
    } catch (err) {
      // Nothing saved (or we can't be sure): stay here, let them try again
      stop((err && err.message) || "Something went wrong. Try again.");
    }
  }

  // ============================================================
  // EATING
  // ============================================================

  // Gives the macros point once a day when all 3 are at 90%+
  async function checkMacros(ctx) {
    const [meals, logs] = await Promise.all([PP.db.listTodayMeals(), PP.db.getTodayLogs()]);
    if (countKind(logs, "macros") > 0) return;
    if (!hitMacros(mealTotals(meals), goalsOf(ctx.me))) return;
    try {
      await PP.db.addPointLog({ kind: "macros", points: 1, multiplier: 1, multiplier_reason: "none", event_types: [] });
      toast("Macros hit. +1 pt");
      ctx.refreshSidebar();
    } catch (err) {
      // Another tab already got it: that's fine, no double point
      if (!/already/i.test(err.message || "")) toast(err.message);
    }
  }

  async function addFood(ctx) {
    const sel = document.getElementById("logFood");
    const food = sel && FOODS[Number(sel.value)];
    if (!food) return;
    await PP.db.addMeal({ food_name: food.name, protein_g: food.p, carbs_g: food.c, fat_g: food.f });
    await checkMacros(ctx);
    await redraw(ctx);
  }

  // ---------- AI meal tracker ----------

  // The AI box: input + photo + Estimate, then the result card
  function aiHTML() {
    const r = ai.result;
    let card = "";
    if (r && r.meal) {
      const m = r.meal;
      const conf = ["high", "medium", "low"].includes(m.confidence) ? m.confidence : "low";
      const confCls = conf === "high" ? "badge-success" : "badge-muted";
      const n = (v) => (v == null || v === "" ? "" : esc(v));
      const rows = (m.items || [])
        .map((it) => {
          // A tiny tag: verified by USDA or Claude's own estimate
          const tag = it.source === "usda"
            ? `<span class="badge badge-success log-ai-src log-ai-usda" title="${esc(it.usda_name || "USDA FoodData Central")}">✓ USDA</span>`
            : `<span class="badge badge-muted log-ai-src log-ai-est">AI est.</span>`;
          return `
            <tr>
              <td><div class="log-ai-name"><span>${esc(it.name)}</span>${tag}</div></td>
              <td class="num">${it.grams ? `${n(it.grams)}` : "-"}</td>
              <td class="num">${n(it.protein_g)}</td>
              <td class="num">${n(it.carbs_g)}</td>
              <td class="num">${n(it.fat_g)}</td>
            </tr>`;
        })
        .join("");
      const table = (m.items || []).length
        ? `<table class="log-ai-table">
            <thead><tr><th>Item</th><th class="num">g</th><th class="num">P</th><th class="num">C</th><th class="num">F</th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><td>Total</td><td></td><td class="num">${n(m.total_protein_g)}</td><td class="num">${n(m.total_carbs_g)}</td><td class="num">${n(m.total_fat_g)}</td></tr></tfoot>
          </table>`
        : "";
      const usdaLine = m.usda_count > 0
        ? `<div class="log-ai-meta">${m.usda_count} of ${(m.items || []).length} items verified with USDA FoodData Central</div>`
        : "";
      const note = `${esc(m.note || "")}${r.offline ? " (offline guess)" : ""}`;
      card = `
        <div class="log-ai-result">
          <div class="log-ai-head">
            <span class="log-ai-head-title">Estimate</span>
            <span class="badge ${confCls} log-ai-conf log-ai-${conf}">${conf[0].toUpperCase() + conf.slice(1)} confidence</span>
          </div>
          ${table}
          ${usdaLine}
          ${note.trim() ? `<div class="log-ai-meta">${note}</div>` : ""}
          <div class="log-ai-actions">
            <button class="btn btn-primary" data-action="log-ai-add" ${(m.items || []).length ? "" : "disabled"}>${icon("plus-circle", 16)}Add to today</button>
            <button class="btn btn-ghost" data-action="log-ai-clear">Try again</button>
          </div>
        </div>`;
    }
    return `
      <div class="card-header">
        <div>
          <div class="card-title">Meal tracker</div>
          <div class="card-sub">Type what you ate or snap your plate. We estimate the macros.</div>
        </div>
      </div>
      <div class="log-ai-row">
        <input type="text" class="input" id="logAiText" maxlength="300" value="${esc(ai.text)}"
          placeholder="ex: 2 eggs, toast, chipotle bowl" />
        <label class="btn btn-secondary log-ai-photo ${ai.file ? "log-ai-has" : ""}" title="${ai.file ? "Photo added (tap to change)" : "Snap your plate"}" aria-label="Add a photo of your meal">${icon("camera", 18)}
          <input type="file" accept="image/*" capture="environment" id="logAiPhoto" hidden />
        </label>
        <button class="btn btn-primary" data-action="log-ai-estimate" ${ai.loading ? "disabled" : ""}>${ai.loading ? `<span class="icon-spin">${icon("loader", 16)}</span>Reading...` : "Estimate"}</button>
      </div>
      ${ai.file ? `<div class="log-ai-file">${icon("image", 14)}<span>${esc(ai.file.name || "Photo")} added</span></div>` : ""}
      ${card}`;
  }

  // Redraws just the AI box so nothing else on the page flickers
  function drawAi() {
    const box = document.getElementById("logAi");
    if (box) box.innerHTML = aiHTML();
  }

  async function aiEstimate() {
    if (ai.loading) return;
    const input = document.getElementById("logAiText");
    if (input) ai.text = input.value;
    if (!ai.text.trim() && !ai.file) return toast("Tell me what you ate");
    ai.loading = true;
    ai.result = null;
    const myToken = ++ai.token;
    drawAi();
    let res;
    try {
      res = await PP.ai.estimateMacros({ text: ai.text, file: ai.file });
    } catch (e) {
      res = { ok: false, error: "Couldn't reach the AI. Try again." };
    }
    if (myToken !== ai.token) return; // cleared or restarted meanwhile
    ai.loading = false;
    if (res && res.ok && res.meal) ai.result = res;
    else toast((res && res.error) || "Couldn't reach the AI. Try again.");
    drawAi();
  }

  function aiClear() {
    ai.token++;
    ai.loading = false;
    ai.result = null;
    ai.file = null;
    drawAi();
    const input = document.getElementById("logAiText");
    if (input) input.focus();
  }

  async function aiAdd(ctx) {
    const m = ai.result && ai.result.meal;
    if (!m || !(m.items || []).length) return;
    const food_name = m.items.map((it) => it.name).join(" + ").slice(0, 80);
    await PP.db.addMeal({ food_name, protein_g: m.total_protein_g, carbs_g: m.total_carbs_g, fat_g: m.total_fat_g });
    ai.result = null;
    ai.file = null;
    ai.text = "";
    toast(`Added. +${m.total_protein_g}g protein`);
    await checkMacros(ctx); // same macro-hit check the food list uses
    await redraw(ctx);
  }

  async function removeFood(el, ctx) {
    await PP.db.removeMeal(el.dataset.id); // never takes the macros point away
    await redraw(ctx);
  }

  async function saveGoals(ctx) {
    const val = (id) => Number((document.getElementById(id) || {}).value);
    const p = val("logGP"), c = val("logGC"), f = val("logGF");
    if (!(p > 0 && c > 0 && f > 0)) return toast("Goals need to be above 0");
    const profile = await PP.db.updateGoals({ goal_protein_g: p, goal_carbs_g: c, goal_fat_g: f });
    // Keep the profile the app holds in sync with the new goals
    const fresh = profile || { goal_protein_g: p, goal_carbs_g: c, goal_fat_g: f };
    ["goal_protein_g", "goal_carbs_g", "goal_fat_g"].forEach((k) => {
      if (fresh[k] != null) {
        ctx.me[k] = fresh[k];
        if (PP.me && PP.me !== ctx.me) PP.me[k] = fresh[k];
      }
    });
    toast("Goals saved");
    await checkMacros(ctx);
    await redraw(ctx);
  }

  // ============================================================
  // JOURNAL (the photo never leaves this computer)
  // ============================================================
  async function onJournalPhoto(file, ctx) {
    if (!file) return;
    if (!fileOk(file)) return toast(BAD_FILE_MSG);
    if (busy) return;
    busy = true;
    try {
      let img;
      try {
        img = await PP.ui.shrinkImage(file, 400);
      } catch (e) {
        return toast("Couldn't read that photo. Try another one.");
      }
      const stored = saveJournalPhoto(ctx.me, { date: PP.points.todayKey(), img });

      const logs = await PP.db.getTodayLogs();
      if (countKind(logs, "journal") === 0) {
        // The database only gets a point log. No photo.
        await PP.db.addPointLog({ kind: "journal", points: 1, multiplier: 1, multiplier_reason: "none", event_types: [] });
        toast(stored ? "Journal logged. +1 pt" : "Point saved, but this browser couldn't store the photo.");
        ctx.refreshSidebar();
      } else {
        toast(stored ? "Saved. You already got today's point." : "This browser couldn't store the photo.");
      }
      await redraw(ctx);
    } finally {
      busy = false;
    }
  }

  // ============================================================
  // MEDITATION LOCK
  // ============================================================
  function getOverlay() {
    let ov = document.getElementById("medOverlay");
    if (!ov) {
      // index.html should have it, but make one if not
      ov = document.createElement("div");
      ov.id = "medOverlay";
      ov.className = "overlay";
      ov.hidden = true;
      document.body.appendChild(ov);
    }
    return ov;
  }

  const fmtLeft = (left) => `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  function startMeditation(seconds, ctx) {
    if (med || !(seconds > 0)) return;
    const ov = getOverlay();
    // Thin brand ring that drains over the session (pure CSS, timed to the session length)
    ov.innerHTML = `
      <div class="overlay-inner log-med">
        <div class="log-med-kicker">${icon("brain", 16)}Meditating</div>
        <div class="log-med-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="log-med-track" cx="60" cy="60" r="56" />
            <circle class="log-med-progress" cx="60" cy="60" r="56" pathLength="100" style="animation-duration:${seconds}s" />
          </svg>
          <div class="breathe log-med-breathe"></div>
          <div class="med-time">${fmtLeft(seconds)}</div>
        </div>
        <p class="log-med-hint">Breathe in as the circle grows. Out as it shrinks.</p>
        <p class="log-med-hint log-med-warn">Stay here. Leaving the tab ends your session.</p>
        <button class="btn btn-ghost log-med-quit" data-action="log-quit-med">Give up</button>
      </div>`;
    ov.hidden = false;

    const endAt = Date.now() + seconds * 1000;
    const onHide = () => { if (document.hidden) failMeditation(); };
    const onBlur = () => failMeditation();
    const onKey = (e) => { if (e.key === "Escape") failMeditation(); };

    med = { ctx, onHide, onBlur, onKey, timer: null };
    med.timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      if (left <= 0) return finishMeditation();
      const t = ov.querySelector(".med-time");
      if (t) t.textContent = fmtLeft(left);
    }, 250);

    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("blur", onBlur);
    document.addEventListener("keydown", onKey);
  }

  // Turns everything off. Safe to call more than once. Returns the ctx it was using.
  function cleanupMeditation() {
    if (!med) return null;
    const { ctx, timer, onHide, onBlur, onKey } = med;
    med = null;
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("keydown", onKey);
    const ov = document.getElementById("medOverlay");
    if (ov) { ov.hidden = true; ov.innerHTML = ""; }
    return ctx;
  }

  // Used by render(): ends the session with no point and no redraw
  function stopMeditation(msg) {
    if (cleanupMeditation()) toast(msg);
  }

  // Left the tab, clicked away, or hit Escape
  function failMeditation() {
    if (cleanupMeditation()) toast("You left, so the session ended. No point this time.");
  }

  // Pressed "Give up"
  function quitMeditation() {
    if (cleanupMeditation()) toast("Session ended early. No point this time.");
  }

  // Timer hit 0
  async function finishMeditation() {
    const ctx = cleanupMeditation();
    if (!ctx) return;
    try {
      const logs = await PP.db.getTodayLogs();
      if (countKind(logs, "meditation") === 0) {
        await PP.db.addPointLog({ kind: "meditation", points: 1, multiplier: 1, multiplier_reason: "none", event_types: [] });
        toast("Session done. +1 pt");
        ctx.refreshSidebar();
      } else {
        toast("Session done. You already got today's point.");
      }
    } catch (err) {
      if (/already/i.test(err.message || "")) toast("Session done. You already got today's point.");
      else toast(err.message || "Something went wrong. Try again.");
    }
    await redraw(ctx);
  }

  // ============================================================
  // EVENTS (app.js sends us clicks and changes)
  // ============================================================
  async function onAction(action, el, ctx) {
    if (action === "log-quit-med") return quitMeditation();
    if (med) return; // nothing else works while meditating
    lastCtx = ctx;

    if (action === "log-tab") {
      const v = el.dataset.v;
      if (!["workout", "eating", "wellness"].includes(v) || v === tab) return;
      tab = v;
      return redraw(ctx);
    }
    if (action === "log-workout") return logWorkout(el, ctx);
    if (action === "log-remove-wphoto") {
      clearPhoto();
      if (PP.share && PP.share.clearPhoto) PP.share.clearPhoto();
      const input = document.getElementById("logWPhoto");
      if (input) input.value = "";
      drawPhotoArea();
      return PP.ui.toast("Photo removed");
    }
    if (action === "log-remove-jphoto") {
      if (!confirm("Delete this journal photo? Your point for that day stays.")) return;
      if (deleteJournalPhoto(ctx.me, Number(el.dataset.i))) PP.ui.toast("Journal photo deleted");
      else PP.ui.toast("Couldn't delete that. Try again.");
      return redraw(ctx);
    }

    if (action === "log-meditate") return startMeditation(Number(el.dataset.sec), ctx);

    // AI meal tracker
    if (action === "log-ai-estimate") return aiEstimate();
    if (action === "log-ai-clear") return aiClear();
    if (action === "log-ai-add") {
      if (busy) return;
      busy = true;
      el.disabled = true;
      try {
        await aiAdd(ctx);
      } catch (err) {
        toast((err && err.message) || "Couldn't add that. Try again.");
      } finally {
        busy = false;
        if (el.isConnected) el.disabled = false;
      }
      return;
    }

    // Food and goals: one at a time so a double click can't double-add
    if (["log-add-food", "log-remove-food", "log-save-goals"].includes(action)) {
      if (busy) return;
      busy = true;
      el.disabled = true;
      try {
        if (action === "log-add-food") await addFood(ctx);
        if (action === "log-remove-food") await removeFood(el, ctx);
        if (action === "log-save-goals") await saveGoals(ctx);
      } finally {
        busy = false;
        if (el.isConnected) el.disabled = false;
      }
    }
  }

  async function onChange(el, ctx) {
    lastCtx = ctx;
    const id = el.id;
    if (id === "logWPP") form.peakPulse = el.checked;
    if (id === "logWUF") form.ufEvent = el.checked;
    if (id === "logWOther") form.other = el.checked;
    if (id === "logWPartner") form.partnerId = el.value;
    if (["logWPP", "logWUF", "logWOther", "logWPartner"].includes(id)) return drawPreview(ctx);

    if (id === "logWPhoto") {
      const file = el.files && el.files[0];
      el.value = ""; // so picking the same file again still fires
      return onWorkoutPhoto(file, ctx);
    }
    if (id === "logJPhoto") {
      const file = el.files && el.files[0];
      el.value = "";
      return onJournalPhoto(file, ctx);
    }
    if (id === "logAiText") {
      ai.text = el.value; // remember it so a redraw doesn't wipe it
      return;
    }
    if (id === "logAiPhoto") {
      const file = el.files && el.files[0];
      el.value = "";
      if (!file) return;
      if (!fileOk(file)) return toast(BAD_FILE_MSG);
      const input = document.getElementById("logAiText");
      if (input) ai.text = input.value; // keep what they typed
      ai.file = file;
      ai.result = null;
      return drawAi();
    }
  }

  PP.pages.log = {
    render,
    onAction,
    onChange,
    // Pure helpers exposed for tests (not used by other pages)
    _test: { FOODS, mealTotals, goalsOf, hitMacros, eventTypes, workoutPlan, fileOk },
  };
})();
