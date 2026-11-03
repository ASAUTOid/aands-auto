// Vehicle inspection in the style of manufacturer certified pre-owned checklists (Toyota 160-point, Ford Blue Advantage,
// BMW / Chrysler CPO) and dealer multi-point inspections: a traffic-light result per item (Good / Future attention /
// Needs repair / Repaired / N/A), real measurements (tyre tread in 32nds, brake pads in mm, battery test) with
// pass marks, photos of findings, one click to mark everything Good, a printable report, a public report page
// (/inspection?car=<id>[&d=<dealer>]) and a summary block for the car page on the website.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const CHECKLIST = [
  ["docs", "Vehicle history & paperwork", ["VIN matches the title", "VIN plates intact (dash and door)", "Odometer works and matches records", "Clean title (no salvage / flood)", "Open recalls checked", "Two keys / remotes", "Owner's manual"]],
  ["ext", "Exterior & body", ["Body panels straight, gaps even", "Paint condition", "No major dents or scratches", "No rust or rot", "Windshield (no cracks)", "Side and rear glass", "Wipers and washers", "Mirrors", "Headlights", "Tail lights and brake lights", "Turn signals and hazards", "Bumpers and trim", "Doors open and close properly", "Hood and trunk / tailgate", "Weatherstripping and seals", "No signs of frame damage"]],
  ["tires", "Tires & wheels", ["Front left tire", "Front right tire", "Rear left tire", "Rear right tire", "Even tire wear (alignment)", "Matching tires", "Wheels / rims (no bends or cracks)", "Tire pressure sensors (TPMS)", "Spare tire, jack and tools"]],
  ["brakes", "Brakes", ["Front brake pads", "Rear brake pads / shoes", "Rotors and drums", "Brake fluid level and condition", "Parking brake", "No ABS warning light"]],
  ["engine", "Under the hood", ["Engine oil level and condition", "Coolant level and condition", "Transmission fluid", "Power steering fluid", "Battery and terminals", "Battery test", "Drive belts", "Radiator and heater hoses", "Air filter", "No oil or fluid leaks", "Engine mounts", "Cold start", "Smooth idle", "No smoke from exhaust", "No unusual engine noises"]],
  ["under", "Underbody & suspension", ["Shocks and struts", "Springs", "Ball joints", "Tie rods and steering linkage", "CV axles and boots", "Driveshaft / U-joints", "Exhaust system and mounts", "Fuel lines and tank", "No leaks from oil pan or transmission", "Differential(s)", "Frame and underbody (no rust-through)"]],
  ["interior", "Interior & electronics", ["Seats and upholstery", "Seat adjustments", "Seat belts", "Airbag light off", "No warning lights on the dash", "Gauges and instrument cluster", "Air conditioning (cold)", "Heater", "Defroster (front and rear)", "Radio and speakers", "Bluetooth / phone connection", "Backup camera / sensors", "Power windows", "Power door locks", "Power mirrors", "Sunroof / moonroof", "Horn", "Interior lights", "Carpet and headliner", "No odors (smoke, mold)", "Cruise control", "Steering wheel controls"]],
  ["scan", "Computer diagnostics (OBD-II)", ["Engine codes", "Transmission codes", "ABS codes", "Airbag (SRS) codes", "Emission readiness monitors"]],
  ["road", "Road test", ["Engine power and acceleration", "Transmission shifts smoothly", "Drives straight (no pulling)", "Steering feels right", "Brakes stop straight, no pulsing", "No clunks or rattles over bumps", "No vibrations at highway speed", "4WD / AWD engages", "Cruise control works on the road"]],
];
export const ITEM_COUNT = CHECKLIST.reduce((s, [, , xs]) => s + xs.length, 0);
const key = (g, i) => `${g}.${i}`;
// result codes kept from earlier versions: ok / att / fail / na; rep = repaired before sale
export const RES = [["ok", "Good", "#1f8a4c", "✓"], ["att", "Future attention", "#c98a00", "!"], ["fail", "Needs repair", "#c8141b", "✕"], ["rep", "Repaired", "#2457c5", "🔧"], ["na", "N/A", "#8a8580", "–"]];
const resOf = (v) => RES.find((r) => r[0] === v);

