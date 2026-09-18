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
  const ACT_OPTIONS = [["all", "All"], ["gym", "🏋️ Gym"], ["arms", "Arms"], ["legs", "Legs"], ["cardio", "Cardio"], ["run", "🏃 Run"]];
  const WHEN_OPTIONS = [["all", "Any day"], ["today", "Today"], ["tomorrow", "Tomorrow"], ["week", "This week"]];
  const PART_OPTIONS = [["any", "Any time"], ["morning", "☀️ Morning"], ["afternoon", "Afternoon"], ["evening", "🌙 Evening"]];

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
      `<button class="partner-chip${state.filter[key] === v ? " on" : ""}" data-action="partner-filter" data-k="${key}" data-v="${v}">${label}</button>`
    ).join("");
  }

  function filtersHTML(count) {
    const f = state.filter;
    const anyOn = f.act !== "all" || f.when !== "all" || f.part !== "any" || f.newOnly;
    return `
      <div class="partner-filters">
        <div class="partner-chip-row"><span class="partner-chip-label">What</span>${chipsHTML("act", ACT_OPTIONS)}</div>
        <div class="partner-chip-row"><span class="partner-chip-label">When</span>${chipsHTML("when", WHEN_OPTIONS)}</div>
        <div class="partner-chip-row"><span class="partner-chip-label">Time</span>${chipsHTML("part", PART_OPTIONS)}
          <button class="partner-chip${f.newOnly ? " on" : ""}" data-action="partner-filter" data-k="newOnly" data-v="toggle">✨ New people only (3x)</button>
        </div>
        <div class="muted partner-count">${count} ${count === 1 ? "session" : "sessions"}${anyOn ? ` ${count === 1 ? "matches" : "match"} · <a href="#" data-action="partner-filter" data-k="reset" data-v="1">Clear filters</a>` : ""}</div>
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
    PP.ui.toast("Filled it in. Just add where 📍");
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
  function cardHTML(s) {
    const mine = s.host_id === state.meId;
    const joins = state.joins.filter((j) => j.session_id === s.id);
    const joined = joins.some((j) => j.profile_id === state.meId);
    const hostName = s.host_name || "Someone";
    const what = s.type === "gym" ? `Gym · ${esc(cap(s.focus))}` : "Run";

    // Right side of the bottom row
    let right;
    if (mine) {
      const names = joins.map((j) => esc(firstName(j.display_name))).join(", ");
      right = `<span class="muted">Your post · ${joins.length} joined${names ? `: ${names}` : ""}</span>`;
    } else if (joined) {
      right = `<button class="btn btn-small btn-going" data-action="partner-leave" data-id="${esc(s.id)}">Joined ✓</button>`;
    } else {
      right = `<button class="btn btn-small" data-action="partner-join" data-id="${esc(s.id)}">Join</button>`;
    }

    // The 3x tag only shows for people I haven't trained with yet
    const isNew = !mine && !state.pastIds.has(s.host_id);

    return `
      <div class="card partner-card">
        <div class="partner-head">
          ${PP.ui.avatarHTML(hostName, { me: mine })}
          <div class="partner-info">
            <b>${esc(hostName)}${mine ? " (you)" : ""}</b>
            <div class="muted">${what} · ${esc(PP.ui.fmtWhen(s.starts_at))}</div>
            <div class="muted">📍 ${esc(s.location)}</div>
          </div>
        </div>
        <div class="partner-foot">
          ${isNew ? `<span class="tag">New partner = 3x</span>` : "<span></span>"}
          ${right}
        </div>
      </div>`;
  }

  function feedHTML() {
    if (!state.sessions.length) {
      return `<div class="card muted partner-empty">Nobody's posted yet. Be the first 💪</div>`;
    }
    const shown = state.sessions.filter(matches);
    const list = shown.length
      ? `<div class="grid">${shown.map(cardHTML).join("")}</div>`
      : `<div class="card partner-empty">
           <div><b>Nobody's going then.</b> Post it yourself 💪</div>
           <div class="muted" style="margin-top:4px">Someone looking for the same thing will see it.</div>
           <button class="btn btn-primary" data-action="partner-prefill" style="width:auto">Post this session</button>
         </div>`;
    return filtersHTML(shown.length) + list;
  }

  // Redraws only the feed so the form keeps what you typed
  function drawFeed() {
    const box = document.getElementById("partnerFeed");
    if (box) box.innerHTML = feedHTML();
  }

  // ---------- Form ----------
  function formHTML() {
    return `
      <div class="card sticky partner-post">
        <h3>Post a session</h3>
        <div class="muted partner-sub">Everyone can see it. Go with someone new and get 3x.</div>
        <label class="partner-label" for="pType">Type</label>
        <select id="pType">
          <option value="gym">Gym</option>
          <option value="run">Run</option>
        </select>
        <div id="pFocusWrap">
          <label class="partner-label" for="pFocus">Focus</label>
          <select id="pFocus">
            <option value="arms">Arms</option>
            <option value="legs">Legs</option>
            <option value="cardio">Cardio</option>
          </select>
        </div>
        <label class="partner-label" for="pWhen">When</label>
        <input id="pWhen" type="datetime-local" value="${nextHourLocal()}" />
        <label class="partner-label" for="pWhere">Where</label>
        <input id="pWhere" maxlength="60" placeholder="Where? (ex: Southwest Rec)" />
        <button class="btn btn-primary" data-action="partner-post">Post it</button>
      </div>`;
  }

  // Hide the focus box for runs
  function syncFocus() {
    const type = document.getElementById("pType");
    const wrap = document.getElementById("pFocusWrap");
    if (type && wrap) wrap.hidden = type.value === "run";
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
          <div>
            <h4 class="partner-heading">Upcoming sessions</h4>
            <div id="partnerFeed">${feedHTML()}</div>
          </div>
        </div>`;
      syncFocus();
    },

    async onAction(action, el, ctx) {
      if (action === "partner-post") return post(el, ctx);
      if (action === "partner-join" || action === "partner-leave") return toggleJoin(action, el);
      if (action === "partner-filter") return setFilter(el);
      if (action === "partner-prefill") return prefillForm();
    },

    async onChange(el, ctx) {
      if (el && el.id === "pType") syncFocus();
    },
  };
})();
