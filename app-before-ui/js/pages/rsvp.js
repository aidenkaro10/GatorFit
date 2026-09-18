// ============================================================
// PP.pages.rsvp: the Peak Pulse events page.
// Shows upcoming events, who's going, and an "I'm going" button.
// Ported from the MVP's rsvpHTML(). Only talks to data through PP.db.
// Every data-action in this page starts with "rsvp-".
// ============================================================

window.PP = window.PP || {};
PP.pages = PP.pages || {};

(function () {
  const MAX_FACES = 7;          // how many avatars we show before the "+n" bubble
  const MAX_NAME = 24;          // long names get cut to this many characters + "…"
  const SOON_MS = 2 * 60 * 60 * 1000; // "Starting soon" if the event is within 2 hours

  // Per-event state, kept between clicks so we can update one card without refetching.
  // cards[eventId] = { ev, going, others: [{ profile_id, display_name }], busy }
  let cards = {};
  let myId = null;
  let myName = "";
  let pageRoot = null; // the <main> we drew into

  // Cut a long name so it doesn't blow up the layout
  function shortName(name) {
    const chars = Array.from(String(name || "Someone"));
    return chars.length > MAX_NAME ? chars.slice(0, MAX_NAME - 1).join("") + "…" : chars.join("");
  }

  // Builds the inside of one event card from its state
  function cardInnerHTML(c) {
    const { esc, fmtWhen, avatarHTML } = PP.ui;
    const ev = c.ev;
    const total = c.others.length + (c.going ? 1 : 0);

    // "Starting soon" tag if the event starts in the next 2 hours
    const msLeft = new Date(ev.starts_at).getTime() - Date.now();
    const soon = msLeft > 0 && msLeft <= SOON_MS ? `<span class="tag rsvp-soon">Starting soon</span>` : "";

    // Faces: me first (gold) if I'm going, then everyone else, up to 7 total
    const faceList = (c.going ? [avatarHTML(myName, { me: true })] : [])
      .concat(c.others.map((o) => avatarHTML(o.display_name)));
    const extra = faceList.length - MAX_FACES;
    const faces = faceList.slice(0, MAX_FACES).join("") +
      (extra > 0 ? `<div class="avatar rsvp-more">+${extra}</div>` : "");
    const faceRow = total > 0 ? `<div class="avatar-stack">${faces}</div>` : "";

    // Names list: "You" first, then everyone else
    const names = (c.going ? ["You"] : [])
      .concat(c.others.map((o) => shortName(o.display_name)))
      .map(esc)
      .join(", ");

    return `
      <div class="rsvp-tags"><span class="tag">Peak Pulse · 3x points</span>${soon}</div>
      <h3 class="rsvp-title">${esc(ev.title)}</h3>
      <div class="muted">${esc(fmtWhen(ev.starts_at))} · ${esc(ev.location)}</div>
      ${ev.description ? `<p class="muted rsvp-desc">${esc(ev.description)}</p>` : ""}
      ${faceRow}
      <div class="rsvp-foot">
        <b>${total} going</b>
        <button class="btn btn-small ${c.going ? "btn-going" : ""}" data-action="rsvp-toggle"
          data-id="${esc(ev.id)}" ${c.busy ? "disabled" : ""}>
          ${c.going ? "Going ✓" : "I'm going"}
        </button>
      </div>
      <details${c.open ? " open" : ""}><summary>See who's going</summary><p>${names || "Nobody yet. Be the first 👀"}</p></details>`;
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
      pageRoot = root;
      myId = ctx.me && ctx.me.id;
      myName = (ctx.me && ctx.me.display_name) || (PP.me && PP.me.display_name) || "You";
      PP.ui.setLoading(root);

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
        events.forEach((ev) => { cards[ev.id] = { ev, going: false, others: [], busy: false, open: false }; });
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

        const body = events.length
          ? `<div class="grid">${events.map((ev) =>
              `<div class="card rsvp-card" data-rsvp-card="${PP.ui.esc(ev.id)}">${cardInnerHTML(cards[ev.id])}</div>`
            ).join("")}</div>`
          : `<div class="card"><p>No events posted yet. Check back soon 👀</p></div>`;

        root.innerHTML = PP.ui.greetingHTML("Peak Pulse events", nextUp) + body;
      } catch (e) {
        root.innerHTML = PP.ui.greetingHTML("Peak Pulse events", null) +
          `<div class="card"><p>Couldn't load events. ${PP.ui.esc(e.message || "")}</p></div>`;
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
        if (!wasGoing) PP.ui.toast("You're going! 🔥");
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