// Measurements with pass marks taken from manufacturer CPO checklists (Toyota: 5/32" tread; BMW: 5 mm pads).
const WHEELS = [["FL", "Front left"], ["FR", "Front right"], ["RL", "Rear left"], ["RR", "Rear right"]];
export const MEASURES = {
  tread: { label: "Tire tread", unit: '/32"', good: 5, warn: 3, hint: 'New tires are about 10/32". 5/32" or more passes a certified inspection; 2/32" is the legal limit.' },
  pads: { label: "Brake pads", unit: " mm", good: 5, warn: 3, hint: "New pads are about 10–12 mm. 5 mm or more passes; under 3 mm should be replaced." },
};
const level = (m, v) => (v === "" || v == null || isNaN(+v) ? null : +v >= MEASURES[m].good ? "ok" : +v >= MEASURES[m].warn ? "att" : "fail");
const battLevel = (b) => { if (!b) return null; const v = +b.volts, pct = b.cca && b.rated ? (+b.cca / +b.rated) * 100 : null;
  if ((v && v < 12) || (pct !== null && pct < 60)) return "fail"; if ((v && v < 12.4) || (pct !== null && pct < 80)) return "att"; return v || pct !== null ? "ok" : null; };

export function summary(ins) {
  const r = ins?.results || {}, c = { ok: 0, att: 0, fail: 0, rep: 0, na: 0 };
  Object.values(r).forEach((v) => c[v] !== undefined && c[v]++);
  const done = c.ok + c.att + c.fail + c.rep + c.na, complete = done === ITEM_COUNT;
  const grade = !done ? "Not inspected" : c.fail ? "Needs repairs" : c.att ? "Passed – some items to watch" : complete ? "Passed – full inspection OK" : "In progress";
  return { ...c, done, complete, grade, color: c.fail ? "#c8141b" : c.att ? "#c98a00" : complete ? "#1f8a4c" : "#8a8580" };
}

const CSS = `
.insp-top{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
.insp-all{display:flex;align-items:center;gap:12px;padding:14px 18px;border-radius:10px;border:2px dashed #1f8a4c;background:rgba(31,138,76,.08);cursor:pointer;font-weight:700;font-size:16px;color:inherit}
.insp-all input{width:22px;height:22px;accent-color:#1f8a4c}
.insp-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:13px;color:var(--muted,#666);margin-top:10px}
.insp-legend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:middle}
.insp-grp{margin-bottom:12px}
.insp-grp summary{display:flex;justify-content:space-between;align-items:center;gap:10px;cursor:pointer;font-weight:700;padding:12px 4px;list-style:none}
.insp-grp summary::-webkit-details-marker{display:none}
.insp-grp summary .bar{flex:1;max-width:200px;height:8px;border-radius:4px;background:var(--line,#ddd);overflow:hidden;display:flex}
.insp-grp summary .bar i{display:block;height:100%}
.insp-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 12px;align-items:center;padding:8px 4px;border-top:1px solid var(--line,#e4dfdc)}
.insp-row .lbl{font-size:15px}
.insp-opts{display:flex;gap:4px;flex-wrap:wrap}
.insp-opts button{border:1.5px solid var(--line,#ddd);background:transparent;color:inherit;border-radius:99px;padding:5px 10px;font:600 12.5px/1 inherit;cursor:pointer;display:inline-flex;gap:5px;align-items:center}
.insp-opts button i{width:9px;height:9px;border-radius:50%}
.insp-opts button.on{color:#fff}
.insp-extra{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.insp-extra input.note{flex:1 1 260px;border:1px solid var(--line,#ddd);border-radius:6px;padding:7px 9px;background:transparent;color:inherit;font:inherit;font-size:14px}
.insp-extra img{height:46px;border-radius:4px}
.insp-meas{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.insp-meas .m{border:1px solid var(--line,#ddd);border-radius:8px;padding:10px}
.insp-meas .m label{display:block;font-size:12px;color:var(--muted,#666);margin-bottom:4px}
.insp-meas .m input{width:100%;border:1px solid var(--line,#ddd);border-radius:6px;padding:7px;background:transparent;color:inherit;font:inherit}
.insp-meas .m b{display:block;font-size:12px;margin-top:4px}
@media (max-width:640px){.insp-row{grid-template-columns:1fr}}
.insp-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;color:#fff;font-weight:700}`;

