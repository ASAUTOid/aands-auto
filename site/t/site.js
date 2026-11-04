// Draws a dealer website from a template and the inventory saved in the dashboard.
// /           -> main website (when its template isn't the original Night Lot)
// /w/<slug>   -> an extra website made in Dashboard → Websites
// any domain listed on an extra website -> that website
// ?template=<id> previews a template.
import { TEMPLATES } from "./templates.js";
import { siteSummary, summary as inspSum } from "../admin/inspect.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "$" + Math.round(+n || 0).toLocaleString("en-US");
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];

async function loadData() {
  try { const r = await fetch("/api/data", { cache: "no-store" }); if (r.status === 200) return await r.json(); } catch (_) {}
  const html = await (await fetch("/index.html", { cache: "no-store" })).text();
  return JSON.parse(new DOMParser().parseFromString(html, "text/html").getElementById("site-data").textContent);
}

const SUBSLUG = (location.hostname.replace(/^www\./, "").match(/^([a-z0-9-]+)\.dealervexa\.[a-z.]+$/i) || [])[1];
const SLUGR = (location.pathname.match(/^\/w\/([^/]+)/) || [])[1] || SUBSLUG || "aands", WHERE = "website";
// send errors to DealerVexa HQ so problems are seen and fixed
const reportErr = (() => { let n = 0; return (message, stack, where) => { if (!message || n++ > 8) return; try { fetch("/api/report", { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify({ where, slug: SLUGR, message: String(message).slice(0, 400), stack: String(stack || "").slice(0, 1500), url: location.href }) }); } catch (_) {} }; })();
addEventListener("error", (e) => reportErr(e.message, e.error && e.error.stack, WHERE));
addEventListener("unhandledrejection", (e) => reportErr((e.reason && (e.reason.message || e.reason.code)) || String(e.reason), e.reason && e.reason.stack, WHERE));
const data = await loadData();
const MS = data.settings || {};
const host = location.hostname.replace(/^www\./, "");
const slug = (location.pathname.match(/^\/w\/([^/]+)/) || [])[1] || SUBSLUG;
const sites = MS.websites || [];
const entry = (slug && (sites.find((w) => w.slug === slug) || { slug, tenant: true, name: slug })) || sites.find((w) => w.domain && w.domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "") === host) || null;
let S, ALL, site, PAUSED = false;
const DEMO = new URLSearchParams(location.search).has("demo");
if (DEMO) {
  // template gallery: sample dealer details, real cars from the lot
  // a different made-up dealer for each template
  const DEMOS = {
    classic: ["Summit Ridge Motors", "Twin Falls", "214 Blue Lakes Blvd", "83301", "0142"],
    bold: ["Big Rig Auto Sales", "Pocatello", "88 Yellowstone Ave", "83201", "0187"],
    minimal: ["Northline Autos", "Boise", "1200 W Fairview Ave", "83702", "0119"],
    sport: ["Redline Car Co.", "Nampa", "450 Caldwell Blvd", "83651", "0163"],
    country: ["Snake River Trucks", "Jerome", "31 S Lincoln Ave", "83338", "0175"],
    luxury: ["Golden Mile Motorcars", "Meridian", "3300 E Overland Rd", "83642", "0128"],
    ocean: ["Blue Harbor Auto", "Coeur d'Alene", "705 N Lakeshore Dr", "83814", "0151"],
    urban: ["Downtown Drive", "Idaho Falls", "560 W Broadway St", "83402", "0194"],
    family: ["Happy Road Autos", "Rexburg", "140 N 2nd E", "83440", "0136"],
    budget: ["Cash Car Corner", "Caldwell", "905 Cleveland Blvd", "83605", "0181"],
  };
  const dm = DEMOS[new URLSearchParams(location.search).get("template")] || DEMOS.classic;
  S = { name: dm[0], phone: "(555) 555-" + dm[4], email: "sales@" + dm[0].toLowerCase().replace(/[^a-z]/g, "") + ".com", street: dm[2], city: dm[1], state: "ID", zip: dm[3], apr: 12.9,
    hours: [["Monday – Friday", "9:00 AM – 6:00 PM"], ["Saturday", "10:00 AM – 4:00 PM"], ["Sunday", "Closed"]] };
  // each template shows the cars on its own lot (site/demo/<template>/, made by tools/make_demo_photos.py), in a different order
  const tpl0 = DEMOS[new URLSearchParams(location.search).get("template")] ? new URLSearchParams(location.search).get("template") : "classic";
  const rot = Object.keys(DEMOS).indexOf(tpl0);
  const withLot = (data.cars || []).filter((c) => c.cut && /(^|\/)cut\/v\d+\.webp$/.test(c.cut));
  ALL = withLot.map((_, i, a) => a[(i + rot) % a.length]).map((c, i) => ({ ...c, status: "lot", featured: i === 0, img: `/demo/${tpl0}/${String(c.cut).match(/(v\d+)\.webp$/)[1]}.webp` }));
  if (!ALL.length) ALL = (data.cars || []).filter((c) => c.status === "lot");
  site = { ...S, tenant: "", demo: true, filter: {} };
} else if (entry && entry.tenant) {
  // a separate dealer: its own cars and details, edited at /w/<slug>/admin
  let td = null;
  try { const r = await fetch(`/api/t/${entry.slug}/data`, { cache: "no-store" }); if (r.ok) td = await r.json(); } catch (_) {}
  S = Object.assign({ name: entry.name, apr: 12.9, hours: [] }, td ? td.settings : {});
  ALL = td ? td.cars : [];
  PAUSED = !!(td && td.suspended);
  site = { ...S, tenant: entry.slug, filter: {} };
} else {
  S = Object.assign({ name: "A & S Auto", street: "1038 Overland Ave", city: "Burley", state: "ID", zip: "83318", apr: 12.9 }, MS);
  ALL = data.cars || [];
  site = entry || { name: S.name, template: S.mainTemplate, main: true };
}
const preview = new URLSearchParams(location.search).get("template");
const tplId = TEMPLATES[preview] && !TEMPLATES[preview].original ? preview : TEMPLATES[site.template] && !TEMPLATES[site.template].original ? site.template : "classic";
const T = TEMPLATES[tplId];
const where = [S.city, S.state].filter(Boolean).join(", ");
const showInsp = S.showInspections !== false;
const isDark = (() => { const h = String((T.vars || {}).bg || "#fff").replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 128; })();
const inspBadge = (c) => { const i = c.inspection; if (!i || i.public === false || !i.grade) return ""; const s = inspSum(i); return s.fail ? "" : s.done + " points"; };

