// ============================================================
// PEAK PULSE APP SHELL
// Boot, sign in, onboarding, sidebar, switching tabs, and
// sending clicks to the right page. Pages live in js/pages/.
// ============================================================

window.PP = window.PP || {};
PP.pages = PP.pages || {};

(function () {
  const { esc, toast } = PP.ui;

  // Which page file handles which data-action prefix
  const PREFIX_TO_PAGE = { rsvp: "rsvp", lb: "leaderboard", partner: "partner", log: "log" };
  const TAB_NAMES = { rsvp: "RSVP", leaderboard: "Leaderboard", partner: "Find a Partner", log: "Log" };

  const state = {
    me: null,       // my profile
    tab: "rsvp",    // which tab is open
    params: {},     // extra info passed with go(), like { from, to } for the gator
    renderId: 0,    // stops an old, slow render from drawing over a newer one
  };

  const $ = (id) => document.getElementById(id);

  // Peak Pulse logo on a black rounded tile (top of the auth + onboarding cards)
  const AUTH_LOGO = `<div class="auth-logo brand-logo"><img src="https://www.peakpulseclub.com/cdn/shop/files/white_text_peak_pulse_logo_with_sun.png?v=1750709848&width=600" alt="Peak Pulse" onerror="this.parentNode.classList.add('no-img')" /><span class="logo-fallback"><span class="sun">☀</span> PEAK PULSE</span></div>`;
  const overlay = () => $("onboarding");

  // The ctx object every page gets
  function makeCtx() {
    return { me: state.me, go, refreshSidebar, params: state.params };
  }

  // ============================================================
  // BOOT: signed out -> auth screen, no profile -> onboarding, else the app
  // ============================================================
  async function boot() {
    try {
      const session = await PP.db.getSession();
      if (!session) return showAuth();
      const me = await PP.db.getMyProfile();
      if (!me) return showOnboarding();
      startApp(me);
    } catch (err) {
      showBootError(err);
    }
  }

  function showBootError(err) {
    const ov = overlay();
    ov.hidden = false;
    ov.innerHTML = `
      <div class="overlay-inner auth-card">
        ${AUTH_LOGO}
        <div class="auth-title">GatorFit</div>
        <p class="tagline">${esc(err.message || "Something went wrong.")}</p>
        <button class="btn btn-primary btn-block" data-action="app-retry">Try again</button>
      </div>`;
  }

  // ---------- Sign in / sign up screen ----------
  function showAuth() {
    state.me = null;
    PP.me = null;
    const ov = overlay();
    ov.hidden = false;
    ov.innerHTML = `
      <form class="overlay-inner auth-card" id="authForm" novalidate>
        ${AUTH_LOGO}
        <div class="auth-title">GatorFit</div>
        <div class="tagline">Where movement meets momentum.</div>
        <label class="field-label" for="authEmail">Email</label>
        <input id="authEmail" class="input" type="email" placeholder="you@ufl.edu" autocomplete="email" />
        <label class="field-label" for="authPassword">Password</label>
        <input id="authPassword" class="input" type="password" placeholder="6+ characters" autocomplete="current-password" minlength="6" />
        <button class="btn btn-primary btn-block" type="submit" id="authBtn">Continue</button>
      </form>`;
    setTimeout(() => $("authEmail") && $("authEmail").focus(), 50);
  }

  // Try signing in first. If the account doesn't exist, make it.
  async function submitAuth() {
    const btn = $("authBtn");
    if (!btn || btn.disabled) return; // double click guard
    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;
    if (!email) return toast("Add your email");
    if (password.length < 6) return toast("Password needs at least 6 characters");

    btn.disabled = true;
    btn.textContent = "One sec...";
    try {
      try {
        await PP.db.signIn(email, password);
      } catch (signInErr) {
        if (signInErr.code !== "invalid_credentials") throw signInErr;
        // No account yet (or wrong password). Try making one.
        try {
          await PP.db.signUp(email, password);
        } catch (signUpErr) {
          // Email already taken = it was a wrong password, show the sign in error
          throw signUpErr.code === "user_exists" ? signInErr : signUpErr;
        }
      }
      await boot();
    } catch (err) {
      toast(err.message || "Couldn't sign in. Try again.");
      if ($("authBtn")) {
        $("authBtn").disabled = false;
        $("authBtn").textContent = "Continue";
      }
    }
  }

  // ---------- Onboarding: name + house ----------
  function showOnboarding() {
    const ov = overlay();
    ov.hidden = false;
    ov.innerHTML = `
      <form class="overlay-inner auth-card" id="onboardForm" novalidate>
        ${AUTH_LOGO}
        <div class="auth-title">GatorFit</div>
        <div class="tagline">Almost in. What should we call you?</div>
        <label class="field-label" for="obName">Your name</label>
        <input id="obName" class="input" placeholder="First and last" maxlength="40" autocomplete="off" />
        <label class="field-label" for="obGreek">Greek life</label>
        <select id="obGreek" class="select">
          <option value="">No fraternity or sorority</option>
          ${Object.entries(PP.mock.councils).map(([council, list]) => `<optgroup label="${esc(council)}">${list.map((h) => `<option value="${esc(h)}">${esc(h)}</option>`).join("")}</optgroup>`).join("")}
        </select>
        <button class="btn btn-primary btn-block" type="submit" id="obBtn">Continue</button>
        <button class="btn btn-ghost btn-block auth-alt" type="button" data-action="app-signout">Use a different email</button>
      </form>`;
    setTimeout(() => $("obName") && $("obName").focus(), 50);
  }

  async function submitOnboarding() {
    const btn = $("obBtn");
    if (!btn || btn.disabled) return;
    const name = $("obName").value.trim();
    if (!name) return toast("Add your name first");
    if (Array.from(name).length > 40) return toast("Keep your name under 40 characters");
    btn.disabled = true;
    try {
      const me = await PP.db.createProfile({ display_name: name, greek_house: $("obGreek").value });
      startApp(me);
    } catch (err) {
      toast(err.message);
      if (err.code === "auth") return showAuth();
      btn.disabled = false;
    }
  }

  // ============================================================
  // THE APP
  // ============================================================
  function startApp(me) {
    state.me = me;
    PP.me = me; // PP.ui.greetingHTML reads your first name from here
    overlay().hidden = true;
    overlay().innerHTML = "";
    $("demoPill").hidden = true; // demo label turned off
    PP.ui.updateThemeButton();
    drawSidebarCard(null, null); // draw the name right away, numbers load next
    refreshSidebar();
    go("rsvp");
  }

  // Trophy-style streak badge under the points/rank row.
  // streak = { current, best, loggedToday } or null. Orange when you have one, grey at 0.
  function streakLineHTML(streak) {
    if (!streak) return "";
    const n = streak.current;
    let hint = "";
    if (n === 0) hint = "Log anything today to start one";
    else if (!streak.loggedToday) hint = "Log today to keep it";
    else if (n === 1) hint = "Keep it going tomorrow";
    return `
      <div class="streak-badge ${n > 0 ? "on" : "off"}" id="myStreak">
        ${PP.ui.icon("flame", 18)}
        <div class="streak-text">
          <span>${n}-day streak</span>
          ${hint ? `<span class="streak-hint">${esc(hint)}</span>` : ""}
        </div>
      </div>`;
  }

  // Last streak this page saw: { id, n }. null = not loaded yet, so the first load never toasts.
  let lastStreak = null;

  // Your card in the sidebar: name, house, points, rank, streak
  function drawSidebarCard(pts, rank, streak) {
    const me = state.me;
    if (!me) return;
    $("header").innerHTML = `
      <div class="me-card">
        <div class="me-top">
          ${PP.ui.avatarHTML(me.display_name, { me: true, size: "lg" })}
          <div>
            <div class="me-name" title="${esc(me.display_name)}">${esc(me.display_name)}</div>
            <div class="me-sub">${esc(me.greek_house || "Independent")}</div>
          </div>
        </div>
        <div class="me-stats">
          <div><b id="myPts">${pts == null ? "-" : pts}</b>points</div>
          <div><b id="myRank">${rank == null ? "-" : "#" + rank}</b>rank</div>
        </div>
        ${streakLineHTML(streak)}
      </div>`;
  }

  // Reloads my points and rank, then redraws the sidebar card
  async function refreshSidebar() {
    if (!state.me) return;
    try {
      const rows = PP.points.rankRows(await PP.db.getMonthLeaderboard(), state.me.id);
      const i = rows.findIndex((r) => r.isMe);
      const pts = i >= 0 ? rows[i].points : await PP.db.getMyMonthPoints();
      const streak = await PP.db.getMyStreak(); // never throws
      drawSidebarCard(pts, i >= 0 ? i + 1 : null, streak);
      // Toast only when the streak grows after the first load
      // (keyed by user id, so switching accounts doesn't toast)
      if (lastStreak && lastStreak.id === state.me.id && streak.current > lastStreak.n) toast(`🔥 ${streak.current}-day streak!`);
      lastStreak = { id: state.me.id, n: streak.current };
    } catch (err) {
      console.error(err);
    }
  }

  // Switch tabs: go("leaderboard", { from: 0, to: 9 })
  async function go(tab, params) {
    if (!TAB_NAMES[tab]) tab = "rsvp";
    state.tab = tab;
    state.params = params || {};
    const myRender = ++state.renderId;

    document.querySelectorAll("#tabbar button").forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === tab)
    );
    window.scrollTo(0, 0);

    const root = $("screen");
    const page = PP.pages[tab];
    if (!page || typeof page.render !== "function") {
      // Page file hasn't loaded (or isn't built yet)
      root.innerHTML = `<p class="muted">${TAB_NAMES[tab]} coming soon.</p>`;
      return;
    }
    PP.ui.setLoading(root);
    try {
      await page.render(root, makeCtx());
    } catch (err) {
      console.error(err);
      if (myRender === state.renderId) {
        root.innerHTML = `<div class="card"><h3>Hmm, that didn't load</h3><p class="muted">${esc(err.message || "Something went wrong.")}</p>
          <button class="btn btn-small" data-action="app-tab" data-tab="${tab}">Try again</button></div>`;
      }
    }
  }

  // ============================================================
  // EVENTS: one click listener, one change listener, one submit listener
  // ============================================================
  document.addEventListener("submit", (e) => {
    if (e.target.id === "authForm") { e.preventDefault(); submitAuth(); }
    if (e.target.id === "onboardForm") { e.preventDefault(); submitOnboarding(); }
  });

  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;

    // App-level actions
    if (action.startsWith("app-")) {
      if (action === "app-tab") return go(el.dataset.tab);
      if (action === "app-theme") return PP.ui.toggleTheme();
      if (action === "app-retry") return boot();
      if (action === "app-signout") {
        await PP.db.signOut();
        $("header").innerHTML = "";
        $("screen").innerHTML = "";
        return showAuth();
      }
      return;
    }

    // Page actions: "lb-tab" goes to PP.pages.leaderboard, etc.
    const page = PP.pages[PREFIX_TO_PAGE[action.split("-")[0]]];
    if (!page || typeof page.onAction !== "function" || !state.me) return;
    try {
      await page.onAction(action, el, makeCtx());
    } catch (err) {
      console.error(err);
      toast(err.message || "Something went wrong. Try again.");
    }
  });

  document.addEventListener("change", async (e) => {
    const el = e.target;
    if (!state.me || el.closest("#onboarding")) return;
    // Use the page named on the closest [data-page] if there is one, else the open tab
    const holder = el.closest("[data-page]");
    const page = PP.pages[(holder && holder.dataset.page) || state.tab];
    if (!page || typeof page.onChange !== "function") return;
    try {
      await page.onChange(el, makeCtx());
    } catch (err) {
      console.error(err);
      toast(err.message || "Something went wrong. Try again.");
    }
  });

  // If the login ends somewhere else (another tab signs out), go back to the auth screen
  PP.db.onAuthChange((session, event) => {
    if (event === "SIGNED_OUT" && state.me) showAuth();
  });

  // Handy for testing in the browser console: PP.app.go("leaderboard", { from: 0, to: 9 })
  PP.app = { go, refreshSidebar, boot, get ctx() { return makeCtx(); } };

  // Start the app
  PP.ui.updateThemeButton();
  // Visiting the app with ?reset=1 wipes this browser's demo data (test accounts, logs).
  // Only works in DEMO MODE, so it can never touch the real database.
  if (/[?&]reset=1\b/.test(location.search) && PP.db.mode === "demo" && PP.db.resetDemo) {
    PP.db.resetDemo();
    try {
      Object.keys(localStorage).filter((k) => k.startsWith("peakpulse-journal-")).forEach((k) => localStorage.removeItem(k));
    } catch (e) {}
    history.replaceState(null, "", location.pathname);
    setTimeout(() => toast("Demo data cleared. Fresh start 🐊"), 300);
  }
  boot();
})();
