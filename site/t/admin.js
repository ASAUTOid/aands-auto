// Simple admin for a dealer website made in the A & S dashboard: cars, messages, website details, marketing, password.
import { TEMPLATES, DEALER_TEMPLATES } from "./templates.js";
import * as FEEDS from "../feeds.js";
import { openStudio } from "../admin/studio.js";
import { ftpPanel } from "../admin/ftpui.js";
import { thumb, bindThumbs, openPreview } from "./gallery.js";

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "$" + Math.round(+n || 0).toLocaleString("en-US");
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clone = (x) => JSON.parse(JSON.stringify(x));
const fdt = (s) => (s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
const BODY = ["Truck", "SUV", "Sedan", "Coupe", "Minivan / Passenger Van", "Convertible", "Wagon", "Hatchback", "Van"];

const SLUG = (location.pathname.match(/^\/w\/([^/]+)/) || [])[1] || "";
const API = `/api/t/${SLUG}`;
const SITE_URL = location.origin + "/w/" + SLUG;
let PW = "", TD = null, LEADS = [], DOMAIN = "";

function toast(t, err) { const el = $("#toast"); el.textContent = t; el.className = "toast on" + (err ? " err" : ""); clearTimeout(toast.t); toast.t = setTimeout(() => (el.className = "toast"), err ? 5000 : 2200); }
async function api(path, opt = {}) {
  const r = await fetch(API + path, { ...opt, headers: { ...(opt.headers || {}), "x-admin-password": PW } });
  let b = null; try { b = await r.json(); } catch (_) {}
  if (r.status === 401) { logout(); throw { code: "unauthorized" }; }
  if (!r.ok) throw { code: (b && b.error) || "http_" + r.status };
  return b;
}
const J = (m, b) => ({ method: m, headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const save = () => api("/data", J("PUT", TD));
const S = () => TD.settings;

/* ---------- login ---------- */
async function tryLogin(pw) { try { const r = await fetch(API + "/login", { method: "POST", headers: { "x-admin-password": pw } }); return r.status === 401 ? false : r.ok ? true : null; } catch (_) { return null; } }
function logout() { PW = ""; try { sessionStorage.removeItem("tpw:" + SLUG); } catch (_) {} $("#app").hidden = true; $("#login").hidden = false; }
async function boot() {
  try { const r = await fetch(API + "/data", { cache: "no-store" }); if (r.ok) { const d = await r.json(); $("#loginName").textContent = d.settings.name || "Website admin"; if (d.settings.logo) { $("#loginLogo").src = d.settings.logo; $("#loginLogo").hidden = false; } } } catch (_) {}
  let saved = ""; try { saved = sessionStorage.getItem("tpw:" + SLUG) || ""; } catch (_) {}
  if (saved && (await tryLogin(saved))) return start(saved);
  $("#login").hidden = false; $("#loginPw").focus();
  $("#loginForm").onsubmit = async (e) => { e.preventDefault(); const pw = $("#loginPw").value; $("#loginErr").textContent = "Checking…"; const ok = await tryLogin(pw);
    if (ok) { try { sessionStorage.setItem("tpw:" + SLUG, pw); } catch (_) {} $("#loginErr").textContent = ""; start(pw); } else $("#loginErr").textContent = ok === null ? "Could not reach the server." : "Wrong password."; };
}
async function start(pw) {
  PW = pw; $("#login").hidden = true; $("#app").hidden = false;
  try {
    TD = await (await fetch(API + "/data", { cache: "no-store" })).json(); TD.settings = TD.settings || {}; TD.cars = TD.cars || [];
    LEADS = await api("/leads");
    try { const m = await (await fetch("/api/data", { cache: "no-store" })).json(); DOMAIN = ((m.settings && m.settings.websites) || []).find((w) => w.slug === SLUG)?.domain || ""; } catch (_) {}
  } catch (x) { $("#view").innerHTML = `<p class="empty">Could not load (${esc(x.code || "error")}). Reload the page.</p>`; return; }
  $("#logout").onclick = logout; $("#burger").onclick = () => document.body.classList.toggle("nav-open");
  $("#viewSite").href = DOMAIN ? "https://" + DOMAIN : SITE_URL;
  brand(); window.onhashchange = route; route();
}
function brand() { $("#sideName").textContent = S().name || "My website"; if (S().logo) { $("#sideLogo").src = S().logo; $("#sideLogo").hidden = false; } document.title = (S().name || "Website") + " · Admin"; }

/* ---------- router ---------- */
const NAV = [["cars", "🚗", "Cars"], ["messages", "✉", "Messages"], ["website", "🌐", "Website"], ["marketing", "📣", "Marketing"], ["account", "🔑", "Password"]];
function route() {
  document.body.classList.remove("nav-open");
  const [page, id] = (location.hash.replace(/^#\/?/, "") || "cars").split("/");
  const nNew = LEADS.filter((l) => l.status === "new").length;
  $("#nav").innerHTML = NAV.map(([k, ic, l]) => `<a href="#/${k}" class="${page === k ? "on" : ""}"><span class="ic">${ic}</span>${l}${k === "messages" && nNew ? `<span class="cnt">${nNew}</span>` : ""}</a>`).join("");
  scrollTo(0, 0);
  const V = $("#view");
  ({ cars: id ? carEdit : cars, messages, website, marketing, account }[page] || cars)(V, id);
}
const go = (h) => (location.hash === h ? route() : (location.hash = h));
const f = (id, l, v, t = "text", x = "") => `<div class="f ${x.includes("wide") ? "w2" : ""}"><label for="${id}">${l}</label><input id="${id}" type="${t}" value="${esc(v ?? "")}" ${t === "number" ? 'step="any"' : ""} ${x.replace("wide", "")}></div>`;
const sel = (id, l, v, opts, x = "") => `<div class="f ${x}"><label for="${id}">${l}</label><select id="${id}">${opts.map((o) => { const [a, b] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(a)}" ${String(a) === String(v ?? "") ? "selected" : ""}>${esc(b)}</option>`; }).join("")}</select></div>`;
const area = (id, l, v) => `<div class="f wf"><label for="${id}">${l}</label><textarea id="${id}">${esc(v ?? "")}</textarea></div>`;
const val = (id) => (document.getElementById(id)?.value || "").trim();
const num = (id) => { const x = val(id); return x === "" ? null : +x; };
async function upload(blob, max) {
  const bmp = await createImageBitmap(blob), s = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s); c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const out = await new Promise((r) => c.toBlob(r, "image/webp", 0.86));
  return (await api("/upload", { method: "POST", headers: { "content-type": "image/webp" }, body: out })).url;
}

/* ---------- cars ---------- */
function cars(V) {
  const L = TD.cars;
  V.innerHTML = `<div class="ph"><div><h1>Cars</h1><p>${L.filter((c) => c.status === "lot").length} for sale · ${L.filter((c) => c.status === "sold").length} sold</p></div><div class="act"><a class="b primary" href="#/cars/new">+ Add car</a></div></div>
  ${L.length ? `<div class="tw"><table class="t"><thead><tr><th></th><th>Car</th><th class="r">Miles</th><th class="r">Price</th><th>Status</th></tr></thead><tbody>${L.map((c) => `<tr class="rowlink" data-href="#/cars/${esc(c.id)}" tabindex="0">
    <td>${c.img ? `<img class="th" src="${esc(c.img)}" alt="">` : ""}</td><td><b>${esc(c.year)} ${esc(c.name)}</b><span class="sub">${esc(c.trim || "")}${c.vin ? " · " + esc(c.vin) : ""}</span></td>
    <td class="r num">${c.miles != null ? Number(c.miles).toLocaleString("en-US") : "—"}</td><td class="r num">${money(c.price)}</td>
    <td>${c.status === "lot" ? '<span class="pill ok">For sale</span>' : c.status === "sold" ? '<span class="pill bad">Sold</span>' : '<span class="pill">Hidden</span>'}${c.featured ? " ★" : ""}</td></tr>`).join("")}</tbody></table></div>`
    : '<div class="card empty">No cars yet. Click <b>+ Add car</b> to put your first car on your website.</div>'}`;
  $$("tr[data-href]").forEach((tr) => { tr.onclick = () => go(tr.dataset.href); tr.onkeydown = (e) => e.key === "Enter" && go(tr.dataset.href); });
}
async function decodeVin(vin) {
  const x = (await (await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`)).json()).Results?.[0] || {};
  const tc = (s) => String(s || "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const bc = String(x.BodyClass || ""), dt = String(x.DriveType || "");
  return { year: x.ModelYear, make: tc(x.Make), model: x.Model, trim: x.Trim || "", fuel: tc(x.FuelTypePrimary), hp: x.EngineHP ? Math.round(x.EngineHP) : "",
    body: /pickup/i.test(bc) ? "Truck" : /sport utility|crossover/i.test(bc) ? "SUV" : /minivan/i.test(bc) ? "Minivan / Passenger Van" : /coupe/i.test(bc) ? "Coupe" : /convertible/i.test(bc) ? "Convertible" : /wagon/i.test(bc) ? "Wagon" : /hatchback/i.test(bc) ? "Hatchback" : /van/i.test(bc) ? "Van" : /sedan/i.test(bc) ? "Sedan" : "",
    engine: [x.DisplacementL ? (+x.DisplacementL).toFixed(1) + "L" : "", x.EngineCylinders ? (/v-shaped/i.test(x.EngineConfiguration) ? "V" : /in-line/i.test(x.EngineConfiguration) ? "I" : "") + x.EngineCylinders : ""].filter(Boolean).join(" "),
    drive: /4wd|4x4|4-wheel/i.test(dt) ? "4WD" : /awd|all-wheel/i.test(dt) ? "AWD" : /fwd|front/i.test(dt) ? "FWD" : /rwd|rear/i.test(dt) ? "RWD" : "",
    trans: x.TransmissionStyle ? (x.TransmissionSpeeds ? x.TransmissionSpeeds + "-Speed " : "") + x.TransmissionStyle : "" };
}
function carEdit(V, id) {
  const isNew = id === "new", orig = TD.cars.find((c) => c.id === id);
  if (!isNew && !orig) return go("#/cars");
  const c = isNew ? { id: uid("c"), year: new Date().getFullYear(), body: "Truck", status: "lot", equip: [], img: "", addedAt: new Date().toISOString().slice(0, 10) } : clone(orig);
  const model = c.name && c.make && c.name.startsWith(c.make + " ") ? c.name.slice(c.make.length + 1) : c.name || "";
  V.innerHTML = `<div class="crumb"><a href="#/cars">Cars</a> / ${isNew ? "New car" : esc(c.year + " " + c.name)}</div>
  <div class="ph"><div><h1>${isNew ? "Add a car" : esc(c.year + " " + c.name)}</h1></div><div class="act">${isNew ? "" : '<button class="b danger" type="button" id="del">Delete</button>'}<button class="b primary" type="button" id="saveCar">Save</button></div></div>
  <div class="split"><div class="card"><h3>Vehicle</h3><div class="fg">
    <div class="f w2"><label for="vin">VIN</label><div style="display:flex;gap:8px"><input id="vin" maxlength="17" value="${esc(c.vin || "")}" style="flex:1;min-width:0;padding:9px 11px;border:1px solid var(--line);border-radius:6px;background:var(--panel);font-family:var(--mono);text-transform:uppercase"><button class="b" type="button" id="dec">Decode VIN</button></div></div>
    ${f("year", "Year", c.year, "number")}${f("make", "Make", c.make)}${f("model", "Model", model)}${f("trim", "Trim", c.trim)}${sel("body", "Body", c.body, BODY)}
    ${f("price", "Price", c.price, "number")}${f("miles", "Mileage", c.miles, "number")}${f("ext", "Exterior colour", c.ext)}${f("int", "Interior", c.int)}
    ${f("engine", "Engine", c.engine)}${f("trans", "Transmission", c.trans)}${f("drive", "Drivetrain", c.drive)}${f("fuel", "Fuel", c.fuel)}${f("mpg", "MPG city / hwy", c.mpg)}${f("hp", "Horsepower", c.hp, "number")}${f("stock", "Stock #", c.stock)}
    ${area("equip", "Equipment (one per line)", (c.equip || []).join("\n"))}${area("desc", "Description", c.desc)}</div></div>
  <div class="grid"><div class="card"><h3>Photo</h3><div class="photo" id="pv">${c.img ? `<img src="${esc(c.img)}" alt="">` : "No photo yet"}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center"><input type="file" accept="image/*" id="file" style="font-size:13px;flex:1"><button class="b sm primary" type="button" id="studio">✨ AI photo studio</button></div>
    <p style="color:var(--muted);font-size:13px;margin:6px 0 0">The AI studio removes or replaces the background, fixes the light and adds your banner.</p></div>
    <div class="card"><h3>On the website</h3>${sel("status", "Status", c.status, [["lot", "For sale"], ["sold", "Sold"], ["hidden", "Hidden"]])}
    <label class="chk" style="margin-top:12px"><input type="checkbox" id="feat" ${c.featured ? "checked" : ""}> Show at the top of the home page</label></div></div></div>`;
  $("#vin").oninput = (e) => (e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
  $("#dec").onclick = async () => { const v = val("vin"); if (v.length !== 17) return toast("Enter all 17 characters of the VIN.", 1); $("#dec").textContent = "Decoding…";
    try { const x = await decodeVin(v); ["year", "make", "model", "trim", "engine", "drive", "fuel", "trans", "hp"].forEach((k) => { if (x[k] && !val(k)) document.getElementById(k).value = x[k]; }); if (x.body) $("#body").value = x.body; toast(x.make ? `Decoded: ${x.year} ${x.make} ${x.model}` : "Could not decode this VIN.", !x.make); }
    catch (_) { toast("Could not reach the VIN decoder.", 1); } $("#dec").textContent = "Decode VIN"; };
  $("#file").onchange = async (e) => { const fl = e.target.files[0]; if (!fl) return; $("#pv").textContent = "Uploading…"; try { c.img = await upload(fl, 1600); $("#pv").innerHTML = `<img src="${esc(c.img)}" alt="">`; } catch (_) { $("#pv").textContent = "Upload failed"; } };
  $("#studio").onclick = () => { if (!c.img) return toast("Upload a photo first.", 1);
    openStudio({ src: c.img, settings: S(), price: num("price") || c.price, onSave: async (blob, kind) => { const u = await upload(blob, kind === "cut" ? 900 : 1600); if (kind === "img") { c.img = u; $("#pv").innerHTML = `<img src="${esc(u)}" alt="">`; } else c.cut = u; toast("Photo updated. Click Save."); } }); };
  if ($("#del")) $("#del").onclick = async () => { if (!confirm("Delete this car?")) return; TD.cars = TD.cars.filter((x) => x.id !== c.id); try { await save(); toast("Deleted"); go("#/cars"); } catch (x) { TD.cars.push(orig); toast("Could not delete.", 1); } };
  $("#saveCar").onclick = async () => {
    if (!val("make") || !val("model")) return toast("Add the make and model.", 1);
    if (!(num("price") > 0)) return toast("Add a price.", 1);
    if (!c.img) return toast("Add a photo.", 1);
    Object.assign(c, { vin: val("vin") || null, year: num("year"), make: val("make"), name: val("make") + " " + val("model"), trim: val("trim") || null, body: val("body"), price: num("price"), miles: num("miles"),
      ext: val("ext") || null, int: val("int") || null, engine: val("engine") || null, trans: val("trans") || null, drive: val("drive") || null, fuel: val("fuel") || null, mpg: val("mpg") || null, hp: num("hp"),
      stock: val("stock") || null, equip: val("equip").split("\n").map((s) => s.trim()).filter(Boolean), desc: val("desc"), status: val("status"), featured: $("#feat").checked });
    const before = clone(TD.cars), i = TD.cars.findIndex((x) => x.id === c.id);
    if (c.featured) TD.cars.forEach((x) => (x.featured = false));
    if (i >= 0) TD.cars[i] = c; else TD.cars.unshift(c);
    try { await save(); toast("Saved. Your website is updated."); go("#/cars"); } catch (x) { TD.cars = before; toast("Could not save (" + (x.code || "error") + ").", 1); }
  };
}

/* ---------- messages ---------- */
function messages(V) {
  const L = LEADS.slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const car = (id) => TD.cars.find((c) => c.id === id);
  V.innerHTML = `<div class="ph"><div><h1>Messages</h1><p>Customers who wrote to you from your website.</p></div></div>
  ${L.length ? L.map((l) => `<div class="card" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><b style="font-size:17px">${esc(l.name)}</b> ${l.status === "new" ? '<span class="pill info">New</span>' : l.status === "done" ? '<span class="pill ok">Done</span>' : '<span class="pill warn">Contacted</span>'}
      <div style="color:var(--muted);font-size:14px">${esc([l.phone, l.email].filter(Boolean).join(" · "))} · ${fdt(l.createdAt)}${l.carId && car(l.carId) ? " · about the " + esc(car(l.carId).year + " " + car(l.carId).name) : ""}</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:start">${l.phone ? `<a class="b sm" href="tel:${esc(l.phone.replace(/[^\d+]/g, ""))}">Call</a><a class="b sm" href="sms:${esc(l.phone.replace(/[^\d+]/g, ""))}">Text</a>` : ""}${l.email ? `<a class="b sm" href="mailto:${esc(l.email)}">Email</a>` : ""}
      <select class="b sm" data-st="${esc(l.id)}" aria-label="Status"><option value="new" ${l.status === "new" ? "selected" : ""}>New</option><option value="contacted" ${l.status === "contacted" ? "selected" : ""}>Contacted</option><option value="done" ${l.status === "done" ? "selected" : ""}>Done</option></select>
      <button class="b sm danger" type="button" data-del="${esc(l.id)}">Delete</button></div></div>
      ${l.message ? `<p style="white-space:pre-wrap;margin:10px 0 0">${esc(l.message)}</p>` : ""}</div>`).join("") : '<div class="card empty">No messages yet. When someone fills in a form on your website, it shows up here.</div>'}`;
  const put = async () => { try { await api("/leads", J("PUT", LEADS)); route(); } catch (_) { toast("Could not save.", 1); } };
  $$("[data-st]").forEach((s) => (s.onchange = () => { LEADS.find((l) => l.id === s.dataset.st).status = s.value; put(); }));
  $$("[data-del]").forEach((b) => (b.onclick = () => { if (!confirm("Delete this message?")) return; LEADS = LEADS.filter((l) => l.id !== b.dataset.del); put(); }));
}

/* ---------- website ---------- */
function website(V) {
  const s = S(); s.hours = s.hours && s.hours.length ? s.hours : [["Monday – Friday", "9:00 AM – 6:00 PM"], ["Saturday", "10:00 AM – 4:00 PM"], ["Sunday", "Closed"]];
  let tpl = s.template || "classic", logo = s.logo || "";
  const T = (k) => TEMPLATES[k];
  V.innerHTML = `<div class="ph"><div><h1>Website</h1><p>Your details, logo and design. <a href="${esc(DOMAIN ? "https://" + DOMAIN : SITE_URL)}" target="_blank" rel="noopener">${esc(DOMAIN || SITE_URL)} ↗</a></p></div><div class="act"><button class="b primary" type="button" id="saveW">Save</button></div></div>
  <div class="grid g2"><div class="card"><h3>Business</h3><div class="fg">${f("w_name", "Business name", s.name, "text", "wide")}${f("w_phone", "Phone", s.phone, "tel")}${f("w_email", "Email", s.email, "email")}
    ${f("w_street", "Street", s.street, "text", "wide")}${f("w_city", "City", s.city)}${f("w_state", "State", s.state)}${f("w_zip", "ZIP", s.zip)}</div></div>
    <div class="card"><h3>Logo</h3><div class="photo" id="lg" style="aspect-ratio:3/1">${logo ? `<img src="${esc(logo)}" alt="" style="object-fit:contain">` : "No logo yet (your name is shown instead)"}</div>
      <div style="display:flex;gap:8px;margin-top:10px;align-items:center"><input type="file" accept="image/*" id="lgFile" style="font-size:13px;flex:1">${logo ? '<button class="b sm" type="button" id="lgDel">Remove</button>' : ""}</div>
      <h3 style="margin-top:18px">Opening hours</h3><div class="fg">${s.hours.map((h, i) => f("h" + i, h[0], h[1])).join("")}</div></div></div>
  <div class="card" style="margin-top:14px"><h3>Texts</h3><div class="fg">${f("w_head", "Headline", s.heroTitle, "text", 'wide placeholder="Quality used cars"')}${area("w_tag", "Intro under the headline", s.tagline)}${area("w_about", "About us", s.about)}
    ${f("w_apr", "APR for the payment calculator %", s.apr ?? 12.9, "number")}<div class="f"><label for="w_acc">Main colour</label><input id="w_acc" type="color" value="${esc(s.accent || T(tpl).vars.accent)}" style="height:40px;padding:2px"></div>
    <div class="f" style="align-self:end"><button class="b sm" type="button" id="accReset">Use the template's colour</button></div></div></div>
  <h2 class="sec">Design · choose a template</h2>
  <div class="grid g3">${DEALER_TEMPLATES.map((k) => `<div class="card tpl ${k === tpl ? "on" : ""}" data-tpl="${k}">${thumb(`${SITE_URL}?template=${k}`, "Preview " + T(k).name)}<b>${esc(T(k).name)}</b><small style="color:var(--muted)">${esc(T(k).desc)}</small>
    <div style="display:flex;gap:6px"><button class="b sm" type="button" data-big="${k}">🔍 Big preview</button><button class="b sm ${k === tpl ? "" : "primary"}" type="button" data-pick="${k}">${k === tpl ? "Selected" : "Choose"}</button></div></div>`).join("")}</div>`;
  let accTouched = false;
  $("#w_acc").oninput = () => (accTouched = true);
  $("#accReset").onclick = () => { s.accent = ""; accTouched = false; $("#w_acc").value = T(tpl).vars.accent; toast("Template colour selected. Click Save."); };
  $$("[data-pick]").forEach((b) => (b.onclick = () => { tpl = b.dataset.pick; $$("[data-tpl]").forEach((c) => c.classList.toggle("on", c.dataset.tpl === tpl)); $$("[data-pick]").forEach((x) => { x.textContent = x.dataset.pick === tpl ? "Selected" : "Choose"; x.classList.toggle("primary", x.dataset.pick !== tpl); }); if (!accTouched && !s.accent) $("#w_acc").value = T(tpl).vars.accent; }));
  const pick = (k) => document.querySelector(`[data-pick="${k}"]`).click();
  const big = (k) => { const i = DEALER_TEMPLATES.indexOf(k), n = DEALER_TEMPLATES.length;
    openPreview(`${SITE_URL}?template=${k}`, T(k).name + " · with your cars", { onUse: () => { pick(k); toast("Chosen. Click Save to put it on your website."); }, useLabel: "Choose this design",
      prev: () => big(DEALER_TEMPLATES[(i - 1 + n) % n]), next: () => big(DEALER_TEMPLATES[(i + 1) % n]) }); };
  $$("[data-big]").forEach((b) => (b.onclick = () => big(b.dataset.big)));
  bindThumbs(V, (url) => big(new URLSearchParams(url.split("?")[1]).get("template")));
  $("#lgFile").onchange = async (e) => { const fl = e.target.files[0]; if (!fl) return; $("#lg").textContent = "Uploading…"; try { logo = await upload(fl, 600); $("#lg").innerHTML = `<img src="${esc(logo)}" alt="" style="object-fit:contain">`; } catch (_) { $("#lg").textContent = "Upload failed"; } };
  if ($("#lgDel")) $("#lgDel").onclick = () => { logo = ""; $("#lg").textContent = "No logo"; };
  $("#saveW").onclick = async () => {
    if (!val("w_name")) return toast("Add your business name.", 1);
    const before = clone(s);
    Object.assign(s, { name: val("w_name"), phone: val("w_phone"), email: val("w_email"), street: val("w_street"), city: val("w_city"), state: val("w_state"), zip: val("w_zip"), logo, template: tpl,
      heroTitle: val("w_head"), tagline: val("w_tag"), about: val("w_about"), apr: num("w_apr") ?? 12.9, accent: accTouched ? val("w_acc") : s.accent || "" });
    s.hours.forEach((h, i) => (h[1] = val("h" + i)));
    try { await save(); brand(); toast("Saved. Your website is updated."); website(V); } catch (x) { TD.settings = before; toast("Could not save.", 1); }
  };
}

/* ---------- marketing ---------- */
function marketing(V) {
  const s = S(); s.feeds = s.feeds || {};
  const lot = TD.cars.filter((c) => c.status === "lot");
  let adCar = lot[0]?.id;
  const feedUrl = (k) => `${location.origin}/feeds/t/${SLUG}/${k}.csv`, base = DOMAIN ? "https://" + DOMAIN : SITE_URL;
  const draw = () => {
    const ad = adCar ? FEEDS.adText(TD.cars.find((c) => c.id === adCar), s, base) : null;
    V.innerHTML = `<div class="ph"><div><h1>Marketing</h1><p>Send your cars to listing sites.</p></div><div class="act"><button class="b primary" type="button" id="saveM">Save dealer IDs</button></div></div>
    <div class="banner">Each listing site gives you a dealer ID when you sign up as a dealer. Put it in, click Save, then send the file: download it, give them the feed link, or send it by FTP below.</div>
    <div class="grid g4">${Object.entries(FEEDS.PRESETS).map(([k, p]) => `<div class="card" style="display:grid;gap:8px;align-content:start"><h3 style="margin:0">${esc(p.label)}</h3>
      <div class="f"><label>Dealer ID</label><input data-dealer="${k}" value="${esc(s.feeds[k]?.dealerId || "")}"></div>
      <button class="b sm" type="button" data-dl="${k}">Download CSV</button><button class="b sm" type="button" data-copy="${k}">Copy feed link</button></div>`).join("")}</div>
    <h2 class="sec">Send by FTP</h2><div id="ftpBox"></div>
    <h2 class="sec">Craigslist, Facebook Marketplace, OfferUp, KSL</h2>
    ${ad ? `<div class="split"><div class="card"><div class="f"><label for="adCar">Car</label><select id="adCar">${lot.map((c) => `<option value="${esc(c.id)}" ${c.id === adCar ? "selected" : ""}>${esc(c.year + " " + c.name)} · ${money(c.price)}</option>`).join("")}</select></div>
      <div class="f" style="margin-top:10px"><label>Title</label><input id="adTitle" value="${esc(ad.title)}"></div><div class="f" style="margin-top:10px"><label>Ad text</label><textarea id="adText" class="adtext">${esc(ad.text)}</textarea></div>
      <div class="formft" style="justify-content:flex-start"><button class="b" type="button" data-cp="adTitle">Copy title</button><button class="b primary" type="button" data-cp="adText">Copy ad text</button></div></div>
      <div class="card"><h3>Post it</h3>${FEEDS.CLASSIFIEDS.map(([k, l, u, how]) => `<div style="border-bottom:1px solid var(--line);padding:10px 0"><div style="display:flex;justify-content:space-between;align-items:center"><b>${esc(l)}</b><a class="b sm" href="${esc(u(s))}" target="_blank" rel="noopener">Open ↗</a></div><small style="color:var(--muted)">${esc(how)}</small></div>`).join("")}</div></div>` : '<div class="card empty">Add a car first.</div>'}`;
    $$("[data-dealer]").forEach((i) => (i.oninput = () => { s.feeds[i.dataset.dealer] = { ...(s.feeds[i.dataset.dealer] || {}), dealerId: i.value.trim() }; }));
    $$("[data-dl]").forEach((b) => (b.onclick = () => { const r = FEEDS.buildFeed(TD, b.dataset.dl, base); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([r.csv], { type: "text/csv" })); a.download = r.filename; a.click(); }));
    $$("[data-copy]").forEach((b) => (b.onclick = () => navigator.clipboard?.writeText(feedUrl(b.dataset.copy)).then(() => toast("Feed link copied"))));
    $$("[data-cp]").forEach((b) => (b.onclick = () => navigator.clipboard?.writeText($("#" + b.dataset.cp).value).then(() => toast("Copied"))));
    $("#adCar")?.addEventListener("change", (e) => { adCar = e.target.value; draw(); });
    $("#saveM").onclick = async () => { try { await save(); toast("Saved"); } catch (_) { toast("Could not save.", 1); } };
    ftpPanel($("#ftpBox"), { get: () => api("/ftp"), put: (c) => api("/ftp", J("PUT", c)), send: (feed) => api("/ftpsend", J("POST", { feed, base })) }, toast);
  };
  draw();
}

/* ---------- password ---------- */
function account(V) {
  V.innerHTML = `<div class="ph"><div><h1>Password</h1></div></div><div class="card" style="max-width:520px"><div class="fg">${f("p1", "New password (8+ characters)", "", "password")}${f("p2", "Repeat new password", "", "password")}</div>
    <div class="formft"><button class="b primary" type="button" id="pw">Change password</button></div></div>`;
  $("#pw").onclick = async () => { const a = $("#p1").value, b = $("#p2").value; if (a.length < 8) return toast("Use at least 8 characters.", 1); if (a !== b) return toast("The passwords are different.", 1);
    try { await api("/password", J("POST", { newPassword: a })); PW = a; try { sessionStorage.setItem("tpw:" + SLUG, a); } catch (_) {} toast("Password changed"); $("#p1").value = $("#p2").value = ""; } catch (_) { toast("Could not change the password.", 1); } };
}

boot();
