// ============================================================
// PEAK PULSE MVP
// Everything runs in your browser. Your data is saved in the
// browser's memory (localStorage), so it stays after a refresh.
// ============================================================

const STORE_KEY = "peakpulse-mvp-v1";

// ---------- Point rules (change these to rebalance the game) ----------
const RULES = {
  workoutBase: 3,       // points for any workout
  maxWorkoutsPerDay: 2,
  macrosPoint: 1,       // hitting all your macros for the day
  journalPoint: 1,
  meditationPoint: 1,
  macroHitPercent: 0.9, // "hitting" a macro = reaching 90% of the goal
  greekMinActive: 10,   // houses need this many active members to show up
  multipliers: { peakPulse: 3, newPartner: 3, ufEvent: 2, other: 1 },
};

// ============================================================
// SMALL HELPERS
// ============================================================

// Today's date as "2026-09-18" (in your local time zone)
function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
// This month as "2026-09"
function monthStr() {
  return todayStr().slice(0, 7);
}
// Makes text safe to put on the page (stops weird characters from breaking it)
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
// "Jake Carter" -> "JC"
function initials(name) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}
// Random short id
function uid() {
  return Math.random().toString(36).slice(2, 9);
}
// Nice date like "Sat, Sep 19, 6:30 AM"
function fmtWhen(iso) {
  return new Date(iso).toLocaleString([], {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}
// Wait a bit (used for animations)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pop-up message at the bottom of the screen
let toastTimer = null;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

// Shrinks a photo so it fits in the browser's memory
function shrinkImage(file, maxW = 400) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const c = document.createElement("canvas");
      c.width = img.width * scale;
      c.height = img.height * scale;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ============================================================
// SAVED DATA (the app's memory)
// ============================================================

function freshState() {
  return {
    me: null,                  // your profile: { name, email, greek }
    logs: [],                  // every point you earned: { kind, date, points, detail }
    meals: {},                 // meals by date: { "2026-09-18": ["Eggs (2)", ...] }
    goals: { p: 150, c: 250, f: 70 }, // daily macro goals in grams
    rsvps: {},                 // events you're going to: { ev1: true }
    sessions: makeSeedSessions(), // Find a Partner posts
    joined: [],                // ids of partner posts you joined
    pastPartners: [],          // people you've already worked out with
    journalPhotos: [],         // { date, img } kept only on this device
  };
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY));
  } catch (e) {
    return null;
  }
}
function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    toast("Couldn't save. Your browser storage might be full.");
  }
}

let state = loadState() || freshState();
const EVENTS = makeEvents();

// Stuff that only matters while the page is open (which tab you're on, etc.)
const ui = {
  tab: "rsvp",
  lbTab: "individuals",
  logTab: "workout",
  photoOk: false,  // did the workout photo pass the check?
  photoUrl: null,  // preview of the workout photo you picked
  gatorRunning: false,
};

// ============================================================
// POINTS
// ============================================================

// Your points this month (old months don't count = monthly reset)
function myPoints() {
  const m = monthStr();
  return state.logs
    .filter((l) => l.date.startsWith(m))
    .reduce((sum, l) => sum + l.points, 0);
}
// Everything you logged today of one kind (like "workout")
function todays(kind) {
  const t = todayStr();
  return state.logs.filter((l) => l.date === t && l.kind === kind);
}
function addLog(kind, points, detail = {}) {
  state.logs.push({ id: uid(), kind, date: todayStr(), points, detail });
  saveState();
}

// Works out a workout's multiplier. They don't stack: you get the biggest one.
function workoutMultiplier({ peakPulse, ufEvent, newPartner }) {
  const m = RULES.multipliers;
  return Math.max(
    peakPulse ? m.peakPulse : 1,
    newPartner ? m.newPartner : 1,
    ufEvent ? m.ufEvent : 1,
    m.other
  );
}

// ============================================================
// LEADERBOARD MATH
// ============================================================

// Everyone ranked by points. If you tie with someone, they stay above you.
function individuals(myPts = myPoints()) {
  const rows = FAKE_USERS.map((u) => ({ ...u, isMe: false }));
  rows.push({ id: "me", name: state.me.name, greek: state.me.greek, points: myPts, isMe: true });
  rows.sort((a, b) => b.points - a.points || (a.isMe ? 1 : 0) - (b.isMe ? 1 : 0));
  return rows;
}

