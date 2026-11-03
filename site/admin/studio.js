// AI photo studio: remove / replace / blur the background, adjust light and colour, add a dealer banner.
// Background removal runs in the browser with @imgly/background-removal (AGPL-3.0, source: github.com/imgly/background-removal-js).
// The AI model (~40 MB) downloads the first time it's used, then the browser caches it.

const W = 1600, H = 1067;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; });
let AI = null;
async function removeBg(blob, onProgress) {
  if (!AI) AI = await import("https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/+esm");
  return AI.removeBackground(blob, {
    progress: (key, cur, tot) => onProgress && tot && onProgress(key.includes("fetch") ? `Downloading the AI model (first time only)… ${Math.round((cur / tot) * 100)}%` : "Finding the car…"),
    output: { format: "image/png" },
  });
}

const BACKDROPS = {
  showroom: ["Showroom", null],
  studio: ["White studio", (x) => { let g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#ffffff"); g.addColorStop(0.62, "#eceae8"); g.addColorStop(0.63, "#dcd8d4"); g.addColorStop(1, "#f4f2f0"); x.fillStyle = g; x.fillRect(0, 0, W, H); }],
  grey: ["Grey studio", (x) => { const g = x.createRadialGradient(W / 2, H * 0.45, 50, W / 2, H * 0.5, W * 0.75); g.addColorStop(0, "#a7adb3"); g.addColorStop(1, "#33373b"); x.fillStyle = g; x.fillRect(0, 0, W, H); }],
  night: ["A & S night", (x) => { x.fillStyle = "#0d0b0b"; x.fillRect(0, 0, W, H); const g = x.createRadialGradient(W / 2, H * 0.45, 20, W / 2, H * 0.45, W * 0.55); g.addColorStop(0, "rgba(210,22,30,.45)"); g.addColorStop(1, "rgba(210,22,30,0)"); x.fillStyle = g; x.fillRect(0, 0, W, H); x.fillStyle = "#1c1616"; x.fillRect(0, H * 0.66, W, H); }],
  sky: ["Blue sky", (x) => { let g = x.createLinearGradient(0, 0, 0, H * 0.64); g.addColorStop(0, "#4f8fd8"); g.addColorStop(1, "#cfe3f6"); x.fillStyle = g; x.fillRect(0, 0, W, H); g = x.createLinearGradient(0, H * 0.64, 0, H); g.addColorStop(0, "#8d8f91"); g.addColorStop(1, "#5d5f61"); x.fillStyle = g; x.fillRect(0, H * 0.64, W, H); }],
  custom: ["Your own picture", null],
};

export function openStudio({ src, settings, price, onSave }) {
  const st = { mode: "none", backdrop: "showroom", center: true, bright: 100, contrast: 100, sat: 100, overlay: "none", showPrice: false };
  let orig = null, fg = null, fgBox = null, custom = null, showroom = null, logo = null, busy = false;
  const ov = document.createElement("div");
  ov.className = "studio";
  ov.innerHTML = `<div class="studio-pan" role="dialog" aria-modal="true" aria-label="Photo studio">
    <div class="studio-hd"><h2>✨ Photo studio</h2><button class="b sm" data-x type="button">Close</button></div>
    <div class="studio-body">
      <div class="studio-cv"><canvas width="${W}" height="${H}"></canvas><div class="studio-msg" hidden></div></div>
      <div class="studio-ctl">
        <div class="f"><label>Background</label><div class="seg" data-g="mode">${[["none", "Keep"], ["replace", "Replace (AI)"], ["blur", "Blur (AI)"]].map(([k, l]) => `<button type="button" data-k="${k}">${l}</button>`).join("")}</div></div>
        <div class="f" data-show="replace"><label>New background</label><div class="seg" data-g="backdrop">${Object.entries(BACKDROPS).map(([k, [l]]) => `<button type="button" data-k="${k}">${l}</button>`).join("")}</div>
          <input type="file" accept="image/*" data-custom hidden style="font-size:13px;margin-top:6px"><label class="chk" style="margin-top:6px"><input type="checkbox" data-center checked> Centre the car</label></div>
        <div class="f"><label>Light & colour</label>
          ${[["bright", "Brightness"], ["contrast", "Contrast"], ["sat", "Colour"]].map(([k, l]) => `<div class="studio-sl"><span>${l}</span><input type="range" min="60" max="150" value="100" data-sl="${k}"><b data-v="${k}">100</b></div>`).join("")}
          <button class="b sm" type="button" data-auto>✨ Auto enhance</button></div>
        <div class="f"><label>Banner</label><div class="seg" data-g="overlay">${[["none", "None"], ["logo", "Logo"], ["banner", "Dealer banner"]].map(([k, l]) => `<button type="button" data-k="${k}">${l}</button>`).join("")}</div>
          <label class="chk" style="margin-top:6px"><input type="checkbox" data-price> Show the price on the banner</label></div>
        <div class="studio-ft">
          <button class="b primary" type="button" data-save="img">Use as main photo</button>
          <button class="b" type="button" data-save="cut" title="The car without a background, for the home page animation">Use as cut-out</button>
          <button class="b" type="button" data-dl>Download</button>
        </div>
        <p class="hint">AI background removal runs on this computer. The first time, it downloads the AI model (about 40 MB), so give it a minute.</p>
      </div>
    </div></div>`;
  document.body.appendChild(ov); document.body.style.overflow = "hidden";
  const $ = (s) => ov.querySelector(s), $$ = (s) => [...ov.querySelectorAll(s)];
  const cv = $("canvas"), x = cv.getContext("2d");
  const msg = (t) => { $(".studio-msg").hidden = !t; $(".studio-msg").textContent = t || ""; };
  const close = () => { ov.remove(); document.body.style.overflow = ""; };
  $("[data-x]").onclick = close;
  ov.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  const cover = (img, w = W, h = H) => { const s = Math.max(w / img.width, h / img.height); return [(w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s]; };
  const filt = () => `brightness(${st.bright}%) contrast(${st.contrast}%) saturate(${st.sat}%)`;
  function bbox(img) {
    const c = document.createElement("canvas"), sc = Math.min(1, 400 / img.width); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
    const g = c.getContext("2d"); g.drawImage(img, 0, 0, c.width, c.height); const d = g.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) if (d[(y * c.width + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0) return { x: 0, y: 0, w: img.width, h: img.height };
    return { x: x0 / sc, y: y0 / sc, w: (x1 - x0 + 1) / sc, h: (y1 - y0 + 1) / sc };
  }
  function carRect() {
    if (st.mode === "replace" && st.center && fgBox) {
      const s = Math.min((W * 0.84) / fgBox.w, (H * 0.62) / fgBox.h), w = fgBox.w * s, h = fgBox.h * s;
      return { sx: fgBox.x, sy: fgBox.y, sw: fgBox.w, sh: fgBox.h, dx: (W - w) / 2, dy: H * 0.82 - h, dw: w, dh: h };
    }
    const [dx, dy, dw, dh] = cover(orig); return { sx: 0, sy: 0, sw: orig.width, sh: orig.height, dx, dy, dw, dh };
  }
  function draw() {
    if (!orig) return;
    x.save(); x.clearRect(0, 0, W, H); x.filter = "none";
    if (st.mode === "none" || !fg) {
      x.filter = filt(); x.drawImage(orig, ...cover(orig));
    } else {
      if (st.mode === "blur") { x.filter = filt() + " blur(14px)"; const [a, b, c, d] = cover(orig); x.drawImage(orig, a - 20, b - 20, c + 40, d + 40); }
      else if (st.backdrop === "custom" && custom) x.drawImage(custom, ...cover(custom));
      else if (st.backdrop === "showroom" && showroom) { x.filter = "blur(5px) brightness(80%)"; x.drawImage(showroom, ...cover(showroom)); }
      else (BACKDROPS[st.backdrop][1] || BACKDROPS.studio[1])(x);
      x.filter = "none";
      const r = carRect();
      if (st.mode === "replace") { // soft shadow under the car
        const sy = r.dy + (fgBox ? ((fgBox.y + fgBox.h - r.sy) / r.sh) * r.dh : r.dh) - 6, cx = r.dx + r.dw / 2;
        const g = x.createRadialGradient(cx, sy, 10, cx, sy, r.dw * 0.55); g.addColorStop(0, "rgba(0,0,0,.45)"); g.addColorStop(1, "rgba(0,0,0,0)");
        x.save(); x.translate(cx, sy); x.scale(1, 0.12); x.translate(-cx, -sy); x.fillStyle = g; x.fillRect(cx - r.dw, sy - r.dw, r.dw * 2, r.dw * 2); x.restore();
      }
      x.filter = filt(); x.drawImage(fg, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
    }
    x.filter = "none";
    if (st.overlay === "logo" && logo) { const h = 110, w = (logo.width / logo.height) * h; x.shadowColor = "rgba(0,0,0,.6)"; x.shadowBlur = 16; x.drawImage(logo, W - w - 36, 30, w, h); x.shadowBlur = 0; }
    if (st.overlay === "banner") {
      const bh = 120; x.fillStyle = "rgba(13,11,11,.86)"; x.fillRect(0, H - bh, W, bh); x.fillStyle = "#d2161e"; x.fillRect(0, H - bh, W, 6);
      let tx = 36; if (logo) { const h = 88, w = (logo.width / logo.height) * h; x.drawImage(logo, 30, H - bh + 18, w, h); tx = 30 + w + 24; }
      x.fillStyle = "#fff"; x.font = "800 44px 'Big Shoulders Display', Impact, sans-serif"; x.textBaseline = "middle"; x.fillText(String(settings.name || "").toUpperCase(), tx, H - bh / 2 - 16);
      x.font = "500 28px 'Barlow', Arial, sans-serif"; x.fillStyle = "#d8d1cc"; x.fillText([settings.phone, [settings.city, settings.state].filter(Boolean).join(", ")].filter(Boolean).join("  ·  "), tx, H - bh / 2 + 24);
      if (st.showPrice && price) { x.textAlign = "right"; x.fillStyle = "#f4a43a"; x.font = "900 72px 'Big Shoulders Display', Impact, sans-serif"; x.fillText("$" + Number(price).toLocaleString("en-US"), W - 36, H - bh / 2 + 4); x.textAlign = "left"; }
    }
    x.restore();
  }
  async function needFg() {
    if (fg || busy) return !!fg;
    busy = true; msg("Starting the AI…");
    try {
      const blob = await (await fetch(src)).blob();
      const out = await removeBg(blob, msg);
      fg = await loadImg(URL.createObjectURL(out)); fgBox = bbox(fg); msg(""); return true;
    } catch (e) { console.error(e); msg(""); alert("The AI background removal could not run (" + (e && e.message || "error") + "). Check your internet connection and try again."); return false; }
    finally { busy = false; }
  }
  const segSet = (g, k) => { st[g] = k; $$(`[data-g="${g}"] button`).forEach((b) => b.classList.toggle("on", b.dataset.k === k)); $$("[data-show]").forEach((el) => (el.hidden = el.dataset.show !== st.mode)); $("[data-custom]").hidden = st.backdrop !== "custom"; };
  $$("[data-g] button").forEach((b) => (b.onclick = async () => {
    const g = b.parentElement.dataset.g; const prev = st[g]; segSet(g, b.dataset.k);
    if (g === "mode" && b.dataset.k !== "none" && !(await needFg())) segSet("mode", prev === b.dataset.k ? "none" : prev);
    draw();
  }));
  $("[data-custom]").onchange = async (e) => { const f = e.target.files[0]; if (f) { custom = await loadImg(URL.createObjectURL(f)); draw(); } };
  $("[data-center]").onchange = (e) => { st.center = e.target.checked; draw(); };
  $("[data-price]").onchange = (e) => { st.showPrice = e.target.checked; draw(); };
  $$("[data-sl]").forEach((r) => (r.oninput = () => { st[r.dataset.sl] = +r.value; $(`[data-v="${r.dataset.sl}"]`).textContent = r.value; draw(); }));
  $("[data-auto]").onclick = () => { Object.assign(st, { bright: 106, contrast: 112, sat: 118 }); $$("[data-sl]").forEach((r) => { r.value = st[r.dataset.sl]; $(`[data-v="${r.dataset.sl}"]`).textContent = r.value; }); draw(); };
  const toBlob = (c, type = "image/webp", q = 0.9) => new Promise((r) => c.toBlob(r, type, q));
  $("[data-dl]").onclick = async () => { const a = document.createElement("a"); a.href = URL.createObjectURL(await toBlob(cv, "image/jpeg", 0.92)); a.download = "car-photo.jpg"; a.click(); };
  $$("[data-save]").forEach((b) => (b.onclick = async () => {
    const kind = b.dataset.save;
    let blob;
    if (kind === "cut") {
      if (!(await needFg())) return;
      const c = document.createElement("canvas"); c.width = Math.round(fgBox.w); c.height = Math.round(fgBox.h);
      const g = c.getContext("2d"); g.filter = filt(); g.drawImage(fg, fgBox.x, fgBox.y, fgBox.w, fgBox.h, 0, 0, c.width, c.height);
      blob = await toBlob(c, "image/png");
    } else blob = await toBlob(cv);
    b.disabled = true; b.textContent = "Saving…";
    try { await onSave(blob, kind); close(); } catch (e) { b.disabled = false; b.textContent = kind === "cut" ? "Use as cut-out" : "Use as main photo"; alert("Could not save the photo. Try again."); }
  }));
  segSet("mode", "none"); segSet("backdrop", "showroom"); segSet("overlay", "none");
  msg("Loading photo…");
  Promise.all([loadImg(src), loadImg("/img/showroom.webp").catch(() => null), loadImg("/img/logo.png").catch(() => null)])
    .then(([o, s, l]) => { orig = o; showroom = s; logo = l; msg(""); draw(); })
    .catch(() => msg("Could not load this photo."));
}
