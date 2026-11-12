// 🪄 AI scene: puts the real car from a photo onto the dealer's own lot (or a ready-made scene).
// The picture is made on the server (Google Gemini) and takes about 20-40 seconds.
// env: { api(url, opt), slug, settings(), saveSettings(), upload(file, max) -> url, toast(msg, err) }
import { BACKGROUNDS } from "./backgrounds.js";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PRESET_NAMES = { lot: "Clean dealer lot", showroom: "Modern showroom", studio: "Photo studio", street: "Quiet street" };
const Jp = (b) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const why = (x) => (x && x.code && /\s/.test(x.code) ? x.code : "Something went wrong. Please try again.");

export async function openAIScene({ src, env, onUse }) {
  const ov = document.createElement("div"); ov.className = "studio";
  ov.innerHTML = `<div class="studio-pan" role="dialog" aria-modal="true" aria-label="AI scene" style="width:min(100%,1040px)"><div class="studio-hd"><h2>🪄 AI scene</h2><button class="b sm" data-x type="button">Close</button></div><div data-body><p style="color:var(--muted)">Loading…</p></div></div>`;
  document.body.appendChild(ov);
  const close = () => { stop = true; ov.remove(); }; let stop = false;
  ov.querySelector("[data-x]").onclick = close; ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  const body = ov.querySelector("[data-body]"), q = "?slug=" + encodeURIComponent(env.slug || "");
  let info; try { info = await env.api("/api/ai/photo" + q); } catch (x) { body.innerHTML = `<p>${esc(why(x))}</p>`; return; }
  if (!info.on) { body.innerHTML = `<div class="banner">AI scene photos are not turned on for this account yet. ${env.slug ? "Ask DealerVexa support (Help) to turn them on." : "Add GEMINI_API_KEY in Netlify → Environment variables."}</div>
    <p style="color:var(--muted)">Meanwhile, ✨ Studio changes backgrounds right in your browser, for free.</p>`; return; }
  const s = env.settings(); let scene = s.lotPhoto ? { url: s.lotPhoto } : { preset: "lot" }, result = "";
  const own = [...(s.lotPhoto ? [{ url: s.lotPhoto, name: "Your lot" }] : []), ...(s.bgLibrary || []).map((b) => ({ url: b.url, name: b.name || "Yours" }))];
  const lib = BACKGROUNDS.filter((b) => b.id.startsWith("photo-")).map((b) => ({ url: b.url, thumb: b.thumb, name: b.name }));
  const draw = () => {
    const left = info.limit == null ? "" : `<span class="pill ${info.used >= info.limit ? "bad" : "ok"}">${Math.max(0, info.limit - info.used)} of ${info.limit} left this month</span>`;
    const tile = (o, key, val) => `<button type="button" class="ai-t ${scene[key] === val ? "on" : ""}" data-k="${key}" data-v="${esc(val)}">${o.thumb || o.url ? `<img src="${esc(o.thumb || o.url)}" alt="" loading="lazy">` : `<span class="ai-p">${esc(o.name)}</span>`}<small>${esc(o.name)}</small></button>`;
    body.innerHTML = `<div class="studio-body" style="grid-template-columns:minmax(0,1.5fr) minmax(260px,1fr)">
      <div><div class="ai-cmp"><div><small>Your photo</small><img src="${esc(src)}" alt=""></div><div><small>AI result</small><div class="ai-res" data-res>${result ? `<img src="${esc(result)}" alt="">` : '<span>Pick a place and press Create</span>'}</div></div></div>
        <p class="hint" style="margin-top:10px">The AI keeps your real car and only changes where it stands. Always check the result: the car must look exactly like the one you sell.</p></div>
      <div><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px"><b>Where should the car stand?</b>${left}</div>
        <div class="ai-g">${own.map((o) => tile(o, "url", o.url)).join("")}${Object.entries(PRESET_NAMES).map(([k, n]) => tile({ name: n }, "preset", k)).join("")}${lib.map((o) => tile(o, "url", o.url)).join("")}</div>
        <label class="b sm" style="margin-top:10px;display:inline-flex;cursor:pointer"><input type="file" accept="image/*" hidden data-lot>📷 ${s.lotPhoto ? "Change" : "Add"} a photo of your own lot</label>
        <p class="hint" style="margin:6px 0 12px">Best: an empty spot in front of your building, taken at eye level.</p>
        <label style="display:block;font-size:13px;font-weight:600">Extra wish (optional)<input data-hint maxlength="200" placeholder="e.g. show the car from the front left" style="display:block;width:100%;margin-top:4px;border:1px solid var(--line);border-radius:6px;padding:9px;background:var(--panel)"></label>
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="b primary" type="button" data-go>🪄 Create</button>${result ? '<button class="b" type="button" data-use>✓ Use this photo</button>' : ""}</div>
        <p data-msg style="font-size:14px;margin:10px 0 0;min-height:1.4em"></p></div></div>`;
    body.querySelectorAll(".ai-t").forEach((b) => (b.onclick = () => { scene = { [b.dataset.k]: b.dataset.v }; body.querySelectorAll(".ai-t").forEach((x) => x.classList.toggle("on", x === b)); }));
    body.querySelector("[data-lot]").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; msg("Uploading your lot photo…");
      try { const u = await env.upload(f, 1800); s.lotPhoto = u; await env.saveSettings(); own.unshift({ url: u, name: "Your lot" }); scene = { url: u }; draw(); } catch (_) { msg("Could not upload that photo.", 1); } };
    body.querySelector("[data-go]").onclick = go;
    const use = body.querySelector("[data-use]"); if (use) use.onclick = async () => { use.disabled = true; try { await onUse(result); close(); } catch (_) { use.disabled = false; msg("Could not save the photo.", 1); } };
  };
  const msg = (t, bad) => { const m = body.querySelector("[data-msg]"); if (m) { m.textContent = t; m.style.color = bad ? "var(--bad)" : "var(--muted)"; } };
  async function go() {
    const btn = body.querySelector("[data-go]"), hint = body.querySelector("[data-hint]").value, res = body.querySelector("[data-res]");
    btn.disabled = true; res.innerHTML = '<span class="ai-spin">Creating your photo… about 30 seconds</span>'; msg("");
    try {
      const { id } = await env.api("/api/ai/photo", Jp({ slug: env.slug || "", photo: src, scene: scene.url || "", preset: scene.preset || "", hint }));
      for (let i = 0; i < 80 && !stop; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        const j = await env.api(`/api/ai/photo${q}&id=${id}`);
        if (j.status === "done") { result = j.url; if (info.limit != null) info.used++; draw(); msg("Done. Compare it with your photo, then press Use this photo."); return; }
        if (j.status === "error") throw { code: j.error || "The AI could not make this photo. Try again." };
      }
      if (!stop) throw { code: "This is taking too long. Please try again." };
    } catch (x) { if (stop) return; res.innerHTML = "<span>No result</span>"; msg(why(x), 1); btn.disabled = false; }
  }
  draw();
}