// Greek houses ranked by the AVERAGE points of their active members.
// "Active" = has points this month.
function greekBoard(myPts = myPoints()) {
  const everyone = individuals(myPts);
  const board = [];
  const tooSmall = [];
  GREEK_HOUSES.forEach((house) => {
    const active = everyone.filter((r) => r.greek === house && r.points > 0);
    if (active.length >= RULES.greekMinActive) {
      const avg = active.reduce((s, r) => s + r.points, 0) / active.length;
      board.push({ house, avg: Math.round(avg * 10) / 10, count: active.length });
    } else {
      tooSmall.push({ house, count: active.length });
    }
  });
  board.sort((a, b) => b.avg - a.avg);
  return { board, tooSmall };
}

// The next person above you, and how many points until you pass them
function nextTarget(myPts = myPoints()) {
  const rows = individuals(myPts);
  const i = rows.findIndex((r) => r.isMe);
  if (i === 0) return null; // you're #1
  const above = rows[i - 1];
  return { name: above.name, gap: above.points - myPts + 1 };
}

// "Good morning / afternoon / evening"
function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// The greeting block at the top of every tab
function greetingHTML(title, myPts = myPoints()) {
  const first = esc(state.me.name.split(" ")[0]);
  const t = nextTarget(myPts);
  const hint = t
    ? `<div class="next-up">🐊 <b>${t.gap} ${t.gap === 1 ? "pt" : "pts"}</b> until you pass ${esc(t.name)}</div>`
    : `<div class="next-up">👑 You're <b>#1</b>. Stay hungry.</div>`;
  return `
    <div class="greeting">
      <div>
        <div class="hello">${timeGreeting()}, ${first}</div>
        <div class="big">${title}</div>
      </div>
      ${hint}
    </div>`;
}

// Default time for a new partner post: the next full hour
function nextHourLocal() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
}

function daysLeftInMonth() {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return last - now.getDate();
}

// ============================================================
// DRAWING THE SCREENS
// ============================================================

// Redraws the whole app. myPtsOverride is only used during the gator animation.
function render(myPtsOverride) {
  if (!state.me) {
    renderOnboarding();
    return;
  }
  document.getElementById("onboarding").hidden = true;

  const pts = myPtsOverride ?? myPoints();
  renderHeader(pts);

  // Highlight the active tab in the bottom bar
  document.querySelectorAll("#tabbar button").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === ui.tab)
  );

  const screen = document.getElementById("screen");
  if (ui.tab === "rsvp") screen.innerHTML = greetingHTML("Peak Pulse events", pts) + rsvpHTML();
  if (ui.tab === "leaderboard") screen.innerHTML = greetingHTML("Leaderboard", pts) + leaderboardHTML(pts);
  if (ui.tab === "partner") screen.innerHTML = greetingHTML("Find a partner", pts) + partnerHTML();
  if (ui.tab === "log") screen.innerHTML = greetingHTML("Log it", pts) + logHTML();

  if (ui.tab === "log" && ui.logTab === "workout") updateWorkoutPreview();

  // On the leaderboard, scroll so your row is in view
  if (ui.tab === "leaderboard" && ui.lbTab === "individuals") {
    const meRow = document.querySelector(".row.me");
    if (meRow) meRow.scrollIntoView({ block: "center" });
  }
}

// Your card in the sidebar: name, house, points, rank
function renderHeader(pts) {
  const rank = individuals(pts).findIndex((r) => r.isMe) + 1;
  document.getElementById("header").innerHTML = `
    <div class="me-card">
      <div style="display:flex;gap:10px;align-items:center">
        <div class="avatar me">${initials(state.me.name)}</div>
        <div style="min-width:0">
          <div class="me-name">${esc(state.me.name)}</div>
          <div class="me-sub">${esc(state.me.greek || "Independent")}</div>
        </div>
      </div>
      <div class="me-stats">
        <div><b id="myPts">${pts}</b>points</div>
        <div><b id="myRank">#${rank}</b>rank</div>
      </div>
    </div>`;
}

// ---------- Light / dark mode ----------
function currentTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}
function updateThemeButton() {
  // The button shows the mode you'd SWITCH TO
  document.getElementById("themeBtn").textContent = currentTheme() === "dark" ? "☀️ Light" : "🌙 Dark";
}
function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("peakpulse-theme", next); } catch (e) {}
  updateThemeButton();
}

