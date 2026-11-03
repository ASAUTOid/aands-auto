// AI photo studio: remove / replace / blur the background, background library (ours + the dealer's own),
// realistic placement (shadow, reflection, light matching), licence-plate cover, light & colour, dealer banner.
// Also used for bulk edits (processPhoto). Background removal runs in the browser with
// @imgly/background-removal (AGPL-3.0, source: github.com/imgly/background-removal-js); the AI model (~40 MB)
// downloads the first time, then the browser keeps it.
import { BACKGROUNDS } from "./backgrounds.js";

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
function bbox(img) {
  const c = document.createElement("canvas"), sc = Math.min(1, 400 / img.width); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
  const g = c.getContext("2d"); g.drawImage(img, 0, 0, c.width, c.height); const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 <= x0 ? { x: 0, y: 0, w: img.width, h: img.height } : { x: x0 / sc, y: y0 / sc, w: (x1 - x0 + 1) / sc, h: (y1 - y0 + 1) / sc };
}
function avgColor(img) {
  const c = document.createElement("canvas"); c.width = 24; c.height = 16; const g = c.getContext("2d"); g.drawImage(img, 0, 0, 24, 16);
  const d = g.getImageData(0, 0, 24, 16).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; } const n = d.length / 4;
  return `rgb(${Math.round(r / n)},${Math.round(gg / n)},${Math.round(b / n)})`;
}
const cover = (img, w = W, h = H) => { const s = Math.max(w / img.width, h / img.height); return [(w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s]; };

// ---------- the renderer (used by the editor and by bulk edits) ----------
// A = { orig, fg, fgBox, bg, bgMeta, logo, settings, price }   st = options
function carRect(A, st) {
  if (st.mode === "replace" && A.fg) {
    const b = A.fgBox, base = Math.min((W * 0.8) / b.w, (H * 0.6) / b.h), s = base * (st.scale / 100), w = b.w * s, h = b.h * s;
    const floorY = H * ((A.bgMeta && A.bgMeta.floor) || 0.84) + st.offY;
    return { sx: b.x, sy: b.y, sw: b.w, sh: b.h, dx: (W - w) / 2 + st.offX, dy: floorY - h, dw: w, dh: h };
  }
  const [dx, dy, dw, dh] = cover(A.orig); return { sx: 0, sy: 0, sw: A.orig.width, sh: A.orig.height, dx, dy, dw, dh };
}
const filt = (st) => `brightness(${st.bright}%) contrast(${st.contrast}%) saturate(${st.sat}%)`;
export function render(cv, A, st) {
  const x = cv.getContext("2d"); x.save(); x.clearRect(0, 0, W, H);
  const r = carRect(A, st);
  if (st.mode === "none" || !A.fg) { x.filter = filt(st); x.drawImage(A.orig, ...cover(A.orig)); x.filter = "none"; }
  else {
    if (st.mode === "blur") { x.filter = filt(st) + " blur(16px)"; const [a, b, c, d] = cover(A.orig); x.drawImage(A.orig, a - 24, b - 24, c + 48, d + 48); }
    else if (A.bg) x.drawImage(A.bg, ...cover(A.bg));
    else { x.fillStyle = "#eceae8"; x.fillRect(0, 0, W, H); }
    x.filter = "none";
    const car = document.createElement("canvas"); car.width = W; car.height = H; const c2 = car.getContext("2d");
    c2.filter = filt(st); c2.drawImage(A.fg, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh); c2.filter = "none";
    if (st.mode === "replace" && st.matchLight && A.bg) { c2.globalCompositeOperation = "source-atop"; c2.globalAlpha = 0.14; c2.fillStyle = avgColor(A.bg); c2.fillRect(0, 0, W, H); c2.globalAlpha = 1; c2.globalCompositeOperation = "source-over"; }
    if (st.mode === "replace") {
      const ground = r.dy + r.dh, cx = r.dx + r.dw / 2;
      if (st.reflect && A.bgMeta && A.bgMeta.reflect) { // mirror image on a glossy floor, fading out
        const rf = document.createElement("canvas"); rf.width = W; rf.height = H; const g = rf.getContext("2d");
        g.translate(0, ground * 2); g.scale(1, -1); g.drawImage(car, 0, 0); g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = "destination-in"; const fade = g.createLinearGradient(0, ground, 0, ground + r.dh * 0.45); fade.addColorStop(0, "rgba(0,0,0,.28)"); fade.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = fade; g.fillRect(0, 0, W, H);
        x.drawImage(rf, 0, 0);
      }
      if (st.shadow) { // soft wide shadow + tight contact shadow under the tyres
        for (const [ry, a, spread] of [[0.11, 0.38, 0.62], [0.035, 0.6, 0.5]]) {
          const g = x.createRadialGradient(cx, ground, 4, cx, ground, r.dw * spread); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, "rgba(0,0,0,0)");
          x.save(); x.translate(cx, ground); x.scale(1, ry); x.translate(-cx, -ground); x.fillStyle = g; x.fillRect(cx - r.dw, ground - r.dw, r.dw * 2, r.dw * 2); x.restore();
        }
      }
    }
    x.drawImage(car, 0, 0);
  }
  // licence plate cover (stored in the original photo's coordinates so it follows the car)
  if (st.plate) {
    const p = st.plate, k = r.dw / r.sw, px = r.dx + (p.x - r.sx) * k, py = r.dy + (p.y - r.sy) * k, pw = p.w * k, ph = p.h * k;
    x.save();
    if (st.plateStyle === "blur") { x.beginPath(); x.rect(px, py, pw, ph); x.clip(); x.filter = "blur(10px)"; x.drawImage(cv, px - 20, py - 20, pw + 40, ph + 40, px - 20, py - 20, pw + 40, ph + 40); x.filter = "none"; }
    else {
      const rr = Math.min(pw, ph) * 0.14; x.beginPath(); x.roundRect ? x.roundRect(px, py, pw, ph, rr) : x.rect(px, py, pw, ph);
      x.fillStyle = st.plateStyle === "dark" ? "#111" : "#fff"; x.fill(); x.lineWidth = Math.max(1.5, ph * 0.06); x.strokeStyle = st.plateStyle === "dark" ? "#444" : "#c8141b"; x.stroke();
      x.fillStyle = st.plateStyle === "dark" ? "#fff" : "#111"; x.textAlign = "center"; x.textBaseline = "middle";
      const name = String(A.settings.name || "").toUpperCase();
      let fs = ph * 0.42; x.font = `800 ${fs}px Arial, sans-serif`; while (x.measureText(name).width > pw * 0.9 && fs > 6) { fs -= 1; x.font = `800 ${fs}px Arial, sans-serif`; }
      x.fillText(name, px + pw / 2, py + ph * (A.settings.phone ? 0.4 : 0.52));
      if (A.settings.phone) { x.font = `600 ${Math.max(6, ph * 0.22)}px Arial, sans-serif`; x.fillText(A.settings.phone, px + pw / 2, py + ph * 0.78); }
    }
    x.restore();
  }
  if (st.overlay === "logo" && A.logo) { const h = 110, w = (A.logo.width / A.logo.height) * h; x.shadowColor = "rgba(0,0,0,.6)"; x.shadowBlur = 16; x.drawImage(A.logo, W - w - 36, 30, w, h); x.shadowBlur = 0; }
  if (st.overlay === "banner") {
    const bh = 120; x.fillStyle = "rgba(13,11,11,.86)"; x.fillRect(0, H - bh, W, bh); x.fillStyle = st.bannerColor || "#d2161e"; x.fillRect(0, H - bh, W, 6);
    let tx = 36; if (A.logo) { const h = 88, w = (A.logo.width / A.logo.height) * h; x.drawImage(A.logo, 30, H - bh + 18, w, h); tx = 30 + w + 24; }
    x.textAlign = "left"; x.fillStyle = "#fff"; x.font = "800 44px 'Big Shoulders Display', Impact, sans-serif"; x.textBaseline = "middle"; x.fillText(String(A.settings.name || "").toUpperCase(), tx, H - bh / 2 - 16);
    x.font = "500 28px 'Barlow', Arial, sans-serif"; x.fillStyle = "#d8d1cc"; x.fillText([A.settings.phone, [A.settings.city, A.settings.state].filter(Boolean).join(", ")].filter(Boolean).join("  ·  "), tx, H - bh / 2 + 24);
    if (st.showPrice && A.price) { x.textAlign = "right"; x.fillStyle = "#f4a43a"; x.font = "900 72px 'Big Shoulders Display', Impact, sans-serif"; x.fillText("$" + Number(A.price).toLocaleString("en-US"), W - 36, H - bh / 2 + 4); }
  }
  x.restore();
  return r;
}
export const DEFAULTS = { mode: "replace", bgId: "lux-showroom", scale: 100, offX: 0, offY: 0, shadow: true, reflect: true, matchLight: true, bright: 100, contrast: 100, sat: 100, overlay: "none", showPrice: false, plate: null, plateStyle: "dealer" };
async function bgFor(st, library) {
  const meta = BACKGROUNDS.find((b) => b.id === st.bgId) || (library || []).find((b) => b.id === st.bgId);
  if (!meta) return { bg: null, bgMeta: null };
  return { bg: await loadImg(meta.url), bgMeta: meta };
}
const blobOf = (cv, type = "image/webp", q = 0.9) => new Promise((r) => cv.toBlob(r, type, q));