// theme
const vars = { ...T.vars, ...(site.accent ? { accent: site.accent, ...(T.heroStyle === "search" || T.heroStyle === "split" ? { hero: site.accent } : {}) } : {}) };
const root = document.documentElement.style;
Object.entries(vars).forEach(([k, v]) => root.setProperty("--" + k, v));
root.setProperty("--head", T.head); root.setProperty("--body", T.body); root.setProperty("--r", T.radius);
if (T.upper) document.body.classList.add("up");
const fl = document.createElement("link"); fl.rel = "stylesheet"; fl.href = `https://fonts.googleapis.com/css2?family=${T.fonts[0].replace(/ /g, "+")}&display=swap`; document.head.appendChild(fl);
const name = site.name || S.name;
document.title = `${name} · Used cars${where ? " in " + where : ""}`;

// inventory for this website
const F = site.filter || {};
const absP = (u) => (u && !/^(\/|https?:|data:|blob:)/.test(u) ? "/" + u : u);
ALL.forEach((c) => { c.img = absP(c.img); c.cut = absP(c.cut); });
const PV = new URLSearchParams(location.search).get("preview");
const CARS = ALL.filter((c) => (c.status === "lot" || c.status === "pending" || (site.showSold && c.status === "sold") || (c.status === "draft" && c.id === PV)) && c.img)
  .filter((c) => !F.body || c.body === F.body).filter((c) => !F.maxPrice || c.price <= F.maxPrice).filter((c) => !F.minPrice || c.price >= F.minPrice)
  .sort((a, b) => (a.status === "sold") - (b.status === "sold"));
