// Live template previews: small thumbnails and a big preview with desktop / phone switch.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// demo link for a template; the original Night Lot only exists on the main site
export const demoUrl = (id, base = "") => (id === "night" ? base + "/?template=night" : `${base}/t/site.html?template=${id}&demo=1`);

export const GALLERY_CSS = `
.gthumb{position:relative;aspect-ratio:16/10;overflow:hidden;border-radius:6px;border:1px solid var(--line,#ddd);background:#eee;cursor:zoom-in}
.gthumb iframe{position:absolute;left:0;top:0;width:1280px;height:800px;border:0;transform-origin:0 0;pointer-events:none}
.gthumb .gcap{position:absolute;left:8px;bottom:8px;background:rgba(0,0,0,.72);color:#fff;font:600 12px/1 Arial,sans-serif;padding:6px 8px;border-radius:4px;opacity:0;transition:opacity .2s}
.gthumb:hover .gcap,.gthumb:focus-visible .gcap{opacity:1}
.gprev{position:fixed;inset:0;z-index:95;background:rgba(0,0,0,.8);display:flex;flex-direction:column;padding:12px;gap:10px}
.gprev .gbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:#fff;font:600 15px Arial,sans-serif}
.gprev .gbar b{font-size:18px;margin-right:auto}
.gprev .gbar button{font:600 14px Arial,sans-serif;padding:9px 14px;border-radius:6px;border:1px solid rgba(255,255,255,.4);background:transparent;color:#fff;cursor:pointer}
.gprev .gbar button.on{background:#fff;color:#111}
.gprev .gbar button.use{background:#d2161e;border-color:#d2161e}
.gprev .gstage{flex:1;display:grid;place-items:center;min-height:0}
.gprev iframe{background:#fff;border:0;border-radius:8px;width:100%;height:100%;transition:width .3s}
.gprev.phone iframe{width:390px;max-width:100%;height:min(100%,844px);border-radius:28px;box-shadow:0 0 0 10px #222}`;

let cssDone = false;
function ensureCss() { if (cssDone) return; cssDone = true; const s = document.createElement("style"); s.textContent = GALLERY_CSS; document.head.appendChild(s); }

// a thumbnail element; the page inside is loaded only when the thumbnail scrolls into view
export function thumb(url, label = "Click to preview") {
  ensureCss();
  return `<div class="gthumb" tabindex="0" role="button" data-gurl="${esc(url)}" aria-label="${esc(label)}"><div class="gcap">🔍 ${esc(label)}</div></div>`;
}
const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((es) => es.forEach((e) => {
  if (!e.isIntersecting) return; const el = e.target; io.unobserve(el);
  const f = document.createElement("iframe"); f.src = el.dataset.gurl; f.loading = "lazy"; f.tabIndex = -1; f.setAttribute("aria-hidden", "true"); f.title = "Template preview";
  const fit = () => (f.style.transform = `scale(${el.clientWidth / 1280})`); fit(); new ResizeObserver(fit).observe(el); el.prepend(f);
}), { rootMargin: "200px" }) : null;

// call after the thumbnails are in the page
export function bindThumbs(root, onOpen) {
  root.querySelectorAll(".gthumb").forEach((el) => {
    if (io && !el.dataset.obs) { el.dataset.obs = 1; io.observe(el); }
    el.onclick = () => onOpen(el.dataset.gurl);
    el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(el.dataset.gurl); } };
  });
}

// big preview. useLabel/onUse are optional ("Use this template")
export function openPreview(url, name, { onUse, useLabel = "Use this template", prev, next } = {}) {
  ensureCss();
  const ov = document.createElement("div"); ov.className = "gprev"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", name);
  ov.innerHTML = `<div class="gbar"><b>${esc(name)}</b>${prev ? '<button type="button" data-nav="prev">← Previous</button>' : ""}${next ? '<button type="button" data-nav="next">Next →</button>' : ""}
    <button type="button" class="on" data-dev="desk">🖥 Computer</button><button type="button" data-dev="phone">📱 Phone</button>
    <button type="button" data-open>Open in new tab ↗</button>${onUse ? `<button type="button" class="use" data-use>${esc(useLabel)}</button>` : ""}<button type="button" data-x>✕ Close</button></div>
    <div class="gstage"><iframe src="${esc(url)}" title="${esc(name)}"></iframe></div>`;
  document.body.appendChild(ov); document.body.style.overflow = "hidden";
  const close = () => { ov.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", key); };
  const key = (e) => { if (e.key === "Escape") close(); if (e.key === "ArrowRight" && next) { close(); next(); } if (e.key === "ArrowLeft" && prev) { close(); prev(); } };
  document.addEventListener("keydown", key);
  ov.querySelector("[data-x]").onclick = close;
  ov.querySelector("[data-open]").onclick = () => window.open(url, "_blank", "noopener");
  ov.querySelectorAll("[data-dev]").forEach((b) => (b.onclick = () => { ov.classList.toggle("phone", b.dataset.dev === "phone"); ov.querySelectorAll("[data-dev]").forEach((x) => x.classList.toggle("on", x === b)); }));
  if (onUse) ov.querySelector("[data-use]").onclick = () => { close(); onUse(); };
  ov.querySelectorAll("[data-nav]").forEach((b) => (b.onclick = () => { close(); (b.dataset.nav === "next" ? next : prev)(); }));
  ov.querySelector("[data-x]").focus();
}
