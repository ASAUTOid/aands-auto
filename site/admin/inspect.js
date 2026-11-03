// Vehicle inspection: checklist with OK / Needs attention / Problem / N/A per item, one click to mark everything OK,
// printable report and a public report page (/inspection?car=<id>[&d=<dealer>]).
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const CHECKLIST = [
  ["docs", "Vehicle & paperwork", ["VIN matches the title", "VIN plates intact (dash and door)", "Odometer works and matches records", "Clean title (no salvage / flood)", "Open recalls checked", "Two keys / remotes", "Owner's manual"]],
  ["ext", "Exterior & body", ["Body panels straight, gaps even", "Paint condition", "No major dents or scratches", "No rust or rot", "Windshield (no cracks)", "Side and rear glass", "Wipers and washers", "Mirrors", "Headlights", "Tail lights and brake lights", "Turn signals and hazards", "Bumpers and trim", "Doors open and close properly", "Hood and trunk / tailgate", "Weatherstripping and seals", "No signs of frame damage"]],
  ["tires", "Tires & wheels", ["Front left tire tread", "Front right tire tread", "Rear left tire tread", "Rear right tire tread", "Even tire wear (alignment)", "Matching tires", "Wheels / rims (no bends or cracks)", "Tire pressure sensors (TPMS)", "Spare tire, jack and tools"]],
  ["brakes", "Brakes", ["Front brake pads", "Rear brake pads / shoes", "Rotors and drums", "Brake fluid level and condition", "Parking brake", "No ABS warning light"]],
  ["engine", "Under the hood", ["Engine oil level and condition", "Coolant level and condition", "Transmission fluid", "Power steering fluid", "Battery and terminals", "Battery test", "Drive belts", "Radiator and heater hoses", "Air filter", "No oil or fluid leaks", "Engine mounts", "Cold start", "Smooth idle", "No smoke from exhaust", "No unusual engine noises"]],
  ["under", "Underbody & suspension", ["Shocks and struts", "Springs", "Ball joints", "Tie rods and steering linkage", "CV axles and boots", "Driveshaft / U-joints", "Exhaust system and mounts", "Fuel lines and tank", "No leaks from oil pan or transmission", "Differential(s)", "Frame and underbody (no rust-through)"]],
  ["interior", "Interior & electronics", ["Seats and upholstery", "Seat adjustments", "Seat belts", "Airbag light off", "No warning lights on the dash", "Gauges and instrument cluster", "Air conditioning (cold)", "Heater", "Defroster (front and rear)", "Radio and speakers", "Bluetooth / phone connection", "Backup camera / sensors", "Power windows", "Power door locks", "Power mirrors", "Sunroof / moonroof", "Horn", "Interior lights", "Carpet and headliner", "No odors (smoke, mold)", "Cruise control", "Steering wheel controls"]],
  ["scan", "Computer diagnostics (OBD-II)", ["Engine codes", "Transmission codes", "ABS codes", "Airbag (SRS) codes", "Emission readiness monitors"]],
  ["road", "Road test", ["Engine power and acceleration", "Transmission shifts smoothly", "Drives straight (no pulling)", "Steering feels right", "Brakes stop straight, no pulsing", "No clunks or rattles over bumps", "No vibrations at highway speed", "4WD / AWD engages", "Cruise control works on the road"]],
];
export const ITEM_COUNT = CHECKLIST.reduce((s, [, , xs]) => s + xs.length, 0);
const key = (g, i) => `${g}.${i}`;
const RES = [["ok", "✓ OK", "#1f8a4c"], ["att", "! Attention", "#b86e00"], ["fail", "✕ Problem", "#c8141b"], ["na", "N/A", "#8a8580"]];

export function summary(ins) {
  const r = ins?.results || {}, vals = Object.values(r);
  const c = { ok: 0, att: 0, fail: 0, na: 0 }; vals.forEach((v) => c[v] !== undefined && c[v]++);
  const done = c.ok + c.att + c.fail + c.na, complete = done === ITEM_COUNT;
  const grade = !done ? "Not inspected" : c.fail ? "Needs repairs" : c.att ? "Passed with notes" : complete ? "Passed – full inspection OK" : "In progress";
  return { ...c, done, complete, grade, color: c.fail ? "#c8141b" : c.att ? "#b86e00" : complete ? "#1f8a4c" : "#8a8580" };
}

