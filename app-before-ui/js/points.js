// ============================================================
// PP.points: the point rules and leaderboard math.
// Pure functions only: no page drawing, no network.
// That means we can test this file in Node too.
// Ported from the MVP (app-mvp-backup/app.js).
// ============================================================

(function () {
  // Works in the browser (window) and in Node (globalThis)
  const root = typeof window !== "undefined" ? window : globalThis;
  const PP = (root.PP = root.PP || {});

  // ---------- Point rules (change these to rebalance the game) ----------
  // Keep these in sync with supabase/schema.sql, the database checks them too.
  const RULES = {
    workoutBase: 3,       // points for any workout
    maxWorkoutsPerDay: 2,
    macrosPoint: 1,       // hitting all your macros for the day
    journalPoint: 1,
    meditationPoint: 1,
    macroHitPercent: 0.9, // "hitting" a macro = reaching 90% of the goal
    greekMinActive: 10,   // houses need this many active members to show up
    multipliers: { peak_pulse: 3, new_partner: 3, uf_event: 2, other: 1 },
  };

  // Pads a number to 2 digits: 7 -> "07"
  const pad = (n) => String(n).padStart(2, "0");

  // Today's date as "2026-09-18" in YOUR time zone.
  // Never use toISOString here: that's UTC, and after 8 PM in Gainesville
  // it's already tomorrow, so the daily caps would reset early.
  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // This month as "2026-09"
  function monthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }

  // Works out a workout's multiplier. They don't stack: you get the biggest one.
  // If two are tied, the reason is picked in this order:
  // peak_pulse, new_partner, uf_event, other.
  function workoutMultiplier({ peakPulse, ufEvent, newPartner } = {}) {
    const m = RULES.multipliers;
    const options = [
      { on: !!peakPulse, multiplier: m.peak_pulse, reason: "peak_pulse" },
      { on: !!newPartner, multiplier: m.new_partner, reason: "new_partner" },
      { on: !!ufEvent, multiplier: m.uf_event, reason: "uf_event" },
    ];
    let best = { multiplier: m.other, reason: "other" };
    options.forEach((o) => {
      // Strictly bigger only, so the earlier reason wins a tie
      if (o.on && o.multiplier > best.multiplier) best = { multiplier: o.multiplier, reason: o.reason };
    });
    return best;
  }

  // Points for one workout: 3 x the multiplier (3, 6, or 9)
  function workoutPoints(opts) {
    return RULES.workoutBase * workoutMultiplier(opts).multiplier;
  }

  // Everyone ranked by points, high to low.
  // If you tie with someone, they stay ABOVE you (so the gator math matches the screen).
  // Returns a NEW array. Each row gets isMe: true/false.
  function rankRows(rows, myId) {
    return (rows || [])
      .map((r) => ({ ...r, isMe: r.profile_id === myId }))
      .sort((a, b) => b.points - a.points || (a.isMe ? 1 : 0) - (b.isMe ? 1 : 0));
  }

  // People you jumped over: not you, and fromPts <= points < toPts.
  // Closest to your old score first (lowest points first).
  function passedUsers(rows, fromPts, toPts, myId) {
    return (rows || [])
      .filter((r) => r.profile_id !== myId && r.points >= fromPts && r.points < toPts)
      .sort((a, b) => a.points - b.points);
  }

  // Did you hit all 3 macros? Each one must be at least 90% of the goal.
  // totals and goals are both { p, c, f } in grams.
  function macrosHit(totals, goals) {
    return ["p", "c", "f"].every(
      (k) => Number(totals[k] || 0) >= Number(goals[k] || 0) * RULES.macroHitPercent
    );
  }

  // EXTRA helper (not in the contract, safe to ignore):
  // The person right above you in already-ranked rows, and how many points to pass them.
  // Returns { name, gap } for PP.ui.greetingHTML, or null if you're #1 (or not on the list).
  function nextUp(rankedRows) {
    const i = (rankedRows || []).findIndex((r) => r.isMe);
    if (i <= 0) return null;
    const above = rankedRows[i - 1];
    return { name: above.display_name, gap: above.points - rankedRows[i].points + 1 };
  }

  // Turns "2026-09-18" into a local Date at midnight (not UTC)
  function keyToDate(key) {
    const [y, m, d] = String(key).split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  // Turns a Date back into "2026-09-18" using local parts
  function dateToKey(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  // The day before a "YYYY-MM-DD" key. Uses setDate, so daylight saving can't break it.
  function dayBefore(key) {
    const d = keyToDate(key);
    d.setDate(d.getDate() - 1);
    return dateToKey(d);
  }

  // Daily streak from the days you logged anything.
  // dateKeys: ["2026-09-17", "2026-09-18", ...] (duplicates are fine)
  // current: days in a row ending today, or ending yesterday if you haven't logged yet today
  // best: longest run ever. loggedToday: did you log today?
  function streakFrom(dateKeys, today) {
    const days = new Set((dateKeys || []).filter(Boolean).map(String));
    const loggedToday = days.has(today);

    // Current streak: start today (or yesterday) and walk back one day at a time
    let current = 0;
    let day = loggedToday ? today : dayBefore(today);
    while (days.has(day)) {
      current++;
      day = dayBefore(day);
    }

    // Best streak: for each day that starts a run (no log the day before), count forward
    let best = 0;
    days.forEach((k) => {
      if (days.has(dayBefore(k))) return; // not the start of a run
      let len = 0;
      const d = keyToDate(k);
      while (days.has(dateToKey(d))) {
        len++;
        d.setDate(d.getDate() + 1);
      }
      if (len > best) best = len;
    });

    return { current, best: Math.max(best, current), loggedToday };
  }

  PP.points = { RULES, todayKey, monthKey, workoutMultiplier, workoutPoints, rankRows, passedUsers, macrosHit, nextUp, streakFrom };
})();

// Lets Node load this file for tests: require("./points.js")
if (typeof module !== "undefined") module.exports = (typeof window !== "undefined" ? window : globalThis).PP.points;