// ---------- Sign up ----------
function renderOnboarding() {
  const ov = document.getElementById("onboarding");
  ov.hidden = false;
  ov.innerHTML = `
    <div class="overlay-inner">
      <div class="big-logo logo"><span class="sun">☀</span> PEAK PULSE</div>
      <div class="tagline">Where movement meets momentum. Gainesville.</div>
      <input id="obName" placeholder="Your name" autocomplete="off" />
      <input id="obEmail" placeholder="UF email (you@ufl.edu)" type="email" autocomplete="off" />
      <select id="obGreek">
        <option value="">No fraternity or sorority</option>
        ${GREEK_HOUSES.map((h) => `<option>${esc(h)}</option>`).join("")}
      </select>
      <button class="btn btn-primary" data-action="signup">Let's go</button>
    </div>`;
}

// ---------- RSVP tab ----------
function rsvpHTML() {
  const cards = EVENTS.map((ev) => {
    const going = !!state.rsvps[ev.id];
    const people = ev.attendees.map(userById);
    const total = people.length + (going ? 1 : 0);
    // Show up to 7 faces, you first if you're going
    const faces = (going ? [`<div class="avatar me">${initials(state.me.name)}</div>`] : [])
      .concat(people.slice(0, going ? 6 : 7).map((u) => `<div class="avatar">${initials(u.name)}</div>`))
      .join("");
    const names = (going ? ["You"] : []).concat(people.map((u) => u.name)).map(esc).join(", ");
    return `
      <div class="card">
        <span class="tag">Peak Pulse · 3x points</span>
        <h3 style="margin-top:8px">${esc(ev.title)}</h3>
        <div class="muted">${fmtWhen(ev.when)} · ${esc(ev.location)}</div>
        <div class="avatar-stack">${faces}</div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b>${total} going</b>
          <button class="btn btn-small ${going ? "btn-going" : ""}" data-action="rsvp" data-id="${ev.id}">
            ${going ? "Going ✓" : "I'm going"}
          </button>
        </div>
        <details><summary>See who's going</summary><p>${names}</p></details>
      </div>`;
  }).join("");
  return `<div class="grid">${cards}</div>`;
}

// ---------- Leaderboard tab ----------
function leaderboardHTML(pts) {
  const seg = `
    <div class="seg">
      <button class="${ui.lbTab === "individuals" ? "active" : ""}" data-action="lbtab" data-v="individuals">Individuals</button>
      <button class="${ui.lbTab === "greek" ? "active" : ""}" data-action="lbtab" data-v="greek">Greek Life</button>
    </div>
    <div class="muted" style="margin-bottom:10px">Resets on the 1st · ${daysLeftInMonth()} days left this month</div>`;

  if (ui.lbTab === "individuals") {
    const rows = individuals(pts).map((r, i) => `
      <div class="row ${r.isMe ? "me" : ""} ${i < 3 ? "top" + (i + 1) : ""}" data-id="${r.id}">
        <span class="rank ${i < 3 ? "medal" : ""}">${["🥇", "🥈", "🥉"][i] || i + 1}</span>
        <div class="avatar">${initials(r.name)}</div>
        <div class="who">
          <div class="name">${esc(r.name)}${r.isMe ? " (you)" : ""}</div>
          <div class="sub">${esc(r.greek || "Independent")}</div>
        </div>
        <span class="pts">${r.points}</span>
      </div>`).join("");
    return `<div class="narrow">${seg}${rows}</div>`;
  }

  // Greek Life board
  const { board, tooSmall } = greekBoard(pts);
  const rows = board.map((h, i) => `
    <div class="row ${h.house === state.me.greek ? "me" : ""}">
      <span class="rank">${i + 1}</span>
      <div class="who">
        <div class="name">${esc(h.house)}</div>
        <div class="sub">${h.count} active members</div>
      </div>
      <span class="pts">${h.avg}</span>
    </div>`).join("");
  const small = tooSmall.length
    ? `<p class="muted" style="margin-top:14px">Not on the board yet (need ${RULES.greekMinActive} active members): ${tooSmall
        .map((h) => `${esc(h.house)} (${h.count}/${RULES.greekMinActive})`).join(", ")}</p>`
    : "";
  return `<div class="narrow">${seg}<div class="muted" style="margin-bottom:8px">Score = average points per active member</div>${rows}${small}</div>`;
}