const CSS = `
.insp-top{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
.insp-all{display:flex;align-items:center;gap:12px;padding:14px 18px;border-radius:10px;border:2px dashed #1f8a4c;background:rgba(31,138,76,.08);cursor:pointer;font-weight:700;font-size:16px;color:inherit}
.insp-all input{width:22px;height:22px;accent-color:#1f8a4c}
.insp-grp{margin-bottom:12px}
.insp-grp summary{display:flex;justify-content:space-between;align-items:center;gap:10px;cursor:pointer;font-weight:700;padding:12px 4px;list-style:none}
.insp-grp summary::-webkit-details-marker{display:none}
.insp-grp summary .bar{flex:1;max-width:200px;height:8px;border-radius:4px;background:var(--line,#ddd);overflow:hidden;display:flex}
.insp-grp summary .bar i{display:block;height:100%}
.insp-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 12px;align-items:center;padding:8px 4px;border-top:1px solid var(--line,#e4dfdc)}
.insp-row .lbl{font-size:15px}
.insp-opts{display:flex;gap:4px;flex-wrap:wrap}
.insp-opts button{border:1.5px solid var(--line,#ddd);background:transparent;color:inherit;border-radius:99px;padding:5px 11px;font:600 13px/1 inherit;cursor:pointer}
.insp-opts button.on{color:#fff}
.insp-row input.note{grid-column:1/-1;border:1px solid var(--line,#ddd);border-radius:6px;padding:7px 9px;background:transparent;color:inherit;font:inherit;font-size:14px}
@media (max-width:640px){.insp-row{grid-template-columns:1fr}}
.insp-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;color:#fff;font-weight:700}`;

