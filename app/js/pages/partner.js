// ============================================================
// PP.pages.partner: the Find a Partner page.
// Left: a sticky "Post a session" card. Right: the feed of upcoming sessions.
// Talks to data only through PP.db. Every data-action starts with "partner-".
// ============================================================

window.PP = window.PP || {};
PP.pages = PP.pages || {};

(function () {
  // What the page remembers between clicks (filled in by render)
  const state = {
    meId: null,
    sessions: [],      // [{ id, host_id, host_name, type, focus, starts_at, location }]
    joins: [],         // [{ session_id, profile_id, display_name }]
    pastIds: new Set(),// people I've already logged a workout with
    busy: false,       // true while a post is saving (stops double posts)
    // Filters above the feed. "all"/"any" means no filter.
    filter: { act: "all", when: "all", part: "any", newOnly: false },
  };

  // ---------- Filters ----------
  const ACT_OPTIONS = [["all", "All"], ["gym", "Gym"], ["arms", "Arms"], ["legs", "Legs"], ["cardio", "Cardio"], ["run", "Run"]];
  const WHEN_OPTIONS = [["all", "Any day"], ["today", "Today"], ["tomorrow", "Tomorrow"], ["week", "This week"]];
  const PART_OPTIONS = [["any", "Any time"], ["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening"]];

  // Local "YYYY-MM-DD" for a date, so "today" means today in Gainesville, not UTC
  function dayKey(d) {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function partOfDay(d) {
    const h = d.getHours();
    return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  }

  // Does this session match every filter that's turned on?
  function matches(s) {
    const f = state.filter;
    if (f.act === "gym" && s.type !== "gym") return false;
    if (f.act === "run" && s.type !== "run") return false;
    if (["arms", "legs", "cardio"].includes(f.act) && !(s.type === "gym" && s.focus === f.act)) return false;

    const start = new Date(s.starts_at);
    const today = new Date();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    if (f.when === "today" && dayKey(start) !== dayKey(today)) return false;
    if (f.when === "tomorrow" && dayKey(start) !== dayKey(tomorrow)) return false;
    if (f.when === "week" && start.getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000) return false;

    if (f.part !== "any" && partOfDay(start) !== f.part) return false;
    if (f.newOnly && (s.host_id === state.meId || state.pastIds.has(s.host_id))) return false;
    return true;
  }

  function chipsHTML(key, options) {
    return options.map(([v, label]) =>
      `<button type="button" class="chip${state.filter[key] === v ? " on" : ""}" data-action="partner-filter" data-k="${key}" data-v="${v}">${label}</button>`
    ).join("");
  }

  // Compact toolbar: header line (title, count, Clear) + three labeled chip groups
  function filtersHTML(count) {
    const f = state.filter;
    const anyOn = f.act !== "all" || f.when !== "all" || f.part !== "any" || f.newOnly;
    return `
      <div class="partner-toolbar">
        <div class="partner-toolbar-top">
          <h2 class="partner-feed-title">Upcoming sessions</h2>
          <div class="partner-count">
            <span>${count} ${count === 1 ? "session" : "sessions"}</span>
            ${anyOn ? `<button type="button" class="partner-clear" data-action="partner-filter" data-k="reset" data-v="1">Clear</button>` : ""}
          </div>
        </div>
        <div class="partner-groups">
          <div class="partner-group"><span class="partner-group-label">What</span><div class="partner-chips">${chipsHTML("act", ACT_OPTIONS)}</div></div>
          <div class="partner-group"><span class="partner-group-label">When</span><div class="partner-chips">${chipsHTML("when", WHEN_OPTIONS)}</div></div>
          <div class="partner-group"><span class="partner-group-label">Time</span><div class="partner-chips">${chipsHTML("part", PART_OPTIONS)}
            <span class="partner-divider" aria-hidden="true"></span>
            <button type="button" class="chip partner-toggle${f.newOnly ? " on" : ""}" data-action="partner-filter" data-k="newOnly" data-v="toggle" aria-pressed="${f.newOnly}">${PP.ui.icon(f.newOnly ? "check" : "users", 14)}New people only (3x)</button>
          </div></div>
        </div>
      </div>`;
  }

  // Build a sensible post time from the filters, for "Post it yourself"
  function prefillTime() {
    const f = state.filter;
    const d = new Date();
    if (f.when === "tomorrow") d.setDate(d.getDate() + 1);
    const hour = f.part === "morning" ? 8 : f.part === "afternoon" ? 15 : f.part === "evening" ? 18 : null;
    if (hour !== null) d.setHours(hour, 0, 0, 0);
    else { d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); }
    // If that time already passed today, use tomorrow
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function prefillForm() {
    const f = state.filter;
    const type = f.act === "run" ? "run" : "gym";
    document.getElementById("pType").value = type;
    if (["arms", "legs", "cardio"].includes(f.act)) document.getElementById("pFocus").value = f.act;
    document.getElementById("pWhen").value = prefillTime();
    syncFocus();
    const where = document.getElementById("pWhere");
    where.focus();
    where.scrollIntoView({ block: "center", behavior: "smooth" });
    PP.ui.toast("Filled it in. Just add where.");
  }

  function setFilter(el) {
    const k = el.dataset.k, v = el.dataset.v;
    if (k === "reset") state.filter = { act: "all", when: "all", part: "any", newOnly: false };
    else if (k === "newOnly") state.filter.newOnly = !state.filter.newOnly;
    else state.filter[k] = v;
    drawFeed();
  }

  const esc = (s) => PP.ui.esc(s);
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
  const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "They";

  // Default time for a new post: the next full hour, in the format the date box wants
  function nextHourLocal() {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
  }

  // ---------- Feed ----------
  // One session = one row: avatar, who + what, when + where, action on the right
  function rowHTML(s) {
    const mine = s.host_id === state.meId;
    const joins = state.joins.filter((j) => j.session_id === s.id);
    const joined = joins.some((j) => j.profile_id === state.meId);
    const hostName = s.host_name || "Someone";
    const isRun = s.type === "run";
    const what = isRun ? "Run" : `Gym · ${esc(cap(s.focus))}`;

    // Right side of the row
    let right;
    if (mine) {
      const names = joins.map((j) => firstName(j.display_name)).filter(Boolean).join(", ");
      right = `<span class="partner-mine"${names ? ` title="${esc(names)}"` : ""}>Your post · ${joins.length} joined</span>`;
    } else if (joined) {
      right = `<button type="button" class="btn btn-sm btn-primary partner-btn" data-action="partner-leave" data-id="${esc(s.id)}" aria-label="Joined. Click to leave">${PP.ui.icon("check", 14)}Joined</button>`;
    } else {
      right = `<button type="button" class="btn btn-sm btn-secondary partner-btn" data-action="partner-join" data-id="${esc(s.id)}">Join</button>`;
    }

    // The 3x tag only shows for people I haven't trained with yet
    const isNew = !mine && !state.pastIds.has(s.host_id);

    return `
      <li class="partner-row${mine ? " is-mine" : ""}">
        ${PP.ui.avatarHTML(hostName, { me: mine })}
        <div class="partner-main">
          <div class="partner-line1">
            <span class="partner-name">${esc(hostName)}${mine ? " (you)" : ""}</span>
            ${isNew ? `<span class="badge badge-brand">3x · new partner</span>` : ""}
          </div>
          <div class="partner-what">${PP.ui.icon(isRun ? "footprints" : "dumbbell", 14)}<span>${what}</span></div>
          <div class="partner-meta">
            <span>${PP.ui.icon("clock", 14)}${esc(PP.ui.fmtWhen(s.starts_at))}</span>
            <span class="partner-place">${PP.ui.icon("map-pin", 14)}<span>${esc(s.location)}</span></span>
          </div>
        </div>
        <div class="partner-action">${right}</div>
      </li>`;
  }

  function emptyHTML(title, text, button) {
    return `
      <div class="empty partner-empty">
        <div class="empty-icon">${PP.ui.icon("users", 24)}</div>
        <div class="empty-title">${title}</div>
        <div class="empty-text">${text}</div>
        ${button || ""}
      </div>`;
  }

  function feedHTML() {
    if (!state.sessions.length) {
      return `<div class="card partner-feed">
        <div class="partner-toolbar"><div class="partner-toolbar-top"><h2 class="partner-feed-title">Upcoming sessions</h2></div></div>
        ${emptyHTML("No sessions yet", "Nobody's posted yet. Post one on the left and be the first.")}
      </div>`;
    }
    const shown = state.sessions.filter(matches);
    const list = shown.length
      ? `<ul class="partner-list">${shown.map(rowHTML).join("")}</ul>`
      : emptyHTML(
          "Nobody's going then",
          "Post it yourself. Someone looking for the same thing will see it.",
          `<button type="button" class="btn btn-primary" data-action="partner-prefill">${PP.ui.icon("plus-circle", 16)}Post this session</button>`
        );
    return `<div class="card partner-feed">${filtersHTML(shown.length)}${list}</div>`;
  }

  // Redraws only the feed so the form keeps what you typed
  function drawFeed() {
    const box = document.getElementById("partnerFeed");
    if (box) box.innerHTML = feedHTML();
  }

  // ---------- Form ----------
  // Type and Focus are hidden inputs (#pType, #pFocus) driven by button groups,
  // so the rest of the code can keep reading and writing .value like before.
  function formHTML() {
    const focusBtn = (v, label) =>
      `<button type="button" class="chip${v === "arms" ? " on" : ""}" data-action="partner-focus" data-v="${v}" aria-pressed="${v === "arms"}">${label}</button>`;
    return `
      <div class="card sticky partner-post">
        <div class="card-header">
          <div>
            <h2 class="card-title">Post a session</h2>
            <p class="card-sub">Everyone can see it. Go with someone new for 3x.</p>
          </div>
        </div>

        <div class="partner-field">
          <span class="partner-label" id="pTypeLabel">Type</span>
          <input type="hidden" id="pType" value="gym" />
          <div class="seg partner-seg" role="group" aria-labelledby="pTypeLabel">
            <button type="button" class="active" data-action="partner-type" data-v="gym" aria-pressed="true">${PP.ui.icon("dumbbell", 16)}Gym</button>
            <button type="button" data-action="partner-type" data-v="run" aria-pressed="false">${PP.ui.icon("footprints", 16)}Run</button>
          </div>
        </div>

        <div class="partner-field" id="pFocusWrap">
          <span class="partner-label" id="pFocusLabel">Focus</span>
          <input type="hidden" id="pFocus" value="arms" />
          <div class="partner-chips" role="group" aria-labelledby="pFocusLabel">
            ${focusBtn("arms", "Arms")}${focusBtn("legs", "Legs")}${focusBtn("cardio", "Cardio")}
          </div>
        </div>

        <div class="partner-field">
          <label class="partner-label" for="pWhen">When</label>
          <input id="pWhen" class="input" type="datetime-local" value="${nextHourLocal()}" />
        </div>

        <div class="partner-field">
          <label class="partner-label" for="pWhere">Where</label>
          <div class="partner-input-icon">
            ${PP.ui.icon("map-pin", 16)}
            <input id="pWhere" class="input" maxlength="60" placeholder="Southwest Rec" autocomplete="off" />
          </div>
        </div>

        <button type="button" class="btn btn-primary btn-block" data-action="partner-post">Post session</button>
      </div>`;
  }

  // Make the buttons match the hidden inputs, and hide Focus for runs
  function syncFocus() {
    const type = document.getElementById("pType");
    const focus = document.getElementById("pFocus");
    const wrap = document.getElementById("pFocusWrap");
    if (!type || !wrap) return;
    wrap.hidden = type.value === "run";
    document.querySelectorAll('[data-action="partner-type"]').forEach((b) => {
      const on = b.dataset.v === type.value;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    document.querySelectorAll('[data-action="partner-focus"]').forEach((b) => {
      const on = focus && b.dataset.v === focus.value;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }

  function pickType(el) {
    document.getElementById("pType").value = el.dataset.v === "run" ? "run" : "gym";
    syncFocus();
  }
  function pickFocus(el) {
    document.getElementById("pFocus").value = el.dataset.v;
    syncFocus();
  }

  function resetForm() {
    document.getElementById("pType").value = "gym";
    document.getElementById("pFocus").value = "arms";
    document.getElementById("pWhen").value = nextHourLocal();
    document.getElementById("pWhere").value = "";
    syncFocus();
  }

  async function post(el, ctx) {
    if (state.busy) return;
    const type = document.getElementById("pType").value === "run" ? "run" : "gym";
    // A run never has a focus, no matter what the hidden dropdown says
    const focus = type === "gym" ? String(document.getElementById("pFocus").value || "").toLowerCase() : "";
    const whenRaw = document.getElementById("pWhen").value;
    const location = document.getElementById("pWhere").value.trim();

    // Check everything before saving
    if (!location) return PP.ui.toast("Add where you're going");
    if (Array.from(location).length > 60) return PP.ui.toast("Keep the location under 60 characters");
    const when = new Date(whenRaw);
    if (!whenRaw || isNaN(when.getTime())) return PP.ui.toast("Pick a date and time");
    if (when.getTime() <= Date.now()) return PP.ui.toast("Pick a time that hasn't happened yet");
    if (when.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000) return PP.ui.toast("Pick a time in the next 30 days");

    state.busy = true;
    el.disabled = true;
    try {
      // toISOString turns the local time into a real moment the database understands
      const saved = await PP.db.postSession({ type, focus, starts_at: when.toISOString(), location });
      const row = {
        id: saved.id,
        host_id: saved.host_id || state.meId,
        host_name: (ctx.me && ctx.me.display_name) || "You",
        type: saved.type || type,
        focus: saved.focus ?? focus,
        starts_at: saved.starts_at || when.toISOString(),
        location: saved.location || location,
      };
      state.sessions.push(row);
      state.sessions.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
      drawFeed();
      resetForm();
      PP.ui.toast("Posted. Everyone can see it now.");
    } catch (err) {
      PP.ui.toast((err && err.message) || "Couldn't post that. Try again.");
    } finally {
      state.busy = false;
      el.disabled = false;
    }
  }

  // Join or leave: update the screen first, undo if the save fails
  async function toggleJoin(action, el) {
    const id = el.dataset.id;
    const s = state.sessions.find((x) => x.id === id);
    if (!s || s.host_id === state.meId) return;
    const joining = action === "partner-join";
    const before = state.joins.slice();

    if (joining) {
      state.joins.push({ session_id: id, profile_id: state.meId, display_name: "" });
    } else {
      state.joins = state.joins.filter((j) => !(j.session_id === id && j.profile_id === state.meId));
    }
    drawFeed();
    // Disable the new button while it saves
    const btn = document.querySelector(`#partnerFeed [data-id="${CSS.escape(id)}"]`);
    if (btn) btn.disabled = true;

    try {
      if (joining) {
        await PP.db.joinSession(id);
        PP.ui.toast(`You're in. ${firstName(s.host_name)} got a heads up.`);
      } else {
        await PP.db.leaveSession(id);
      }
    } catch (err) {
      state.joins = before; // undo
      PP.ui.toast((err && err.message) || "That didn't save. Try again.");
    }
    drawFeed();
  }

  PP.pages.partner = {
    async render(root, ctx) {
      PP.ui.setLoading(root);
      state.meId = ctx.me && ctx.me.id;

      // Greeting data plus the 3 feed calls (sessions first, then joins + past partners)
      const [board, sessions, pastIds] = await Promise.all([
        PP.db.getMonthLeaderboard().catch(() => []),
        PP.db.listUpcomingSessions(),
        PP.db.getPastPartnerIds(),
      ]);
      const joins = await PP.db.listJoins(sessions.map((s) => s.id));

      state.sessions = sessions;
      // Ignore joins for sessions that are gone
      const ids = new Set(sessions.map((s) => s.id));
      state.joins = joins.filter((j) => ids.has(j.session_id));
      state.pastIds = pastIds instanceof Set ? pastIds : new Set(pastIds || []);

      const nextUp = PP.points.nextUp(PP.points.rankRows(board, state.meId));
      root.innerHTML = `
        ${PP.ui.greetingHTML("Find a partner", nextUp)}
        <div class="cols partner-cols">
          ${formHTML()}
          <div id="partnerFeed">${feedHTML()}</div>
        </div>`;
      syncFocus();
    },

    async onAction(action, el, ctx) {
      if (action === "partner-post") return post(el, ctx);
      if (action === "partner-join" || action === "partner-leave") return toggleJoin(action, el);
      if (action === "partner-filter") return setFilter(el);
      if (action === "partner-prefill") return prefillForm();
      if (action === "partner-type") return pickType(el);
      if (action === "partner-focus") return pickFocus(el);
    },

    async onChange(el, ctx) {
      if (el && el.id === "pType") syncFocus();
    },
  };
})();
