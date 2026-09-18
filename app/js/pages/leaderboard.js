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
  // Page memory (lives while the app is open)
  let tab = "individuals"; // "individuals" or "greek"
  let busy = false;        // true while the gator is chomping (ignore clicks)
  let drawId = 0;          // goes up on every render, so an old gator run knows to stop
  let shareInfo = null;    // set only right after a fresh workout; shows the "Share to your story" button
  let countUp = null;      // { from } = count my points up on the next draw (only once per visit)

  // Share button under the greeting (only after a fresh workout). Uses PP.share (js/share.js).
  function shareBtnHTML() {
    return shareInfo && PP.share
      ? `<button class="btn btn-primary lb-share-btn" data-action="lb-share">${PP.ui.icon("share-2", 16)}<span>Share to your story</span></button>`
      : "";
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

  // Days until the board resets on the 1st
  function daysUntilReset() {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return last - now.getDate() + 1;
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

  // "1 pt", "9 pts"
  function ptsLabel(n) { return n === 1 ? "pt" : "pts"; }

  // Top part: greeting, segmented switch, reset line
  function headerHTML(ranked) {
    const U = PP.ui;
    const n = daysUntilReset();
    return `
      ${U.greetingHTML("Leaderboard", nextUpFor(ranked))}
      <div class="lb-bar">
        <div class="seg" role="tablist">
          <button class="${tab === "individuals" ? "active" : ""}" role="tab" aria-selected="${tab === "individuals"}" data-action="lb-tab" data-v="individuals">Individuals</button>
          <button class="${tab === "greek" ? "active" : ""}" role="tab" aria-selected="${tab === "greek"}" data-action="lb-tab" data-v="greek">Greek Life</button>
        </div>
        <div class="lb-reset">${U.icon("clock", 14)}<span>${n === 1 ? "Resets tomorrow" : `Resets in ${n} days`}</span></div>
      </div>`;
  }

  // One podium spot (Trophy leaderboard-podium, ported).
  // spot = { place, id, name, sub, points, me, avatarName }
  function podiumSpotHTML(spot) {
    const U = PP.ui;
    const crown = spot.place === 1 ? `<span class="lb-crown">${U.icon("crown", 20)}</span>` : "";
    const count = spot.me ? ` data-count="${spot.points}"` : "";
    return `
      <div class="lb-spot p${spot.place} ${spot.me ? "me" : ""}" role="listitem" data-podium-id="${U.esc(spot.id)}"
           aria-label="Rank ${spot.place}: ${U.esc(spot.name)}, ${spot.points} ${ptsLabel(spot.points)}">
        <div class="lb-spot-head">
          ${crown}
          <div class="lb-spot-avatar">
            ${U.avatarHTML(spot.avatarName, { me: spot.me, size: "lg" })}
            <span class="lb-spot-badge">${spot.place}</span>
          </div>
        </div>
        <div class="lb-spot-name" title="${U.esc(spot.name)}">${U.esc(spot.name)}${spot.me ? ` <span class="lb-you">You</span>` : ""}</div>
        <div class="lb-spot-sub">${U.esc(spot.sub)}</div>
        <div class="lb-spot-block">
          <span class="lb-spot-pts"${count}>${spot.points}</span>
          <span class="lb-spot-unit">${spot.unit || ptsLabel(spot.points)}</span>
        </div>
      </div>`;
  }

  // Podium order on screen: 2nd left, 1st center, 3rd right
  function podiumHTML(spots) {
    if (!spots.length) return "";
    const order = [spots[1], spots[0], spots[2]].filter(Boolean);
    return `<div class="lb-podium" role="list" aria-label="Top 3">${order.map(podiumSpotHTML).join("")}</div>`;
  }

  // Individuals board. Top 3 on the podium, rank 4+ in the list. Shows people with points, plus me even at 0.
  function individualsHTML(ranked) {
    const U = PP.ui;
    const shown = ranked.filter((r) => r.points > 0 || r.isMe);
    const spots = shown.slice(0, 3).map((r, i) => ({
      place: i + 1, id: r.profile_id, name: r.display_name, avatarName: r.display_name,
      sub: r.greek_house || "Independent", points: r.points, me: !!r.isMe,
    }));
    const rest = shown.slice(3);
    const rows = rest.map((r, k) => {
      const i = k + 3;
      return `
      <div class="row lb-row ${r.isMe ? "me" : ""}" data-id="${U.esc(r.profile_id)}">
        <span class="rank">${i + 1}</span>
        ${U.avatarHTML(r.display_name, { me: r.isMe })}
        <div class="who">
          <div class="name">${U.esc(r.display_name)}${r.isMe ? ` <span class="lb-you">You</span>` : ""}</div>
          <div class="sub">${U.esc(r.greek_house || "Independent")}</div>
        </div>
        <span class="pts"${r.isMe ? ` data-count="${r.points}"` : ""}>${r.points}</span>
      </div>`;
    }).join("");
    const list = rows
      ? `<div class="lb-list-head"><span>Rank</span><span>Points</span></div><div class="lb-rank-list">${rows}</div>`
      : "";
    return podiumHTML(spots) + list;
  }

  // Greek Life board. The database view already did the math
  // (active members only, 10+ rule). We only sort and show it.
  function greekHTML(houses, myHouse) {
    const U = PP.ui;
    const min = PP.points.RULES.greekMinActive;
    const onBoard = houses
      .filter((h) => h.on_board)
      .sort((a, b) => b.avg_points - a.avg_points || String(a.house).localeCompare(String(b.house)));
    const waiting = houses
      .filter((h) => !h.on_board)
      .sort((a, b) => b.active_count - a.active_count || String(a.house).localeCompare(String(b.house)));
    const activeLabel = (n) => `${n} active`;

    if (!onBoard.length && !waiting.length) {
      return `
        <div class="empty">
          <div class="empty-icon">${U.icon("users", 22)}</div>
          <div class="empty-title">No houses yet</div>
          <div class="empty-text">Houses show up here once members start logging workouts.</div>
        </div>`;
    }

    const spots = onBoard.slice(0, 3).map((h, i) => ({
      place: i + 1, id: h.house, name: h.house, avatarName: h.house,
      sub: activeLabel(h.active_count), points: h.avg_points, unit: "avg",
      me: !!myHouse && h.house === myHouse,
    }));
    const rows = onBoard.slice(3).map((h, k) => {
      const mine = myHouse && h.house === myHouse;
      return `
        <div class="row lb-row ${mine ? "me" : ""}">
          <span class="rank">${k + 4}</span>
          ${U.avatarHTML(h.house, { me: mine })}
          <div class="who">
            <div class="name">${U.esc(h.house)}${mine ? ` <span class="lb-you">Your house</span>` : ""}</div>
            <div class="sub">${activeLabel(h.active_count)}</div>
          </div>
          <span class="pts">${h.avg_points}</span>
        </div>`;
    }).join("");

    const board = onBoard.length
      ? podiumHTML(spots) + (rows ? `<div class="lb-list-head"><span>Rank</span><span>Avg points</span></div><div class="lb-rank-list">${rows}</div>` : "")
      : `<div class="lb-none">No houses on the board yet. A house needs ${min} active members to rank.</div>`;

    const small = waiting.length
      ? `
        <div class="lb-waiting">
          <div class="lb-waiting-head">
            <span>Not on the board yet</span>
            <span>${min} active members to rank</span>
          </div>
          ${waiting.map((h) => {
            const pct = Math.min(100, Math.round((h.active_count / min) * 100));
            const mine = myHouse && h.house === myHouse;
            return `
            <div class="lb-wait-row ${mine ? "me" : ""}">
              <span class="lb-wait-name" title="${U.esc(h.house)}">${U.esc(h.house)}</span>
              <div class="lb-wait-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${min}" aria-valuenow="${h.active_count}"><div style="width:${pct}%"></div></div>
              <span class="lb-wait-count">${h.active_count}/${min}</span>
            </div>`;
          }).join("")}
        </div>`
      : "";

    return `<div class="lb-note">Score is average points per active member</div>${board}${small}`;
  }

  // Counts my points up once (Magic UI number-ticker idea, plain JS, 500ms). Off for reduced motion.
  function runCountUp(root, from) {
    const els = root.querySelectorAll("[data-count]");
    if (!els.length) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const start = performance.now();
    const dur = 500;
    const targets = Array.from(els).map((el) => ({ el, to: Number(el.dataset.count) || 0 }));
    targets.forEach(({ el, to }) => { el.textContent = String(Math.min(from, to)); }); // start low, no flash of the final number
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const ease = 1 - Math.pow(1 - t, 3); // ease out
      targets.forEach(({ el, to }) => {
        const a = Math.min(from, to);
        el.textContent = String(Math.round(a + (to - a) * ease));
      });
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
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
          <div class="empty lb-error">
            <div class="empty-icon">${PP.ui.icon("alert-triangle", 22)}</div>
            <div class="empty-title">Couldn't load the board</div>
            <div class="empty-text">Check your connection and try again.</div>
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
    if (countUp && tab === "individuals") {
      const from = countUp.from;
      countUp = null; // once per visit
      runCountUp(root, from);
    }
    return { id, rows: lb || [] };
  }

  // Find a row in the rankings list by profile id (podium spots use data-podium-id, so they never match)
  function rowFor(root, profileId) {
    return Array.from(root.querySelectorAll(".lb-rank-list .row[data-id]")).find((el) => el.dataset.id === String(profileId));
  }

  // Centers my row on the screen (or my podium spot if I'm top 3)
  function centerMe(root, smooth) {
    const meRow = root.querySelector(".lb-rank-list .row.me") || root.querySelector(".lb-spot.me");
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
      countUp = null; // no ticker on the "before" board
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
        if (!row) continue; // not in the rankings list (on the podium or hidden at 0 pts): skip

        row.scrollIntoView({ block: "center", behavior: "smooth" });
        await PP.ui.sleep(350);
        if (!alive()) return;
        await chomp(row);
      }
      if (!alive()) return;

      // Now the board AFTER: me with my real points, bouncing (points tick up from the old total)
      countUp = { from };
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
      countUp = { from: 0 }; // count my points up once on load

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
      if (res) PP.ui.toast(`Workout logged. +${p.to - p.from} ${ptsLabel(p.to - p.from)}`);
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
