// ============================================================
// PP.mock: FAKE DATA for DEMO MODE
// Fills the app with fake students, events, and gym posts so the
// demo feels alive without a database. Nothing here is real.
// Same people, houses, events, and posts as supabase/seed.sql.
// ============================================================

(function () {
  const root = typeof window !== "undefined" ? window : globalThis;
  const PP = (root.PP = root.PP || {});

  // A tiny "random number" maker that gives the SAME numbers every time.
  // That way the fake leaderboard looks the same on every laptop.
  function seededRandom(seed) {
    return function () {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }
  const rand = seededRandom(42);

  // ---------- Greek houses ----------
  // How many fake members each house gets.
  // Chi Omega only has 4, so it stays off the board (needs 10 active members).
  const HOUSE_SIZES = {
    "Sigma Chi": 12,
    "Kappa Delta": 11,
    "Pi Kappa Alpha": 10,
    "Delta Gamma": 12,
    "Beta Theta Pi": 10,
    "Chi Omega": 4,
  };
  // Every chapter at UF, by council. From the official council sites:
  // ufifc.org/fraternities, ufpanhellenic.org/chapters, mgcuf.org/organizations,
  // and the NPHC's 9 organizations.
  const COUNCILS = {
    "Interfraternity Council (IFC)": [
      "Alpha Epsilon Pi", "Alpha Gamma Rho", "Alpha Tau Omega", "Beta Theta Pi", "Chi Phi",
      "Delta Chi", "Delta Sigma Phi", "Delta Tau Delta", "Delta Upsilon", "Kappa Alpha Order",
      "Kappa Sigma", "Lambda Chi Alpha", "Phi Gamma Delta", "Phi Kappa Tau", "Pi Kappa Alpha",
      "Pi Kappa Phi", "Pi Lambda Phi", "Sigma Alpha Epsilon", "Sigma Alpha Mu", "Sigma Chi",
      "Sigma Nu", "Sigma Phi Epsilon", "Tau Epsilon Phi", "Tau Kappa Epsilon", "Theta Chi",
      "Zeta Beta Tau"],
    "Panhellenic Council": [
      "Alpha Chi Omega", "Alpha Delta Pi", "Alpha Epsilon Phi", "Alpha Omicron Pi", "Alpha Phi",
      "Chi Omega", "Delta Delta Delta", "Delta Gamma", "Delta Phi Epsilon", "Delta Zeta",
      "Gamma Phi Beta", "Kappa Alpha Theta", "Kappa Delta", "Kappa Kappa Gamma", "Phi Mu",
      "Pi Beta Phi", "Sigma Kappa", "Zeta Tau Alpha"],
    "Multicultural Greek Council (MGC)": [
      "Alpha Kappa Delta Phi", "Beta Chi Theta", "Delta Phi Omega", "Gamma Eta", "Kappa Phi Lambda",
      "Lambda Theta Alpha", "Pi Delta Psi", "Sigma Lambda Beta", "Sigma Sigma Rho", "Theta Nu Xi"],
    "National Pan-Hellenic Council (NPHC)": [
      "Alpha Kappa Alpha", "Alpha Phi Alpha", "Delta Sigma Theta", "Iota Phi Theta",
      "Kappa Alpha Psi", "Omega Psi Phi", "Phi Beta Sigma", "Sigma Gamma Rho", "Zeta Phi Beta"],
  };
  const HOUSES = Object.values(COUNCILS).flat();

  // ---------- Fake students ----------
  const FIRST = ["Jake","Maya","Chris","Sofia","Tyler","Ava","Marcus","Emma","Jordan","Olivia",
    "Ethan","Isabella","Noah","Mia","Liam","Chloe","Ryan","Zoe","Dylan","Grace",
    "Caleb","Lily","Owen","Hannah","Mason","Ella","Logan","Sara","Lucas","Nina",
    "Aiden","Priya","Diego","Jada","Ben"];
  const LAST = ["Carter","Nguyen","Brooks","Rivera","Patel","Kim","Johnson","Lopez","Reed","Martin",
    "Hayes","Diaz","Bennett","Cole","Shah","Ward","Price","Fox","Gray","Stone"];

  // Each fake student looks like a row from the profiles table,
  // plus "points" = their points this month.
  const USERS = [];
  (function buildFakeUsers() {
    // Everyone in a house first, then 11 people with no house (70 total).
    const houseSlots = [];
    Object.keys(HOUSE_SIZES).forEach((h) => {
      for (let i = 0; i < HOUSE_SIZES[h]; i++) houseSlots.push(h);
    });
    const total = houseSlots.length + 11;

    for (let i = 0; i < total; i++) {
      const first = FIRST[i % FIRST.length];
      const last = LAST[(i + Math.floor(i / FIRST.length) * 7) % LAST.length];
      USERS.push({
        id: "demo" + i,
        email: "demo" + i + "@peakpulse.demo",
        display_name: first + " " + last,
        greek_house: houseSlots[i] || "",
        points: Math.floor(rand() * 101) + 10, // this month's points, 10 to 110
      });
    }

    // The last 4 people (no house) get 2, 4, 5, 7 points.
    // So a new user's first 9 point workout passes EXACTLY 4 people and the gator fires.
    [7, 5, 4, 2].forEach((p, k) => {
      USERS[total - 1 - k].points = p;
    });
  })();

  // ---------- Date helper ----------
  // Makes a date X days from today at a certain local hour, as an ISO string.
  // (toISOString is fine here: this is a real moment in time, not a "day key".)
  function daysFromNow(days, hour, minute) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    d.setHours(hour, minute);
    return d.toISOString();
  }

  // ---------- Peak Pulse events (RSVP tab) ----------
  // REAL weekly schedule from peakpulseclub.com/pages/locations (Gainesville):
  //   Thursday 6pm ET at Depot Park, Saturday 8am ET at Afternoon Coffee.
  // We list the next 2 weeks of those runs.
  const SCHEDULE = [
    { day: 4, hour: 18, minute: 0, key: "thu", title: "Thursday Run Club", location: "Depot Park",
      description: "The weekly Peak Pulse run. All faces, all paces. Instagram: @peakpulsegville" },
    { day: 6, hour: 8, minute: 0, key: "sat", title: "Saturday Morning Run", location: "Afternoon Coffee",
      description: "Weekend run from Afternoon Coffee, then hang after. Instagram: @peakpulsegville" },
  ];
  function makeEvents() {
    const now = new Date();
    const out = [];
    for (let add = 0; add < 15; add++) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + add);
      SCHEDULE.forEach((s) => {
        if (d.getDay() !== s.day) return;
        const start = new Date(d);
        start.setHours(s.hour, s.minute);
        if (start <= now) return; // already happened
        const dayKey = start.getFullYear() + "-" + String(start.getMonth() + 1).padStart(2, "0") + "-" + String(start.getDate()).padStart(2, "0");
        out.push({ id: "ev-" + s.key + "-" + dayKey, title: s.title, starts_at: start.toISOString(),
          location: s.location, description: s.description });
      });
    }
    return out;
  }

  // Fake RSVPs: the same rule as seed.sql, about 14 people per event.
  function makeRsvps(events) {
    const out = [];
    events.forEach((ev, k) => {
      USERS.forEach((u, n) => {
        if ((n * 7 + k) % 5 === 0) out.push({ event_id: ev.id, profile_id: u.id });
      });
    });
    return out;
  }

  // ---------- Fake "Find a Partner" posts ----------
  // Focus is lowercase ("legs"), the same as the database stores it.
  function makeSessions() {
    return [
      { id: "s1", host_id: "demo3", type: "gym", focus: "legs", starts_at: daysFromNow(1, 17, 0), location: "Southwest Rec" },
      { id: "s2", host_id: "demo14", type: "run", focus: "", starts_at: daysFromNow(1, 7, 0), location: "Lake Alice" },
      { id: "s3", host_id: "demo27", type: "gym", focus: "arms", starts_at: daysFromNow(2, 15, 30), location: "Student Rec Center" },
      { id: "s4", host_id: "demo41", type: "gym", focus: "cardio", starts_at: daysFromNow(2, 19, 0), location: "Southwest Rec" },
      { id: "s5", host_id: "demo8", type: "run", focus: "", starts_at: daysFromNow(3, 18, 0), location: "Depot Park" },
    ];
  }

  // ---------- Foods for meal tracking ----------
  // Used in BOTH modes (there's no food table in the database).
  // p = protein, c = carbs, f = fat (all in grams)
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

  PP.mock = { houses: HOUSES, councils: COUNCILS, schedule: SCHEDULE, users: USERS, foods: FOODS, makeEvents, makeRsvps, makeSessions };
})();

if (typeof module !== "undefined") module.exports = (typeof window !== "undefined" ? window : globalThis).PP.mock;
