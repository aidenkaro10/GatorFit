// ============================================================
// PP.db: EVERY data call in the app goes through this file.
//
// Two modes, picked once when the page loads:
//   "supabase": config.js has a Supabase URL and key. Real accounts, shared data.
//   "demo":     no config. A fake backend in this browser (localStorage),
//               filled with the fake students from mock-data.js.
// Both modes follow the SAME rules as supabase/schema.sql and throw the
// SAME friendly messages, so pages work the same either way.
// Pages never talk to Supabase directly. Only this file does.
// ============================================================

window.PP = window.PP || {};

(function () {
  const P = PP.points;

  // ---------- Friendly error messages ----------
  const MSG = {
    maxWorkouts: "Max 2 workouts a day",
    alreadyPoint: "Already got today's point",
    notYours: "You can only change your own stuff",
    network: "Couldn't reach the server. Try again.",
    badLogin: "Wrong email or password",
    emailTaken: "That email already has an account",
    badEmail: "Enter a real email",
    shortPassword: "Password needs at least 6 characters",
    signInFirst: "Sign in first",
    noProfile: "Finish setting up your profile first",
    badPoints: "Those points don't add up",
    badName: "Add your name first (40 characters max)",
    badHouse: "Pick a house from the list",
    badGoals: "Goals need to be above 0",
    badMeal: "Macros need to be 0 or more",
    badFood: "Add a food name",
    selfJoin: "You can't join your own session",
    selfPartner: "You can't be your own workout partner",
    badSession: "Check your session details",
    noLocation: "Add where you're going",
    longLocation: "Keep the location under 60 characters",
    badTime: "Pick a date and time",
    gone: "That's not there anymore. Refresh and try again.",
    generic: "Something went wrong. Try again.",
  };

  // Makes an Error with a short message (and an optional code the app can check)
  function fail(message, code) {
    const e = new Error(message);
    if (code) e.code = code;
    return e;
  }

  // ---------- Shared input checks (both modes run these first) ----------
  const HOUSES = ["", ...PP.mock.houses];
  const KINDS = ["workout", "macros", "journal", "meditation"];
  const REASONS = ["peak_pulse", "new_partner", "uf_event", "other", "none"];
  const EVENT_TYPES = ["peak_pulse", "uf_event", "other"];

  function checkCredentials(email, password) {
    const e = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw fail(MSG.badEmail);
    if (String(password || "").length < 6) throw fail(MSG.shortPassword);
    return e;
  }

  // Name: trimmed, 1 to 40 characters (emoji count as 1, like the database)
  function cleanName(name) {
    const n = String(name || "").trim();
    const len = Array.from(n).length;
    if (len < 1 || len > 40) throw fail(MSG.badName);
    return n;
  }

  function cleanHouse(house) {
    const h = house || "";
    if (!HOUSES.includes(h)) throw fail(MSG.badHouse);
    return h;
  }

  function cleanGoals(g) {
    const out = {
      goal_protein_g: Math.round(Number(g.goal_protein_g)),
      goal_carbs_g: Math.round(Number(g.goal_carbs_g)),
      goal_fat_g: Math.round(Number(g.goal_fat_g)),
    };
    if (!Object.values(out).every((v) => Number.isFinite(v) && v > 0)) throw fail(MSG.badGoals);
    return out;
  }

  // Fills in defaults and checks a point log the same way schema.sql does.
  // Returns the row ready to save (without profile_id and log_date).
  function cleanPointLog(o = {}) {
    const kind = o.kind;
    const row = {
      kind,
      points: Number(o.points),
      multiplier: o.multiplier == null ? 1 : Number(o.multiplier),
      multiplier_reason: o.multiplier_reason || (kind === "workout" ? "other" : "none"),
      event_types: Array.isArray(o.event_types) ? o.event_types : [],
      partner_profile_id: o.partner_profile_id || null,
    };
    const ok =
      KINDS.includes(kind) &&
      [1, 2, 3].includes(row.multiplier) &&
      REASONS.includes(row.multiplier_reason) &&
      row.event_types.every((t) => EVENT_TYPES.includes(t)) &&
      (kind === "workout"
        ? row.points === P.RULES.workoutBase * row.multiplier
        : row.points === 1 && row.multiplier === 1 && !row.partner_profile_id && row.event_types.length === 0);
    // "seed" is only for the demo data script, the app can't add it
    if (kind === "seed") throw fail(MSG.notYours);
    if (!ok) throw fail(MSG.badPoints);
    return row;
  }

  function cleanSession(s = {}) {
    const type = String(s.type || "").toLowerCase();
    const focus = type === "run" ? "" : String(s.focus || "").toLowerCase();
    const location = String(s.location || "").trim();
    const when = new Date(s.starts_at);
    if (!["gym", "run"].includes(type)) throw fail(MSG.badSession);
    if (type === "gym" && !["arms", "legs", "cardio"].includes(focus)) throw fail(MSG.badSession);
    if (!s.starts_at || isNaN(when.getTime())) throw fail(MSG.badTime);
    if (!location) throw fail(MSG.noLocation);
    if (Array.from(location).length > 60) throw fail(MSG.longLocation);
    return { type, focus, starts_at: when.toISOString(), location };
  }

  function cleanMeal(m = {}) {
    const row = {
      food_name: String(m.food_name || "").trim(),
      protein_g: Math.round(Number(m.protein_g)),
      carbs_g: Math.round(Number(m.carbs_g)),
      fat_g: Math.round(Number(m.fat_g)),
    };
    if (!row.food_name) throw fail(MSG.badFood);
    if (![row.protein_g, row.carbs_g, row.fat_g].every((v) => Number.isFinite(v) && v >= 0)) throw fail(MSG.badMeal);
    return row;
  }

  const PROFILE_FIELDS = "id, email, display_name, greek_house, goal_protein_g, goal_carbs_g, goal_fat_g";
  const pickProfile = (p) =>
    p && {
      id: p.id, email: p.email, display_name: p.display_name, greek_house: p.greek_house || "",
      goal_protein_g: p.goal_protein_g, goal_carbs_g: p.goal_carbs_g, goal_fat_g: p.goal_fat_g,
    };
  const byStart = (a, b) => new Date(a.starts_at) - new Date(b.starts_at);

  // ---------- Pick the mode (once) ----------
  const cfg = window.PP_CONFIG || {};
  const hasConfig =
    typeof cfg.supabaseUrl === "string" && cfg.supabaseUrl.trim() !== "" &&
    typeof cfg.supabaseAnonKey === "string" && cfg.supabaseAnonKey.trim() !== "";
  const hasLibrary = !!(window.supabase && typeof window.supabase.createClient === "function");
  if (hasConfig && !hasLibrary) {
    console.warn("Peak Pulse: Supabase library didn't load (offline?). Falling back to DEMO MODE.");
  }
  const mode = hasConfig && hasLibrary ? "supabase" : "demo";

  // ============================================================
  // SUPABASE MODE
  // ============================================================
  function makeSupabaseDb() {
    const sb = window.supabase.createClient(cfg.supabaseUrl.trim(), cfg.supabaseAnonKey.trim());
    let myIdCache = null; // my profiles.id, saved after the first lookup

    const isNetwork = (err) =>
      err instanceof TypeError ||
      /failed to fetch|networkerror|load failed|fetch failed|network request failed/i.test(String((err && err.message) || err));

    // Turns a database error into a short friendly message
    function friendly(err, table) {
      const msg = String((err && err.message) || err || "");
      const code = (err && err.code) || "";
      if (/Max 2 workouts a day/i.test(msg)) return fail(MSG.maxWorkouts);
      if (/join your own session/i.test(msg)) return fail(MSG.selfJoin);
      if (code === "23505") return fail(table === "point_logs" ? MSG.alreadyPoint : "That already exists", "duplicate");
      if (code === "42501" || /row-level security/i.test(msg)) return fail(MSG.notYours);
      if (isNetwork(err)) return fail(MSG.network);
      if (code === "23514" || code === "22P02") {
        if (table === "point_logs") return fail(MSG.badPoints);
        if (table === "profiles") {
          // Say which field the database rejected, so the message is actually useful
          if (/greek_house/i.test(msg)) return fail("That house isn't set up yet. Pick another one or choose no house for now.");
          if (/goal/i.test(msg)) return fail(MSG.badGoals);
          return fail(MSG.badName);
        }
        if (table === "partner_sessions") return fail(MSG.badSession);
        if (table === "meal_entries") return fail(MSG.badMeal);
      }
      if (code === "23503") return fail(MSG.gone);
      if (/jwt|not authenticated/i.test(msg)) return fail("Your session ran out. Sign in again.", "auth");
      console.error("Peak Pulse db error:", err);
      return fail(MSG.generic);
    }

    // Runs one Supabase query and returns its data, or throws a friendly error
    async function run(table, query, { okIfDuplicate = false } = {}) {
      let res;
      try {
        res = await query;
      } catch (err) {
        throw friendly(err, table);
      }
      if (res.error) {
        if (okIfDuplicate && res.error.code === "23505") return null; // it already exists, that's fine
        throw friendly(res.error, table);
      }
      return res.data;
    }

    const toSession = (s) => (s && s.user ? { userId: s.user.id, email: s.user.email } : null);

    async function getSession() {
      try {
        const { data } = await sb.auth.getSession();
        return toSession(data && data.session);
      } catch (err) {
        return null;
      }
    }

    async function requireSession() {
      const s = await getSession();
      if (!s) throw fail(MSG.signInFirst, "auth");
      return s;
    }

    // My profile id (profiles.id, not the login id)
    async function myId() {
      if (myIdCache) return myIdCache;
      const p = await getMyProfile();
      if (!p) throw fail(MSG.noProfile, "no_profile");
      return p.id;
    }

    async function signIn(email, password) {
      const e = checkCredentials(email, password);
      let res;
      try {
        res = await sb.auth.signInWithPassword({ email: e, password });
      } catch (err) {
        throw fail(MSG.network);
      }
      if (res.error) {
        const m = res.error.message || "";
        if (/invalid login credentials|invalid_credentials/i.test(m) || res.error.code === "invalid_credentials") {
          throw fail(MSG.badLogin, "invalid_credentials");
        }
        if (/not confirmed/i.test(m)) throw fail("Confirm your email first, then sign in.");
        if (isNetwork(res.error)) throw fail(MSG.network);
        throw fail(m || MSG.generic);
      }
      myIdCache = null;
      return toSession(res.data.session);
    }

    async function signUp(email, password) {
      const e = checkCredentials(email, password);
      let res;
      try {
        res = await sb.auth.signUp({ email: e, password });
      } catch (err) {
        throw fail(MSG.network);
      }
      if (res.error) {
        const m = res.error.message || "";
        if (/already registered|already exists/i.test(m)) throw fail(MSG.emailTaken, "user_exists");
        if (/password/i.test(m)) throw fail(MSG.shortPassword);
        if (/rate limit/i.test(m)) throw fail("Too many tries. Wait a minute and try again.");
        if (isNetwork(res.error)) throw fail(MSG.network);
        throw fail(m || MSG.generic);
      }
      // Email confirmation should be OFF in Supabase, so we get a session right away
      if (!res.data.session) throw fail("Check your email to confirm, then sign in.");
      myIdCache = null;
      return toSession(res.data.session);
    }

    async function signOut() {
      myIdCache = null;
      try {
        await sb.auth.signOut();
      } catch (err) {
        // Signing out locally still works even if the server can't be reached
      }
    }

    // callback(session or null, eventName)
    function onAuthChange(callback) {
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") myIdCache = null;
        try { callback(toSession(session), event); } catch (err) { console.error(err); }
      });
      return () => data.subscription.unsubscribe();
    }

    async function getMyProfile() {
      const s = await getSession();
      if (!s) return null;
      const data = await run("profiles", sb.from("profiles").select(PROFILE_FIELDS).eq("user_id", s.userId).maybeSingle());
      myIdCache = data ? data.id : null;
      return data ? pickProfile(data) : null;
    }

    async function createProfile({ display_name, greek_house } = {}) {
      const row = { display_name: cleanName(display_name), greek_house: cleanHouse(greek_house) };
      const s = await requireSession();
      try {
        const data = await run("profiles",
          sb.from("profiles").insert({ ...row, user_id: s.userId, email: s.email }).select(PROFILE_FIELDS).single());
        myIdCache = data.id;
        return pickProfile(data);
      } catch (err) {
        // Already made one (double click)? Just return it.
        if (err.code === "duplicate") {
          const existing = await getMyProfile();
          if (existing) return existing;
          throw fail(MSG.emailTaken);
        }
        throw err;
      }
    }

    async function updateGoals(goals = {}) {
      const row = cleanGoals(goals);
      const s = await requireSession();
      const data = await run("profiles",
        sb.from("profiles").update(row).eq("user_id", s.userId).select(PROFILE_FIELDS).single());
      return pickProfile(data);
    }

    async function getMonthLeaderboard() {
      const data = await run("month_leaderboard",
        sb.from("month_leaderboard").select("profile_id, display_name, greek_house, points"));
      return (data || []).map((r) => ({ ...r, greek_house: r.greek_house || "", points: Number(r.points) || 0 }));
    }

    async function getGreekBoard() {
      const data = await run("greek_leaderboard",
        sb.from("greek_leaderboard").select("house, active_count, avg_points, on_board").order("avg_points", { ascending: false }));
      return (data || []).map((r) => ({
        house: r.house, active_count: Number(r.active_count), avg_points: Number(r.avg_points), on_board: !!r.on_board,
      }));
    }

    async function getMyMonthPoints() {
      const id = await myId();
      const data = await run("month_leaderboard",
        sb.from("month_leaderboard").select("points").eq("profile_id", id).maybeSingle());
      return data ? Number(data.points) || 0 : 0;
    }

    async function listUpcomingEvents() {
      return (await run("peak_pulse_events",
        sb.from("peak_pulse_events").select("id, title, starts_at, location, description")
          .gt("starts_at", new Date().toISOString()).order("starts_at", { ascending: true }))) || [];
    }

    async function listRsvps(eventIds) {
      if (!eventIds || !eventIds.length) return [];
      const data = await run("rsvps",
        sb.from("rsvps").select("event_id, profile_id, created_at, profiles(display_name)")
          .in("event_id", eventIds).order("created_at", { ascending: true }));
      return (data || []).map((r) => ({
        event_id: r.event_id, profile_id: r.profile_id, display_name: (r.profiles && r.profiles.display_name) || "",
      }));
    }

    async function addRsvp(eventId) {
      const id = await myId();
      await run("rsvps", sb.from("rsvps").insert({ event_id: eventId, profile_id: id }), { okIfDuplicate: true });
    }

    async function removeRsvp(eventId) {
      const id = await myId();
      await run("rsvps", sb.from("rsvps").delete().eq("event_id", eventId).eq("profile_id", id));
    }

    async function listUpcomingSessions() {
      const data = await run("partner_sessions",
        sb.from("partner_sessions").select("id, host_id, type, focus, starts_at, location, profiles(display_name)")
          .gt("starts_at", new Date().toISOString()).order("starts_at", { ascending: true }));
      return (data || []).map((s) => ({
        id: s.id, host_id: s.host_id, host_name: (s.profiles && s.profiles.display_name) || "",
        type: s.type, focus: s.focus, starts_at: s.starts_at, location: s.location,
      }));
    }

    async function listJoins(sessionIds) {
      if (!sessionIds || !sessionIds.length) return [];
      const data = await run("session_joins",
        sb.from("session_joins").select("session_id, profile_id, created_at, profiles(display_name)")
          .in("session_id", sessionIds).order("created_at", { ascending: true }));
      return (data || []).map((r) => ({
        session_id: r.session_id, profile_id: r.profile_id, display_name: (r.profiles && r.profiles.display_name) || "",
      }));
    }

    async function postSession(s) {
      const row = cleanSession(s);
      const id = await myId();
      return run("partner_sessions",
        sb.from("partner_sessions").insert({ ...row, host_id: id }).select("id, host_id, type, focus, starts_at, location").single());
    }

    async function joinSession(sessionId) {
      const id = await myId();
      await run("session_joins", sb.from("session_joins").insert({ session_id: sessionId, profile_id: id }), { okIfDuplicate: true });
    }

    async function leaveSession(sessionId) {
      const id = await myId();
      await run("session_joins", sb.from("session_joins").delete().eq("session_id", sessionId).eq("profile_id", id));
    }

    async function getPastPartnerIds() {
      const id = await myId();
      const data = await run("past_partners",
        sb.from("past_partners").select("partner_profile_id").eq("profile_id", id));
      return new Set((data || []).map((r) => r.partner_profile_id));
    }

    async function listProfiles() {
      const id = await myId();
      return (await run("profiles",
        sb.from("profiles").select("id, display_name, greek_house").neq("id", id).order("display_name", { ascending: true }))) || [];
    }

    async function getTodayLogs() {
      const id = await myId();
      return (await run("point_logs",
        sb.from("point_logs").select("kind, points, multiplier, multiplier_reason")
          .eq("profile_id", id).eq("log_date", P.todayKey()).order("created_at", { ascending: true }))) || [];
    }

    async function addPointLog(opts) {
      const row = cleanPointLog(opts);
      const id = await myId();
      if (row.partner_profile_id === id) throw fail(MSG.selfPartner);
      return run("point_logs",
        sb.from("point_logs").insert({ ...row, profile_id: id, log_date: P.todayKey() })
          .select("id, kind, log_date, points, multiplier, multiplier_reason, event_types, partner_profile_id").single());
    }

    // My daily streak. Seed (fake demo) points never count. Never throws.
    async function getMyStreak() {
      try {
        const id = await myId();
        const rows = (await run("point_logs",
          sb.from("point_logs").select("log_date").eq("profile_id", id).neq("kind", "seed"))) || [];
        return P.streakFrom(rows.map((r) => r.log_date), P.todayKey());
      } catch (err) {
        return { current: 0, best: 0, loggedToday: false };
      }
    }

    async function listTodayMeals() {
      const id = await myId();
      return (await run("meal_entries",
        sb.from("meal_entries").select("id, food_name, protein_g, carbs_g, fat_g")
          .eq("profile_id", id).eq("log_date", P.todayKey()).order("created_at", { ascending: true }))) || [];
    }

    async function addMeal(m) {
      const row = cleanMeal(m);
      const id = await myId();
      return run("meal_entries",
        sb.from("meal_entries").insert({ ...row, profile_id: id, log_date: P.todayKey() })
          .select("id, food_name, protein_g, carbs_g, fat_g").single());
    }

    async function removeMeal(mealId) {
      const id = await myId();
      await run("meal_entries", sb.from("meal_entries").delete().eq("id", mealId).eq("profile_id", id));
    }

    // Sends the photo to our Vercel function, which asks Claude if it's a workout.
    // Never blocks the user: any problem = { ok: true, checked: false }.
    async function checkWorkoutPhoto(file) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000); // give up after 15 seconds
      try {
        const dataUrl = await PP.ui.shrinkImage(file, 1024);
        const image = dataUrl.slice(dataUrl.indexOf(",") + 1); // drop the "data:...;base64," part
        const res = await fetch("/api/check-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image, mediaType: "image/jpeg" }),
          signal: controller.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (json && json.ok === false) return { ok: false, checked: true };
        return { ok: true, checked: !!(json && json.checked) };
      } catch (err) {
        return { ok: true, checked: false };
      } finally {
        clearTimeout(timer);
      }
    }

    return {
      getSession, signUp, signIn, signOut, onAuthChange,
      getMyProfile, createProfile, updateGoals,
      getMonthLeaderboard, getGreekBoard, getMyMonthPoints,
      listUpcomingEvents, listRsvps, addRsvp, removeRsvp,
      listUpcomingSessions, listJoins, postSession, joinSession, leaveSession, getPastPartnerIds, listProfiles,
      getTodayLogs, addPointLog, getMyStreak,
      listTodayMeals, addMeal, removeMeal,
      checkWorkoutPhoto,
    };
  }

  // ============================================================
  // DEMO MODE (fake backend in this browser)
  // ============================================================
  function makeDemoDb() {
    const KEY = "peakpulse-demo-v1";
    let storageWarned = false;

    // Tell the user once if the browser won't let us save (private window)
    function warnStorage() {
      if (storageWarned) return;
      storageWarned = true;
      setTimeout(() => PP.ui && PP.ui.toast("Private window? Demo data won't be saved after you close this tab."), 300);
    }

    function blank() {
      return {
        accounts: {},   // { "you@ufl.edu": { userId, hash } }
        session: null,  // { userId, email } of whoever is signed in
        profiles: [],   // real (non-fake) profiles made in this browser
        logs: [],       // point logs
        rsvps: PP.mock.makeRsvps(PP.mock.makeEvents()), // fake people already going
        sessions: [],   // partner posts made in this browser
        joins: [],
        meals: [],
      };
    }

    function load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return blank();
        return { ...blank(), ...JSON.parse(raw) };
      } catch (err) {
        warnStorage();
        return blank();
      }
    }

    let store = load();
    // Re-read the saved data before using it, so two tabs don't overwrite each other.
    // If storage is blocked (private window), keep what's in memory.
    function refresh() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) store = { ...blank(), ...JSON.parse(raw) };
      } catch (err) { /* keep memory copy */ }
    }
    function save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(store));
      } catch (err) {
        warnStorage(); // keep going in memory
      }
    }

    // Events and fake posts are made fresh on every load so they're always in the future
    const EVENTS = PP.mock.makeEvents();
    const FAKE_SESSIONS = PP.mock.makeSessions();
    const listeners = [];

    const uid = (prefix) => prefix + Math.random().toString(36).slice(2, 10);
    // Tiny hash so the fake password isn't stored as plain text (demo only, not real security)
    const hash = (s) => {
      let h = 2166136261;
      for (const ch of String(s)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
      return (h >>> 0).toString(36);
    };
    const delay = () => new Promise((r) => setTimeout(r, 60)); // feels a little like a real network
    const copy = (x) => JSON.parse(JSON.stringify(x));
    const emit = (event) => listeners.forEach((cb) => { try { cb(store.session && { ...store.session }, event); } catch (e) { console.error(e); } });

    // Every profile: the 70 fake students plus people who signed up in this browser
    function allProfiles() {
      return PP.mock.users.map((u) => ({ ...u, isFake: true })).concat(store.profiles);
    }
    const profileById = (id) => allProfiles().find((p) => p.id === id);
    const nameOf = (id) => (profileById(id) || {}).display_name || "";

    function myProfileRow() {
      if (!store.session) return null;
      return store.profiles.find((p) => p.user_id === store.session.userId) || null;
    }
    function requireMe() {
      refresh();
      if (!store.session) throw fail(MSG.signInFirst, "auth");
      const me = myProfileRow();
      if (!me) throw fail(MSG.noProfile, "no_profile");
      return me;
    }

    // Points this month. Fake students get their seed points every month (like re-running seed.sql).
    function monthPoints(p) {
      const m = P.monthKey();
      const logged = store.logs
        .filter((l) => l.profile_id === p.id && l.log_date.startsWith(m))
        .reduce((s, l) => s + l.points, 0);
      return (p.isFake ? p.points : 0) + logged;
    }

    async function getSession() {
      refresh();
      return store.session ? { ...store.session } : null;
    }

    async function signUp(email, password) {
      const e = checkCredentials(email, password);
      await delay();
      refresh();
      if (store.accounts[e]) throw fail(MSG.emailTaken, "user_exists");
      const userId = uid("user-");
      store.accounts[e] = { userId, hash: hash(password) };
      store.session = { userId, email: e };
      save();
      emit("SIGNED_IN");
      return { ...store.session };
    }

    async function signIn(email, password) {
      const e = checkCredentials(email, password);
      await delay();
      refresh();
      const acct = store.accounts[e];
      if (!acct || acct.hash !== hash(password)) throw fail(MSG.badLogin, "invalid_credentials");
      store.session = { userId: acct.userId, email: e };
      save();
      emit("SIGNED_IN");
      return { ...store.session };
    }

    async function signOut() {
      refresh();
      store.session = null;
      save();
      emit("SIGNED_OUT");
    }

    function onAuthChange(callback) {
      listeners.push(callback);
      return () => listeners.splice(listeners.indexOf(callback), 1);
    }

    async function getMyProfile() {
      const me = myProfileRow();
      return me ? pickProfile(copy(me)) : null;
    }

    async function createProfile({ display_name, greek_house } = {}) {
      const row = { display_name: cleanName(display_name), greek_house: cleanHouse(greek_house) };
      if (!store.session) throw fail(MSG.signInFirst, "auth");
      await delay();
      refresh();
      const existing = myProfileRow();
      if (existing) return pickProfile(copy(existing)); // double click: just return it
      const p = {
        id: uid("me-"), user_id: store.session.userId, email: store.session.email, ...row,
        goal_protein_g: 150, goal_carbs_g: 250, goal_fat_g: 70,
      };
      store.profiles.push(p);
      save();
      return pickProfile(copy(p));
    }

    async function updateGoals(goals = {}) {
      const row = cleanGoals(goals);
      const me = requireMe();
      Object.assign(me, row);
      save();
      return pickProfile(copy(me));
    }

    async function getMonthLeaderboard() {
      await delay();
      refresh();
      return allProfiles().map((p) => ({
        profile_id: p.id, display_name: p.display_name, greek_house: p.greek_house || "", points: monthPoints(p),
      }));
    }

    // Same math as the greek_leaderboard view: average of members with points > 0
    async function getGreekBoard() {
      const rows = await getMonthLeaderboard();
      const houses = {};
      rows.filter((r) => r.greek_house && r.points > 0).forEach((r) => {
        (houses[r.greek_house] = houses[r.greek_house] || []).push(r.points);
      });
      return Object.entries(houses)
        .map(([house, pts]) => ({
          house,
          active_count: pts.length,
          avg_points: Math.round((pts.reduce((a, b) => a + b, 0) / pts.length) * 10) / 10,
          on_board: pts.length >= P.RULES.greekMinActive,
        }))
        .sort((a, b) => b.avg_points - a.avg_points);
    }

    async function getMyMonthPoints() {
      return monthPoints(requireMe());
    }

    async function listUpcomingEvents() {
      await delay();
      const now = Date.now();
      return copy(EVENTS.filter((e) => new Date(e.starts_at) > now).sort(byStart));
    }

    async function listRsvps(eventIds) {
      const ids = eventIds || [];
      refresh();
      // Fake students going are rebuilt for the current events every time,
      // so new weeks never show "0 going". Real users' RSVPs come from storage.
      const fake = PP.mock.makeRsvps(EVENTS);
      const mine = store.rsvps.filter((r) => !String(r.profile_id).startsWith("demo"));
      return fake.concat(mine)
        .filter((r) => ids.includes(r.event_id))
        .map((r) => ({ event_id: r.event_id, profile_id: r.profile_id, display_name: nameOf(r.profile_id) }));
    }

    async function addRsvp(eventId) {
      const me = requireMe();
      if (!EVENTS.some((e) => e.id === eventId)) throw fail(MSG.gone);
      // Already going? That's fine, nothing to do (same as the database's unique rule)
      if (!store.rsvps.some((r) => r.event_id === eventId && r.profile_id === me.id)) {
        store.rsvps.push({ event_id: eventId, profile_id: me.id });
        save();
      }
    }

    async function removeRsvp(eventId) {
      const me = requireMe();
      store.rsvps = store.rsvps.filter((r) => !(r.event_id === eventId && r.profile_id === me.id));
      save();
    }

    function allSessions() {
      return FAKE_SESSIONS.concat(store.sessions);
    }

    async function listUpcomingSessions() {
      await delay();
      const now = Date.now();
      return allSessions()
        .filter((s) => new Date(s.starts_at) > now)
        .sort(byStart)
        .map((s) => ({ ...s, host_name: nameOf(s.host_id) }));
    }

    async function listJoins(sessionIds) {
      const ids = sessionIds || [];
      refresh();
      return store.joins
        .filter((j) => ids.includes(j.session_id))
        .map((j) => ({ session_id: j.session_id, profile_id: j.profile_id, display_name: nameOf(j.profile_id) }));
    }

    async function postSession(s) {
      const row = cleanSession(s);
      const me = requireMe();
      const saved = { id: uid("ps-"), host_id: me.id, ...row };
      store.sessions.push(saved);
      save();
      return copy(saved);
    }

    async function joinSession(sessionId) {
      const me = requireMe();
      const s = allSessions().find((x) => x.id === sessionId);
      if (!s) throw fail(MSG.gone);
      if (s.host_id === me.id) throw fail(MSG.selfJoin);
      if (!store.joins.some((j) => j.session_id === sessionId && j.profile_id === me.id)) {
        store.joins.push({ session_id: sessionId, profile_id: me.id });
        save();
      }
    }

    async function leaveSession(sessionId) {
      const me = requireMe();
      store.joins = store.joins.filter((j) => !(j.session_id === sessionId && j.profile_id === me.id));
      save();
    }

    async function getPastPartnerIds() {
      const me = requireMe();
      return new Set(
        store.logs.filter((l) => l.profile_id === me.id && l.kind === "workout" && l.partner_profile_id).map((l) => l.partner_profile_id)
      );
    }

    async function listProfiles() {
      const me = requireMe();
      return allProfiles()
        .filter((p) => p.id !== me.id)
        .map((p) => ({ id: p.id, display_name: p.display_name, greek_house: p.greek_house || "" }))
        .sort((a, b) => a.display_name.localeCompare(b.display_name));
    }

    async function getTodayLogs() {
      const me = requireMe();
      const t = P.todayKey();
      return store.logs
        .filter((l) => l.profile_id === me.id && l.log_date === t)
        .map((l) => ({ kind: l.kind, points: l.points, multiplier: l.multiplier, multiplier_reason: l.multiplier_reason }));
    }

    // Same order as the database: workout cap first, then point checks, then once-per-day
    async function addPointLog(opts = {}) {
      const me = requireMe();
      const t = P.todayKey();
      const mineToday = store.logs.filter((l) => l.profile_id === me.id && l.log_date === t);
      if (opts.kind === "workout" && mineToday.filter((l) => l.kind === "workout").length >= P.RULES.maxWorkoutsPerDay) {
        throw fail(MSG.maxWorkouts);
      }
      const row = cleanPointLog(opts);
      if (row.partner_profile_id === me.id) throw fail(MSG.selfPartner);
      if (row.partner_profile_id && !profileById(row.partner_profile_id)) throw fail(MSG.gone);
      if (row.kind !== "workout" && mineToday.some((l) => l.kind === row.kind)) throw fail(MSG.alreadyPoint);
      const saved = { id: uid("log-"), profile_id: me.id, log_date: t, ...row };
      store.logs.push(saved);
      save();
      return copy(saved);
    }

    // My daily streak. Seed (fake demo) points never count. Never throws.
    async function getMyStreak() {
      try {
        const me = requireMe();
        const dates = store.logs
          .filter((l) => l.profile_id === me.id && l.kind !== "seed")
          .map((l) => l.log_date);
        return P.streakFrom(dates, P.todayKey());
      } catch (err) {
        return { current: 0, best: 0, loggedToday: false };
      }
    }

    async function listTodayMeals() {
      const me = requireMe();
      const t = P.todayKey();
      return store.meals
        .filter((m) => m.profile_id === me.id && m.log_date === t)
        .map((m) => ({ id: m.id, food_name: m.food_name, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g }));
    }

    async function addMeal(m) {
      const row = cleanMeal(m);
      const me = requireMe();
      const saved = { id: uid("meal-"), profile_id: me.id, log_date: P.todayKey(), ...row };
      store.meals.push(saved);
      save();
      return { id: saved.id, ...row };
    }

    async function removeMeal(mealId) {
      const me = requireMe();
      store.meals = store.meals.filter((m) => !(m.id === mealId && m.profile_id === me.id));
      save();
    }

    // No server in DEMO MODE: pretend to check, and never block
    async function checkWorkoutPhoto() {
      await new Promise((r) => setTimeout(r, 900));
      return { ok: true, checked: false };
    }

    // For testing only: wipes the demo data in this browser
    function resetDemo() {
      store = blank();
      save();
    }

    return {
      getSession, signUp, signIn, signOut, onAuthChange,
      getMyProfile, createProfile, updateGoals,
      getMonthLeaderboard, getGreekBoard, getMyMonthPoints,
      listUpcomingEvents, listRsvps, addRsvp, removeRsvp,
      listUpcomingSessions, listJoins, postSession, joinSession, leaveSession, getPastPartnerIds, listProfiles,
      getTodayLogs, addPointLog, getMyStreak,
      listTodayMeals, addMeal, removeMeal,
      checkWorkoutPhoto,
      resetDemo,
    };
  }

  PP.db = { mode, ...(mode === "supabase" ? makeSupabaseDb() : makeDemoDb()) };
})();
