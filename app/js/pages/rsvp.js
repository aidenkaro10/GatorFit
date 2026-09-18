// ============================================================
// PP.pages.rsvp: the Peak Pulse events page.
// Layout: points boost callout (with a live countdown to the next run),
// the next run as a featured card, then the rest of the runs as a list.
// Only talks to data through PP.db.
// Every data-action in this page starts with "rsvp-".
// ============================================================

window.PP = window.PP || {};
PP.pages = PP.pages || {};

(function () {
  const MAX_FACES = 5;          // how many avatars we show before the "+n" bubble
  const MAX_NAME = 24;          // long names get cut to this many characters + "…"
  const SOON_MS = 2 * 60 * 60 * 1000; // "Starting soon" if the event is within 2 hours

  // Per-event state, kept between clicks so we can update one card without refetching.
  // cards[eventId] = { ev, going, others: [{ profile_id, display_name }], busy, open, featured }
  let cards = {};
  let myId = null;
  let myName = "";
  let pageRoot = null;   // the <main> we drew into
  let tickTimer = null;  // the countdown interval (cleared on every re-render)
  let nextStart = 0;     // when the next run starts (ms), for the countdown

  // Cut a long name so it doesn't blow up the layout
  function shortName(name) {
    const chars = Array.from(String(name || "Someone"));
    return chars.length > MAX_NAME ? chars.slice(0, MAX_NAME - 1).join("") + "…" : chars.join("");
  }

  // "6:30 AM"
  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  // "Starts in 1d 4h 12m" (drops the parts that are zero at the front)
  function countdownText(startMs) {
    const ms = startMs - Date.now();
    if (ms <= 0) return "Happening now";
    const totalMin = Math.max(1, Math.ceil(ms / 60000));
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    const m = totalMin % 60;
    if (d > 0) return `Starts in ${d}d ${h}h ${m}m`;
    if (h > 0) return `Starts in ${h}h ${m}m`;
    return `Starts in ${m}m`;
  }

  // Stop the countdown (called before every re-render and when the page is gone)
  function stopTick() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = null;
  }

  // Update the countdown every minute. If the countdown is no longer on screen
  // (the user switched tabs), stop the timer.
  function startTick() {
    stopTick();
    tickTimer = setInterval(() => {
      const el = document.querySelector("[data-rsvp-countdown]");
      if (!el || !pageRoot || !pageRoot.contains(el)) return stopTick();
      el.textContent = countdownText(nextStart);
    }, 60 * 1000);
  }

  // Calendar tile: "SAT" small on top, "19" big below
  function dateTileHTML(iso, big) {
    const d = new Date(iso);
    const wd = d.toLocaleDateString([], { weekday: "short" });
    const mo = d.toLocaleDateString([], { month: "short" });
    return `
      <div class="rsvp-date${big ? " rsvp-date-lg" : ""}" aria-label="${PP.ui.esc(d.toDateString())}">
        <span class="rsvp-date-wd">${PP.ui.esc(wd)}</span>
        <span class="rsvp-date-day">${d.getDate()}</span>
        ${big ? `<span class="rsvp-date-mo">${PP.ui.esc(mo)}</span>` : ""}
      </div>`;
  }

  // The Trophy "points boost" style callout at the top of the page
  function boostHTML(ev) {
    const { esc, fmtWhen, icon } = PP.ui;
    return `
      <div class="rsvp-boost">
        <div class="rsvp-boost-icon">${icon("zap", 20)}</div>
        <div class="rsvp-boost-body">
          <div class="rsvp-boost-title">
            <span>3x points at Peak Pulse runs</span>
            <span class="rsvp-boost-mult">x3</span>
          </div>
          <div class="rsvp-boost-sub">
            <span class="rsvp-trunc">Next: <b>${esc(ev.title)}</b></span>
            <span class="rsvp-dot" aria-hidden="true"></span>
            <span>${esc(fmtWhen(ev.starts_at))}</span>
            <span class="rsvp-dot" aria-hidden="true"></span>
            <span class="rsvp-trunc">${esc(ev.location)}</span>
          </div>
        </div>
        <div class="rsvp-boost-count">
          ${icon("clock", 14)}
          <span data-rsvp-countdown>${esc(countdownText(new Date(ev.starts_at).getTime()))}</span>
        </div>
      </div>`;
  }

  // Builds the inside of one event (featured card or list row) from its state
  function cardInnerHTML(c) {
    const { esc, avatarHTML, icon } = PP.ui;
    const ev = c.ev;
    const total = c.others.length + (c.going ? 1 : 0);

    // "Starting soon" badge if the event starts in the next 2 hours
    const msLeft = new Date(ev.starts_at).getTime() - Date.now();
    const soon = msLeft > 0 && msLeft <= SOON_MS
      ? `<span class="badge badge-ink rsvp-soon">${icon("clock", 12)}Starting soon</span>` : "";

    // Faces: me first (orange) if I'm going, then everyone else
    const faceList = (c.going ? [avatarHTML(myName, { me: true, size: "sm" })] : [])
      .concat(c.others.map((o) => avatarHTML(o.display_name, { size: "sm" })));
    const extra = faceList.length - MAX_FACES;
    const faces = faceList.slice(0, MAX_FACES).join("") +
      (extra > 0 ? `<div class="avatar avatar-sm rsvp-more">+${extra}</div>` : "");
    const faceRow = total > 0 ? `<div class="avatar-stack">${faces}</div>` : "";
    const countText = total > 0 ? `<b>${total}</b> going` : "Be the first";

    // Names list: "You" first, then everyone else
    const names = (c.going ? ["You"] : [])
      .concat(c.others.map((o) => shortName(o.display_name)))
      .map(esc)
      .join(", ");

    // The RSVP button: outline "Going?" or solid ink "Going" with a check
    const btn = `
      <button class="btn ${c.featured ? "" : "btn-sm"} ${c.going ? "btn-primary" : "btn-secondary"} rsvp-btn"
        data-action="rsvp-toggle" data-id="${esc(ev.id)}" ${c.busy ? "disabled" : ""}
        aria-pressed="${c.going ? "true" : "false"}">
        ${c.going ? `${icon("check", c.featured ? 16 : 14)}Going` : "Going?"}
      </button>`;

    const who = `
      <details class="rsvp-who"${c.open ? " open" : ""}>
        <summary>See who's going${icon("chevron-down", 14)}</summary>
        <p>${names || "Nobody yet."}</p>
      </details>`;

    const meta = `
      <div class="rsvp-meta">
        <span>${icon("clock", 14)}${esc(fmtTime(ev.starts_at))}</span>
        <span class="rsvp-trunc">${icon("map-pin", 14)}${esc(ev.location)}</span>
      </div>`;

    if (c.featured) {
      return `
        <div class="rsvp-feature-top">
          ${dateTileHTML(ev.starts_at, true)}
          <div class="rsvp-main">
            <div class="rsvp-label">Next run ${soon}</div>
            <h3 class="rsvp-title rsvp-title-lg">${esc(ev.title)}</h3>
            ${meta}
            ${ev.description ? `<p class="rsvp-desc">${esc(ev.description)}</p>` : ""}
          </div>
        </div>
        <div class="rsvp-feature-foot">
          <div class="rsvp-people">${faceRow}<span class="rsvp-count">${countText}</span></div>
          ${btn}
        </div>
        ${who}`;
    }

    return `
      ${dateTileHTML(ev.starts_at, false)}
      <div class="rsvp-main">
        <div class="rsvp-title-row"><h3 class="rsvp-title">${esc(ev.title)}</h3>${soon}</div>
        ${meta}
        ${who}
      </div>
      <div class="rsvp-side">
        <div class="rsvp-people">${faceRow}<span class="rsvp-count">${countText}</span></div>
        ${btn}
      </div>`;
  }

  // Redraws just one card in place (no refetch, no page jump)
  function redrawCard(root, id) {
    const c = cards[id];
    const el = root && root.querySelector(`[data-rsvp-card="${CSS.escape(String(id))}"]`);
    if (!c || !el) return;
    // Keep "See who's going" open if the user had it open
    const d = el.querySelector("details");
    c.open = !!(d && d.open);
    el.innerHTML = cardInnerHTML(c);
  }

  PP.pages.rsvp = {
    // Draws the page into root (the <main id="screen"> element)
    async render(root, ctx) {
      stopTick(); // an old countdown never keeps running under a new render
      pageRoot = root;
      myId = ctx.me && ctx.me.id;
      myName = (ctx.me && ctx.me.display_name) || (PP.me && PP.me.display_name) || "You";
      PP.ui.setLoading(root);
      const { esc, icon } = PP.ui;

      try {
        // Greeting: the person right above me on the leaderboard (null if I'm #1)
        const rows = PP.points.rankRows(await PP.db.getMonthLeaderboard(), myId);
        const i = rows.findIndex((r) => r.isMe);
        const nextUp = i > 0
          ? { name: rows[i - 1].display_name, gap: rows[i - 1].points - rows[i].points + 1 }
          : null;

        // Exactly 2 data calls: events, then all RSVPs for those events
        const events = await PP.db.listUpcomingEvents();
        const rsvps = events.length ? await PP.db.listRsvps(events.map((e) => e.id)) : [];

        // Build per-event state. Unique people only (a duplicate row never counts twice).
        cards = {};
        events.forEach((ev, n) => {
          cards[ev.id] = { ev, going: false, others: [], busy: false, open: false, featured: n === 0 };
        });
        const seen = new Set();
        rsvps.forEach((r) => {
          const c = cards[r.event_id];
          if (!c) return; // RSVP for an event not in the list: ignore
          const key = r.event_id + "|" + r.profile_id;
          if (seen.has(key)) return;
          seen.add(key);
          if (r.profile_id === myId) c.going = true;
          else c.others.push({ profile_id: r.profile_id, display_name: r.display_name });
        });

        let body;
        if (!events.length) {
          body = `
            <div class="card">
              <div class="empty">
                <div class="empty-icon">${icon("calendar", 24)}</div>
                <div class="empty-title">No runs on the calendar</div>
                <div class="empty-text">New Peak Pulse runs show up here. Check back soon.</div>
              </div>
            </div>`;
        } else {
          const [next, ...rest] = events;
          nextStart = new Date(next.starts_at).getTime();
          body = `
            ${boostHTML(next)}
            <div class="card rsvp-feature" data-rsvp-card="${esc(next.id)}">${cardInnerHTML(cards[next.id])}</div>
            ${rest.length ? `
              <div class="rsvp-section">
                <h4>Later runs</h4>
                <span class="rsvp-section-count">${rest.length} ${rest.length === 1 ? "run" : "runs"}</span>
              </div>
              <div class="card rsvp-list">
                ${rest.map((ev) =>
                  `<div class="rsvp-row" data-rsvp-card="${esc(ev.id)}">${cardInnerHTML(cards[ev.id])}</div>`
                ).join("")}
              </div>` : ""}`;
        }

        root.innerHTML = PP.ui.greetingHTML("Peak Pulse events", nextUp) + `<div class="rsvp-page">${body}</div>`;
        if (events.length) startTick();
      } catch (e) {
        root.innerHTML = PP.ui.greetingHTML("Peak Pulse events", null) + `
          <div class="card">
            <div class="empty">
              <div class="empty-icon">${icon("alert-triangle", 24)}</div>
              <div class="empty-title">Couldn't load events</div>
              <div class="empty-text">${esc(e.message || "Something went wrong. Try again.")}</div>
            </div>
          </div>`;
      }
    },

    // Clicks on [data-action="rsvp-..."] elements
    async onAction(action, el, ctx) {
      if (action !== "rsvp-toggle") return;
      const id = el.dataset.id;
      const c = cards[id];
      const root = (pageRoot && pageRoot.isConnected ? pageRoot : null) || el.closest("main") || document;
      if (!c || c.busy) return; // already saving: ignore extra clicks

      // 1. Flip it on screen right away and lock the button
      const wasGoing = c.going;
      c.going = !wasGoing;
      c.busy = true;
      redrawCard(root, id);

      try {
        // 2. Save it
        if (wasGoing) await PP.db.removeRsvp(id);
        else await PP.db.addRsvp(id);
        if (!wasGoing) PP.ui.toast("You're going. See you there.");
      } catch (e) {
        // 3. Save failed: undo the screen change and say why
        c.going = wasGoing;
        PP.ui.toast((e && e.message) || "Couldn't save that. Try again.");
      } finally {
        c.busy = false;
        redrawCard(root, id);
      }
    },

    // No inputs on this page
    async onChange(el, ctx) {},
  };
})();