// Bulk: process one photo with the given options, returns a webp Blob
export async function processPhoto(src, opts, settings, price, library, onProgress) {
  const st = { ...DEFAULTS, ...opts, plate: null };
  const orig = await loadImg(src);
  const A = { orig, settings, price, logo: await loadImg(settings.logo || "/img/logo.png").catch(() => null), ...(await bgFor(st, library)) };
  if (st.mode !== "none") { const out = await removeBg(await (await fetch(src)).blob(), onProgress); A.fg = await loadImg(URL.createObjectURL(out)); A.fgBox = bbox(A.fg); }
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; render(cv, A, st);
  return blobOf(cv);
}

// ---------- the editor ----------
// opts: { src, settings, price, onSave(blob, kind), library: [{id,name,url,thumb,floor,reflect,cat}], onAddBackground(file) -> Promise<entry> }
export function openStudio({ src, settings, price, onSave, library = [], onAddBackground }) {
  const st = { ...DEFAULTS, mode: "none" };
  const A = { orig: null, fg: null, fgBox: null, bg: null, bgMeta: null, logo: null, settings, price };
  let busy = false, drawing = null, lib = library.slice();
  const ov = document.createElement("div"); ov.className = "studio";
  const allBgs = () => [...BACKGROUNDS, ...lib];
  ov.innerHTML = `<div class="studio-pan" role="dialog" aria-modal="true" aria-label="Photo studio">
    <div class="studio-hd"><h2>✨ Photo studio</h2><button class="b sm" data-x type="button">Close</button></div>
    <div class="studio-body">
      <div><div class="studio-cv"><canvas width="${W}" height="${H}"></canvas><div class="studio-msg" hidden></div></div>
        <p class="hint" data-platehint hidden style="margin-top:8px">Drag a box over the licence plate on the photo.</p></div>
      <div class="studio-ctl">
        <div class="f"><label>Background</label><div class="seg" data-g="mode">${[["none", "Keep"], ["replace", "Replace (AI)"], ["blur", "Blur (AI)"]].map(([k, l]) => `<button type="button" data-k="${k}">${l}</button>`).join("")}</div></div>
        <div data-show="replace"><div class="f"><label>Choose a background</label><div class="bg-grid" data-bgs></div>
          <label class="b sm" style="margin-top:8px;cursor:pointer">+ Upload your own background<input type="file" accept="image/*" data-up hidden></label></div>
          <div class="f" style="margin-top:10px"><label>Car position</label>
            <div class="studio-sl"><span>Size</span><input type="range" min="60" max="125" value="100" data-sl="scale"><b data-v="scale">100</b></div>
            <div class="studio-sl"><span>Left / right</span><input type="range" min="-300" max="300" value="0" data-sl="offX"><b data-v="offX">0</b></div>
            <div class="studio-sl"><span>Up / down</span><input type="range" min="-200" max="150" value="0" data-sl="offY"><b data-v="offY">0</b></div></div>
          <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px"><label class="chk"><input type="checkbox" data-c="shadow" checked> Shadow</label><label class="chk"><input type="checkbox" data-c="reflect" checked> Floor reflection</label><label class="chk"><input type="checkbox" data-c="matchLight" checked> Match the light</label></div></div>
        <div class="f"><label>Licence plate</label><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="b sm" type="button" data-plate>🔲 Cover the plate</button><button class="b sm" type="button" data-noplate hidden>Remove cover</button></div>
          <div class="seg" data-g="plateStyle" style="margin-top:6px">${[["dealer", "Dealer plate"], ["dark", "Black plate"], ["blur", "Blur"]].map(([k, l]) => `<button type="button" data-k="${k}">${l}</button>`).join("")}</div></div>
        <div class="f"><label>Light & colour</label>
          ${[["bright", "Brightness"], ["contrast", "Contrast"], ["sat", "Colour"]].map(([k, l]) => `<div class="studio-sl"><span>${l}</span><input type="range" min="60" max="150" value="100" data-sl="${k}"><b data-v="${k}">100</b></div>`).join("")}
          <button class="b sm" type="button" data-auto>✨ Auto enhance</button></div>
        <div class="f"><label>Banner</label><div class="seg" data-g="overlay">${[["none", "None"], ["logo", "Logo"], ["banner", "Dealer banner"]].map(([k, l]) => `<button type="button" data-k="${k}">${l}</button>`).join("")}</div>
          <label class="chk" style="margin-top:6px"><input type="checkbox" data-c="showPrice"> Show the price on the banner</label></div>
        <div class="studio-ft"><button class="b primary" type="button" data-save="img">Save photo</button><button class="b" type="button" data-save="cut">Use as cut-out (animation)</button><button class="b" type="button" data-dl>Download</button></div>
        <p class="hint">The AI runs on this computer. The first time it downloads its model (about 40 MB), so give it a minute.</p>
      </div></div></div>`;
  document.body.appendChild(ov); document.body.style.overflow = "hidden";
  const $ = (s) => ov.querySelector(s), $$ = (s) => [...ov.querySelectorAll(s)];
  const cv = $("canvas");
  const msg = (t) => { $(".studio-msg").hidden = !t; $(".studio-msg").textContent = t || ""; };
  const close = () => { ov.remove(); document.body.style.overflow = ""; };
  $("[data-x]").onclick = close;
  let lastRect = null;
  const draw = () => { if (A.orig) lastRect = render(cv, A, st); };
  const drawBgs = () => {
    $("[data-bgs]").innerHTML = ["Inside", "Studio", "Outside", "Yours"].map((cat) => { const xs = allBgs().filter((b) => (b.cat || "Yours") === cat); return xs.length ? `<div class="bg-cat">${cat === "Yours" ? "Your backgrounds" : cat}</div>
      <div class="bg-row">${xs.map((b) => `<button type="button" class="bg-it ${st.bgId === b.id ? "on" : ""}" data-bg="${esc(b.id)}" title="${esc(b.name)}"><img src="${esc(b.thumb || b.url)}" alt="" loading="lazy"><span>${esc(b.name)}</span></button>`).join("")}</div>` : ""; }).join("");
    $$("[data-bg]").forEach((b) => (b.onclick = async () => { st.bgId = b.dataset.bg; drawBgs(); Object.assign(A, await bgFor(st, lib)); st.reflect = !!(A.bgMeta && A.bgMeta.reflect); $('[data-c="reflect"]').checked = st.reflect; draw(); }));
  };
  async function needFg() {
    if (A.fg || busy) return !!A.fg;
    busy = true; msg("Starting the AI…");
    try { const out = await removeBg(await (await fetch(src)).blob(), msg); A.fg = await loadImg(URL.createObjectURL(out)); A.fgBox = bbox(A.fg); msg(""); return true; }
    catch (e) { console.error(e); msg(""); alert("The AI background removal could not run (" + ((e && e.message) || "error") + "). Check your internet connection and try again."); return false; }
    finally { busy = false; }
  }
  const segSet = (g, k) => { st[g] = k; $$(`[data-g="${g}"] button`).forEach((b) => b.classList.toggle("on", b.dataset.k === k)); $$("[data-show]").forEach((el) => (el.hidden = el.dataset.show !== st.mode)); };
  $$("[data-g] button").forEach((b) => (b.onclick = async () => { const g = b.parentElement.dataset.g, prev = st[g]; segSet(g, b.dataset.k);
    if (g === "mode" && b.dataset.k !== "none") { if (!(await needFg())) segSet("mode", prev === b.dataset.k ? "none" : prev); else if (b.dataset.k === "replace" && !A.bg) Object.assign(A, await bgFor(st, lib)); }
    draw(); }));
  $$("[data-sl]").forEach((r) => (r.oninput = () => { st[r.dataset.sl] = +r.value; $(`[data-v="${r.dataset.sl}"]`).textContent = r.value; draw(); }));
  $$("[data-c]").forEach((c) => (c.onchange = () => { st[c.dataset.c] = c.checked; draw(); }));
  $("[data-auto]").onclick = () => { Object.assign(st, { bright: 106, contrast: 112, sat: 118 }); ["bright", "contrast", "sat"].forEach((k) => { $(`[data-sl="${k}"]`).value = st[k]; $(`[data-v="${k}"]`).textContent = st[k]; }); draw(); };
  $("[data-up]").onchange = async (e) => { const f = e.target.files[0]; if (!f) return;
    try { msg("Uploading your background…"); const entry = onAddBackground ? await onAddBackground(f) : { id: "tmp" + Date.now(), name: f.name, url: URL.createObjectURL(f), cat: "Yours", floor: 0.86 };
      lib.push(entry); st.bgId = entry.id; drawBgs(); Object.assign(A, await bgFor(st, lib)); msg(""); draw(); } catch (_) { msg(""); alert("Could not upload the background."); } };
  // licence plate: drag a box on the photo
  const toCanvas = (ev) => { const b = cv.getBoundingClientRect(), p = ev.touches ? ev.touches[0] : ev; return [((p.clientX - b.left) / b.width) * W, ((p.clientY - b.top) / b.height) * H]; };
  $("[data-plate]").onclick = () => { drawing = { on: true }; $("[data-platehint]").hidden = false; cv.style.cursor = "crosshair"; };
  $("[data-noplate]").onclick = () => { st.plate = null; $("[data-noplate]").hidden = true; draw(); };
  const down = (ev) => { if (!drawing || !drawing.on) return; ev.preventDefault(); drawing.a = toCanvas(ev); };
  const move = (ev) => { if (!drawing || !drawing.a) return; ev.preventDefault(); drawing.b = toCanvas(ev); draw();
    const g = cv.getContext("2d"), [x1, y1] = drawing.a, [x2, y2] = drawing.b; g.save(); g.strokeStyle = "#f4a43a"; g.lineWidth = 4; g.setLineDash([12, 8]); g.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)); g.restore(); };
  const up = () => { if (!drawing || !drawing.a || !drawing.b || !lastRect) { return; }
    const [x1, y1] = drawing.a, [x2, y2] = drawing.b, r = lastRect, k = r.sw / r.dw;
    if (Math.abs(x2 - x1) > 8 && Math.abs(y2 - y1) > 4) { st.plate = { x: r.sx + (Math.min(x1, x2) - r.dx) * k, y: r.sy + (Math.min(y1, y2) - r.dy) * k, w: Math.abs(x2 - x1) * k, h: Math.abs(y2 - y1) * k }; $("[data-noplate]").hidden = false; }
    drawing = null; cv.style.cursor = ""; $("[data-platehint]").hidden = true; draw(); };
  cv.addEventListener("mousedown", down); cv.addEventListener("mousemove", move); window.addEventListener("mouseup", up, { once: false });
  cv.addEventListener("touchstart", down, { passive: false }); cv.addEventListener("touchmove", move, { passive: false }); cv.addEventListener("touchend", up);
  $("[data-dl]").onclick = async () => { const a = document.createElement("a"); a.href = URL.createObjectURL(await blobOf(cv, "image/jpeg", 0.92)); a.download = "car-photo.jpg"; a.click(); };
  $$("[data-save]").forEach((b) => (b.onclick = async () => {
    const kind = b.dataset.save; let blob;
    if (kind === "cut") {
      if (!(await needFg())) return;
      const c = document.createElement("canvas"); c.width = Math.round(A.fgBox.w); c.height = Math.round(A.fgBox.h);
      const g = c.getContext("2d"); g.filter = filt(st); g.drawImage(A.fg, A.fgBox.x, A.fgBox.y, A.fgBox.w, A.fgBox.h, 0, 0, c.width, c.height); blob = await blobOf(c, "image/png");
    } else blob = await blobOf(cv);
    const label = b.textContent; b.disabled = true; b.textContent = "Saving…";
    try { await onSave(blob, kind); window.removeEventListener("mouseup", up); close(); } catch (e) { b.disabled = false; b.textContent = label; alert("Could not save the photo. Try again."); }
  }));
  segSet("mode", "none"); segSet("overlay", "none"); segSet("plateStyle", "dealer"); drawBgs();
  msg("Loading photo…");
  Promise.all([loadImg(src), loadImg(settings.logo || "/img/logo.png").catch(() => null)])
    .then(([o, l]) => { A.orig = o; A.logo = l; msg(""); draw(); })
    .catch(() => msg("Could not load this photo."));
}
