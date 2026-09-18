// ============================================================
// PP.ui: small shared helpers and bits of HTML every page uses.
// Ported from the MVP (app-mvp-backup/app.js).
// ============================================================

window.PP = window.PP || {};
PP.pages = PP.pages || {}; // each page file adds itself here

(function () {
  // Makes text safe to put on the page (stops weird characters from breaking it)
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  // "Jake Carter" -> "JC". Works with emoji too (Array.from keeps them whole).
  function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return parts.map((p) => Array.from(p)[0]).slice(0, 2).join("").toUpperCase();
  }

  // Nice date like "Sat, Sep 19, 6:30 AM"
  function fmtWhen(iso) {
    return new Date(iso).toLocaleString([], {
      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  }

  // Wait a bit (used for animations): await PP.ui.sleep(500)
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Pop-up message at the bottom of the screen
  let toastTimer = null;
  function toast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
  }

  // Shrinks a photo so it's small enough to save or upload.
  // Returns a "data:image/jpeg;base64,..." string.
  function shrinkImage(file, maxW = 400) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });
  }

  // "Good morning / afternoon / evening"
  function timeGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }

  // The greeting block at the top of every tab.
  // nextUp = { name, gap } (the person right above you), or null if you're #1.
  // Tip: PP.points.nextUp(PP.points.rankRows(rows, ctx.me.id)) gives you nextUp.
  // Your first name comes from PP.me (app.js sets it after sign in).
  function greetingHTML(title, nextUp) {
    const first = esc(String((PP.me && PP.me.display_name) || "").trim().split(/\s+/)[0] || "there");
    const hint = nextUp
      ? `<div class="next-up">🐊 <b>${nextUp.gap} ${nextUp.gap === 1 ? "pt" : "pts"}</b> until you pass ${esc(nextUp.name)}</div>`
      : `<div class="next-up">👑 You're <b>#1</b>. Stay hungry.</div>`;
    return `
      <div class="greeting">
        <div>
          <div class="hello">${timeGreeting()}, ${first}</div>
          <div class="big">${esc(title)}</div>
        </div>
        ${hint}
      </div>`;
  }

  // Round face with initials. { me: true } gives it the gold gradient.
  function avatarHTML(name, { me } = {}) {
    return `<div class="avatar ${me ? "me" : ""}">${esc(initials(name))}</div>`;
  }

  // Grey placeholder cards while a page loads
  function setLoading(root) {
    if (!root) return;
    root.innerHTML = `
      <div class="skeleton skeleton-title"></div>
      <div class="grid">
        <div class="card skeleton-card"><div class="skeleton"></div><div class="skeleton short"></div></div>
        <div class="card skeleton-card"><div class="skeleton"></div><div class="skeleton short"></div></div>
        <div class="card skeleton-card"><div class="skeleton"></div><div class="skeleton short"></div></div>
      </div>`;
  }

  // ---------- Light / dark mode (saved under "peakpulse-theme") ----------
  function currentTheme() {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  }
  function updateThemeButton() {
    // The button shows the mode you'd SWITCH TO
    const b = document.getElementById("themeBtn");
    if (b) b.textContent = currentTheme() === "dark" ? "☀️ Light" : "🌙 Dark";
  }
  function toggleTheme() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("peakpulse-theme", next); } catch (e) {}
    updateThemeButton();
  }

  PP.ui = {
    esc, initials, fmtWhen, sleep, toast, shrinkImage, timeGreeting,
    greetingHTML, avatarHTML, setLoading,
    currentTheme, updateThemeButton, toggleTheme,
  };
})();