// ---------- Find a Partner tab ----------
function partnerHTML() {
  const sorted = [...state.sessions].sort((a, b) => new Date(a.when) - new Date(b.when));
  const feed = sorted.map((s) => {
    const mine = s.userId === "me";
    const host = mine ? { name: state.me.name } : userById(s.userId);
    const joined = state.joined.includes(s.id);
    const what = s.type === "gym" ? `Gym · ${esc(s.focus)}` : "Run";
    let btn;
    if (mine) btn = `<span class="muted">Your post · ${s.joiners.length} joined</span>`;
    else if (joined) btn = `<button class="btn btn-small btn-going" data-action="leave" data-id="${s.id}">Joined ✓</button>`;
    else btn = `<button class="btn btn-small" data-action="join" data-id="${s.id}">Join</button>`;
    const isNew = !mine && !state.pastPartners.includes(s.userId);
    return `
      <div class="card">
        <div style="display:flex;gap:10px;align-items:center">
          <div class="avatar ${mine ? "me" : ""}">${initials(host.name)}</div>
          <div style="flex:1">
            <b>${esc(host.name)}${mine ? " (you)" : ""}</b>
            <div class="muted">${what} · ${fmtWhen(s.when)}</div>
            <div class="muted">📍 ${esc(s.location)}</div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
          ${isNew ? `<span class="tag">New partner = 3x</span>` : "<span></span>"}
          ${btn}
        </div>
      </div>`;
  }).join("");

  return `
   <div class="cols">
    <div class="card sticky">
      <h3>Post a session</h3>
      <div class="muted" style="margin-bottom:10px">Everyone can see it. Go with someone new and get 3x.</div>
      <select id="pType" data-action="ptype">
        <option value="gym">Gym</option>
        <option value="run">Run</option>
      </select>
      <select id="pFocus">
        <option>Arms</option><option>Legs</option><option>Cardio</option>
      </select>
      <input id="pWhen" type="datetime-local" value="${nextHourLocal()}" />
      <input id="pWhere" placeholder="Where? (ex: Southwest Rec)" />
      <button class="btn btn-primary" data-action="post">Post it</button>
    </div>
    <div>
      <h4 style="margin-top:0">Upcoming sessions</h4>
      <div class="grid">${feed}</div>
    </div>
   </div>`;
}

// ---------- Log tab ----------
function logHTML() {
  // Today's progress: what you've done out of what's possible
  const w = todays("workout").length;
  const box = (label, value, done) => `<div class="${done ? "done" : ""}"><b>${value}</b>${label}</div>`;
  const todayPts = state.logs.filter((l) => l.date === todayStr()).reduce((s, l) => s + l.points, 0);
  const checklist = `
    <div class="card">
      <div style="display:flex;justify-content:space-between"><b>Today</b><span class="muted">${todayPts} pts earned today</span></div>
      <div class="checklist">
        ${box("Workouts", `${w}/${RULES.maxWorkoutsPerDay}`, w >= RULES.maxWorkoutsPerDay)}
        ${box("Macros", todays("macros").length ? "✓" : "–", todays("macros").length)}
        ${box("Journal", todays("journal").length ? "✓" : "–", todays("journal").length)}
        ${box("Meditate", todays("meditation").length ? "✓" : "–", todays("meditation").length)}
      </div>
    </div>`;
  const seg = checklist + `
    <div class="seg">
      <button class="${ui.logTab === "workout" ? "active" : ""}" data-action="logtab" data-v="workout">Workout</button>
      <button class="${ui.logTab === "eating" ? "active" : ""}" data-action="logtab" data-v="eating">Eating</button>
      <button class="${ui.logTab === "wellness" ? "active" : ""}" data-action="logtab" data-v="wellness">Wellness</button>
    </div>`;
  if (ui.logTab === "workout") return seg + `<div class="narrow">${workoutHTML()}</div>`;
  if (ui.logTab === "eating") return seg + eatingHTML();
  return seg + `<div class="grid">${wellnessHTML()}</div>`;
}