// Inspection editor. ctx: { car, settings, title, backLabel, onSave(ins) -> Promise, onBack(), toast, reportUrl, upload(file) -> url (optional) }
export function openInspection(V, ctx) {
  if (!document.getElementById("insp-css")) { const s = document.createElement("style"); s.id = "insp-css"; s.textContent = CSS; document.head.appendChild(s); }
  const c = ctx.car, ins = JSON.parse(JSON.stringify(c.inspection || {}));
  ins.results = ins.results || {}; ins.notes = ins.notes || {}; ins.photos = ins.photos || {}; ins.tread = ins.tread || {}; ins.pads = ins.pads || {}; ins.battery = ins.battery || {};
  ins.date = ins.date || new Date().toISOString().slice(0, 10); ins.odometer = ins.odometer ?? c.miles ?? "";
  const open = new Set(["docs"]);
  const lvlTag = (l) => (l ? `<b style="color:${resOf(l)[2]}">${resOf(l)[3]} ${resOf(l)[1]}</b>` : "<b style='color:#999'>—</b>");
  // measurements fill the matching checklist items automatically
  const syncMeasures = () => {
    WHEELS.forEach(([w], i) => { const l = level("tread", ins.tread[w]); if (l) ins.results[key("tires", i)] = l; });
    const pad = (ws) => Math.min(...ws.filter((w) => ins.pads[w] !== "" && ins.pads[w] != null && !isNaN(+ins.pads[w])).map((w) => +ins.pads[w]));
    const front = pad(["FL", "FR"]), rear = pad(["RL", "RR"]);
    if (isFinite(front)) ins.results[key("brakes", 0)] = level("pads", front); if (isFinite(rear)) ins.results[key("brakes", 1)] = level("pads", rear);
    const bl = battLevel(ins.battery); if (bl) ins.results[key("engine", 5)] = bl;
  };
  const draw = () => {
    const sm = summary(ins), allOk = sm.ok === ITEM_COUNT;
    V.innerHTML = `<div class="crumb"><a href="#" data-back>${esc(ctx.backLabel || "Back")}</a> / Inspection</div>
    <div class="ph"><div><h1>Inspection</h1><p>${esc(ctx.title)} · ${ITEM_COUNT}-point check, in the style of manufacturer certified pre-owned inspections</p></div>
      <div class="act"><button class="b" type="button" data-print>🖨 Print report</button>${ctx.reportUrl ? `<a class="b" href="${esc(ctx.reportUrl)}" target="_blank" rel="noopener">👁 Customer view</a>` : ""}<button class="b primary" type="button" data-save>Save inspection</button></div></div>
    <div class="card" style="margin-bottom:14px"><div class="insp-top"><span class="insp-badge" style="background:${sm.color}">${esc(sm.grade)}</span>
      <span style="color:var(--muted)">${sm.done}/${ITEM_COUNT} checked · ${sm.ok} good · ${sm.att} to watch · ${sm.fail} need repair · ${sm.rep} repaired · ${sm.na} N/A</span></div>
      <label class="insp-all"><input type="checkbox" data-allok ${allOk ? "checked" : ""}> ✓ Everything checked and in good condition (full inspection passed)</label>
      <div class="insp-legend">${RES.map(([, l, col]) => `<span><i style="background:${col}"></i>${l}</span>`).join("")}</div>
      <div class="fg" style="margin-top:14px">
        <div class="f"><label>Inspection date</label><input type="date" data-k="date" value="${esc(ins.date)}"></div>
        <div class="f"><label>Inspected by</label><input data-k="inspector" value="${esc(ins.inspector || "")}" placeholder="Mechanic's name"></div>
        <div class="f"><label>ASE certification # (optional)</label><input data-k="ase" value="${esc(ins.ase || "")}"></div>
        <div class="f"><label>Odometer (miles)</label><input type="number" data-k="odometer" value="${esc(ins.odometer)}"></div>
      </div>
      <label class="chk" style="margin-top:12px"><input type="checkbox" data-pub ${ins.public !== false ? "checked" : ""}> Show this report to customers on the website</label></div>
    <div class="card" style="margin-bottom:14px"><h3>Measurements</h3><p style="color:var(--muted);font-size:13px;margin:-4px 0 10px">Fill these in and the tire, brake and battery items are rated for you.</p>
      <b style="font-size:14px">Tire tread depth (/32")</b><p style="color:var(--muted);font-size:12px;margin:2px 0 6px">${esc(MEASURES.tread.hint)}</p>
      <div class="insp-meas">${WHEELS.map(([w, l]) => `<div class="m"><label>${l}</label><input type="number" min="0" max="20" step="1" data-tread="${w}" value="${esc(ins.tread[w] ?? "")}">${lvlTag(level("tread", ins.tread[w]))}</div>`).join("")}</div>
      <b style="font-size:14px;display:block;margin-top:12px">Brake pad thickness (mm)</b><p style="color:var(--muted);font-size:12px;margin:2px 0 6px">${esc(MEASURES.pads.hint)}</p>
      <div class="insp-meas">${WHEELS.map(([w, l]) => `<div class="m"><label>${l}</label><input type="number" min="0" max="20" step="0.5" data-pads="${w}" value="${esc(ins.pads[w] ?? "")}">${lvlTag(level("pads", ins.pads[w]))}</div>`).join("")}</div>
      <b style="font-size:14px;display:block;margin-top:12px">Battery test</b><p style="color:var(--muted);font-size:12px;margin:2px 0 6px">12.4 V or more and at least 80% of the rated cold cranking amps (CCA) passes.</p>
      <div class="insp-meas"><div class="m"><label>Voltage (V)</label><input type="number" step="0.01" data-batt="volts" value="${esc(ins.battery.volts ?? "")}"></div>
        <div class="m"><label>Tested CCA</label><input type="number" data-batt="cca" value="${esc(ins.battery.cca ?? "")}"></div><div class="m"><label>Rated CCA</label><input type="number" data-batt="rated" value="${esc(ins.battery.rated ?? "")}"></div>
        <div class="m"><label>Result</label>${lvlTag(battLevel(ins.battery))}</div></div></div>
    ${CHECKLIST.map(([g, title, items]) => { const ks = items.map((_, i) => key(g, i)), n = (v) => ks.filter((k) => ins.results[k] === v).length;
      return `<details class="card insp-grp" data-g="${g}" ${open.has(g) ? "open" : ""}><summary><span>${esc(title)} <small style="color:var(--muted);font-weight:500">${ks.filter((k) => ins.results[k]).length}/${items.length}</small></span>
        <span class="bar">${RES.map(([v, , col]) => `<i style="width:${(n(v) / items.length) * 100}%;background:${col}"></i>`).join("")}</span>
        <button class="b sm" type="button" data-grpok="${g}">All good</button></summary>
        ${items.map((label, i) => { const k = key(g, i), r = ins.results[k]; return `<div class="insp-row"><span class="lbl">${esc(label)}</span><span class="insp-opts">${RES.map(([v, l, col]) => `<button type="button" data-set="${k}|${v}" class="${r === v ? "on" : ""}" style="${r === v ? `background:${col};border-color:${col}` : ""}"><i style="background:${r === v ? "#fff" : col}"></i>${l}</button>`).join("")}</span>
          ${r && r !== "ok" && r !== "na" || ins.notes[k] || ins.photos[k] ? `<div class="insp-extra"><input class="note" data-note="${k}" value="${esc(ins.notes[k] || "")}" placeholder="${r === "rep" ? "What was repaired? (e.g. new front pads and rotors)" : "What did you find? (e.g. small chip low on the windshield)"}">
            ${ins.photos[k] ? `<a href="${esc(ins.photos[k])}" target="_blank" rel="noopener"><img src="${esc(ins.photos[k])}" alt=""></a><button class="b sm" type="button" data-rmph="${k}">✕</button>` : ctx.upload ? `<label class="b sm" style="cursor:pointer">📷 Add photo<input type="file" accept="image/*" hidden data-ph="${k}"></label>` : ""}</div>` : ""}</div>`; }).join("")}</details>`; }).join("")}
    <div class="card"><div class="f"><label>Overall comments</label><textarea data-k="comments" placeholder="Anything the buyer should know.">${esc(ins.comments || "")}</textarea></div></div>`;
    const $$ = (s) => V.querySelectorAll(s);
    V.querySelector("[data-back]").onclick = (e) => { e.preventDefault(); ctx.onBack(); };
    $$("[data-k]").forEach((el) => (el.oninput = () => (ins[el.dataset.k] = el.value)));
    $$("[data-tread]").forEach((el) => (el.onchange = () => { ins.tread[el.dataset.tread] = el.value; syncMeasures(); draw(); }));
    $$("[data-pads]").forEach((el) => (el.onchange = () => { ins.pads[el.dataset.pads] = el.value; syncMeasures(); draw(); }));
    $$("[data-batt]").forEach((el) => (el.onchange = () => { ins.battery[el.dataset.batt] = el.value; syncMeasures(); draw(); }));
    V.querySelector("[data-pub]").onchange = (e) => (ins.public = e.target.checked);
    $$("details.insp-grp").forEach((d) => (d.ontoggle = () => (d.open ? open.add(d.dataset.g) : open.delete(d.dataset.g))));
    V.querySelector("[data-allok]").onchange = (e) => {
      if (e.target.checked) { CHECKLIST.forEach(([g, , xs]) => xs.forEach((_, i) => (ins.results[key(g, i)] = "ok"))); ins.notes = {}; ctx.toast(`All ${ITEM_COUNT} points marked good. Add the measurements if you have them, then Save.`); }
      else { if (!confirm("Clear all the results?")) { e.target.checked = true; return; } ins.results = {}; }
      draw();
    };
    $$("[data-grpok]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); const g = b.dataset.grpok; CHECKLIST.find((x) => x[0] === g)[2].forEach((_, i) => (ins.results[key(g, i)] = "ok")); open.add(g); draw(); }));
    $$("[data-set]").forEach((b) => (b.onclick = () => { const [k, v] = b.dataset.set.split("|"); if (ins.results[k] === v) delete ins.results[k]; else ins.results[k] = v; open.add(k.split(".")[0]); draw(); }));
    $$("[data-note]").forEach((el) => (el.oninput = () => { ins.notes[el.dataset.note] = el.value; if (!el.value) delete ins.notes[el.dataset.note]; }));
    $$("[data-ph]").forEach((el) => (el.onchange = async () => { const f = el.files[0]; if (!f) return; try { ins.photos[el.dataset.ph] = await ctx.upload(f); draw(); } catch (_) { ctx.toast("Could not upload the photo.", 1); } }));
    $$("[data-rmph]").forEach((b) => (b.onclick = () => { delete ins.photos[b.dataset.rmph]; draw(); }));
    V.querySelector("[data-print]").onclick = () => { const w = window.open("", "_blank"); if (!w) return ctx.toast("Allow pop-ups to print.", 1); w.document.write(reportPage({ ...c, inspection: ins }, ctx.settings, true)); w.document.close(); setTimeout(() => w.print(), 600); };
    V.querySelector("[data-save]").onclick = async (e) => { e.target.disabled = true; ins.updatedAt = new Date().toISOString(); ins.grade = summary(ins).grade;
      try { await ctx.onSave(ins); ctx.toast("Inspection saved"); } catch (x) { ctx.toast("Could not save the inspection.", 1); } e.target.disabled = false; };
  };
  draw();
}

const fdate = (s) => (s ? new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "");
const measuresHTML = (ins) => {
  const cell = (label, v, unit, l) => `<div style="background:#f6f4f2;border-radius:8px;padding:8px 10px"><span style="display:block;font-size:11px;color:#6f6661;text-transform:uppercase;letter-spacing:.05em">${label}</span><b>${esc(v)}${unit}</b>${l ? ` <span style="color:${resOf(l)[2]};font-weight:700">${resOf(l)[3]}</span>` : ""}</div>`;
  const t = WHEELS.filter(([w]) => ins.tread?.[w] !== undefined && ins.tread[w] !== "").map(([w, l]) => cell("Tread " + l, ins.tread[w], '/32"', level("tread", ins.tread[w])));
  const p = WHEELS.filter(([w]) => ins.pads?.[w] !== undefined && ins.pads[w] !== "").map(([w, l]) => cell("Pads " + l, ins.pads[w], " mm", level("pads", ins.pads[w])));
  const b = ins.battery && (ins.battery.volts || ins.battery.cca) ? [cell("Battery", [ins.battery.volts && ins.battery.volts + " V", ins.battery.cca && ins.battery.cca + " CCA"].filter(Boolean).join(" · "), "", battLevel(ins.battery))] : [];
  const all = [...t, ...p, ...b];
  return all.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:10px 0">${all.join("")}</div>` : "";
};

// Full report as an HTML page (print view and the public customer page)
export function reportPage(c, S = {}, print = false) {
  const ins = c.inspection || {}, sm = summary(ins);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Inspection report · ${esc(c.year)} ${esc(c.name)}</title>
  <style>*{box-sizing:border-box}body{margin:0;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#1c1717;background:${print ? "#fff" : "#f4f2f1"}}
  .w{max-width:900px;margin:0 auto;padding:${print ? "0" : "24px 16px 60px"}}.paper{background:#fff;border-radius:${print ? 0 : 12}px;padding:${print ? "0" : "28px"};${print ? "" : "box-shadow:0 10px 30px rgba(0,0,0,.08)"}}
  .hd{display:flex;justify-content:space-between;gap:16px;align-items:center;border-bottom:3px solid #111;padding-bottom:14px}.hd img{height:52px}
  h1{font-size:26px;margin:16px 0 2px}.sub{color:#6f6661}.grade{display:inline-block;margin:14px 0;padding:10px 16px;border-radius:10px;color:#fff;font-weight:800;font-size:20px;background:${sm.color}}
  .kv{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin:10px 0}.kv div{background:#f6f4f2;border-radius:8px;padding:8px 10px}.kv span{display:block;font-size:11px;color:#6f6661;text-transform:uppercase;letter-spacing:.05em}
  .stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.stats b{padding:6px 10px;border-radius:99px;color:#fff;font-size:13px}
  h2{font-size:16px;margin:22px 0 6px;padding-bottom:4px;border-bottom:1px solid #e4dfdc;display:flex;justify-content:space-between}
  .it{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px dashed #eee;font-size:14px}.it em{display:block;color:#6f6661;font-style:normal;font-size:13px}.it img{height:70px;border-radius:6px;margin-top:4px}
  .r{font-weight:700;white-space:nowrap}.foot{margin-top:24px;font-size:12px;color:#8a8580}@media print{.np{display:none}}</style></head><body><div class="w"><div class="paper">
  <div class="hd"><div><b style="font-size:18px">${esc(S.name || "")}</b><br><span class="sub">${esc([S.street, S.city, S.state].filter(Boolean).join(", "))}${S.phone ? " · " + esc(S.phone) : ""}</span></div>${S.logo ? `<img src="${esc(S.logo)}" alt="">` : ""}</div>
  <h1>Vehicle inspection report</h1><div class="sub">${esc(c.year)} ${esc(c.name)} ${esc(c.trim || "")}</div>
  <div class="grade">${sm.complete && !sm.att && !sm.fail ? "✓ " : ""}${esc(sm.grade)}</div>
  <div class="stats">${RES.map(([v, l, col]) => `<b style="background:${col}">${sm[v]} ${l.toLowerCase()}</b>`).join("")}<b style="background:#444">${ITEM_COUNT} points</b></div>
  <div class="kv"><div><span>VIN</span>${esc(c.vin || "—")}</div><div><span>Odometer</span>${ins.odometer ? Number(ins.odometer).toLocaleString("en-US") + " mi" : "—"}</div><div><span>Date</span>${esc(fdate(ins.date))}</div><div><span>Inspected by</span>${esc(ins.inspector || "—")}${ins.ase ? " · ASE #" + esc(ins.ase) : ""}</div></div>
  ${measuresHTML(ins)}
  ${CHECKLIST.map(([g, title, items]) => `<h2><span>${esc(title)}</span><small class="sub">${items.filter((_, i) => ["ok", "rep"].includes(ins.results?.[key(g, i)])).length}/${items.length} good</small></h2>
    ${items.map((label, i) => { const k = key(g, i), r = ins.results?.[k], R = resOf(r); return `<div class="it"><span>${esc(label)}${ins.notes?.[k] ? `<em>${esc(ins.notes[k])}</em>` : ""}${ins.photos?.[k] ? `<br><img src="${esc(ins.photos[k])}" alt="">` : ""}</span><span class="r" style="color:${R ? R[2] : "#bbb"}">${R ? R[3] + " " + R[1] : "Not checked"}</span></div>`; }).join("")}`).join("")}
  ${ins.comments ? `<h2>Comments</h2><p style="white-space:pre-wrap">${esc(ins.comments)}</p>` : ""}
  <p class="foot">Inspection by the dealer on the date shown, following the kind of checklist used for manufacturer certified pre-owned vehicles. It describes the vehicle's condition at that time and is not a warranty. See the Buyers Guide for warranty information. You're welcome to have your own mechanic inspect the vehicle.</p>
  ${print ? "" : `<p class="np" style="margin-top:20px"><button onclick="print()" style="font:inherit;padding:10px 16px;border-radius:8px;border:1px solid #ccc;background:#fff;cursor:pointer">🖨 Print</button></p>`}
  </div></div></body></html>`;
}

// Short summary block for the car page on a dealer website (inline styles so it fits any template)
export function siteSummary(c, reportUrl, dark = false) {
  const ins = c.inspection; if (!ins || ins.public === false || !ins.grade) return "";
  const sm = summary(ins), fg = dark ? "#efebe7" : "#1c1717", mute = dark ? "#a39992" : "#6f6661", bg = dark ? "rgba(255,255,255,.04)" : "#fff", line = dark ? "rgba(255,255,255,.12)" : "#e4dfdc";
  const groups = CHECKLIST.map(([g, title, items]) => { const good = items.filter((_, i) => ["ok", "rep", "na"].includes(ins.results?.[key(g, i)])).length; return [title, good, items.length]; });
  const chips = (k, l, u, m) => WHEELS.filter(([w]) => ins[k]?.[w] !== undefined && ins[k][w] !== "").map(([w]) => { const lv = level(m, ins[k][w]); return `<span style="border:1px solid ${line};border-radius:99px;padding:3px 9px;font-size:12px">${l} ${w} <b style="color:${lv ? resOf(lv)[2] : fg}">${esc(ins[k][w])}${u}</b></span>`; }).join("");
  return `<div style="border:1px solid ${line};border-radius:10px;padding:16px;margin:18px 0;background:${bg};color:${fg};font-family:inherit">
    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><b style="font-size:18px">📋 ${ITEM_COUNT}-point inspection</b><span style="background:${sm.color};color:#fff;padding:5px 10px;border-radius:6px;font-weight:700;font-size:13px">${esc(sm.grade)}</span></div>
    <div style="color:${mute};font-size:13px;margin:4px 0 10px">Inspected ${esc(fdate(ins.date))}${ins.inspector ? " by " + esc(ins.inspector) : ""}${ins.ase ? " · ASE #" + esc(ins.ase) : ""}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px 14px">${groups.map(([t, g, n]) => `<div style="display:flex;justify-content:space-between;gap:8px;font-size:13px;border-bottom:1px dashed ${line};padding:3px 0"><span>${esc(t)}</span><b style="color:${g === n ? "#1f8a4c" : "#c98a00"}">${g === n ? "✓" : g + "/" + n}</b></div>`).join("")}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${chips("tread", "Tread", '/32"', "tread")}${chips("pads", "Pads", "mm", "pads")}</div>
    <a href="${esc(reportUrl)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:12px;font-weight:700;color:inherit">See the full report →</a></div>`;
}
