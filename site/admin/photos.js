// Photos of one car (main photo + more photos) and the bulk background changer. Shared by the main dashboard and the dealer admin.
import { openStudio, processPhoto, DEFAULTS } from "./studio.js";
import { openAIScene } from "./aiscene.js";
import { BACKGROUNDS } from "./backgrounds.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const allPhotos = (c) => [c.img, ...(c.photos || [])].filter(Boolean);

// env: { upload(blobOrFile, max) -> url, settings(), library(), addBackground(file) -> entry, toast(msg, err) }
export function photosBox(el, car, env, onChange) {
  const draw = () => {
    const ps = allPhotos(car);
    el.innerHTML = `<div class="ph-grid">${ps.map((u, i) => `<div class="ph-it"><img src="${esc(u)}" alt="">${i === 0 ? '<span class="ph-main">Main photo</span>' : ""}
      <div class="ph-act"><button class="b sm primary" type="button" data-st="${i}" title="AI photo studio">✨ Studio</button><button class="b sm" type="button" data-ai="${i}" title="AI scene: put this car on your own lot">🪄 AI scene</button>${i ? `<button class="b sm" type="button" data-mk="${i}" title="Make this the main photo">★</button>` : ""}<button class="b sm" type="button" data-rm="${i}" title="Remove">✕</button></div></div>`).join("")}
      <label class="ph-add"><input type="file" accept="image/*" multiple hidden data-add><span>＋<br>Add photos</span></label></div>
      <p style="color:var(--muted);font-size:13px;margin:8px 0 0">The first photo is the main one (cards, exports). ✨ Studio changes the background, covers the plate, adds your banner. 🪄 AI scene puts the car on your own lot.</p>`;
    el.querySelector("[data-add]").onchange = async (e) => {
      const fs = [...e.target.files]; if (!fs.length) return; env.toast(`Uploading ${fs.length} photo${fs.length > 1 ? "s" : ""}…`);
      for (const f of fs) { try { const u = await env.upload(f, 1600); if (!car.img) car.img = u; else (car.photos = car.photos || []).push(u); } catch (_) { env.toast("Could not upload " + f.name, 1); } }
      onChange(); draw();
    };
    el.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { const i = +b.dataset.rm; if (!confirm("Remove this photo?")) return; const ps2 = allPhotos(car); ps2.splice(i, 1); car.img = ps2[0] || ""; car.photos = ps2.slice(1); onChange(); draw(); }));
    el.querySelectorAll("[data-mk]").forEach((b) => (b.onclick = () => { const i = +b.dataset.mk, ps2 = allPhotos(car); const [x] = ps2.splice(i, 1); ps2.unshift(x); car.img = ps2[0]; car.photos = ps2.slice(1); onChange(); draw(); }));
    el.querySelectorAll("[data-ai]").forEach((b) => (b.onclick = () => { const i = +b.dataset.ai, src = allPhotos(car)[i];
      openAIScene({ src, env, onUse: async (u) => { car.originals = { ...(car.originals || {}), [u]: (car.originals || {})[src] || src }; if (i === 0) car.img = u; else car.photos[i - 1] = u;
        onChange(); draw(); env.toast("Photo updated. Click Save to put it on the website."); } }); }));
    el.querySelectorAll("[data-st]").forEach((b) => (b.onclick = () => { const i = +b.dataset.st, src = allPhotos(car)[i];
      openStudio({ src, settings: env.settings(), price: car.price, library: env.library(), onAddBackground: env.addBackground,
        onSave: async (blob, kind) => { const u = await env.upload(blob, kind === "cut" ? 900 : 1600);
          if (kind === "cut") car.cut = u; else { car.originals = { ...(car.originals || {}), [u]: (car.originals || {})[src] || src }; if (i === 0) car.img = u; else car.photos[i - 1] = u; }
          onChange(); draw(); env.toast("Photo updated. Click Save to put it on the website."); } }); }));
  };
  draw();
}