function workoutHTML() {
  const done = todays("workout").length;
  const full = done >= RULES.maxWorkoutsPerDay;

  // People you joined sessions with go at the top of the partner list
  const joinedHosts = state.sessions
    .filter((s) => state.joined.includes(s.id) && s.userId !== "me")
    .map((s) => s.userId);
  const option = (u) => {
    const isNew = !state.pastPartners.includes(u.id);
    return `<option value="${u.id}">${esc(u.name)}${isNew ? "  (new, 3x)" : ""}</option>`;
  };
  const fromSessions = joinedHosts.map(userById);
  const everyone = [...FAKE_USERS].filter((u) => !joinedHosts.includes(u.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return `
    <div class="card">
      <h3>Log a workout</h3>
      <div class="muted">${done} of ${RULES.maxWorkoutsPerDay} workouts logged today</div>
      ${full ? `<p class="done-pill" style="margin-top:12px">You hit the max for today. Rest up.</p>` : `
      <h4>1. Snap a photo</h4>
      <label class="photo-btn">📸 ${ui.photoOk ? "Photo added ✓ (tap to change)" : "Take workout photo"}
        <input type="file" accept="image/*" capture="environment" id="wPhoto" hidden />
      </label>
      ${ui.photoUrl ? `<img class="photo-thumb" src="${ui.photoUrl}" alt="Your workout photo" />` : ""}
      <div id="wPhotoStatus" class="muted" style="margin-top:6px">${ui.photoOk ? "✅ Looks like a workout" : ""}</div>

      <h4>2. What did you go to?</h4>
      <label class="check"><input type="checkbox" id="wPP" /> Peak Pulse event <span class="tag">3x</span></label>
      <div class="muted" style="margin:-6px 0 6px 30px">Run, cold plunge, and yoga count as one workout</div>
      <label class="check"><input type="checkbox" id="wUF" /> UF event (run club, intramurals) <span class="tag">2x</span></label>
      <label class="check"><input type="checkbox" id="wOther" /> Something else <span class="tag">1x</span></label>

      <h4>3. Work out with someone?</h4>
      <select id="wPartner">
        <option value="">Nobody this time</option>
        ${fromSessions.length ? `<optgroup label="From your sessions">${fromSessions.map(option).join("")}</optgroup>` : ""}
        <optgroup label="Everyone">${everyone.map(option).join("")}</optgroup>
      </select>

      <div class="preview" id="wPreview"></div>
      <button class="btn btn-primary" data-action="logWorkout" id="wSubmit">Log workout</button>`}
    </div>`;
}

function eatingHTML() {
  const t = todayStr();
  const meals = state.meals[t] || [];
  const totals = { p: 0, c: 0, f: 0 };
  meals.forEach((name) => {
    const food = FOODS.find((f) => f.name === name);
    if (food) { totals.p += food.p; totals.c += food.c; totals.f += food.f; }
  });
  const got = todays("macros").length > 0;
  const bar = (label, key) => {
    const goal = state.goals[key] || 1;
    const pct = Math.min(100, Math.round((totals[key] / goal) * 100));
    const hit = totals[key] >= goal * RULES.macroHitPercent;
    return `
      <div class="bar-label"><span>${label}</span><span>${totals[key]} / ${goal}g ${hit ? "✓" : ""}</span></div>
      <div class="bar ${hit ? "full" : ""}"><div style="width:${pct}%"></div></div>`;
  };
  return `
   <div class="cols">
    <div>
    <div class="card">
      <h3>Today's macros</h3>
      ${got ? `<span class="done-pill">Macros hit today. +1 ✓</span>` : `<div class="muted">Hit all 3 to earn 1 point</div>`}
      ${bar("Protein", "p")}${bar("Carbs", "c")}${bar("Fat", "f")}
    </div>
    <div class="card">
      <h3>Your daily goals (grams)</h3>
      <div class="inline">
        <input type="number" id="gP" value="${state.goals.p}" placeholder="Protein" title="Protein" />
        <input type="number" id="gC" value="${state.goals.c}" placeholder="Carbs" title="Carbs" />
        <input type="number" id="gF" value="${state.goals.f}" placeholder="Fat" title="Fat" />
      </div>
      <div class="muted" style="margin-top:6px">Protein · Carbs · Fat</div>
      <button class="btn btn-primary" data-action="saveGoals">Save goals</button>
    </div>
    </div>
    <div class="card">
      <h3>Add food</h3>
      <select id="fFood">${FOODS.map((f) => `<option>${esc(f.name)}</option>`).join("")}</select>
      <button class="btn btn-primary" data-action="addFood">Add</button>
      ${meals.length ? `<h4>Eaten today</h4><div class="muted">${meals.map(esc).join("<br>")}</div>` : `<p class="muted">Nothing logged yet today.</p>`}
    </div>
   </div>`;
}

function wellnessHTML() {
  const journaled = todays("journal").length > 0;
  const meditated = todays("meditation").length > 0;
  const photos = [...state.journalPhotos].reverse().slice(0, 9);
  return `
    <div class="card">
      <h3>📓 Journal</h3>
      <div class="muted">Write on paper. Date it at the top. Snap a photo to log it.</div>
      <div class="muted">The photo stays on your phone. Nobody else sees it.</div>
      <div style="margin:10px 0">${journaled ? `<span class="done-pill">Journaled today. +1 ✓</span>` : ""}</div>
      <label class="photo-btn">📸 Snap journal page
        <input type="file" accept="image/*" capture="environment" id="jPhoto" hidden />
      </label>
      ${photos.length ? `<h4>Your journal</h4><div class="photo-grid">${photos
        .map((p) => `<div><img src="${p.img}" alt="Journal page" /><span>${p.date}</span></div>`).join("")}</div>` : ""}
    </div>
    <div class="card">
      <h3>🧘 Meditate</h3>
      <div class="muted">Your phone gets locked in. Leave the app and the session ends.</div>
      <div style="margin:10px 0">${meditated ? `<span class="done-pill">Meditated today. +1 ✓</span>` : ""}</div>
      <div class="inline" style="flex-wrap:wrap">
        <button class="btn" data-action="meditate" data-sec="10">Demo 10s</button>
        <button class="btn" data-action="meditate" data-sec="300">5 min</button>
        <button class="btn" data-action="meditate" data-sec="600">10 min</button>
        <button class="btn" data-action="meditate" data-sec="900">15 min</button>
      </div>
    </div>`;
}

// Updates the "This workout = X pts" box as you tick boxes
function updateWorkoutPreview() {
  const box = document.getElementById("wPreview");
  if (!box) return;
  const info = readWorkoutForm();
  const mult = workoutMultiplier(info);
  let why = "";
  if (mult > 1) {
    const reasons = [];
    if (info.peakPulse) reasons.push("Peak Pulse");
    if (info.newPartner) reasons.push("new partner");
    if (info.ufEvent) reasons.push("UF event");
    why = `<div class="muted" style="font-weight:400;margin-top:4px">${mult}x from ${reasons.join(" / ")}. Multipliers don't stack, you get the biggest.</div>`;
  }
  box.innerHTML = `This workout = <b>${RULES.workoutBase * mult} pts</b>${why}`;
}

function readWorkoutForm() {
  const partnerId = document.getElementById("wPartner")?.value || "";
  return {
    peakPulse: document.getElementById("wPP")?.checked,
    ufEvent: document.getElementById("wUF")?.checked,
    other: document.getElementById("wOther")?.checked,
    partnerId,
    newPartner: !!partnerId && !state.pastPartners.includes(partnerId),
  };
}

// ============================================================
// THE GATOR 🐊
// Plays after you log a workout, but ONLY if you passed someone.
// ============================================================
async function runGator(oldPts, newPts) {
  // People who were above you before and are below you now
  const passed = FAKE_USERS
    .filter((u) => u.points >= oldPts && u.points < newPts)
    .sort((a, b) => a.points - b.points); // closest to you first

  if (passed.length === 0) return false;

  ui.gatorRunning = true;
  ui.tab = "leaderboard";
  ui.lbTab = "individuals";
  render(oldPts); // show the board the way it was BEFORE your workout
  await sleep(500);

  // Chomp up to 5 people one after another (more would take forever)
  for (const u of passed.slice(0, 5)) {
    const row = document.querySelector(`.row[data-id="${u.id}"]`);
    if (!row) continue;
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    await sleep(350);
    const gator = document.createElement("div");
    gator.className = "gator";
    gator.textContent = "🐊";
    const word = document.createElement("div");
    word.className = "chomp-word";
    word.textContent = "CHOMP!";
    row.append(gator, word);
    row.classList.add("chomped");
    await sleep(1000);
  }

  // Now show the new board with you moved up
  render();
  const meRow = document.querySelector(".row.me");
  if (meRow) meRow.classList.add("jumped");
  const n = passed.length;
  toast(`🐊 You ate ${n} ${n === 1 ? "person" : "people"}! +${newPts - oldPts} pts`);
  ui.gatorRunning = false;
  return true;
}

// ============================================================
// MEDITATION LOCK
// ============================================================
let medTimer = null;

function startMeditation(seconds) {
  const ov = document.getElementById("medOverlay");
  ov.hidden = false;
  let left = seconds;

  const draw = () => {
    const m = Math.floor(left / 60);
    const s = String(left % 60).padStart(2, "0");
    ov.innerHTML = `
      <div class="overlay-inner" style="text-align:center">
        <div class="breathe"></div>
        <div class="med-time">${m}:${s}</div>
        <p class="muted">Breathe in as the circle grows. Out as it shrinks.</p>
        <p class="muted">Stay here. Leaving the app ends your session.</p>
        <button class="btn" data-action="quitMed" style="margin-top:20px">Give up</button>
      </div>`;
  };
  draw();

  medTimer = setInterval(() => {
    left--;
    if (left <= 0) finishMeditation(true);
    else {
      // Only update the numbers so the breathing circle keeps animating smoothly
      const t = ov.querySelector(".med-time");
      if (t) t.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    }
  }, 1000);

  // If you switch apps or tabs, the session fails
  document.addEventListener("visibilitychange", onLeaveDuringMeditation);
}

function onLeaveDuringMeditation() {
  if (document.hidden) finishMeditation(false, "You left the app, so the session ended. No point this time.");
}

function finishMeditation(success, msg) {
  clearInterval(medTimer);
  document.removeEventListener("visibilitychange", onLeaveDuringMeditation);
  document.getElementById("medOverlay").hidden = true;
  if (success) {
    if (todays("meditation").length === 0) {
      addLog("meditation", RULES.meditationPoint);
      toast("🧘 Session done. +1 pt");
    } else {
      toast("🧘 Session done. You already got today's point.");
    }
  } else {
    toast(msg || "Session ended early. No point this time.");
  }
  render();
}

// ============================================================
// BUTTON CLICKS
// One listener handles every button that has data-action="..."
// ============================================================
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || ui.gatorRunning) return;
  const action = el.dataset.action;

  // --- Sign up ---
  if (action === "signup") {
    const name = document.getElementById("obName").value.trim();
    const email = document.getElementById("obEmail").value.trim().toLowerCase();
    const greek = document.getElementById("obGreek").value;
    if (!name) return toast("Add your name first");
    if (!email.endsWith("@ufl.edu")) return toast("Use your @ufl.edu email");
    state.me = { name, email, greek };
    saveState();
    render();
  }

  // --- Switch tabs ---
  if (action === "tab") { ui.tab = el.dataset.tab; render(); window.scrollTo(0, 0); }
  if (action === "lbtab") { ui.lbTab = el.dataset.v; render(); }
  if (action === "logtab") { ui.logTab = el.dataset.v; render(); }

  // --- RSVP ---
  if (action === "rsvp") {
    const id = el.dataset.id;
    if (state.rsvps[id]) delete state.rsvps[id];
    else { state.rsvps[id] = true; toast("You're going! 🔥"); }
    saveState();
    render();
  }

  // --- Find a Partner ---
  if (action === "post") {
    const type = document.getElementById("pType").value;
    const focus = type === "gym" ? document.getElementById("pFocus").value : "";
    const when = document.getElementById("pWhen").value;
    const where = document.getElementById("pWhere").value.trim();
    if (!when) return toast("Pick a date and time");
    if (!where) return toast("Add where you're going");
    state.sessions.push({ id: uid(), userId: "me", type, focus, when: new Date(when).toISOString(), location: where, joiners: [] });
    saveState();
    toast("Posted. Everyone can see it now.");
    render();
  }
  if (action === "join") {
    const s = state.sessions.find((x) => x.id === el.dataset.id);
    state.joined.push(s.id);
    saveState();
    toast(`You're in. ${userById(s.userId).name.split(" ")[0]} got a notification.`);
    render();
  }
  if (action === "leave") {
    state.joined = state.joined.filter((id) => id !== el.dataset.id);
    saveState();
    render();
  }

  // --- Log a workout ---
  if (action === "logWorkout") {
    if (todays("workout").length >= RULES.maxWorkoutsPerDay) return toast("Max 2 workouts a day");
    if (!ui.photoOk) return toast("Snap your workout photo first");
    const info = readWorkoutForm();
    if (!info.peakPulse && !info.ufEvent && !info.other) return toast("Pick what you went to");

    const mult = workoutMultiplier(info);
    const pts = RULES.workoutBase * mult;
    const oldPts = myPoints();
    addLog("workout", pts, info);
    if (info.partnerId && !state.pastPartners.includes(info.partnerId)) {
      state.pastPartners.push(info.partnerId);
      saveState();
    }
    ui.photoOk = false;
    if (ui.photoUrl) URL.revokeObjectURL(ui.photoUrl);
    ui.photoUrl = null;

    const chomped = await runGator(oldPts, oldPts + pts);
    if (!chomped) {
      toast(`💪 Workout logged. +${pts} pts`);
      render();
    }
  }

  // --- Eating ---
  if (action === "addFood") {
    const t = todayStr();
    const name = document.getElementById("fFood").value;
    state.meals[t] = state.meals[t] || [];
    state.meals[t].push(name);
    saveState();
    checkMacros();
    render();
  }
  if (action === "saveGoals") {
    const p = +document.getElementById("gP").value;
    const c = +document.getElementById("gC").value;
    const f = +document.getElementById("gF").value;
    if (!(p > 0 && c > 0 && f > 0)) return toast("Goals need to be above 0");
    state.goals = { p, c, f };
    saveState();
    toast("Goals saved");
    checkMacros();
    render();
  }

  // --- Meditation ---
  if (action === "meditate") startMeditation(+el.dataset.sec);
  if (action === "quitMed") finishMeditation(false);

  // --- Light / dark mode ---
  if (action === "theme") toggleTheme();

  // --- Reset the demo ---
  if (action === "reset") {
    if (confirm("Reset the demo? This wipes your profile and points.")) {
      localStorage.removeItem(STORE_KEY);
      state = freshState();
      ui.tab = "rsvp";
      render();
    }
  }
});

