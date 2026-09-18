// ============================================================
// FAKE DATA
// This fills the app with fake students, events, and gym posts
// so the demo feels alive. Nothing here is real.
// ============================================================

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
// Chi Omega only has 4, so it will be hidden (needs 10 active members).
const HOUSE_SIZES = {
  "Sigma Chi": 12,
  "Kappa Delta": 11,
  "Pi Kappa Alpha": 10,
  "Delta Gamma": 12,
  "Beta Theta Pi": 10,
  "Chi Omega": 4,
};
const GREEK_HOUSES = Object.keys(HOUSE_SIZES);

// ---------- Fake students ----------
const FIRST = ["Jake","Maya","Chris","Sofia","Tyler","Ava","Marcus","Emma","Jordan","Olivia",
  "Ethan","Isabella","Noah","Mia","Liam","Chloe","Ryan","Zoe","Dylan","Grace",
  "Caleb","Lily","Owen","Hannah","Mason","Ella","Logan","Sara","Lucas","Nina",
  "Aiden","Priya","Diego","Jada","Ben"];
const LAST = ["Carter","Nguyen","Brooks","Rivera","Patel","Kim","Johnson","Lopez","Reed","Martin",
  "Hayes","Diaz","Bennett","Cole","Shah","Ward","Price","Fox","Gray","Stone"];

const FAKE_USERS = [];
(function buildFakeUsers() {
  // Put everyone in a list of houses first, then 11 people with no house.
  const houseSlots = [];
  GREEK_HOUSES.forEach((h) => {
    for (let i = 0; i < HOUSE_SIZES[h]; i++) houseSlots.push(h);
  });
  const total = houseSlots.length + 11;

  for (let i = 0; i < total; i++) {
    const first = FIRST[i % FIRST.length];
    const last = LAST[(i + Math.floor(i / FIRST.length) * 7) % LAST.length];
    FAKE_USERS.push({
      id: "u" + i,
      name: first + " " + last,
      greek: houseSlots[i] || "",
      points: Math.floor(rand() * 110) + 1, // this month's points, 1 to 110
    });
  }

  // A few people with low points, so your FIRST workout passes someone
  // and you get to see the gator right away.
  const lows = [2, 4, 5, 7];
  lows.forEach((p, k) => {
    FAKE_USERS[total - 1 - k].points = p;
  });
})();

// Quick way to find a fake user by id.
function userById(id) {
  return FAKE_USERS.find((u) => u.id === id);
}

// ---------- Date helper for fake events ----------
// Makes a date X days from today at a certain hour.
function daysFromNow(days, hour, minute) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute);
  return d.toISOString();
}

// Picks a different group of fake users for each event.
function pickAttendees(k) {
  return FAKE_USERS.filter((u, i) => (i * 7 + k) % 5 === 0).map((u) => u.id);
}

// ---------- Peak Pulse events (for the RSVP tab) ----------
function makeEvents() {
  return [
    { id: "ev1", title: "Sunrise Run + Cold Plunge + Yoga", when: daysFromNow(1, 6, 30), location: "Depot Park", attendees: pickAttendees(0) },
    { id: "ev2", title: "Lake Alice 5K + Plunge", when: daysFromNow(3, 7, 0), location: "Lake Alice", attendees: pickAttendees(1) },
    { id: "ev3", title: "Sunset Yoga + Cold Plunge", when: daysFromNow(5, 18, 30), location: "Plaza of the Americas", attendees: pickAttendees(2) },
    { id: "ev4", title: "Saturday Long Run", when: daysFromNow(8, 7, 30), location: "Paynes Prairie", attendees: pickAttendees(3) },
  ];
}

// ---------- Fake "Find a Partner" posts ----------
function makeSeedSessions() {
  return [
    { id: "s1", userId: "u3", type: "gym", focus: "Legs", when: daysFromNow(1, 17, 0), location: "Southwest Rec", joiners: [] },
    { id: "s2", userId: "u14", type: "run", focus: "", when: daysFromNow(1, 7, 0), location: "Lake Alice", joiners: [] },
    { id: "s3", userId: "u27", type: "gym", focus: "Arms", when: daysFromNow(2, 15, 30), location: "Student Rec Center", joiners: [] },
    { id: "s4", userId: "u41", type: "gym", focus: "Cardio", when: daysFromNow(2, 19, 0), location: "Southwest Rec", joiners: [] },
    { id: "s5", userId: "u8", type: "run", focus: "", when: daysFromNow(3, 18, 0), location: "Depot Park", joiners: [] },
  ];
}

// ---------- Foods for meal tracking ----------
// In the real app this comes from a nutrition API.
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