// Bulk: pick cars and photos, pick a background, change them all.
// env as above + cars() -> array, saveAll() -> Promise
export function bulkStudio(V, env) {
  const st = { ...DEFAULTS };
  const sel = new Set(); let which = "main", running = false;
  const cars = () => env.cars().filter((c) => c.img && c.status !== "sold");
  const draw = () => {
    const lib = [...BACKGROUNDS, ...env.library()];
    V.innerHTML = `<div class="ph"><div><h1>Photo studio</h1><p>Change the background of many cars at once: pick the cars, pick a background, click Change.</p></div></div>
    <div class="split"><div class="card"><h3>1 · Pick the cars <span><button class="b sm" type="button" data-allc>Select all</button> <button class="b sm" type="button" data-nonec>None</button></span></h3>
      <div class="bulk-cars">${cars().map((c) => `<label class="bulk-car ${sel.has(c.id) ? "on" : ""}"><input type="checkbox" data-car="${esc(c.id)}" ${sel.has(c.id) ? "checked" : ""}><img src="${esc(c.img)}" alt="" loading="lazy"><span>${esc(c.year + " " + c.name)}<small>${allPhotos(c).length} photo${allPhotos(c).length > 1 ? "s" : ""}${c.originals && Object.keys(c.originals).length ? " · edited" : ""}</small></span></label>`).join("") || '<p class="empty">No cars with photos.</p>'}</div></div>
    <div class="grid"><div class="card"><h3>2 · Which photos</h3><div class="seg" data-which>${[["main", "Main photo only"], ["all", "All photos"]].map(([k, l]) => `<button type="button" data-k="${k}" class="${which === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
      <div class="card"><h3>3 · Background</h3><div class="bg-grid">${["Inside", "Urban", "Outside", "Studio", "Yours"].map((cat) => { const xs = lib.filter((b) => (b.cat || "Yours") === cat); return xs.length ? `<div class="bg-cat">${cat === "Yours" ? "Your backgrounds" : cat}</div><div class="bg-row">${xs.map((b) => `<button type="button" class="bg-it ${st.bgId === b.id ? "on" : ""}" data-bg="${esc(b.id)}"><img src="${esc(b.thumb || b.url)}" alt="" loading="lazy"><span>${esc(b.name)}</span></button>`).join("")}</div>` : ""; }).join("")}</div>
        <label class="b sm" style="margin-top:8px;cursor:pointer">+ Upload your own background<input type="file" accept="image/*" hidden data-upbg></label>
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px"><label class="chk"><input type="checkbox" data-o="shadow" ${st.shadow ? "checked" : ""}> Shadow</label><label class="chk"><input type="checkbox" data-o="reflect" ${st.reflect ? "checked" : ""}> Reflection</label><label class="chk"><input type="checkbox" data-o="matchLight" ${st.matchLight ? "checked" : ""}> Match the light</label></div>
        <div class="seg" data-ov style="margin-top:10px">${[["none", "No banner"], ["logo", "Logo"], ["banner", "Dealer banner"]].map(([k, l]) => `<button type="button" data-k="${k}" class="${st.overlay === k ? "on" : ""}">${l}</button>`).join("")}</div>
        <label class="chk" style="margin-top:8px"><input type="checkbox" data-o="auto" ${st.auto ? "checked" : ""}> ✨ Auto enhance light & colour</label></div>
      <div class="card"><h3>4 · Change</h3><button class="b primary" type="button" data-go style="width:100%" ${running ? "disabled" : ""}>Change ${count()} photo${count() === 1 ? "" : "s"}</button>
        <div data-prog style="margin-top:10px;font-size:14px;color:var(--muted)"></div>
        <p style="color:var(--muted);font-size:13px;margin:8px 0 0">Your original photos are kept: open a car and use ✕ / ★ to tidy up, or Undo below. To cover a licence plate, open the photo in ✨ Studio (plates need placing by hand).</p>
        <button class="b sm" type="button" data-undo style="margin-top:8px">↺ Undo edits on the selected cars</button></div></div></div>`;
    V.querySelectorAll("[data-car]").forEach((c) => (c.onchange = () => { c.checked ? sel.add(c.dataset.car) : sel.delete(c.dataset.car); draw(); }));
    V.querySelector("[data-allc]").onclick = () => { cars().forEach((c) => sel.add(c.id)); draw(); };
    V.querySelector("[data-nonec]").onclick = () => { sel.clear(); draw(); };
    V.querySelectorAll("[data-which] button").forEach((b) => (b.onclick = () => { which = b.dataset.k; draw(); }));
    V.querySelectorAll("[data-ov] button").forEach((b) => (b.onclick = () => { st.overlay = b.dataset.k; draw(); }));
    V.querySelectorAll("[data-bg]").forEach((b) => (b.onclick = () => { st.bgId = b.dataset.bg; const m = lib.find((x) => x.id === st.bgId); st.reflect = !!(m && m.reflect); draw(); }));
    V.querySelectorAll("[data-o]").forEach((c) => (c.onchange = () => { st[c.dataset.o] = c.checked; }));
    V.querySelector("[data-upbg]").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { const entry = await env.addBackground(f); st.bgId = entry.id; draw(); } catch (_) { env.toast("Could not upload the background.", 1); } };
    V.querySelector("[data-undo]").onclick = async () => {
      if (!sel.size) return env.toast("Pick the cars first.", 1);
      env.cars().filter((c) => sel.has(c.id) && c.originals).forEach((c) => { const back = (u) => c.originals[u] || u; c.img = back(c.img); c.photos = (c.photos || []).map(back); c.originals = {}; });
      try { await env.saveAll(); env.toast("Original photos are back."); draw(); } catch (_) { env.toast("Could not save.", 1); }
    };
    V.querySelector("[data-go]").onclick = run;
  };
  const count = () => env.cars().filter((c) => sel.has(c.id)).reduce((s, c) => s + (which === "all" ? allPhotos(c).length : 1), 0);
  async function run() {
    const jobs = []; env.cars().filter((c) => sel.has(c.id)).forEach((c) => allPhotos(c).forEach((u, i) => { if (which === "all" || i === 0) jobs.push([c, i, u]); }));
    if (!jobs.length) return env.toast("Pick at least one car.", 1);
    running = true; draw(); const prog = V.querySelector("[data-prog]"); let done = 0, failed = 0;
    const opts = { ...st, mode: "replace", ...(st.auto ? { bright: 106, contrast: 112, sat: 118 } : {}) };
    for (const [c, i, src] of jobs) {
      prog.textContent = `Working on ${done + 1} of ${jobs.length}: ${c.year} ${c.name}…`;
      try {
        const blob = await processPhoto(src, opts, env.settings(), c.price, env.library(), (m) => (prog.textContent = `${done + 1} of ${jobs.length}: ${m}`));
        const u = await env.upload(blob, 1600);
        c.originals = { ...(c.originals || {}), [u]: (c.originals || {})[src] || src };
        if (i === 0) c.img = u; else c.photos[i - 1] = u;
      } catch (e) { console.error(e); failed++; }
      done++;
    }
    try { await env.saveAll(); } catch (_) { failed = jobs.length; }
    running = false; draw();
    V.querySelector("[data-prog]").textContent = failed ? `Done, but ${failed} photo${failed > 1 ? "s" : ""} could not be changed. Check your internet connection and try those again.` : `Done! ${jobs.length} photo${jobs.length > 1 ? "s" : ""} changed and saved on the website.`;
    env.toast(failed ? "Finished with some errors." : "All photos changed", !!failed);
  }
  draw();
}
