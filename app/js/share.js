// ============================================================
// PP.share: the "share to your story" card.
// After a workout we build a 1080x1920 Instagram Story image on a canvas.
// Phones: the Web Share API opens the share sheet (pick "Instagram Stories").
// Laptops: we just download the PNG.
// The workout photo lives ONLY in memory here. Never saved, never uploaded.
// ============================================================

window.PP = window.PP || {};

(function () {
  const W = 1080;
  const H = 1920;
  const PHOTO_H = Math.round(H * 0.62); // top 62% is the photo
  const LOGO_URL =
    "https://www.peakpulseclub.com/cdn/shop/files/white_text_peak_pulse_logo_with_sun.png?v=1750709848&width=600";
  const FILE_NAME = "peak-pulse-story.png";
  const FONT = '"Assistant", -apple-system, "Segoe UI", Roboto, sans-serif';

  let photoFile = null; // the workout photo (a File), memory only
  let selfieFile = null; // a selfie picked in the share window, memory only
  let logoPromise = null; // loaded once, reused
  let logoUsed = null; // "real" or "text", handy for debugging

  // ---------- Photo memory ----------
  function setPhoto(file) {
    photoFile = file || null;
  }
  function clearPhoto() {
    photoFile = null;
    selfieFile = null;
  }

  // ---------- Image loading helpers ----------

  // Turns a File into an <img>. Resolves null if it can't be read.
  function loadFileImage(file) {
    return new Promise((resolve) => {
      if (!file) return resolve(null);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  // Loads the Peak Pulse logo. crossOrigin lets us export the canvas later.
  // Resolves null if it fails or takes more than 5 seconds.
  function loadLogo() {
    if (!logoPromise) {
      logoPromise = new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        const timer = setTimeout(() => resolve(null), 5000);
        img.onload = () => { clearTimeout(timer); resolve(img); };
        img.onerror = () => { clearTimeout(timer); resolve(null); };
        img.src = LOGO_URL;
      });
    }
    return logoPromise;
  }

  // canvas.toBlob as a promise. Throws if the canvas is "tainted".
  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make the image"))), "image/png");
      } catch (e) {
        reject(e); // "Tainted canvases may not be exported"
      }
    });
  }

  // ---------- Drawing ----------

  // Draws img so it fills the box (x, y, w, h) with no stretching (like CSS cover)
  function drawCover(ctx, img, x, y, w, h) {
    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (img.width - sw) / 2;
    const sy = (img.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  // Shrinks the font until the text fits in maxW
  function fitFont(ctx, text, weight, size, maxW) {
    let s = size;
    ctx.font = `${weight} ${s}px ${FONT}`;
    while (ctx.measureText(text).width > maxW && s > 30) {
      s -= 4;
      ctx.font = `${weight} ${s}px ${FONT}`;
    }
    return s;
  }

  // Text logo used when the real logo can't load: "peak pulse" + orange sun
  function drawTextLogo(ctx, x, y) {
    ctx.fillStyle = "#ff6a00";
    ctx.beginPath();
    ctx.arc(x + 34, y + 34, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 64px ${FONT}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText("peak pulse", x + 88, y + 36);
    ctx.textBaseline = "alphabetic";
  }

  // The caption people paste with their story
  function captionFor(info) {
    const rank = Number(info.rank) || 0;
    return rank
      ? `Just chomped my way to #${rank} on the Peak Pulse leaderboard 🐊 Join me on GatorFit @peakpulsegville`
      : `Just chomped my way up the Peak Pulse leaderboard 🐊 Join me on GatorFit @peakpulsegville`;
  }

  // Draws the whole story graphic. logoImg = null draws the text logo instead.
  // Layout: logo on top, framed photo (tilted like a polaroid), orange rank sticker,
  // then "Just chomped my way to #12 on the leaderboard".
  function drawStory(canvas, info, photoImg, logoImg) {
    const ctx = canvas.getContext("2d");
    const pts = Math.max(0, Number(info.to) - Number(info.from)) || 0;
    const n = Number(info.passedCount) || 0;
    const rank = Number(info.rank) || 0;

    // 1. Background: Peak Pulse black with an orange sun glow
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W * 0.85, H * 0.95, 50, W * 0.85, H * 0.95, 1100);
    glow.addColorStop(0, "rgba(255,106,0,0.55)");
    glow.addColorStop(1, "rgba(255,106,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    const glow2 = ctx.createRadialGradient(W * 0.1, 120, 20, W * 0.1, 120, 700);
    glow2.addColorStop(0, "rgba(255,176,0,0.25)");
    glow2.addColorStop(1, "rgba(255,176,0,0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, W, H);

    // 2. Logo, centered at the top
    if (logoImg) {
      const lw = 360;
      const lh = Math.round((logoImg.height / logoImg.width) * lw) || 120;
      ctx.drawImage(logoImg, (W - lw) / 2, 70, lw, lh);
    } else {
      drawTextLogo(ctx, W / 2 - 230, 90);
    }

    // 3. The framed photo, tilted a little like a polaroid
    const FW = 860, FH = 1000, FX = (W - FW) / 2, FY = 330, BORDER = 22;
    ctx.save();
    ctx.translate(FX + FW / 2, FY + FH / 2);
    ctx.rotate((-2.5 * Math.PI) / 180);
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-FW / 2, -FH / 2, FW, FH + 70); // white frame, thicker at the bottom
    ctx.shadowColor = "transparent";
    const px = -FW / 2 + BORDER, py = -FH / 2 + BORDER, pw = FW - BORDER * 2, ph = FH - BORDER * 2;
    if (photoImg) {
      drawCover(ctx, photoImg, px, py, pw, ph);
    } else {
      const g = ctx.createLinearGradient(px, py, px + pw, py + ph);
      g.addColorStop(0, "#ff6a00");
      g.addColorStop(1, "#ffb000");
      ctx.fillStyle = g;
      ctx.fillRect(px, py, pw, ph);
      ctx.font = `380px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🐊", 0, 10);
      ctx.textBaseline = "alphabetic";
    }
    // handwritten-style label on the polaroid's bottom strip
    ctx.fillStyle = "#121212";
    ctx.textAlign = "center";
    ctx.font = `700 40px ${FONT}`;
    const tag = info.houseName ? `${info.houseName} · +${pts} pts` : `+${pts} pts`;
    ctx.fillText(tag, 0, FH / 2 + 40);
    ctx.restore();

    // 4. Orange rank sticker over the top-right corner of the photo
    if (rank) {
      const cx = FX + FW - 40, cy = FY + 40, r = 125;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((10 * Math.PI) / 180);
      ctx.fillStyle = "#ff6a00";
      ctx.beginPath();
      // sun-like sticker: circle with little rays
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2;
        const rr = i % 2 === 0 ? r : r - 14;
        ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      fitFont(ctx, `#${rank}`, 800, 96, 190);
      ctx.fillText(`#${rank}`, 0, 22);
      ctx.font = `700 26px ${FONT}`;
      ctx.fillText("ON THE BOARD", 0, 62);
      ctx.restore();
    }

    // 5. The headline
    ctx.textAlign = "center";
    const x = W / 2;
    const maxW = W - 120;
    let y = FY + FH + 190;
    ctx.fillStyle = "#ffffff";
    fitFont(ctx, "Just chomped my way to", 600, 68, maxW);
    ctx.fillText("Just chomped my way to", x, y);

    y += 125;
    const big = rank ? `#${rank} on the leaderboard 🐊` : "the top of the board 🐊";
    fitFont(ctx, big, 800, 104, maxW);
    ctx.fillStyle = "#ff6a00";
    ctx.fillText(big, x, y);

    y += 80;
    const sub = "Join me on GatorFit";
    fitFont(ctx, sub, 800, 56, maxW);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(sub, x, y);

    // 6. Footer
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    const foot = "GatorFit x @peakpulsegville · Where movement meets momentum";
    fitFont(ctx, foot, 600, 34, maxW);
    ctx.fillText(foot, x, H - 90);
    ctx.textAlign = "left";
  }

  // Builds the story and returns a PNG File named peak-pulse-story.png
  async function makeStoryImage(info) {
    info = info || {};
    try { await document.fonts.ready; } catch (e) {}
    // Make sure the Assistant weights we use are loaded before drawing
    try {
      await Promise.all([
        document.fonts.load(`800 120px "Assistant"`),
        document.fonts.load(`600 50px "Assistant"`),
      ]);
    } catch (e) {}

    const [photoImg, logoImg] = await Promise.all([loadFileImage(selfieFile || photoFile), loadLogo()]);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;

    let blob;
    drawStory(canvas, info, photoImg, logoImg);
    try {
      blob = await canvasToBlob(canvas);
      logoUsed = logoImg ? "real" : "text";
    } catch (e) {
      // The remote logo tainted the canvas. Redraw with the text logo and try again.
      drawStory(canvas, info, photoImg, null);
      blob = await canvasToBlob(canvas);
      logoUsed = "text";
    }
    return new File([blob], FILE_NAME, { type: "image/png" });
  }

  // Saves the file through a hidden <a download>
  function download(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = FILE_NAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    PP.ui.toast("Saved. Post it to your story 📲");
  }

  // Phones: share sheet. Laptops: download. Pass a ready File to skip rebuilding.
  async function share(info, readyFile) {
    const file = readyFile || (await makeStoryImage(info));
    const canShare = navigator.canShare && navigator.share && navigator.canShare({ files: [file] });
    if (canShare) {
      try {
        await navigator.share({ files: [file], title: "Peak Pulse", text: captionFor(info || {}) });
      } catch (e) {
        if (e && e.name === "AbortError") return; // they closed the share sheet, that's fine
        download(file); // share failed for another reason, give them the file instead
      }
      return;
    }
    download(file);
  }

  // ---------- The modal ----------
  function close(modal) {
    const img = modal.querySelector("img.share-preview");
    if (img && img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
    modal.remove();
    document.removeEventListener("keydown", modal._onKey);
  }

  function open(info, opts) {
    opts = opts || {};
    const rank = Number(info && info.rank) || 0;
    const title = opts.prompt
      ? (rank ? `🐊 You moved up to #${rank}! Post it?` : "🐊 You moved up! Post it?")
      : "Share to your story";
    const old = document.getElementById("shareModal");
    if (old) close(old);

    const modal = document.createElement("div");
    modal.id = "shareModal";
    modal.className = "share-modal";
    modal.innerHTML = `
      <div class="share-panel" role="dialog" aria-modal="true" aria-label="Share to your story">
        <div class="share-title">${PP.ui.esc(title)}</div>
        ${opts.prompt ? `<div class="muted share-sub">Add a pic of yourself and post it to your story.</div>` : ""}
        <div class="share-frame"><div class="share-loading">Making your story...</div></div>
        <label class="btn share-selfie ${opts.prompt ? "btn-primary" : ""}">🤳 ${opts.prompt ? "Add a pic of yourself" : "Use a selfie instead"}
          <input type="file" accept="image/*" capture="user" hidden />
        </label>
        <div class="share-caption">
          <div class="share-caption-text">${PP.ui.esc(captionFor(info || {}))}</div>
          <button class="btn btn-small share-copy" type="button">Copy caption</button>
        </div>
        <div class="share-actions">
          <button class="btn btn-primary share-go" data-action="lb-share-go" disabled>Share to story</button>
          <a class="share-dl" href="#" download="${FILE_NAME}" aria-disabled="true">Download</a>
          <button class="btn share-close" data-action="lb-share-close">${opts.prompt ? "Not now" : "Close"}</button>
        </div>
        <div class="muted share-hint">On your phone: tap Share, then Instagram, then Story.</div>
      </div>`;
    document.body.appendChild(modal);

    let file = null;
    const goBtn = modal.querySelector(".share-go");
    const dl = modal.querySelector(".share-dl");

    // Our own listeners, so app.js routing is never needed
    modal.addEventListener("click", async (e) => {
      const el = e.target.closest("[data-action], .share-dl");
      if (e.target === modal) { e.stopPropagation(); return close(modal); } // click outside the panel
      if (!el) return;
      e.stopPropagation(); // keep it away from app.js page routing
      const action = el.dataset.action;
      if (action === "lb-share-close") return close(modal);
      if (action === "lb-share-go") {
        if (!file) return;
        goBtn.disabled = true;
        try { await share(info, file); } finally { goBtn.disabled = false; }
        return;
      }
      if (el.classList.contains("share-dl")) {
        e.preventDefault();
        if (file) download(file);
      }
    });
    modal._onKey = (e) => { if (e.key === "Escape") close(modal); };
    document.addEventListener("keydown", modal._onKey);

    // Draws (or redraws) the preview
    function build() {
      goBtn.disabled = true;
      dl.setAttribute("aria-disabled", "true");
      const frame = modal.querySelector(".share-frame");
      const oldImg = frame.querySelector("img.share-preview");
      if (oldImg && oldImg.src.startsWith("blob:")) URL.revokeObjectURL(oldImg.src);
      frame.innerHTML = `<div class="share-loading">Making your story...</div>`;
      makeStoryImage(info)
        .then((f) => {
          if (!modal.isConnected) return;
          file = f;
          frame.innerHTML = `<img class="share-preview" alt="Your Peak Pulse story" src="${URL.createObjectURL(f)}" />`;
          goBtn.disabled = false;
          dl.removeAttribute("aria-disabled");
        })
        .catch((err) => {
          console.error(err);
          if (!modal.isConnected) return;
          frame.innerHTML = `<div class="share-loading">Couldn't make the image. Try again.</div>`;
        });
    }

    // Selfie picker: swaps the photo in the frame (kept in memory only)
    const selfieInput = modal.querySelector(".share-selfie input");
    selfieInput.addEventListener("change", (e) => {
      e.stopPropagation();
      const f = selfieInput.files && selfieInput.files[0];
      if (!f || !/^image\//.test(f.type)) return PP.ui.toast("Pick a photo");
      selfieFile = f;
      modal.querySelector(".share-selfie").firstChild.textContent = "🤳 Selfie added (tap to change) ";
      build();
    });

    // Copy the caption so they can paste it on the story
    modal.querySelector(".share-copy").addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(captionFor(info || {}));
        PP.ui.toast("Caption copied 📋");
      } catch (err) {
        PP.ui.toast("Couldn't copy. Hold down on the text to copy it.");
      }
    });

    build();
  }

  PP.share = {
    setPhoto, clearPhoto, makeStoryImage, share, open, captionFor,
    get logoUsed() { return logoUsed; },
  };
})();