// Gives the macro point once per day when all 3 goals are hit
function checkMacros() {
  if (todays("macros").length > 0) return;
  const meals = state.meals[todayStr()] || [];
  const totals = { p: 0, c: 0, f: 0 };
  meals.forEach((name) => {
    const food = FOODS.find((f) => f.name === name);
    if (food) { totals.p += food.p; totals.c += food.c; totals.f += food.f; }
  });
  const hitAll = ["p", "c", "f"].every((k) => totals[k] >= state.goals[k] * RULES.macroHitPercent);
  if (hitAll) {
    addLog("macros", RULES.macrosPoint);
    toast("🥗 Macros hit! +1 pt");
  }
}

// ============================================================
// FORM CHANGES (checkboxes, dropdowns, photo pickers)
// ============================================================
document.addEventListener("change", async (e) => {
  const id = e.target.id;

  // Show/hide the gym focus dropdown
  if (id === "pType") {
    document.getElementById("pFocus").style.display = e.target.value === "gym" ? "" : "none";
  }

  // Workout form: update the points preview
  if (["wPP", "wUF", "wOther", "wPartner"].includes(id)) updateWorkoutPreview();

  // Workout photo. In the real app, Claude looks at the photo to check it's a workout.
  // For the MVP we just pretend to check it.
  if (id === "wPhoto" && e.target.files[0]) {
    const status = document.getElementById("wPhotoStatus");
    status.textContent = "Checking photo...";
    // Remember what's already filled in so redrawing doesn't wipe it
    const before = readWorkoutForm();
    await sleep(900);
    ui.photoOk = true;
    if (ui.photoUrl) URL.revokeObjectURL(ui.photoUrl);
    ui.photoUrl = URL.createObjectURL(e.target.files[0]);
    render();
    document.getElementById("wPP").checked = !!before.peakPulse;
    document.getElementById("wUF").checked = !!before.ufEvent;
    document.getElementById("wOther").checked = !!before.other;
    document.getElementById("wPartner").value = before.partnerId;
    updateWorkoutPreview();
  }

  // Journal photo. Saved only in this browser. Honor system, no checking.
  if (id === "jPhoto" && e.target.files[0]) {
    try {
      const img = await shrinkImage(e.target.files[0]);
      state.journalPhotos.push({ date: todayStr(), img });
      if (todays("journal").length === 0) {
        addLog("journal", RULES.journalPoint);
        toast("📓 Journal logged. +1 pt");
      } else {
        saveState();
        toast("📓 Saved. You already got today's point.");
      }
      render();
    } catch (err) {
      toast("Couldn't read that photo. Try another one.");
    }
  }
});

// Start the app
updateThemeButton();
render();
