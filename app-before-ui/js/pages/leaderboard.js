// ============================================================
// PP.pages.leaderboard: the monthly leaderboard + THE GATOR 🐊
// Owned by the Leaderboard agent.
// Two boards: Individuals and Greek Life.
// After a workout, the Log page sends us here with ctx.params = { from, to }.
// If you passed anyone, the gator runs across their rows and eats them.
// Every data-action in this page starts with "lb-".
// ============================================================

window.PP = window.PP || {};
PP.pages = PP.pages || {};

(function () {
  const MEDALS = ["🥇", "🥈", "🥉"];

  // Page memory (lives while the app is open)
  let tab = "individuals"; // "individuals" or "greek"
  let busy = false;        // true while the gator is chomping (ignore clicks)
  let drawId = 0;          // goes up on every render, so an old gator run knows to stop
  let shareInfo = null;    // set only right after a fresh workout; shows the "Share to your story" button

  // Share button under the greeting (only after a fresh workout). Uses PP.share (js/share.js).
  function shareBtnHTML() {
    return shareInfo && PP.share ? `<button class="btn btn-primary lb-share-btn" data-action="lb-share">📸 Share to your story</button>` : "";
  }
  function showShare(root, ctx, from, to, passedCount, rows) {
    const me = ctx.me || {};
    const ranked = PP.points.rankRows(rowsWithMyPoints(rows || [], me, to), me.id);
    shareInfo = { name: me.display_name, houseName: me.greek_house || "", from, to, passedCount, rank: ranked.findIndex((r) => r.isMe) + 1 };
    const g = root.querySelector(".lb-page .greeting");
    if (g && !root.querySelector(".lb-share-btn")) g.insertAdjacentHTML("afterend", shareBtnHTML());
    // Moved up past someone? Offer to post it right away (after the toast has a second to land)
    if (passedCount > 0 && PP.share) {
      const info = shareInfo;
      setTimeout(() => { if (shareInfo === info && document.body.contains(root)) PP.share.open(info, { prompt: true }); }, 1400);
    }
  }

  // Days until the board resets (same math as the MVP)
  function daysLeftInMonth() {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return last - now.getDate();
  }

  // The person right above me, for the greeting. null = I'm #1.
  function nextUpFor(ranked) {
    if (PP.points.nextUp) return PP.points.nextUp(ranked);
    const i = ranked.findIndex((r) => r.isMe);
    if (i <= 0) return null;
    return { name: ranked[i - 1].display_name, gap: ranked[i - 1].points - ranked[i].points + 1 };
  }

  // Takes the raw leaderboard and sets MY points to myPts (used by the gator
  // to show the board "before" the workout). Adds me if I'm missing.
  function rowsWithMyPoints(rows, me, myPts) {
    const out = rows.map((r) => (r.profile_id === me.id && myPts != null ? { ...r, points: myPts } : r));
    if (!out.some((r) => r.profile_id === me.id)) {
      out.push({
        profile_id: me.id, display_name: me.display_name, greek_house: me.greek_house || "",
        points: myPts != null ? myPts : 0,
      });
    }
    return out;
  }

  // Top part: greeting, segmented switch, reset line
  function headerHTML(ranked) {
    const U = PP.ui;
    return `
      ${U.greetingHTML("Leaderboard", nextUpFor(ranked))}
      <div class="seg">
        <button class="${tab === "individuals" ? "active" : ""}" data-action="lb-tab" data-v="individuals">Individuals</button>
        <button class="${tab === "greek" ? "active" : ""}" data-action="lb-tab" data-v="greek">Greek Life</button>
      </div>
      <div class="muted lb-reset">Resets on the 1st · ${daysLeftInMonth()} days left this month</div>`;
  }

  // Individuals board. Shows people with points, plus me even at 0.
  function individualsHTML(ranked) {
    const U = PP.ui;
    const shown = ranked.filter((r) => r.points > 0 || r.isMe);
    return shown.map((r, i) => `
      <div class="row ${r.isMe ? "me" : ""} ${i < 3 ? "top" + (i + 1) : ""}" data-id="${U.esc(r.profile_id)}">
        <span class="rank ${i < 3 ? "medal" : ""}">${MEDALS[i] || i + 1}</span>
        ${U.avatarHTML(r.display_name, { me: r.isMe })}
        <div class="who">
          <div class="name">${U.esc(r.display_name)}${r.isMe ? " (you)" : ""}</div>
          <div class="sub">${U.esc(r.greek_house || "Independent")}</div>
        </div>
        <span class="pts">${r.points}</span>
      </div>`).join("");
  }

  // Greek Life board. The database view already did the math
  // (active members only, 10+ rule). We only sort and show it.
  function greekHTML(houses, myHouse) {
    const U = PP.ui;
    const min = PP.points.RULES.greekMinActive;
    const onBoard = houses
      .filter((h) => h.on_board)
      .sort((a, b) => b.avg_points - a.avg_points || String(a.house).localeCompare(String(b.house)));
    const waiting = houses.filter((h) => !h.on_board);

    const rows = onBoard.length
      ? onBoard.map((h, i) => `
        <div class="row ${myHouse && h.house === myHouse ? "me" : ""}">
          <span class="rank">${i + 1}</span>
          <div class="who">
            <div class="name">${U.esc(h.house)}</div>
            <div class="sub">${h.active_count} active members</div>
          </div>
          <span class="pts">${h.avg_points}</span>
        </div>`).join("")
      : `<p class="muted">No houses on the board yet.</p>`;

    const small = waiting.length
      ? `<p class="muted lb-waiting">Not on the board yet (need ${min} active members): ${waiting
          .map((h) => `${U.esc(h.house)} (${h.active_count}/${min})`).join(", ")}</p>`
      : "";

    return `<div class="muted lb-note">Score = average points per active member</div>${rows}${small}`;
  }

  // Draws the whole page. myPts (optional) overrides my points (gator "before" view).
  async function draw(root, ctx, myPts) {
    const id = ++drawId;
    const me = ctx.me || {};
    let lb, houses = [];
    try {
      lb = await PP.db.getMonthLeaderboard();
      if (tab === "greek") houses = (await PP.db.getGreekBoard()) || [];
    } catch (e) {
      if (id !== drawId) return null;
      root.innerHTML = `
        <div class="narrow lb-page">
          <div class="card lb-error">
            <p>Couldn't load the board. Try again.</p>
            <button class="btn btn-primary" data-action="lb-retry">Retry</button>
          </div>
        </div>`;
      return null;
    }
    if (id !== drawId) return null; // a newer render took over

    const ranked = PP.points.rankRows(rowsWithMyPoints(lb || [], me, myPts), me.id);
    const body = tab === "greek" ? greekHTML(houses, me.greek_house) : individualsHTML(ranked);
    root.innerHTML = `<div class="narrow lb-page">${headerHTML(ranked)}<div class="lb-list">${body}</div></div>`;
    const greet = shareInfo && root.querySelector(".lb-page .greeting");
    if (greet) greet.insertAdjacentHTML("afterend", shareBtnHTML()); // keep the share button across redraws
    return { id, rows: lb || [] };
  }

  // Find a row on the page by profile id
  function rowFor(root, profileId) {
    return Array.from(root.querySelectorAll(".row[data-id]")).find((el) => el.dataset.id === String(profileId));
  }

  // Centers my row on the screen
  function centerMe(root, smooth) {
    const meRow = root.querySelector(".row.me");
    if (meRow) meRow.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
    return meRow;
  }

  // One chomp on one row (the MVP gator, CSS lives in styles.css)
  async function chomp(row) {
    const gator = document.createElement("div");
    gator.className = "gator";
    gator.textContent = "🐊";
    const word = document.createElement("div");
    word.className = "chomp-word";
    word.textContent = "CHOMP!";
    row.append(gator, word);
    row.classList.add("chomped");
    await PP.ui.sleep(1100); // matches the 1.1s CSS animation
  }

  // Wipes the gator params so coming back to this tab doesn't replay it
  function clearParams(ctx) {
    if (ctx.params && typeof ctx.params === "object") {
      delete ctx.params.from;
      delete ctx.params.to;
    }
    ctx.params = null;
  }

  // Good params = two numbers, not negative, from < to
  function readParams(p) {
    if (!p || typeof p !== "object") return null;
    const from = p.from, to = p.to;
    if (typeof from !== "number" || typeof to !== "number") return null;
    if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
    if (from < 0 || to < 0 || from >= to) return null;
    return { from, to };
  }

  // THE GATOR. Returns once it's done.
  async function runGator(root, ctx, from, to, passed) {
    busy = true;
    root.classList.add("lb-busy");
    try {
      tab = "individuals";
      const first = await draw(root, ctx, from); // the board BEFORE the workout
      if (!first) return;
      // Still on this page and nobody redrew it? (user may click another tab mid-chomp)
      const alive = () => first.id === drawId && root.isConnected && !!root.querySelector(".lb-page");
      centerMe(root, false);
      await PP.ui.sleep(500);

      // Chomp up to 5 people, lowest points first
      for (const u of passed.slice(0, 5)) {
        if (!alive()) return; // user left or page redrew
        const row = rowFor(root, u.profile_id);
        if (!row) continue;
        row.scrollIntoView({ block: "center", behavior: "smooth" });
        await PP.ui.sleep(350);
        if (!alive()) return;
        await chomp(row);
      }
      if (!alive()) return;

      // Now the board AFTER: me with my real points, bouncing
      const after = await draw(root, ctx, to);
      if (!after) return;
      const meRow = centerMe(root, true);
      if (meRow) meRow.classList.add("jumped");
      const n = passed.length;
      PP.ui.toast(`🐊 You ate ${n} ${n === 1 ? "person" : "people"}! +${to - from} pts`);
      showShare(root, ctx, from, to, n, after.rows);
    } finally {
      busy = false;
      root.classList.remove("lb-busy");
    }
  }

  PP.pages.leaderboard = {
    // Draws the page into root (the <main> element)
    async render(root, ctx) {
      const p = readParams(ctx.params);
      clearParams(ctx); // read once, then forget, so it never replays
      shareInfo = null; // a normal visit never shows the share button

      if (!p) {
        const res = await draw(root, ctx);
        if (res && tab === "individuals") centerMe(root, false);
        return;
      }

      // We have a workout handoff. Who did I pass?
      let rows = [];
      try {
        rows = (await PP.db.getMonthLeaderboard()) || [];
      } catch (e) {
        rows = null;
      }
      const passed = rows ? PP.points.passedUsers(rows, p.from, p.to, ctx.me.id) : [];

      if (passed.length) {
        await runGator(root, ctx, p.from, p.to, passed);
        return;
      }

      // Nobody passed: normal board + a small toast
      const res = await draw(root, ctx);
      if (res && tab === "individuals") centerMe(root, false);
      if (res) PP.ui.toast(`💪 Workout logged. +${p.to - p.from} pts`);
      if (res) showShare(root, ctx, p.from, p.to, 0, res.rows);
    },

    // Clicks on [data-action="lb-..."] elements
    async onAction(action, el, ctx) {
      if (busy) return; // the gator is eating, hands off
      const root = document.getElementById("screen") || el.closest("main");
      if (!root) return;

      if (action === "lb-tab") {
        const v = el.dataset.v === "greek" ? "greek" : "individuals";
        if (v === tab) return;
        tab = v;
        const res = await draw(root, ctx);
        if (res && tab === "individuals") centerMe(root, false);
      }

      if (action === "lb-share" && shareInfo && PP.share) return PP.share.open(shareInfo);

      if (action === "lb-retry") {
        PP.ui.setLoading(root);
        const res = await draw(root, ctx);
        if (res && tab === "individuals") centerMe(root, false);
      }
    },

    // No inputs on this page
    async onChange(el, ctx) {},
  };
})();