// Inspection editor. ctx: { car, settings, title, onSave(ins) -> Promise, onBack(), toast, reportUrl }
export function openInspection(V, ctx) {
  if (!document.getElementById("insp-css")) { const s = document.createElement("style"); s.id = "insp-css"; s.textContent = CSS; document.head.appendChild(s); }
  const c = ctx.car, ins = JSON.parse(JSON.stringify(c.inspection || {}));
  ins.results = ins.results || {}; ins.notes = ins.notes || {}; ins.tread = ins.tread || {};
  ins.date = ins.date || new Date().toISOString().slice(0, 10); ins.odometer = ins.odometer ?? c.miles ?? "";
  const open = new Set(["docs"]);
  const draw = () => {
    const sm = summary(ins), allOk = sm.ok === ITEM_COUNT;
    V.innerHTML = `<div class="crumb"><a href="#" data-back>${esc(ctx.backLabel || "Back")}</a> / Inspection</div>
    <div class="ph"><div><h1>Inspection</h1><p>${esc(ctx.title)} · ${ITEM_COUNT}-point check</p></div>
      <div class="act"><button class="b" type="button" data-print>🖨 Print report</button>${ctx.reportUrl ? `<a class="b" href="${esc(ctx.reportUrl)}" target="_blank" rel="noopener">👁 Customer view</a>` : ""}<button class="b primary" type="button" data-save>Save inspection</button></div></div>
    <div class="card" style="margin-bottom:14px"><div class="insp-top"><span class="insp-badge" style="background:${sm.color}">${esc(sm.grade)}</span>
      <span style="color:var(--muted)">${sm.done}/${ITEM_COUNT} checked · ${sm.ok} OK · ${sm.att} attention · ${sm.fail} problems · ${sm.na} N/A</span></div>
      <label class="insp-all"><input type="checkbox" data-allok ${allOk ? "checked" : ""}> ✓ Everything checked and OK (full inspection passed)</label>
      <div class="fg" style="margin-top:14px">
        <div class="f"><label>Inspection date</label><input type="date" data-k="date" value="${esc(ins.date)}"></div>
        <div class="f"><label>Inspected by</label><input data-k="inspector" value="${esc(ins.inspector || "")}" placeholder="Name of the mechanic"></div>
        <div class="f"><label>Odometer (miles)</label><input type="number" data-k="odometer" value="${esc(ins.odometer)}"></div>
        ${["FL", "FR", "RL", "RR"].map((t) => `<div class="f"><label>Tread ${t} (/32")</label><input type="number" min="0" max="20" data-tread="${t}" value="${esc(ins.tread[t] ?? "")}"></div>`).join("")}
      </div>
      <label class="chk" style="margin-top:12px"><input type="checkbox" data-pub ${ins.public !== false ? "checked" : ""}> Show this report to customers on the website</label></div>
    ${CHECKLIST.map(([g, title, items]) => { const ks = items.map((_, i) => key(g, i)), n = (v) => ks.filter((k) => ins.results[k] === v).length;
      return `<details class="card insp-grp" data-g="${g}" ${open.has(g) ? "open" : ""}><summary><span>${esc(title)} <small style="color:var(--muted);font-weight:500">${ks.filter((k) => ins.results[k]).length}/${items.length}</small></span>
        <span class="bar">${RES.map(([v, , col]) => `<i style="width:${(n(v) / items.length) * 100}%;background:${col}"></i>`).join("")}</span>
        <button class="b sm" type="button" data-grpok="${g}">All OK</button></summary>
        ${items.map((label, i) => { const k = key(g, i), r = ins.results[k]; return `<div class="insp-row"><span class="lbl">${esc(label)}</span><span class="insp-opts">${RES.map(([v, l, col]) => `<button type="button" data-set="${k}|${v}" class="${r === v ? "on" : ""}" style="${r === v ? `background:${col};border-color:${col}` : ""}">${l}</button>`).join("")}</span>
          ${r === "att" || r === "fail" || ins.notes[k] ? `<input class="note" data-note="${k}" value="${esc(ins.notes[k] || "")}" placeholder="What did you find? (e.g. front pads at 3 mm, replace soon)">` : ""}</div>`; }).join("")}</details>`; }).join("")}
    <div class="card"><div class="f"><label>Overall comments</label><textarea data-k="comments" placeholder="Anything the buyer should know.">${esc(ins.comments || "")}</textarea></div></div>`;
    V.querySelector("[data-back]").onclick = (e) => { e.preventDefault(); ctx.onBack(); };
    V.querySelectorAll("[data-k]").forEach((el) => (el.oninput = () => (ins[el.dataset.k] = el.value)));
    V.querySelectorAll("[data-tread]").forEach((el) => (el.oninput = () => (ins.tread[el.dataset.tread] = el.value)));
    V.querySelector("[data-pub]").onchange = (e) => (ins.public = e.target.checked);
    V.querySelectorAll("details.insp-grp").forEach((d) => (d.ontoggle = () => (d.open ? open.add(d.dataset.g) : open.delete(d.dataset.g))));
    V.querySelector("[data-allok]").onchange = (e) => {
      if (e.target.checked) { CHECKLIST.forEach(([g, , xs]) => xs.forEach((_, i) => (ins.results[key(g, i)] = "ok"))); ins.notes = {}; ctx.toast("All " + ITEM_COUNT + " points marked OK. Click Save."); }
      else { if (!confirm("Clear all the results?")) { e.target.checked = true; return; } ins.results = {}; }
      draw();
    };
    V.querySelectorAll("[data-grpok]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); const g = b.dataset.grpok; CHECKLIST.find((x) => x[0] === g)[2].forEach((_, i) => (ins.results[key(g, i)] = "ok")); open.add(g); draw(); }));
    V.querySelectorAll("[data-set]").forEach((b) => (b.onclick = () => { const [k, v] = b.dataset.set.split("|"); ins.results[k] = ins.results[k] === v ? undefined : v; if (!ins.results[k]) delete ins.results[k]; open.add(k.split(".")[0]); draw(); }));
    V.querySelectorAll("[data-note]").forEach((el) => (el.oninput = () => { ins.notes[el.dataset.note] = el.value; if (!el.value) delete ins.notes[el.dataset.note]; }));
    V.querySelector("[data-print]").onclick = () => { const w = window.open("", "_blank"); if (!w) return ctx.toast("Allow pop-ups to print.", 1); w.document.write(reportPage({ ...c, inspection: ins }, ctx.settings, true)); w.document.close(); setTimeout(() => w.print(), 500); };
    V.querySelector("[data-save]").onclick = async (e) => { e.target.disabled = true; ins.updatedAt = new Date().toISOString(); const sm2 = summary(ins); ins.grade = sm2.grade;
      try { await ctx.onSave(ins); ctx.toast("Inspection saved"); } catch (x) { ctx.toast("Could not save the inspection.", 1); } e.target.disabled = false; };
  };
  draw();
}

// Full report as an HTML page (print view and the public customer page)
export function reportPage(c, S = {}, print = false) {
  const ins = c.inspection || {}, sm = summary(ins), col = (v) => (RES.find((x) => x[0] === v) || [, "—", "#bbb"]);
  const fdate = (s) => (s ? new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Inspection report · ${esc(c.year)} ${esc(c.name)}</title>
  <style>*{box-sizing:border-box}body{margin:0;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#1c1717;background:${print ? "#fff" : "#f4f2f1"}}
  .w{max-width:900px;margin:0 auto;padding:${print ? "0" : "24px 16px 60px"}}.paper{background:#fff;border-radius:${print ? 0 : 12}px;padding:${print ? "0" : "28px"};${print ? "" : "box-shadow:0 10px 30px rgba(0,0,0,.08)"}}
  .hd{display:flex;justify-content:space-between;gap:16px;align-items:center;border-bottom:3px solid #111;padding-bottom:14px}.hd img{height:52px}
  h1{font-size:26px;margin:16px 0 2px}.sub{color:#6f6661}.grade{display:inline-block;margin:14px 0;padding:10px 16px;border-radius:10px;color:#fff;font-weight:800;font-size:20px;background:${sm.color}}
  .kv{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin:10px 0 18px}.kv div{background:#f6f4f2;border-radius:8px;padding:8px 10px}.kv span{display:block;font-size:12px;color:#6f6661;text-transform:uppercase;letter-spacing:.05em}
  .stats{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}.stats b{padding:6px 10px;border-radius:99px;color:#fff;font-size:13px}
  h2{font-size:16px;margin:22px 0 6px;padding-bottom:4px;border-bottom:1px solid #e4dfdc;display:flex;justify-content:space-between}
  .it{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px dashed #eee;font-size:14px}.it em{display:block;color:#b86e00;font-style:normal;font-size:13px}
  .r{font-weight:700;white-space:nowrap}.foot{margin-top:24px;font-size:12px;color:#8a8580}@media print{.np{display:none}}</style></head><body><div class="w"><div class="paper">
  <div class="hd"><div><b style="font-size:18px">${esc(S.name || "")}</b><br><span class="sub">${esc([S.street, S.city, S.state].filter(Boolean).join(", "))}${S.phone ? " · " + esc(S.phone) : ""}</span></div>${S.logo ? `<img src="${esc(S.logo)}" alt="">` : ""}</div>
  <h1>Vehicle inspection report</h1><div class="sub">${esc(c.year)} ${esc(c.name)} ${esc(c.trim || "")}</div>
  <div class="grade">${sm.complete && !sm.att && !sm.fail ? "✓ " : ""}${esc(sm.grade)}</div>
  <div class="stats"><b style="background:#1f8a4c">${sm.ok} OK</b><b style="background:#b86e00">${sm.att} need attention</b><b style="background:#c8141b">${sm.fail} problems</b><b style="background:#8a8580">${sm.na} N/A</b><b style="background:#444">${ITEM_COUNT} points</b></div>
  <div class="kv"><div><span>VIN</span>${esc(c.vin || "—")}</div><div><span>Odometer</span>${ins.odometer ? Number(ins.odometer).toLocaleString("en-US") + " mi" : "—"}</div><div><span>Date</span>${esc(fdate(ins.date))}</div><div><span>Inspected by</span>${esc(ins.inspector || "—")}</div>
    ${Object.keys(ins.tread || {}).filter((t) => ins.tread[t] !== "").map((t) => `<div><span>Tread ${t}</span>${esc(ins.tread[t])}/32"</div>`).join("")}</div>
  ${CHECKLIST.map(([g, title, items]) => `<h2><span>${esc(title)}</span><small class="sub">${items.filter((_, i) => ins.results?.[key(g, i)] === "ok").length}/${items.length} OK</small></h2>
    ${items.map((label, i) => { const k = key(g, i), r = ins.results?.[k], [, l, cl] = col(r); return `<div class="it"><span>${esc(label)}${ins.notes?.[k] ? `<em>${esc(ins.notes[k])}</em>` : ""}</span><span class="r" style="color:${cl}">${r ? l : "Not checked"}</span></div>`; }).join("")}`).join("")}
  ${ins.comments ? `<h2>Comments</h2><p style="white-space:pre-wrap">${esc(ins.comments)}</p>` : ""}
  <p class="foot">Inspection by the dealer on the date shown. It describes the vehicle's condition at that time and is not a warranty. See the Buyers Guide for warranty information. You're welcome to have your own mechanic inspect the vehicle.</p>
  ${print ? "" : `<p class="np" style="margin-top:20px"><button onclick="print()" style="font:inherit;padding:10px 16px;border-radius:8px;border:1px solid #ccc;background:#fff;cursor:pointer">🖨 Print</button></p>`}
  </div></div></body></html>`;
}