const featured = CARS.find((c) => c.featured) || CARS[0];
const tel = "tel:+1" + String(S.phone || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
const title = (c) => `${c.year} ${c.name}`;

const applyUrl = (carId) => "/apply" + (site.tenant ? "?d=" + site.tenant : "") + (carId ? (site.tenant ? "&" : "?") + "car=" + encodeURIComponent(carId) : "");
function header() {
  return `<header class="hd"><div class="wrap"><a class="brand" href="#top">${site.logo || ((site.main || !site.tenant) && !site.demo) ? `<img src="${esc(site.logo || "/img/logo.png")}" alt="">` : ""}<b>${esc(name)}</b></a>
    <nav class="nav"><a href="#inventory">Inventory</a><a href="${applyUrl()}">Financing</a><a href="#about">About</a><a href="#contact">Contact</a></nav>
    ${S.phone ? `<a class="tel" href="${tel}">${esc(S.phone)}</a>` : ""}</div></header>`;
}
function hero() {
  const h1 = esc(site.heroTitle || (T.heroStyle === "search" ? "Find your next car" : "Quality used cars" + (S.city ? " in " + S.city : "")));
  const p = esc(site.tagline || `${CARS.length === 1 ? "1 hand-picked vehicle" : CARS.length + " hand-picked cars, trucks and SUVs"} ${CARS.length ? "from " + money(Math.min(...CARS.map((c) => c.price || 0))) : ""}. Inspected, detailed and priced in plain numbers.`);
  const ctas = `<div class="ctas"><a class="btn" href="#inventory">Browse inventory</a>${S.phone ? `<a class="btn ghost" href="${tel}">Call ${esc(S.phone)}</a>` : ""}</div>`;
  const img = site.heroImg || featured?.img;
  if (T.heroStyle === "photo" && img) return `<section class="hero photo" id="top"><img class="bgimg" src="${esc(img)}" alt=""><div class="wrap"><h1>${h1}</h1><p>${p}</p>${ctas}</div></section>`;
  if (T.heroStyle === "center") return `<section class="hero center" id="top"><div class="wrap"><h1>${h1}</h1><p>${p}</p>${ctas}${img ? `<div class="pic"><img src="${esc(img)}" alt=""></div>` : ""}</div></section>`;
  if (T.heroStyle === "split") return `<section class="hero split" id="top"><div class="wrap"><div><h1>${h1}</h1><p>${p}</p>${ctas}</div>${img ? `<div class="pic"><img src="${esc(img)}" alt=""></div>` : ""}</div></section>`;
  const makes = [...new Set(CARS.map((c) => c.make))].sort();
  return `<section class="hero" id="top"><div class="wrap"><h1>${h1}</h1><p>${p}</p>
    <form class="hsearch" id="hs"><select id="hsMake" aria-label="Make"><option value="">Any make</option>${makes.map((m) => `<option>${esc(m)}</option>`).join("")}</select>
    <select id="hsPrice" aria-label="Max price"><option value="">Any price</option>${[5000, 7500, 10000, 15000, 20000, 30000].map((p) => `<option value="${p}">Under ${money(p)}</option>`).join("")}</select>
    <button class="btn" type="submit">Search ${CARS.length} cars</button></form></div></section>`;
}
let fBody = "", fQ = "", fSort = "new", fMax = "", fMake = "";
function inventory() {
  const bodies = [...new Set(CARS.map((c) => c.body).filter(Boolean))];
  return `<section class="s" id="inventory"><div class="wrap"><div class="sh"><h2>Our inventory</h2><span class="muted" id="cnt"></span></div>
    <div class="filters"><input id="fq" type="search" placeholder="Search make, model, colour…" aria-label="Search"><select id="fsort" aria-label="Sort"><option value="new">Newest arrivals</option><option value="pa">Price: low to high</option><option value="pd">Price: high to low</option><option value="yd">Year: newest</option><option value="ma">Mileage: lowest</option></select></div>
    ${bodies.length > 1 ? `<div class="chips"><button class="chip on" data-b="">All</button>${bodies.map((b) => `<button class="chip" data-b="${esc(b)}">${esc(b)}</button>`).join("")}</div>` : ""}
    <div class="grid" id="grid"></div></div></section>`;
}
function drawGrid() {
  let xs = CARS.filter((c) => !fBody || c.body === fBody).filter((c) => !fMake || c.make === fMake).filter((c) => !fMax || c.price <= +fMax)
    .filter((c) => !fQ || [c.year, c.name, c.trim, c.ext, c.body].join(" ").toLowerCase().includes(fQ.toLowerCase()));
  const sorts = { pa: (a, b) => a.price - b.price, pd: (a, b) => b.price - a.price, yd: (a, b) => b.year - a.year, ma: (a, b) => (a.miles ?? 1e9) - (b.miles ?? 1e9) };
  if (sorts[fSort]) xs = xs.slice().sort(sorts[fSort]);
  $("#cnt").textContent = `${xs.length} vehicle${xs.length === 1 ? "" : "s"}`;
  if (!CARS.length) { $("#grid").innerHTML = '<div class="empty">New cars are coming soon. Call us to hear what just arrived.</div>'; return; }
  $("#grid").innerHTML = xs.map((c) => `<a class="card" href="#car-${esc(c.id)}"><div class="ph"><img src="${esc(c.img)}" alt="${esc(title(c))}" loading="lazy">${c.status === "sold" ? '<span class="tag sold">Sold</span>' : c.status === "pending" ? '<span class="tag sold" style="background:#b45309">Sale pending</span>' : c.status === "draft" ? '<span class="tag sold" style="background:#555">Draft preview</span>' : `<span class="tag">${esc(c.year)}</span>`}</div>
    <div class="bd">${showInsp && inspBadge(c) ? `<span style="font-size:12px;font-weight:700;color:#1f8a4c">✓ Inspected · ${inspBadge(c)}</span>` : ""}<h3>${esc(c.name)}</h3><div class="sp">${esc([c.trim, c.miles != null ? Number(c.miles).toLocaleString("en-US") + " mi" : "", c.drive, c.ext].filter(Boolean).join(" · "))}</div><div class="pr">${money(c.price)}</div></div></a>`).join("")
    || '<div class="empty">No cars match. Try fewer filters.</div>';
}
const aboutImg = site.tenant || site.demo ? site.aboutImg || (CARS[1] || CARS[0] || {}).img : "/img/showroom.webp";
function about() {
  return `<section class="s" id="about" style="background:var(--panel);border-block:1px solid var(--line)"><div class="wrap about"><div><h2>About ${esc(name)}</h2>
    <p class="muted" style="font-size:18px">${esc(site.about || `We're a locally owned dealer${S.street ? ` at ${S.street}${S.city ? ", " + S.city : ""}` : ""}. Every car on our lot is hand-picked, inspected and detailed, with a clear price and no pressure. Many of our customers are neighbours who come back, and send their friends.`)}</p>
    <a class="btn" href="#contact">Visit us</a></div>${aboutImg ? `<img src="${esc(aboutImg)}" alt="${esc(name)}" loading="lazy">` : ""}</div></section>`;
}
function contact() {
  const H = S.hours || [];
  return `<section class="s" id="contact"><div class="wrap contact"><div class="info"><h2 style="margin-bottom:20px">Contact us</h2>
    ${S.street || S.city ? `<p><b>Visit</b>${esc(S.street || "")}<br>${esc(where)} ${esc(S.zip || "")}<br><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${S.street} ${S.city} ${S.state} ${S.zip}`)}" target="_blank" rel="noopener">Get directions →</a></p>` : ""}
    ${S.phone ? `<p><b>Call or text</b><a href="${tel}">${esc(S.phone)}</a></p>` : ""}${S.email ? `<p><b>Email</b><a href="mailto:${esc(S.email)}">${esc(S.email)}</a></p>` : ""}
    ${H.length ? `<p><b>Hours</b></p><div class="hours">${H.map(([d, h]) => `<span>${esc(d)}</span><span>${esc(h)}</span>`).join("")}</div>` : ""}</div>
    <div class="box"><h3>Send us a message</h3>${leadForm("contact")}</div></div></section>`;
}
function leadForm(type, carId = "") {
  return `<form class="form" data-lead="${type}" data-car="${esc(carId)}"><div class="two"><input name="name" placeholder="Your name" required aria-label="Name"><input name="phone" type="tel" placeholder="Phone" aria-label="Phone"></div>
    <input name="email" type="email" placeholder="Email" aria-label="Email"><textarea name="message" aria-label="Message" placeholder="${type === "viewing" ? "When would you like to see it?" : "How can we help?"}"></textarea>
    <input name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">
    <button class="btn" type="submit">${type === "viewing" ? "Book a viewing" : "Send message"}</button><div class="msg"></div></form>`;
}
function bindForms(rootEl) {
  $$("form[data-lead]", rootEl).forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(f)); const out = $(".msg", f);
    if (!fd.name.trim()) return; if (!fd.phone.trim() && !fd.email.trim()) { out.innerHTML = '<div class="ok">Add a phone number or an email so we can reach you.</div>'; return; }
    if (site.demo) { out.innerHTML = '<div class="ok">This is a demo. On your website, messages go straight to your admin page.</div>'; return; }
    const b = $("button", f); b.disabled = true;
    try {
      const r = await fetch("/api/lead", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...fd, type: f.dataset.lead, carId: f.dataset.car, site: site.main || site.tenant ? "" : name, tenant: site.tenant || "" }) });
      if (!r.ok) throw 0; f.reset(); out.innerHTML = `<div class="ok">Thanks! We got your message and will get back to you shortly.</div>`;
    } catch (_) { out.innerHTML = `<div class="ok">Couldn't send right now. Please call ${esc(S.phone || "us")}.</div>`; }
    b.disabled = false;
  }));
}
function detail(c) {
  const sp = [["Mileage", c.miles != null ? Number(c.miles).toLocaleString("en-US") + " miles" : ""], ["Engine", c.engine], ["Transmission", c.trans], ["Drivetrain", c.drive], ["Fuel", c.fuel], ["MPG", c.mpg],
    ["Exterior", c.ext], ["Interior", c.int], ["Body", c.body], ["Horsepower", c.hp], ["VIN", c.vin], ["Stock #", c.stock]].filter(([, v]) => v !== null && v !== undefined && v !== "");
  return `<div class="wrap"><a class="back" href="#inventory">← Back to inventory</a>
    <div class="det"><div><div class="main"><img id="mainPh" src="${esc(c.img)}" alt="${esc(title(c))}"></div>
      ${(c.photos || []).length ? `<div class="thumbs">${[c.img, ...c.photos].map((u, i) => `<button type="button" class="${i ? "" : "on"}" data-ph="${esc(u)}"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
      <div class="specs">${sp.map(([k, v]) => `<div><span>${k}</span>${esc(v)}</div>`).join("")}</div>
      ${(c.equip || []).length ? `<div class="equip">${c.equip.map((e) => `<span>${esc(e)}</span>`).join("")}</div>` : ""}
      ${c.desc ? `<p class="muted" style="margin-top:18px">${esc(c.desc)}</p>` : ""}</div>
    <div><h1>${esc(title(c))}</h1><div class="muted">${esc(c.trim || "")}</div><div class="price">${c.status === "sold" ? "Sold" : money(c.price)}</div>${c.status === "pending" ? '<div class="muted" style="margin:-6px 0 14px;font-weight:700">Sale pending · ask us about similar cars</div>' : ""}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">${S.phone ? `<a class="btn" href="${tel}">Call ${esc(S.phone)}</a>` : ""}<a class="btn ghost" href="#book">Book a viewing</a>${c.status === "sold" ? "" : `<a class="btn ghost" href="${applyUrl(c.id)}">Get pre-approved</a>`}</div>
      ${showInsp ? siteSummary(c, `/inspection?car=${encodeURIComponent(c.id)}${site.tenant ? "&d=" + site.tenant : ""}`, isDark) : ""}
      ${c.status === "sold" ? "" : `<div class="box calc"><h3>Payment estimate</h3>
        <label>Down payment <b id="cDownV"></b></label><input type="range" id="cDown" min="0" max="${Math.round(c.price * 0.5)}" step="250" value="${Math.round(c.price * 0.1 / 250) * 250}">
        <label>Term <b id="cTermV"></b></label><input type="range" id="cTerm" min="12" max="72" step="12" value="48">
        <label>APR <b id="cAprV"></b></label><input type="range" id="cApr" min="0" max="29.9" step="0.1" value="${S.apr || 12.9}">
        <div class="pm" id="cPm"></div><small>Estimate only. Excludes tax, title and fees. Your rate depends on credit approval.</small></div>`}
      <div class="box" id="book" style="margin-top:16px"><h3>Interested?</h3>${leadForm("viewing", c.id)}</div></div></div></div>`;
}
function calc(c) {
  const up = () => { const d = +$("#cDown").value, n = +$("#cTerm").value, a = +$("#cApr").value / 1200, P = Math.max(0, c.price - d);
    const m = a ? (P * a) / (1 - Math.pow(1 + a, -n)) : P / n;
    $("#cDownV").textContent = money(d); $("#cTermV").textContent = n + " months"; $("#cAprV").textContent = (+$("#cApr").value).toFixed(1) + "%"; $("#cPm").textContent = money(m) + "/mo"; };
  ["#cDown", "#cTerm", "#cApr"].forEach((s) => ($(s).oninput = up)); up();
}

const R = $("#root");
const footer = `<footer><div class="wrap"><span>© ${new Date().getFullYear()} ${esc(name)}${where ? " · " + esc(where) : ""}</span><span>Prices exclude tax, title and fees. <a href="${site.tenant ? `/w/${esc(site.tenant)}/admin` : "/panel/"}">Staff</a></span></div></footer>`;
function home() {
  R.innerHTML = header() + hero() + inventory() + about() + contact() + footer;
  drawGrid(); bindForms(R);
  $("#fq").oninput = (e) => { fQ = e.target.value; drawGrid(); };
  $("#fsort").onchange = (e) => { fSort = e.target.value; drawGrid(); };
  $$(".chip").forEach((b) => (b.onclick = () => { fBody = b.dataset.b; $$(".chip").forEach((x) => x.classList.toggle("on", x === b)); drawGrid(); }));
  if ($("#hs")) $("#hs").onsubmit = (e) => { e.preventDefault(); fMake = $("#hsMake").value; fMax = $("#hsPrice").value; drawGrid(); location.hash = "inventory"; };
}
let onHome = false;
function route() {
  if (PAUSED) { R.innerHTML = `<div class="wrap" style="padding:80px 16px;text-align:center"><h1>${esc(name)}</h1><p class="muted">This website is temporarily unavailable. Please call us${S.phone ? ` at <a href="${tel}">${esc(S.phone)}</a>` : ""}.</p></div>`; return; }
  const h = location.hash.slice(1);
  const c = h.startsWith("car-") && CARS.find((x) => x.id === h.slice(4));
  if (c) { onHome = false; R.innerHTML = header() + detail(c) + footer; bindForms(R);
    $$(".thumbs [data-ph]").forEach((b) => (b.onclick = () => { $("#mainPh").src = b.dataset.ph; $$(".thumbs button").forEach((x) => x.classList.toggle("on", x === b)); })); if ($("#cPm")) calc(c); document.title = `${title(c)} · ${name}`; scrollTo(0, 0); return; }
  if (!onHome) { home(); onHome = true; document.title = `${name} · Used cars${where ? " in " + where : ""}`; }
  const el = h && document.getElementById(h); if (el) el.scrollIntoView(); else if (!h) scrollTo(0, 0);
}
addEventListener("hashchange", route);
route();

// custom code (CARFAX badges, analytics, pixels…) from the dealer's settings
function injectCode(html, where) {
  if (!html) return; const t = document.createElement("template"); t.innerHTML = html;
  [...t.content.childNodes].forEach((n) => { if (n.nodeName === "SCRIPT") { const s = document.createElement("script"); [...n.attributes].forEach((a) => s.setAttribute(a.name, a.value)); s.textContent = n.textContent; where.appendChild(s); } else where.appendChild(n.cloneNode(true)); });
}
const ownDomain = entry && entry.domain && entry.domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "") === host;
if (!site.demo && !PV && (site.tenant ? ownDomain : true)) { injectCode(S.customHead, document.head); injectCode(S.customBody, document.body); }
