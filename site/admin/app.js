// A & S Auto · Dealer Dashboard
// Inventory, leads (CRM), customers, deals & documents, buy-here-pay-here collections, reports, marketing feeds, settings.
import * as FEEDS from "../feeds.js";
import { photosBox, bulkStudio } from "./photos.js";
import { ftpPanel } from "./ftpui.js";
import { openInspection, summary as inspSummary } from "./inspect.js";
import { TEMPLATES } from "../t/templates.js";
import { thumb, bindThumbs, openPreview, demoUrl } from "../t/gallery.js";

/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const n0 = (v) => { const x = parseFloat(v); return isFinite(x) ? x : 0; };
const r2 = (x) => Math.round(x * 100) / 100;
const money = (v, c = false) => (v < 0 ? "-" : "") + "$" + Math.abs(n0(v)).toLocaleString("en-US", { minimumFractionDigits: c ? 2 : 0, maximumFractionDigits: c ? 2 : 0 });
const money2 = (v) => money(v, true);
const int = (v) => Math.round(n0(v)).toLocaleString("en-US");
const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const parseD = (s) => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const days = (a, b = todayISO()) => (a ? Math.round((parseD(b) - parseD(a)) / 86400000) : null);
const fdate = (s) => (s ? parseD(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
const fdt = (s) => (s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clone = (x) => JSON.parse(JSON.stringify(x));
const BODY_TYPES = ["Truck", "SUV", "Sedan", "Coupe", "Minivan / Passenger Van", "Convertible", "Wagon", "Hatchback", "Van"];
const LEAD_STATUS = [["new", "New", "info"], ["contacted", "Contacted", "warn"], ["appointment", "Appointment", "warn"], ["won", "Sold", "ok"], ["lost", "Lost", ""]];
const LEAD_SOURCES = ["Website", "Walk-in", "Phone", "Facebook", "Marketplace", "Craigslist", "CARFAX", "Autotrader", "Cars.com", "Edmunds", "Referral", "Repeat customer", "Other"];
const DEAL_TYPES = { cash: "Cash", bhph: "Buy Here Pay Here", outside: "Outside financing" };
const FREQ = { monthly: ["Monthly", 12], biweekly: ["Every 2 weeks", 26], weekly: ["Weekly", 52] };
const PAY_METHODS = ["Cash", "Card", "Check", "ACH / Bank transfer", "Money order", "Other"];

let PW = "";
let SITE = null; // public website data: { settings, cars }
const DB = { leads: [], customers: [], deals: [], costs: [], payments: [], tasks: [], appts: [], recon: [], templates: [], expenses: [] };

function toast(t, err) {
  const el = $("#toast"); el.textContent = t; el.className = "toast on" + (err ? " err" : "");
  clearTimeout(toast.t); toast.t = setTimeout(() => (el.className = "toast"), err ? 5000 : 2200);
}
async function api(url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { ...(opt.headers || {}), "x-admin-password": PW } });
  let b = null; try { b = await r.json(); } catch (_) {}
  if (r.status === 401) { logout(); throw { code: "unauthorized" }; }
  if (!r.ok) throw { code: (b && b.error) || "http_" + r.status };
  return b;
}
const errMsg = (x) => "Could not save (" + ((x && x.code) || "error") + "). Check your connection and try again.";

/* ================= data ================= */
async function loadSite() {
  const r = await fetch("/api/data", { cache: "no-store" });
  if (r.status === 200) return r.json();
  // nothing saved yet: read the copy built into the website
  const html = await (await fetch("/index.html", { cache: "no-store" })).text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  return JSON.parse(doc.getElementById("site-data").textContent);
}
async function loadAll() {
  const [site, ...cols] = await Promise.all([loadSite(), ...Object.keys(DB).map((c) => api("/api/db/" + c))]);
  SITE = site;
  SITE.settings = Object.assign({ name: "A & S Auto", street: "1038 Overland Ave", city: "Burley", state: "ID", zip: "83318", taxRate: 6, docFee: 0, titleFee: 0, apr: 18, salespeople: [] }, SITE.settings);
  Object.keys(DB).forEach((c, i) => (DB[c] = cols[i] || []));
  // photo paths from the original site are relative ("img/v17.webp"); make them work from every page
  const absP = (u) => (u && !/^(\/|https?:|data:|blob:)/.test(u) ? "/" + u : u);
  SITE.cars.forEach((c) => { c.img = absP(c.img); c.cut = absP(c.cut); });
}
async function saveSite() {
  await api("/api/data", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(SITE) });
}
async function saveRec(col, rec) {
  const saved = await api(`/api/db/${col}/${rec.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(rec) });
  const i = DB[col].findIndex((x) => x.id === rec.id);
  if (i >= 0) DB[col][i] = saved; else DB[col].push(saved);
  return saved;
}
async function delRec(col, id) {
  await api(`/api/db/${col}/${id}`, { method: "DELETE" });
  DB[col] = DB[col].filter((x) => x.id !== id);
}
const S = () => SITE.settings;
const car = (id) => SITE.cars.find((c) => c.id === id);
const cust = (id) => DB.customers.find((c) => c.id === id);
const costOf = (id) => DB.costs.find((c) => c.id === id) || { id, expenses: [] };
const carCost = (id) => { const c = costOf(id); return n0(c.purchasePrice) + (c.expenses || []).reduce((s, e) => s + n0(e.amount), 0); };
const hasCost = (id) => { const c = costOf(id); return !!(c.purchasePrice || (c.expenses || []).length); };
const inDate = (c) => costOf(c.id).purchaseDate || c.addedAt || null;
const carTitle = (c) => (c ? `${c.year || ""} ${c.name || ""}`.trim() : "—");
const custName = (c) => (c ? `${c.first || ""} ${c.last || ""}`.trim() || c.company || "(no name)" : "—");
const modelOf = (c) => (c.name && c.make && c.name.startsWith(c.make + " ") ? c.name.slice(c.make.length + 1) : c.name || "");
const dealNo = (d) => d.number ? "#" + d.number : "#—";

/* ================= deal math ================= */
function calc(d) {
  const price = n0(d.price), doc = n0(d.docFee), title = n0(d.titleFee), rate = n0(d.taxRate) / 100;
  const allow = n0(d.trade?.allowance), payoff = n0(d.trade?.payoff), down = n0(d.down);
  const taxable = Math.max(0, price + doc - allow); // Idaho taxes the price after the trade-in credit
  const tax = r2(taxable * rate);
  const total = r2(price + doc + title + tax);
  const netTrade = r2(allow - payoff);
  const balance = r2(total - netTrade - down);
  const fin = d.type === "bhph" || d.type === "outside";
  const financed = fin ? Math.max(0, balance) : 0;
  const per = FREQ[d.freq || "monthly"][1];
  const nPay = fin ? Math.max(1, Math.round((n0(d.term) || 1) * per / 12)) : 0;
  const i = n0(d.apr) / 100 / per;
  const payment = fin ? r2(i ? financed * i / (1 - Math.pow(1 + i, -nPay)) : financed / nPay) : 0;
  const totalPay = r2(payment * nPay);
  const gross = d.carId ? r2(price + doc - carCost(d.carId)) : null;
  return { price, doc, title, tax, taxable, total, allow, payoff, netTrade, down, balance, financed, nPay, payment, totalPay, finCharge: r2(totalPay - financed), gross, per };
}
function addPeriod(start, freq, k) {
  const d = parseD(start);
  if (freq === "weekly") d.setDate(d.getDate() + 7 * k);
  else if (freq === "biweekly") d.setDate(d.getDate() + 14 * k);
  else { const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + k); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); }
  return iso(d);
}
function schedule(d) {
  const c = calc(d); if (!c.nPay) return [];
  const first = d.firstDue || addPeriod(d.date || todayISO(), d.freq, 1);
  return Array.from({ length: c.nPay }, (_, k) => ({ n: k + 1, date: addPeriod(first, d.freq, k), amount: k === c.nPay - 1 ? r2(c.totalPay - c.payment * (c.nPay - 1)) : c.payment }));
}
// Buy-here-pay-here account status. Simple interest: each payment first pays the interest built up since the last one.
function account(d) {
  const c = calc(d), pays = DB.payments.filter((p) => p.dealId === d.id).sort((a, b) => a.date.localeCompare(b.date));
  let bal = c.financed, last = d.date || todayISO(), interestPaid = 0;
  const rate = n0(d.apr) / 100;
  for (const p of pays) {
    const intr = r2(bal * rate * Math.max(0, days(last, p.date)) / 365);
    const toInt = Math.min(n0(p.amount), intr);
    interestPaid += toInt; bal = r2(Math.max(0, bal - (n0(p.amount) - toInt))); last = p.date;
  }
  const accrued = r2(bal * rate * Math.max(0, days(last)) / 365);
  const paid = r2(pays.reduce((s, p) => s + n0(p.amount), 0));
  const sch = schedule(d), today = todayISO();
  const dueSoFar = r2(sch.filter((s) => s.date <= today).reduce((s, x) => s + x.amount, 0));
  const pastDue = bal <= 0.005 ? 0 : Math.max(0, r2(dueSoFar - paid));
  let cum = 0, next = null;
  for (const s of sch) { cum += s.amount; if (cum > paid + 0.005) { next = s; break; } }
  const daysLate = pastDue > 0 && next ? Math.max(0, days(next.date)) : 0;
  const payoff = bal <= 0.005 ? 0 : r2(bal + accrued);
  const status = payoff === 0 ? ["Paid off", "ok"] : pastDue > 0 ? [daysLate > 30 ? "Seriously late" : "Late", daysLate > 30 ? "bad" : "warn"] : ["Current", "info"];
  return { calc: c, pays, paid, principal: bal, accrued, payoff, pastDue, next, daysLate, status, interestPaid: r2(interestPaid), lastPay: pays.length ? pays[pays.length - 1] : null };
}
const bhphDeals = () => DB.deals.filter((d) => d.type === "bhph" && d.status === "sold");

/* ================= login ================= */
async function tryLogin(pw) {
  try { const r = await fetch("/api/login", { method: "POST", headers: { "x-admin-password": pw } }); return r.status === 401 ? false : r.ok ? true : null; }
  catch (_) { return null; }
}
function logout() {
  PW = ""; try { sessionStorage.removeItem("admPw"); } catch (_) {}
  $("#app").hidden = true; $("#login").hidden = false; $("#loginPw").value = ""; $("#loginPw").focus();
}
async function boot() {
  // on a dealer's own domain, /admin/ opens that dealer's simple admin
  try { const h = location.hostname.replace(/^www\./, ""), m = await (await fetch("/api/data", { cache: "no-store" })).json();
    const w = (m.settings?.websites || []).find((x) => x.tenant && x.domain === h); if (w) return location.replace(`/w/${w.slug}/admin`); } catch (_) {}
  let saved = ""; try { saved = sessionStorage.getItem("admPw") || ""; } catch (_) {}
  if (saved && (await tryLogin(saved))) return start(saved);
  $("#login").hidden = false; $("#loginPw").focus();
  $("#loginForm").onsubmit = async (e) => {
    e.preventDefault(); const pw = $("#loginPw").value, er = $("#loginErr"); er.textContent = "Checking…";
    const ok = await tryLogin(pw);
    if (ok) { er.textContent = ""; try { sessionStorage.setItem("admPw", pw); } catch (_) {} start(pw); }
    else er.textContent = ok === null ? "Could not reach the server. Try again." : "Wrong password.";
  };
}
async function start(pw) {
  PW = pw; $("#login").hidden = true; $("#app").hidden = false;
  $("#view").innerHTML = '<p class="empty">Loading…</p>';
  try { await loadAll(); } catch (x) { $("#view").innerHTML = `<p class="empty">Could not load your data (${esc(x.code || x.message || "error")}). Reload the page.</p>`; return; }
  $("#logout").onclick = logout;
  $("#burger").onclick = () => document.body.classList.toggle("nav-open");
  setupSearch();
  window.onhashchange = route; route();
}

/* ================= navigation ================= */
const NAV = [
  ["", [["dashboard", "▦", "Dashboard"]]],
  ["Sales", [["inventory", "🚗", "Inventory"], ["studio", "✨", "Photo studio"], ["recon", "🔧", "Recon"], ["leads", "☎", "Leads"], ["calendar", "📅", "Calendar"], ["tasks", "✓", "Tasks"], ["customers", "👤", "Customers"], ["deals", "📄", "Deals"], ["opportunities", "🎯", "Opportunities"]]],
  ["Finance", [["collections", "$", "Collections"], ["expenses", "🧾", "Expenses"], ["reports", "📈", "Reports"]]],
  ["Online", [["marketing", "📣", "Marketing"], ["websites", "🌐", "Websites"]]],
  ["", [["templates", "✉", "Message templates"], ["settings", "⚙", "Settings"]]],
];
function renderNav(page) {
  const newLeads = DB.leads.filter((l) => l.status === "new").length;
  const late = bhphDeals().filter((d) => account(d).pastDue > 0).length;
  const cnt = { leads: newLeads, collections: late, tasks: DB.tasks.filter((t) => !t.done && t.due && t.due <= todayISO()).length, calendar: DB.appts.filter((a) => a.date === todayISO() && a.status === "scheduled").length };
  $("#nav").innerHTML = NAV.map(([g, items]) => (g ? `<div class="grp">${g}</div>` : "") + items.map(([k, ic, l]) =>
    `<a href="#/${k}" class="${page === k ? "on" : ""}"><span class="ic" aria-hidden="true">${ic}</span>${l}${cnt[k] ? `<span class="cnt">${cnt[k]}</span>` : ""}</a>`).join("")).join("");
}
function route() {
  document.body.classList.remove("nav-open");
  const h = location.hash.replace(/^#\/?/, "") || "dashboard";
  const [path, qs] = h.split("?"); const [page, id] = path.split("/");
  const q = Object.fromEntries(new URLSearchParams(qs || ""));
  renderNav(page);
  const V = $("#view"); window.scrollTo(0, 0);
  const pages = { dashboard, inventory: id ? carEdit : inventory, leads: id ? leadEdit : leads, customers: id ? custEdit : customers,
    deals: id ? dealEdit : deals, collections: id ? collectionEdit : collections, reports, marketing, websites, settings, recon: id ? reconEdit : reconBoard, calendar: id ? apptEdit : calendar, tasks: tasksPage, opportunities, expenses: expensesPage, templates: templatesPage, studio: (V2) => bulkStudio(V2, photoEnv()), inspect: (V2, id2) => { const k = car(id2); if (!k) return go("#/inventory");
      openInspection(V2, { car: k, settings: S(), title: carTitle(k), backLabel: carTitle(k), onBack: () => go("#/inventory/" + id2), toast, reportUrl: "/inspection?car=" + id2, upload: (f) => upload(f, 1400),
        onSave: async (ins) => { const prev = k.inspection; k.inspection = ins; try { await saveSite(); } catch (x) { k.inspection = prev; throw x; } } }); } };
  (pages[page] || dashboard)(V, id, q);
}
const go = (h) => { if (location.hash === h) route(); else location.hash = h; };

function setupSearch() {
  const q = $("#q"), box = $("#qres");
  const run = () => {
    const t = q.value.trim().toLowerCase(); if (t.length < 2) { box.hidden = true; return; }
    const hit = (...xs) => xs.some((x) => String(x || "").toLowerCase().includes(t));
    const res = [
      ...SITE.cars.filter((c) => hit(c.name, c.vin, c.stock, c.year, c.trim, c.ext)).map((c) => [`#/inventory/${c.id}`, "🚗 " + carTitle(c), [c.stock && "#" + c.stock, c.vin, money(c.price), c.status].filter(Boolean).join(" · ")]),
      ...DB.customers.filter((c) => hit(c.first, c.last, c.phone, c.email, c.company)).map((c) => [`#/customers/${c.id}`, "👤 " + custName(c), [c.phone, c.email].filter(Boolean).join(" · ")]),
      ...DB.leads.filter((l) => hit(l.name, l.phone, l.email)).map((l) => [`#/leads/${l.id}`, "☎ " + l.name, [l.phone, l.email, l.status].filter(Boolean).join(" · ")]),
      ...DB.deals.filter((d) => hit(d.number, custName(cust(d.customerId)))).map((d) => [`#/deals/${d.id}`, "📄 Deal " + dealNo(d), custName(cust(d.customerId)) + " · " + carTitle(car(d.carId))]),
    ].slice(0, 14);
    box.innerHTML = res.length ? res.map(([h, a, b]) => `<a href="${h}">${esc(a)}<small>${esc(b)}</small></a>`).join("") : '<div class="empty">Nothing found</div>';
    box.hidden = false;
  };
  q.oninput = run; q.onfocus = run;
  box.onclick = () => { box.hidden = true; q.value = ""; };
  document.addEventListener("click", (e) => { if (!e.target.closest(".search")) box.hidden = true; });
}

/* ================= shared UI ================= */
const pill = (t, k = "") => `<span class="pill ${k}">${esc(t)}</span>`;
const CAR_STATUS = [["lot", "Public · for sale"], ["draft", "Draft · not on the website"], ["pending", "Sale pending"], ["sold", "Sold"], ["hidden", "Hidden"]];
const carStatusPill = (c) => c.status === "lot" ? pill("Public", "ok") : c.status === "pending" ? pill("Sale pending", "warn") : c.status === "draft" ? pill("Draft", "info") : c.status === "sold" ? pill("Sold", "bad") : pill("Hidden");
const exportable = (c) => (c.status === "lot" || c.status === "pending") && !c.noExport;
const leadPill = (s) => { const x = LEAD_STATUS.find((l) => l[0] === s) || LEAD_STATUS[0]; return pill(x[1], x[2]); };
const dealPill = (d) => d.status === "sold" ? pill("Sold", "ok") : d.status === "void" ? pill("Void", "bad") : pill("Draft", "warn");
const fld = (id, label, val, type = "text", extra = "") => `<div class="f ${extra.includes("wide") ? "w2" : ""}"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${esc(val ?? "")}" ${type === "number" ? 'step="any"' : ""} ${extra.replace("wide", "")}></div>`;
const sel = (id, label, val, opts, extra = "") => `<div class="f ${extra}"><label for="${id}">${label}</label><select id="${id}">${opts.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(val ?? "") ? "selected" : ""}>${esc(l)}</option>`; }).join("")}</select></div>`;
const area = (id, label, val, extra = "wf") => `<div class="f ${extra}"><label for="${id}">${label}</label><textarea id="${id}">${esc(val ?? "")}</textarea></div>`;
const v = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };
const vn = (id) => { const x = v(id); return x === "" ? null : n0(x); };
function seg(id, opts, cur) { return `<div class="seg" id="${id}">${opts.map(([k, l]) => `<button type="button" data-k="${k}" class="${k === cur ? "on" : ""}">${esc(l)}</button>`).join("")}</div>`; }
function table(cols, rows, onRow) {
  if (!rows.length) return '<div class="tw"><div class="empty">Nothing here yet.</div></div>';
  return `<div class="tw"><table class="t"><thead><tr>${cols.map((c) => `<th class="${c.r ? "r" : ""}">${c.h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) =>
    `<tr class="${onRow ? "rowlink" : ""}" ${onRow ? `data-href="${esc(onRow(r))}" tabindex="0"` : ""}>${cols.map((c) => `<td class="${c.r ? "r num" : ""}">${c.f(r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function bindRows(root) {
  $$("tr[data-href]", root).forEach((tr) => {
    tr.onclick = (e) => { if (!e.target.closest("a,button,input,select")) go(tr.dataset.href); };
    tr.onkeydown = (e) => { if (e.key === "Enter") go(tr.dataset.href); };
  });
}
function csvDownload(name, rows) {
  const cell = (x) => { const s = String(x ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const blob = new Blob([rows.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function shrink(file, max) {
  const bmp = await createImageBitmap(file); const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, "image/webp", 0.84));
}
async function upload(file, max) {
  const blob = await shrink(file, max);
  return (await api("/api/upload", { method: "POST", headers: { "content-type": "image/webp" }, body: blob })).url;
}

// photo tools: upload, background library (ours + the dealer's own), bulk save
const photoEnv = () => ({ upload: (f, max) => upload(f, max), settings: S, library: () => S().bgLibrary || [], toast, cars: () => SITE.cars, saveAll: saveSite,
  addBackground: async (file) => { const url = await upload(file, 1800);
    const e = { id: uid("bg"), name: file.name.replace(/\.\w+$/, "").slice(0, 30) || "My background", url, cat: "Yours", floor: 0.86, reflect: false };
    S().bgLibrary = [...(S().bgLibrary || []), e]; await saveSite(); toast("Background saved to your library"); return e; } });

/* ================= dashboard ================= */
function dashboard(V) {
  const lot = SITE.cars.filter((c) => c.status === "lot");
  const ages = lot.map((c) => days(inDate(c))).filter((x) => x !== null);
  const month = todayISO().slice(0, 7);
  const soldM = DB.deals.filter((d) => d.status === "sold" && (d.date || "").startsWith(month));
  const grossM = soldM.reduce((s, d) => s + (calc(d).gross || 0), 0);
  const accts = bhphDeals().map((d) => [d, account(d)]);
  const late = accts.filter(([, a]) => a.pastDue > 0);
  const recv = accts.reduce((s, [, a]) => s + a.payoff, 0);
  const newLeads = DB.leads.filter((l) => l.status === "new").sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const follow = DB.leads.filter((l) => l.followUp && l.followUp <= todayISO() && !["won", "lost"].includes(l.status)).sort((a, b) => a.followUp.localeCompare(b.followUp));
  const aging = lot.map((c) => [c, days(inDate(c))]).filter(([, d]) => d !== null).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const recent = DB.deals.filter((d) => d.status !== "void").sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 6);
  const paysM = DB.payments.filter((p) => (p.date || "").startsWith(month)).reduce((s, p) => s + n0(p.amount), 0);
  V.innerHTML = `
  <div class="ph"><div><h1>Dashboard</h1><p>${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p></div></div>
  <div class="grid g4">
    <a class="card kpi" href="#/inventory"><span>On the lot</span><b>${lot.length}</b><small>${money(lot.reduce((s, c) => s + n0(c.price), 0))} asking${ages.length ? ` · avg ${Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)} days` : ""}</small></a>
    <a class="card kpi" href="#/leads"><span>New leads</span><b>${newLeads.length}</b><small>${follow.length} follow-up${follow.length === 1 ? "" : "s"} due</small></a>
    <a class="card kpi" href="#/deals"><span>Sold this month</span><b>${soldM.length}</b><small>${money(soldM.reduce((s, d) => s + n0(d.price), 0))} · gross ${money(grossM)}</small></a>
    <a class="card kpi" href="#/collections"><span>Collections</span><b>${money(recv)}</b><small>${late.length ? `<span style="color:var(--bad)">${late.length} past due · ${money(late.reduce((s, [, a]) => s + a.pastDue, 0))}</span>` : "No accounts past due"} · ${money(paysM)} in this month</small></a>
  </div>
  ${(() => { const ap = DB.appts.filter((a) => a.date === todayISO() && a.status === "scheduled").sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    const tk = DB.tasks.filter((t) => !t.done && t.due && t.due <= todayISO()); const rc = DB.recon.filter((r) => r.stage !== "done" && r.stage !== "ready" && car(r.id)).length;
    return `<div class="card" style="margin-top:14px"><h3>Today <a href="#/calendar">Calendar →</a></h3><div class="grid g3">
      <div><b>📅 ${ap.length} appointment${ap.length === 1 ? "" : "s"}</b>${ap.map((a) => `<a class="lc" style="margin-top:6px" href="#/calendar/${esc(a.id)}">${esc(a.time || "")} ${esc(a.name || "")}<small>${esc(a.type || "")}${a.carId && car(a.carId) ? " · " + esc(carTitle(car(a.carId))) : ""}</small></a>`).join("")}</div>
      <div><b>✓ ${tk.length} task${tk.length === 1 ? "" : "s"} due</b>${tk.slice(0, 5).map((t) => `<a class="lc" style="margin-top:6px" href="#/tasks">${esc(t.title)}<small>${t.due < todayISO() ? "overdue · " : ""}${fdate(t.due)}</small></a>`).join("")}</div>
      <div><b>🔧 ${rc} car${rc === 1 ? "" : "s"} in recon</b><p style="margin:6px 0 0"><a href="#/recon">Open the recon board →</a></p></div></div></div>`; })()}
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>New leads <a href="#/leads">All leads →</a></h3>${table([
      { h: "Name", f: (l) => `<b>${esc(l.name)}</b><span class="sub">${esc(l.phone || l.email || "")}</span>` },
      { h: "Type", f: (l) => esc(l.type === "trade" ? "Trade-in" : l.type || "") },
      { h: "Source", f: (l) => esc(l.source || "") },
      { h: "Received", f: (l) => fdt(l.createdAt) }], newLeads.slice(0, 6), (l) => "#/leads/" + l.id)}</div>
    <div class="card"><h3>Follow-ups due</h3>${table([
      { h: "Name", f: (l) => `<b>${esc(l.name)}</b><span class="sub">${esc(l.phone || l.email || "")}</span>` },
      { h: "Status", f: (l) => leadPill(l.status) },
      { h: "Due", f: (l) => fdate(l.followUp) }], follow.slice(0, 6), (l) => "#/leads/" + l.id)}</div>
    <div class="card"><h3>Past due accounts <a href="#/collections">Collections →</a></h3>${table([
      { h: "Customer", f: ([d]) => `<b>${esc(custName(cust(d.customerId)))}</b><span class="sub">${esc(carTitle(car(d.carId)))}</span>` },
      { h: "Past due", r: 1, f: ([, a]) => money2(a.pastDue) },
      { h: "Days late", r: 1, f: ([, a]) => a.daysLate }], late.sort((a, b) => b[1].daysLate - a[1].daysLate).slice(0, 6), ([d]) => "#/collections/" + d.id)}</div>
    <div class="card"><h3>Longest on the lot <a href="#/inventory">Inventory →</a></h3>${table([
      { h: "Car", f: ([c]) => `<b>${esc(carTitle(c))}</b><span class="sub">${money(c.price)}</span>` },
      { h: "Days", r: 1, f: ([, d]) => `<span style="color:${d > 90 ? "var(--bad)" : d > 60 ? "var(--warn)" : "inherit"}">${d}</span>` }], aging, ([c]) => "#/inventory/" + c.id)}
      ${aging.length ? "" : '<p class="hint" style="color:var(--muted);font-size:13px">Add a purchase date to your cars (Inventory → car → Costs) to track days on the lot.</p>'}</div>
  </div>
  <div class="card" style="margin-top:14px"><h3>Recent deals <a href="#/deals">All deals →</a></h3>${table([
    { h: "Deal", f: (d) => dealNo(d) }, { h: "Date", f: (d) => fdate(d.date) },
    { h: "Customer", f: (d) => esc(custName(cust(d.customerId))) }, { h: "Car", f: (d) => esc(carTitle(car(d.carId))) },
    { h: "Type", f: (d) => esc(DEAL_TYPES[d.type] || "") }, { h: "Price", r: 1, f: (d) => money(d.price) }, { h: "Status", f: dealPill }], recent, (d) => "#/deals/" + d.id)}</div>`;
  bindRows(V);
}

/* ================= inventory ================= */
let invFilter = "lot", invQ = "";
function inventory(V) {
  const list = () => SITE.cars.filter((c) => invFilter === "all" || c.status === invFilter)
    .filter((c) => !invQ || [c.name, c.vin, c.stock, c.year, c.trim, c.ext, c.body].join(" ").toLowerCase().includes(invQ.toLowerCase()));
  const cnt = (s) => SITE.cars.filter((c) => s === "all" || c.status === s).length;
  V.innerHTML = `
  <div class="ph"><div><h1>Inventory</h1><p>${cnt("lot")} on the lot · ${cnt("sold")} sold · ${cnt("hidden")} hidden</p></div>
    <div class="act"><button class="b" id="invCsv" type="button">Export CSV</button><a class="b primary" href="#/inventory/new">+ Add car</a></div></div>
  <div class="bar">${seg("invSeg", [["lot", `Public (${cnt("lot")})`], ["draft", `Draft (${cnt("draft")})`], ["pending", `Sale pending (${cnt("pending")})`], ["sold", `Sold (${cnt("sold")})`], ["hidden", `Hidden (${cnt("hidden")})`], ["all", `All (${cnt("all")})`]], invFilter)}
    <div class="f" style="flex:1 1 240px"><input id="invQ" type="search" placeholder="Filter by make, model, VIN, stock #…" value="${esc(invQ)}" aria-label="Filter"></div></div>
  <div id="invT"></div>`;
  const draw = () => {
    $("#invT").innerHTML = table([
      { h: "", f: (c) => `<img class="th" src="${esc(c.img)}" alt="" loading="lazy">` },
      { h: "Vehicle", f: (c) => `<b>${esc(carTitle(c))}</b><span class="sub">${esc(c.trim || "")}${c.stock ? " · #" + esc(c.stock) : ""}${c.vin ? " · " + esc(c.vin) : ""}</span>` },
      { h: "Miles", r: 1, f: (c) => (c.miles ? int(c.miles) : "—") },
      { h: "Price", r: 1, f: (c) => money(c.price) },
      { h: "Cost", r: 1, f: (c) => (hasCost(c.id) ? money(carCost(c.id)) : '<span style="color:var(--dim)">—</span>') },
      { h: "Profit", r: 1, f: (c) => (hasCost(c.id) ? `<span style="color:${c.price - carCost(c.id) < 0 ? "var(--bad)" : "var(--ok)"}">${money(c.price - carCost(c.id))}</span>` : '<span style="color:var(--dim)">—</span>') },
      { h: "Days", r: 1, f: (c) => { const d = days(inDate(c)); return d === null ? "—" : d; } },
      { h: "Inspection", f: (c) => { const s = inspSummary(c.inspection); return s.done ? `<span style="color:${s.color};font-weight:600;font-size:13px">${s.fail ? "✕" : s.att ? "!" : "✓"} ${esc(s.grade)}</span>` : '<span style="color:var(--dim);font-size:13px">—</span>'; } },
      { h: "Status", f: (c) => carStatusPill(c) + (c.featured ? ' <span title="In the home page animation">★</span>' : "") },
    ], list(), (c) => "#/inventory/" + c.id);
    bindRows(V);
  };
  draw();
  $$("#invSeg button").forEach((b) => (b.onclick = () => { invFilter = b.dataset.k; inventory(V); }));
  $("#invQ").oninput = (e) => { invQ = e.target.value; draw(); };
  $("#invCsv").onclick = () => csvDownload("inventory.csv", [["Stock", "VIN", "Year", "Make", "Model", "Trim", "Body", "Miles", "Price", "Cost", "Profit", "Days on lot", "Status"],
    ...list().map((c) => [c.stock || "", c.vin || "", c.year, c.make, modelOf(c), c.trim || "", c.body || "", c.miles ?? "", c.price, hasCost(c.id) ? carCost(c.id) : "", hasCost(c.id) ? c.price - carCost(c.id) : "", days(inDate(c)) ?? "", c.status])]);
}

async function decodeVin(vin) {
  const r = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`);
  const x = (await r.json()).Results?.[0] || {};
  const tc = (s) => String(s || "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bBmw\b|\bGmc\b|\bRam\b/g, (m) => m.toUpperCase());
  const bc = String(x.BodyClass || "");
  const body = /pickup/i.test(bc) ? "Truck" : /sport utility|crossover/i.test(bc) ? "SUV" : /minivan/i.test(bc) ? "Minivan / Passenger Van" : /convertible/i.test(bc) ? "Convertible" : /coupe/i.test(bc) ? "Coupe" : /wagon/i.test(bc) ? "Wagon" : /hatchback/i.test(bc) ? "Hatchback" : /van/i.test(bc) ? "Van" : /sedan/i.test(bc) ? "Sedan" : "";
  const cfg = /v-shaped/i.test(x.EngineConfiguration) ? "V" : /in-line/i.test(x.EngineConfiguration) ? "I" : /flat|horizontal/i.test(x.EngineConfiguration) ? "H" : "";
  const engine = [x.DisplacementL ? parseFloat(x.DisplacementL).toFixed(1) + "L" : "", x.EngineCylinders ? (cfg || "") + x.EngineCylinders : ""].filter(Boolean).join(" ") + (x.FuelTypePrimary && /diesel/i.test(x.FuelTypePrimary) ? " Diesel" : x.Turbo === "Yes" ? " Turbo" : "");
  const dt = String(x.DriveType || "");
  const drive = /4wd|4x4|4-wheel/i.test(dt) ? "4WD" : /awd|all-wheel/i.test(dt) ? "AWD" : /fwd|front/i.test(dt) ? "FWD" : /rwd|rear/i.test(dt) ? "RWD" : "";
  return { error: x.ErrorCode && !/^0/.test(x.ErrorCode) ? x.ErrorText : "", year: x.ModelYear, make: tc(x.Make), model: x.Model, trim: [x.Trim, x.Series].filter(Boolean).join(" "), body, engine: engine.trim(), drive,
    fuel: tc(x.FuelTypePrimary), trans: x.TransmissionStyle ? (x.TransmissionSpeeds ? x.TransmissionSpeeds + "-Speed " : "") + x.TransmissionStyle : "", hp: x.EngineHP ? Math.round(x.EngineHP) : "" };
}
function vinCheck(v) {
  v = (v || "").toUpperCase(); if (!v) return ["", ""];
  if (/[IOQ]/.test(v)) return ["bad", "VINs never use I, O or Q"];
  if (v.length !== 17) return ["bad", v.length + " / 17 characters"];
  const TR = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 }, WT = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  const r = [...v].reduce((s, ch, i) => s + (isNaN(ch) ? TR[ch] : +ch) * WT[i], 0) % 11, ck = r === 10 ? "X" : String(r);
  return ck === v[8] ? ["ok", "✓ Valid VIN"] : ["bad", `Check digit should be ${ck}. Probably a typo.`];
}

function carEdit(V, id, q) {
  const isNew = id === "new";
  const c = isNew ? { id: uid("c"), make: "", name: "", year: new Date().getFullYear(), price: 0, body: "Truck", equip: [], desc: "", img: "", cut: "", status: "lot", featured: false, addedAt: todayISO() } : clone(car(id) || {});
  if (!isNew && !car(id)) { V.innerHTML = '<p class="empty">Car not found. <a href="#/inventory">Back to inventory</a></p>'; return; }
  const k = clone(costOf(c.id)); k.expenses = k.expenses || [];
  const deals = DB.deals.filter((d) => d.carId === c.id && d.status !== "void");
  V.innerHTML = `
  <div class="crumb"><a href="#/inventory">Inventory</a> / ${isNew ? "New car" : esc(carTitle(c))}</div>
  <div class="ph"><div><h1>${isNew ? "Add a car" : esc(carTitle(c))}</h1>${isNew ? "" : `<p>${carStatusPill(c)} ${c.stock ? "· Stock #" + esc(c.stock) : ""}</p>`}</div>
    <div class="act">${isNew ? "" : `<a class="b" href="/?preview=${esc(c.id)}#car-${esc(c.id)}" target="_blank" rel="noopener">👁 Preview</a><button class="b" id="sticker" type="button">Print window sticker</button><a class="b" href="#/inspect/${esc(c.id)}">📋 Inspection</a><a class="b" href="#/recon/${esc(c.id)}">Recon</a><a class="b" href="#/deals/new?car=${esc(c.id)}">Start a deal</a>`}<button class="b primary" id="saveCar" type="button">Save</button></div></div>
  <div class="split">
    <div class="grid">
      <div class="card"><h3>Vehicle</h3>
        <div class="fg">
          <div class="f w2"><label for="c_vin">VIN</label><div style="display:flex;gap:8px"><input id="c_vin" maxlength="17" value="${esc(c.vin || "")}" style="font-family:var(--mono);letter-spacing:.08em;text-transform:uppercase;flex:1;min-width:0;padding:9px 11px;border:1px solid var(--line);border-radius:6px;background:var(--panel)"><button class="b" type="button" id="decode">Decode VIN</button></div><span class="hint" id="vinSt"></span></div>
          ${fld("c_stock", "Stock #", c.stock)}${fld("c_year", "Year", c.year, "number")}${fld("c_make", "Make", c.make)}${fld("c_model", "Model", modelOf(c))}${fld("c_trim", "Trim", c.trim)}
          ${sel("c_body", "Body", c.body, BODY_TYPES)}${fld("c_miles", "Mileage", c.miles, "number")}${fld("c_ext", "Exterior colour", c.ext)}${fld("c_int", "Interior", c.int)}
          ${fld("c_engine", "Engine", c.engine)}${fld("c_trans", "Transmission", c.trans)}${fld("c_drive", "Drivetrain", c.drive)}${fld("c_fuel", "Fuel", c.fuel)}${fld("c_mpg", "MPG city / hwy", c.mpg, "text", 'placeholder="e.g. 15 / 21"')}
          ${fld("c_hp", "Horsepower", c.hp, "number")}${fld("c_tq", "Torque (lb-ft)", c.tq, "number")}${fld("c_zero", "0–60 mph (s)", c.zero, "number")}${fld("c_top", "Top speed (mph)", c.top, "number")}
          ${area("c_equip", "Equipment (one per line)", (c.equip || []).join("\n"))}${area("c_desc", "Description (shown on the website)", c.desc)}
        </div></div>
      <div class="card"><h3>Costs <span style="text-transform:none;letter-spacing:0;font-family:var(--body)">private, never shown on the website</span></h3>
        <div class="fg">${fld("k_price", "Purchase price", k.purchasePrice, "number")}${fld("k_date", "Date in stock", k.purchaseDate || c.addedAt || todayISO(), "date")}${fld("k_from", "Bought from", k.source, "text", 'placeholder="Auction, trade-in, private…"')}</div>
        <h2 class="sec">Reconditioning & expenses</h2>
        <div id="exp"></div>
        <button class="b sm" type="button" id="addExp" style="margin-top:8px">+ Add expense</button>
        <dl class="dl" style="margin-top:14px" id="costSum"></dl></div>
    </div>
    <div class="grid">
      <div class="card"><h3>Price & status</h3>
        <div class="fg">${fld("c_price", "Asking price", c.price, "number")}${sel("c_status", "Status", c.status, CAR_STATUS)}</div>
        <label class="chk" style="margin-top:12px"><input type="checkbox" id="c_exp" ${c.noExport ? "" : "checked"}> Include in exports (CARFAX, Cars.com, Facebook…)</label>
        <p style="color:var(--muted);font-size:13px;margin:6px 0 0">Drafts never go on the website or in exports. Use 👁 Preview to see a draft as customers will.</p>
        <label class="chk" style="margin-top:12px"><input type="checkbox" id="c_feat" ${c.featured ? "checked" : ""}> Show in the home page animation (needs a cut-out photo)</label></div>
      <div class="card"><h3>Photos</h3><div id="photosBox"></div></div>
      <div class="card"><h3>Cut-out for the animation</h3><div class="photo cut" id="pvCut">${c.cut ? `<img src="${esc(c.cut)}" alt="">` : "No cut-out yet"}</div>
        <input type="file" accept="image/png,image/webp" id="fCut" style="margin-top:10px;font-size:13px"><p class="hint" style="color:var(--muted);font-size:13px;margin:6px 0 0">A PNG with the background removed (e.g. from remove.bg).</p></div>
      ${deals.length ? `<div class="card"><h3>Deals</h3>${deals.map((d) => `<a class="lc" href="#/deals/${d.id}">${dealNo(d)} · ${esc(custName(cust(d.customerId)))}<small>${fdate(d.date)} · ${money(d.price)} · ${d.status}</small></a>`).join("")}</div>` : ""}
      ${isNew ? "" : `<div class="card"><h3>Danger zone</h3><button class="b danger" type="button" id="delCar">Delete this car</button><p class="hint" style="color:var(--muted);font-size:13px">To take it off the website but keep it, set the status to Hidden instead.</p></div>`}
    </div>
  </div>`;
  const vs = () => { const el = $("#c_vin"); el.value = el.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); const [cls, t] = vinCheck(el.value); $("#vinSt").textContent = t; $("#vinSt").style.color = cls === "ok" ? "var(--ok)" : cls === "bad" ? "var(--bad)" : ""; };
  $("#c_vin").oninput = vs; vs();
  $("#decode").onclick = async () => {
    const vin = v("c_vin"); if (vin.length !== 17) { toast("Enter all 17 characters of the VIN first.", 1); return; }
    $("#decode").textContent = "Decoding…";
    try {
      const x = await decodeVin(vin);
      const set = (id, val) => { if (val && !v(id)) document.getElementById(id).value = val; };
      set("c_year", x.year); set("c_make", x.make); set("c_model", x.model); set("c_trim", x.trim); set("c_engine", x.engine); set("c_drive", x.drive); set("c_fuel", x.fuel); set("c_trans", x.trans); set("c_hp", x.hp);
      if (x.body) $("#c_body").value = x.body;
      toast(x.make ? `Decoded: ${x.year} ${x.make} ${x.model}` : "The VIN could not be decoded." , !x.make);
    } catch (_) { toast("Could not reach the VIN decoder. Try again later.", 1); }
    $("#decode").textContent = "Decode VIN";
  };
  const drawExp = () => {
    $("#exp").innerHTML = k.expenses.length ? `<div class="tw"><table class="t"><thead><tr><th>Date</th><th>What</th><th class="r">Amount</th><th></th></tr></thead><tbody>${k.expenses.map((e, i) => `<tr data-i="${i}">
      <td><input type="date" data-e="date" value="${esc(e.date || "")}" style="border:1px solid var(--line);border-radius:4px;padding:5px;background:var(--panel)"></td>
      <td><input data-e="desc" value="${esc(e.desc || "")}" placeholder="Tires, detail, repair…" style="width:100%;border:1px solid var(--line);border-radius:4px;padding:5px;background:var(--panel)"></td>
      <td class="r"><input type="number" step="any" data-e="amount" value="${esc(e.amount ?? "")}" style="width:100px;border:1px solid var(--line);border-radius:4px;padding:5px;text-align:right;background:var(--panel)"></td>
      <td><button class="b sm" type="button" data-del>✕</button></td></tr>`).join("")}</tbody></table></div>` : '<p style="color:var(--muted);font-size:14px;margin:0">No expenses yet.</p>';
    $$("#exp tr[data-i]").forEach((tr) => { const e = k.expenses[+tr.dataset.i];
      $$("[data-e]", tr).forEach((el) => (el.oninput = () => { e[el.dataset.e] = el.dataset.e === "amount" ? n0(el.value) : el.value; sum(); }));
      $("[data-del]", tr).onclick = () => { k.expenses.splice(+tr.dataset.i, 1); drawExp(); sum(); }; });
  };
  const sum = () => {
    const tot = n0(v("k_price")) + k.expenses.reduce((s, e) => s + n0(e.amount), 0), price = n0(v("c_price"));
    $("#costSum").innerHTML = `<dt>Purchase</dt><dd>${money2(n0(v("k_price")))}</dd><dt>Expenses</dt><dd>${money2(tot - n0(v("k_price")))}</dd><dt class="tot">Total cost</dt><dd class="tot">${money2(tot)}</dd>
      <dt>Asking price</dt><dd>${money2(price)}</dd><dt class="tot">Profit if sold at asking</dt><dd class="tot" style="color:${price - tot < 0 ? "var(--bad)" : "var(--ok)"}">${money2(price - tot)}</dd>`;
  };
  drawExp(); sum();
  ["k_price", "c_price"].forEach((i) => ($("#" + i).oninput = sum));
  $("#addExp").onclick = () => { k.expenses.push({ date: todayISO(), desc: "", amount: 0 }); drawExp(); sum(); $$("#exp [data-e=desc]").pop().focus(); };
  const up = (inp, pv, max, key) => ($("#" + inp).onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return; $("#" + pv).textContent = "Uploading…";
    try { c[key] = await upload(f, max); $("#" + pv).innerHTML = `<img src="${esc(c[key])}" alt="">`; }
    catch (x) { $("#" + pv).textContent = "Upload failed"; toast("Upload failed. Try a smaller photo.", 1); } });
  up("fCut", "pvCut", 900, "cut");
  photosBox($("#photosBox"), c, photoEnv(), () => { if (c.cut) $("#pvCut").innerHTML = `<img src="${esc(c.cut)}" alt="">`; });
  if ($("#sticker")) $("#sticker").onclick = () => printSticker(car(c.id));
  if ($("#delCar")) $("#delCar").onclick = async () => {
    if (deals.length) { toast("This car has deals. Set it to Hidden instead.", 1); return; }
    if (!confirm(`Delete ${carTitle(c)}? This can't be undone.`)) return;
    SITE.cars = SITE.cars.filter((x) => x.id !== c.id);
    try { await saveSite(); if (DB.costs.some((x) => x.id === c.id)) await delRec("costs", c.id); toast("Car deleted"); go("#/inventory"); } catch (x) { toast(errMsg(x), 1); }
  };
  $("#saveCar").onclick = async () => {
    const make = v("c_make"), model = v("c_model");
    if (!make || !model) return toast("Add the make and the model.", 1);
    if (!(vn("c_year") > 1900)) return toast("Add the model year.", 1);
    if (!(vn("c_price") > 0)) return toast("Add an asking price.", 1);
    if (!c.img) return toast("Add a photo of the car.", 1);
    Object.assign(c, { vin: v("c_vin") || null, stock: v("c_stock") || null, year: vn("c_year"), make, name: make + " " + model, trim: v("c_trim") || null, body: v("c_body"), miles: vn("c_miles"),
      ext: v("c_ext") || null, int: v("c_int") || null, engine: v("c_engine") || null, trans: v("c_trans") || null, drive: v("c_drive") || null, fuel: v("c_fuel") || null, mpg: v("c_mpg") || null,
      hp: vn("c_hp"), tq: vn("c_tq"), zero: vn("c_zero"), top: vn("c_top"), price: vn("c_price"), status: v("c_status"), noExport: !$("#c_exp").checked, featured: $("#c_feat").checked && !!c.cut,
      equip: v("c_equip").split("\n").map((s) => s.trim()).filter(Boolean) });
    c.desc = v("c_desc") || `${c.year} ${c.name}${c.trim ? " " + c.trim : ""} at ${S().name} in ${S().city}, ${S().state}.`;
    if (c.status === "sold" && !c.soldAt) c.soldAt = todayISO();
    const i = SITE.cars.findIndex((x) => x.id === c.id);
    if (i >= 0) SITE.cars[i] = c; else SITE.cars.unshift(c);
    Object.assign(k, { purchasePrice: vn("k_price"), purchaseDate: v("k_date") || null, source: v("k_from") || null, expenses: k.expenses.filter((e) => e.desc || n0(e.amount)) });
    $("#saveCar").disabled = true;
    try { await saveSite(); await saveRec("costs", k); toast("Saved. The website is updated."); go("#/inventory/" + c.id); }
    catch (x) { toast(errMsg(x), 1); if (i < 0) SITE.cars = SITE.cars.filter((y) => y !== c); }
    $("#saveCar").disabled = false;
  };
}

/* ================= leads ================= */
let leadView = "board", leadQ = "";
function leads(V) {
  const filt = () => DB.leads.filter((l) => !leadQ || [l.name, l.phone, l.email, l.message, l.source].join(" ").toLowerCase().includes(leadQ.toLowerCase()))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  V.innerHTML = `
  <div class="ph"><div><h1>Leads</h1><p>Website forms land here automatically. Add walk-ins and phone calls yourself.</p></div>
    <div class="act"><button class="b" id="leadCsv" type="button">Export CSV</button><a class="b primary" href="#/leads/new">+ Add lead</a></div></div>
  <div class="bar">${seg("leadSeg", [["board", "Pipeline"], ["list", "List"]], leadView)}<div class="f" style="flex:1 1 240px"><input id="leadQ" type="search" placeholder="Filter leads…" value="${esc(leadQ)}" aria-label="Filter"></div></div>
  <div id="leadBody"></div>`;
  const draw = () => {
    const L = filt();
    $("#leadBody").innerHTML = leadView === "board"
      ? `<div class="pipeline">${LEAD_STATUS.map(([k, l]) => { const xs = L.filter((x) => (x.status || "new") === k); return `<div class="col"><h4>${l}<span>${xs.length}</span></h4>${xs.slice(0, 50).map((x) =>
        `<a class="lc" href="#/leads/${x.id}"><b>${esc(x.name)}</b><small>${esc(x.phone || x.email || "")}</small><small>${esc(x.source || "")} · ${fdate((x.createdAt || "").slice(0, 10))}${x.followUp ? " · follow up " + fdate(x.followUp) : ""}</small></a>`).join("") || '<p style="color:var(--dim);font-size:13px;margin:0">—</p>'}</div>`; }).join("")}</div>`
      : table([
        { h: "Name", f: (l) => `<b>${esc(l.name)}</b><span class="sub">${esc([l.phone, l.email].filter(Boolean).join(" · "))}</span>` },
        { h: "Type", f: (l) => esc(l.type === "trade" ? "Trade-in" : l.type || "") }, { h: "Source", f: (l) => esc(l.source || "") },
        { h: "Interested in", f: (l) => esc(l.carId ? carTitle(car(l.carId)) : "") }, { h: "Status", f: (l) => leadPill(l.status) },
        { h: "Follow up", f: (l) => (l.followUp ? fdate(l.followUp) : "—") }, { h: "Received", f: (l) => fdt(l.createdAt) }], L, (l) => "#/leads/" + l.id);
    bindRows(V);
  };
  draw();
  $$("#leadSeg button").forEach((b) => (b.onclick = () => { leadView = b.dataset.k; leads(V); }));
  $("#leadQ").oninput = (e) => { leadQ = e.target.value; draw(); };
  $("#leadCsv").onclick = () => csvDownload("leads.csv", [["Received", "Name", "Phone", "Email", "Type", "Source", "Status", "Interested in", "Follow up", "Message"],
    ...filt().map((l) => [l.createdAt, l.name, l.phone, l.email, l.type, l.source, l.status, l.carId ? carTitle(car(l.carId)) : "", l.followUp || "", l.message || ""])]);
}
function leadEdit(V, id) {
  const isNew = id === "new";
  const l = isNew ? { id: uid("L"), name: "", phone: "", email: "", type: "contact", source: "Walk-in", status: "new", notes: [], createdAt: new Date().toISOString() } : clone(DB.leads.find((x) => x.id === id) || {});
  if (!l.id) { V.innerHTML = '<p class="empty">Lead not found. <a href="#/leads">Back</a></p>'; return; }
  l.notes = l.notes || [];
  const carOpts = [["", "—"], ...SITE.cars.filter((c) => c.status !== "hidden" || c.id === l.carId).map((c) => [c.id, carTitle(c) + (c.status === "sold" ? " (sold)" : "")])];
  V.innerHTML = `
  <div class="crumb"><a href="#/leads">Leads</a> / ${isNew ? "New lead" : esc(l.name)}</div>
  <div class="ph"><div><h1>${isNew ? "Add a lead" : esc(l.name)}</h1>${isNew ? "" : `<p>${leadPill(l.status)} · received ${fdt(l.createdAt)} · ${esc(l.source || "")}</p>`}</div>
    <div class="act">${l.phone ? `<a class="b" href="tel:${esc(l.phone.replace(/[^\d+]/g, ""))}">Call</a><a class="b" href="sms:${esc(l.phone.replace(/[^\d+]/g, ""))}">Text</a>` : ""}${l.email ? `<a class="b" href="mailto:${esc(l.email)}">Email</a>` : ""}
    ${isNew ? "" : l.customerId ? `<a class="b" href="#/customers/${l.customerId}">Open customer</a>` : `<button class="b" id="toCust" type="button">Make customer</button>`}<button class="b primary" id="saveLead" type="button">Save</button></div></div>
  <div class="split">
    <div class="grid">
      <div class="card"><h3>Contact</h3><div class="fg">${fld("l_name", "Name", l.name)}${fld("l_phone", "Phone", l.phone, "tel")}${fld("l_email", "Email", l.email, "email")}
        ${sel("l_type", "Type", l.type, [["contact", "General question"], ["viewing", "Viewing / test drive"], ["trade", "Trade-in"], ["credit", "Financing"]])}${sel("l_source", "Source", l.source, LEAD_SOURCES)}
        ${sel("l_car", "Interested in", l.carId || "", carOpts, "w2")}</div>
        ${l.message ? `<h2 class="sec">Their message</h2><p style="white-space:pre-wrap;margin:0">${esc(l.message)}</p>` : ""}
        ${l.vin || l.miles ? `<h2 class="sec">Trade-in</h2><p style="margin:0">VIN ${esc(l.vin || "—")} · ${esc(l.miles || "—")} miles</p>` : ""}</div>
      <div class="card"><h3>Notes & activity</h3>
        <div class="f"><textarea id="l_note" placeholder="Called, left a voicemail. Coming Saturday at 10…"></textarea></div>
        <div class="formft" style="margin-top:8px"><button class="b" type="button" id="addNote">Add note</button></div>
        <div id="notes">${l.notes.slice().reverse().map((n) => `<div class="note">${esc(n.text)}<small>${fdt(n.at)}</small></div>`).join("") || '<p style="color:var(--muted);font-size:14px">No notes yet.</p>'}</div></div>
    </div>
    <div class="grid">
      <div class="card"><h3>Status</h3>${seg("l_status", LEAD_STATUS.map(([k, t]) => [k, t]), l.status || "new")}
        <div class="fg" style="margin-top:14px">${fld("l_follow", "Follow up on", l.followUp || "", "date")}</div></div>
      ${isNew ? "" : `<div class="card"><h3>Next step</h3><div style="display:grid;gap:8px"><a class="b" href="#/deals/new?lead=${esc(l.id)}${l.carId ? "&car=" + esc(l.carId) : ""}">Start a deal</a>
        <a class="b" href="#/calendar/new?lead=${esc(l.id)}">Book an appointment</a><button class="b" type="button" id="addTask">Add a follow-up task</button></div></div>
      ${DB.templates.length ? `<div class="card"><h3>Send a template</h3>${sel("l_tpl", "Template", "", [["", "Choose…"], ...DB.templates.map((t) => [t.id, (t.channel === "sms" ? "💬 " : "✉ ") + t.name])])}<div class="formft"><button class="b" type="button" id="useTpl">Open message</button></div></div>` : ""}
      <div class="card"><h3>Danger zone</h3><button class="b danger" type="button" id="delLead">Delete lead</button></div>`}
    </div>
  </div>`;
  let status = l.status || "new";
  $$("#l_status button").forEach((b) => (b.onclick = () => { status = b.dataset.k; $$("#l_status button").forEach((x) => x.classList.toggle("on", x === b)); }));
  const collect = () => Object.assign(l, { name: v("l_name"), phone: v("l_phone"), email: v("l_email"), type: v("l_type"), source: v("l_source"), carId: v("l_car") || null, followUp: v("l_follow") || null, status });
  const save = async (msg = "Saved") => {
    collect(); if (!l.name) { toast("Add a name.", 1); return false; }
    try { await saveRec("leads", l); toast(msg); return true; } catch (x) { toast(errMsg(x), 1); return false; }
  };
  $("#saveLead").onclick = async () => { if (await save()) go("#/leads/" + l.id); };
  $("#addNote").onclick = async () => { const t = v("l_note"); if (!t) return; l.notes.push({ text: t, at: new Date().toISOString() }); if (status === "new") status = "contacted"; if (await save("Note added")) go("#/leads/" + l.id); };
  if ($("#addTask")) $("#addTask").onclick = async () => { const t = prompt("Task (e.g. Call back about the F-150):", "Follow up with " + (l.name || "")); if (!t) return;
    const due = prompt("Due date (yyyy-mm-dd):", addDays(todayISO(), 1)); try { await saveRec("tasks", { id: uid("T"), title: t, due: due || todayISO(), leadId: l.id, done: false }); toast("Task added"); } catch (x) { toast(errMsg(x), 1); } };
  if ($("#useTpl")) $("#useTpl").onclick = () => { const t = DB.templates.find((x) => x.id === v("l_tpl")); if (!t) return; useTemplate(t, { name: l.name, phone: l.phone, email: l.email, car: car(l.carId) }); };
  if ($("#toCust")) $("#toCust").onclick = async () => {
    collect(); const [first, ...rest] = (l.name || "").split(" ");
    const k = l.credit || {};
    const c = { id: uid("C"), first: k.first || first, last: k.last || rest.join(" "), phone: l.phone, email: l.email, source: l.source, notes: l.message || "",
      dob: k.dob || null, street: k.street || "", city: k.city || "", state: k.state || "", zip: k.zip || "", employer: k.employer || "", income: k.income ? n0(String(k.income).replace(/[^\d.]/g, "")) : null };
    try { await saveRec("customers", c); l.customerId = c.id; if (l.status === "new") l.status = "contacted"; await saveRec("leads", l); toast("Customer created"); go("#/customers/" + c.id); } catch (x) { toast(errMsg(x), 1); }
  };
  if ($("#delLead")) $("#delLead").onclick = async () => { if (!confirm("Delete this lead?")) return; try { await delRec("leads", l.id); toast("Lead deleted"); go("#/leads"); } catch (x) { toast(errMsg(x), 1); } };
}

/* ================= customers ================= */
let custQ = "";
function customers(V) {
  const filt = () => DB.customers.filter((c) => !custQ || [c.first, c.last, c.company, c.phone, c.email, c.city].join(" ").toLowerCase().includes(custQ.toLowerCase()))
    .sort((a, b) => custName(a).localeCompare(custName(b)));
  V.innerHTML = `<div class="ph"><div><h1>Customers</h1><p>${DB.customers.length} customers</p></div><div class="act"><button class="b" id="custCsv" type="button">Export CSV</button><a class="b primary" href="#/customers/new">+ Add customer</a></div></div>
  <div class="bar"><div class="f" style="flex:1 1 240px"><input id="custQ" type="search" placeholder="Filter by name, phone, email…" value="${esc(custQ)}" aria-label="Filter"></div></div><div id="custT"></div>`;
  const draw = () => {
    $("#custT").innerHTML = table([
      { h: "Name", f: (c) => `<b>${esc(custName(c))}</b><span class="sub">${esc([c.city, c.state].filter(Boolean).join(", "))}</span>` },
      { h: "Phone", f: (c) => esc(c.phone || "") }, { h: "Email", f: (c) => esc(c.email || "") },
      { h: "Deals", r: 1, f: (c) => DB.deals.filter((d) => d.customerId === c.id && d.status !== "void").length },
      { h: "Balance owed", r: 1, f: (c) => { const b = bhphDeals().filter((d) => d.customerId === c.id).reduce((s, d) => s + account(d).payoff, 0); return b ? money2(b) : "—"; } }], filt(), (c) => "#/customers/" + c.id);
    bindRows(V);
  };
  draw(); $("#custQ").oninput = (e) => { custQ = e.target.value; draw(); };
  $("#custCsv").onclick = () => csvDownload("customers.csv", [["First", "Last", "Phone", "Email", "Street", "City", "State", "ZIP"], ...filt().map((c) => [c.first, c.last, c.phone, c.email, c.street, c.city, c.state, c.zip])]);
}
function custEdit(V, id, q) {
  const isNew = id === "new";
  const c = isNew ? { id: uid("C"), state: S().state } : clone(cust(id) || {});
  if (!c.id) { V.innerHTML = '<p class="empty">Customer not found. <a href="#/customers">Back</a></p>'; return; }
  const deals = DB.deals.filter((d) => d.customerId === c.id), ls = DB.leads.filter((l) => l.customerId === c.id);
  V.innerHTML = `
  <div class="crumb"><a href="#/customers">Customers</a> / ${isNew ? "New customer" : esc(custName(c))}</div>
  <div class="ph"><div><h1>${isNew ? "Add a customer" : esc(custName(c))}</h1></div>
    <div class="act">${c.phone ? `<a class="b" href="tel:${esc(String(c.phone).replace(/[^\d+]/g, ""))}">Call</a>` : ""}${c.email ? `<a class="b" href="mailto:${esc(c.email)}">Email</a>` : ""}${isNew ? "" : `<a class="b" href="#/deals/new?customer=${esc(c.id)}">Start a deal</a>`}<button class="b primary" id="saveCust" type="button">Save</button></div></div>
  <div class="split">
    <div class="card"><h3>Details</h3><div class="fg">
      ${fld("u_first", "First name", c.first)}${fld("u_last", "Last name", c.last)}${fld("u_phone", "Phone", c.phone, "tel")}${fld("u_phone2", "Other phone", c.phone2, "tel")}${fld("u_email", "Email", c.email, "email", "wide")}
      ${fld("u_street", "Street", c.street, "text", "wide")}${fld("u_city", "City", c.city)}${fld("u_state", "State", c.state)}${fld("u_zip", "ZIP", c.zip)}
      ${fld("u_dob", "Date of birth", c.dob, "date")}${fld("u_dl", "Driver's licence #", c.dl)}${fld("u_dlst", "Licence state", c.dlState)}${fld("u_dlexp", "Licence expires", c.dlExp, "date")}
      ${fld("u_employer", "Employer", c.employer)}${fld("u_income", "Monthly income", c.income, "number")}
      ${fld("u_ref1", "Reference 1 (name, phone)", c.ref1, "text", "wide")}${fld("u_ref2", "Reference 2 (name, phone)", c.ref2, "text", "wide")}
      ${area("u_notes", "Notes", c.notes)}</div></div>
    <div class="grid">
      <div class="card"><h3>Deals</h3>${deals.map((d) => `<a class="lc" href="#/deals/${d.id}">${dealNo(d)} · ${esc(carTitle(car(d.carId)))}<small>${fdate(d.date)} · ${esc(DEAL_TYPES[d.type] || "")} · ${d.status}${d.type === "bhph" && d.status === "sold" ? " · owes " + money2(account(d).payoff) : ""}</small></a>`).join("") || '<p style="color:var(--muted);font-size:14px;margin:0">No deals yet.</p>'}</div>
      ${ls.length ? `<div class="card"><h3>Leads</h3>${ls.map((l) => `<a class="lc" href="#/leads/${l.id}">${esc(l.source || "")} · ${leadPill(l.status)}<small>${fdt(l.createdAt)}</small></a>`).join("")}</div>` : ""}
      ${isNew || deals.length ? "" : `<div class="card"><h3>Danger zone</h3><button class="b danger" type="button" id="delCust">Delete customer</button></div>`}
    </div></div>
  ${isNew ? "" : `<div class="card" style="margin-top:14px"><h3>Documents · licence, insurance, pay stubs</h3><div id="docs"></div></div>`}`;
  if (!isNew) docsBox($("#docs"), cust(c.id) || c, "customers");
  $("#saveCust").onclick = async () => {
    Object.assign(c, { first: v("u_first"), last: v("u_last"), phone: v("u_phone"), phone2: v("u_phone2"), email: v("u_email"), street: v("u_street"), city: v("u_city"), state: v("u_state"), zip: v("u_zip"),
      dob: v("u_dob") || null, dl: v("u_dl"), dlState: v("u_dlst"), dlExp: v("u_dlexp") || null, employer: v("u_employer"), income: vn("u_income"), ref1: v("u_ref1"), ref2: v("u_ref2"), notes: v("u_notes") });
    if (!c.first && !c.last) return toast("Add a name.", 1);
    try { await saveRec("customers", c); toast("Saved"); go(q.back ? decodeURIComponent(q.back).replace("CUST", c.id) : "#/customers/" + c.id); } catch (x) { toast(errMsg(x), 1); }
  };
  if ($("#delCust")) $("#delCust").onclick = async () => { if (!confirm("Delete this customer?")) return; try { await delRec("customers", c.id); toast("Deleted"); go("#/customers"); } catch (x) { toast(errMsg(x), 1); } };
}

/* ================= deals ================= */
let dealFilter = "all";
function deals(V) {
  const list = DB.deals.filter((d) => dealFilter === "all" ? d.status !== "void" : d.status === dealFilter).sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.number || 0) - (a.number || 0));
  V.innerHTML = `<div class="ph"><div><h1>Deals</h1><p>Sales, paperwork and financing.</p></div><div class="act"><button class="b" id="dealCsv" type="button">Export CSV</button><a class="b primary" href="#/deals/new">+ New deal</a></div></div>
  <div class="bar">${seg("dealSeg", [["all", "All"], ["draft", "Drafts"], ["sold", "Sold"], ["void", "Void"]], dealFilter)}</div>
  ${table([{ h: "Deal", f: dealNo }, { h: "Date", f: (d) => fdate(d.date) }, { h: "Customer", f: (d) => esc(custName(cust(d.customerId))) },
    { h: "Vehicle", f: (d) => esc(carTitle(car(d.carId))) }, { h: "Type", f: (d) => esc(DEAL_TYPES[d.type] || "") },
    { h: "Price", r: 1, f: (d) => money(d.price) }, { h: "Financed", r: 1, f: (d) => (calc(d).financed ? money(calc(d).financed) : "—") },
    { h: "Gross", r: 1, f: (d) => { const g = calc(d).gross; return g === null || !hasCost(d.carId) ? "—" : `<span style="color:${g < 0 ? "var(--bad)" : "var(--ok)"}">${money(g)}</span>`; } },
    { h: "Status", f: dealPill }], list, (d) => "#/deals/" + d.id)}`;
  bindRows(V);
  $$("#dealSeg button").forEach((b) => (b.onclick = () => { dealFilter = b.dataset.k; deals(V); }));
  $("#dealCsv").onclick = () => csvDownload("deals.csv", [["Deal", "Date", "Status", "Type", "Customer", "Vehicle", "VIN", "Price", "Doc fee", "Title fee", "Tax", "Trade allowance", "Trade payoff", "Down", "Financed", "APR", "Payment", "Payments", "Gross"],
    ...list.map((d) => { const c = calc(d), k = car(d.carId) || {}; return [d.number, d.date, d.status, DEAL_TYPES[d.type], custName(cust(d.customerId)), carTitle(k), k.vin || "", c.price, c.doc, c.title, c.tax, c.allow, c.payoff, c.down, c.financed, d.apr || "", c.payment || "", c.nPay || "", c.gross ?? ""]; })]);
}
function dealEdit(V, id, q) {
  const isNew = id === "new";
  const st = S();
  let d = isNew ? { id: uid("D"), number: Math.max(1000, ...DB.deals.map((x) => n0(x.number))) + 1, date: todayISO(), status: "draft", type: "cash", carId: q.car || "", customerId: q.customer || "", leadId: q.lead || "",
    price: q.car ? n0(car(q.car)?.price) : 0, docFee: st.docFee, titleFee: st.titleFee, taxRate: st.taxRate, down: 0, apr: st.apr, term: 24, freq: "monthly", trade: {} } : clone(DB.deals.find((x) => x.id === id) || {});
  if (!d.id) { V.innerHTML = '<p class="empty">Deal not found. <a href="#/deals">Back</a></p>'; return; }
  if (isNew && q.lead && !d.customerId) { const l = DB.leads.find((x) => x.id === q.lead); if (l?.customerId) d.customerId = l.customerId; }
  d.trade = d.trade || {};
  const locked = d.status !== "draft";
  const carOpts = [["", "Choose a car…"], ...SITE.cars.filter((c) => c.status === "lot" || c.status === "pending" || c.id === d.carId).map((c) => [c.id, `${carTitle(c)}${c.stock ? " · #" + c.stock : ""} · ${money(c.price)}`])];
  const custOpts = [["", "Choose a customer…"], ...DB.customers.slice().sort((a, b) => custName(a).localeCompare(custName(b))).map((c) => [c.id, custName(c) + (c.phone ? " · " + c.phone : "")])];
  const dis = locked ? "disabled" : "";
  V.innerHTML = `
  <div class="crumb"><a href="#/deals">Deals</a> / ${isNew ? "New deal" : "Deal " + dealNo(d)}</div>
  <div class="ph"><div><h1>Deal ${dealNo(d)}</h1><p>${dealPill(d)} ${d.soldAt ? "· sold " + fdate(d.soldAt) : ""}</p></div>
    <div class="act">${isNew ? "" : `<button class="b" type="button" data-doc="bos">Bill of sale</button><button class="b" type="button" data-doc="guide">Buyers Guide</button>${d.type !== "cash" ? '<button class="b" type="button" data-doc="sched">Payment schedule</button>' : ""}`}
    ${locked ? (d.status === "sold" ? `<button class="b danger" type="button" id="voidDeal">Void deal</button>` : "") : `<button class="b" type="button" id="saveDeal">Save draft</button><button class="b primary" type="button" id="sellDeal">Mark as sold</button>`}</div></div>
  ${locked ? `<div class="banner ${d.status === "void" ? "warn" : ""}">${d.status === "sold" ? "This deal is final. To change it, void it and start a new one." : "This deal was voided."}</div>` : ""}
  <div class="split">
    <div class="grid">
      <div class="card"><h3>Buyer & vehicle</h3><div class="fg">
        ${sel("d_cust", "Customer", d.customerId, custOpts, "w2")}<div class="f" style="align-self:end">${locked ? "" : `<a class="b" href="#/customers/new?back=${encodeURIComponent("#/deals/" + (isNew ? "new?customer=CUST" + (d.carId ? "&car=" + d.carId : "") : d.id))}">+ New customer</a>`}</div>
        ${sel("d_car", "Vehicle", d.carId, carOpts, "w2")}${fld("d_date", "Sale date", d.date, "date", dis)}
        ${sel("d_sp", "Salesperson", d.salesperson || "", [["", "—"], ...(st.salespeople || []).map((s) => [s, s])])}</div></div>
      <div class="card"><h3>Deal type</h3>${seg("d_type", Object.entries(DEAL_TYPES), d.type)}
        <div class="fg" style="margin-top:14px" id="finBox"></div></div>
      <div class="card"><h3>Price</h3><div class="fg">
        ${fld("d_price", "Sale price", d.price, "number", dis)}${fld("d_doc", "Doc fee", d.docFee, "number", dis)}${fld("d_title", "Title & registration", d.titleFee, "number", dis)}${fld("d_tax", "Sales tax %", d.taxRate, "number", dis)}${fld("d_down", "Down payment", d.down, "number", dis)}</div></div>
      <div class="card"><h3>Trade-in</h3><div class="fg">
        ${fld("t_year", "Year", d.trade.year, "number", dis)}${fld("t_make", "Make", d.trade.make, "text", dis)}${fld("t_model", "Model", d.trade.model, "text", dis)}${fld("t_vin", "VIN", d.trade.vin, "text", dis)}${fld("t_miles", "Mileage", d.trade.miles, "number", dis)}
        ${fld("t_allow", "Trade allowance", d.trade.allowance, "number", dis)}${fld("t_payoff", "Payoff owed on it", d.trade.payoff, "number", dis)}${fld("t_lien", "Lienholder", d.trade.lienholder, "text", dis)}</div>
        ${!locked ? '<label class="chk" style="margin-top:12px"><input type="checkbox" id="t_stock"> Add the trade-in to inventory as hidden when sold</label>' : ""}</div>
      <div class="card"><h3>Notes</h3>${area("d_notes", "Notes (internal)", d.notes)}</div>
    </div>
    <div class="grid" style="position:sticky;top:70px">
      <div class="card"><h3>Summary</h3><dl class="dl" id="dsum"></dl></div>
      ${d.status === "sold" && d.type === "bhph" ? `<a class="b" href="#/collections/${d.id}">Open payment account →</a>` : ""}
      ${isNew || locked ? "" : `<div class="card"><h3>Danger zone</h3><button class="b danger" type="button" id="delDeal">Delete draft</button></div>`}
    </div></div>
  ${isNew ? "" : `<div class="card" style="margin-top:14px"><h3>Deal jacket · documents</h3><div id="docs"></div></div>`}`;
  if (!isNew) docsBox($("#docs"), DB.deals.find((x) => x.id === d.id) || d, "deals");
  $$("#d_type button").forEach((b) => { if (locked) b.disabled = true; });
  if (locked) $$(".split input,.split select,.split textarea", V).forEach((el) => (el.disabled = true));
  const finBox = () => {
    $("#finBox").innerHTML = d.type === "cash" ? '<p style="color:var(--muted);margin:0;grid-column:1/-1">Paid in full at signing.</p>'
      : `${fld("d_apr", "APR %", d.apr, "number", dis)}${fld("d_term", "Term (months)", d.term, "number", dis)}${sel("d_freq", "Payments", d.freq || "monthly", Object.entries(FREQ).map(([k, [l]]) => [k, l]), locked ? "" : "")}
         ${fld("d_first", "First payment due", d.firstDue || addPeriod(d.date || todayISO(), d.freq, 1), "date", dis)}${d.type === "outside" ? fld("d_lender", "Lender", d.lender, "text", dis + " wide") : ""}`;
    if (locked && $("#d_freq")) $("#d_freq").disabled = true;
    $$("#finBox input,#finBox select").forEach((el) => (el.oninput = el.onchange = upd));
  };
  const collect = () => {
    const g = (i) => (document.getElementById(i) ? v(i) : undefined), gn = (i) => (document.getElementById(i) ? vn(i) : undefined);
    Object.assign(d, { customerId: g("d_cust"), carId: g("d_car"), date: g("d_date"), salesperson: g("d_sp"), price: gn("d_price") || 0, docFee: gn("d_doc") || 0, titleFee: gn("d_title") || 0, taxRate: gn("d_tax") || 0, down: gn("d_down") || 0, notes: g("d_notes") });
    if (d.type !== "cash") Object.assign(d, { apr: gn("d_apr") ?? d.apr, term: gn("d_term") ?? d.term, freq: g("d_freq") || d.freq, firstDue: g("d_first") || null, lender: g("d_lender") ?? d.lender });
    d.trade = { year: gn("t_year"), make: g("t_make"), model: g("t_model"), vin: g("t_vin"), miles: gn("t_miles"), allowance: gn("t_allow") || 0, payoff: gn("t_payoff") || 0, lienholder: g("t_lien") };
  };
  const upd = () => {
    if (!locked) collect();
    const c = calc(d), k = car(d.carId);
    $("#dsum").innerHTML = `<dt>Sale price</dt><dd>${money2(c.price)}</dd><dt>Doc fee</dt><dd>${money2(c.doc)}</dd><dt>Title & registration</dt><dd>${money2(c.title)}</dd>
      <dt>Sales tax (${n0(d.taxRate)}% of ${money(c.taxable)})</dt><dd>${money2(c.tax)}</dd><dt class="tot">Total</dt><dd class="tot">${money2(c.total)}</dd>
      ${c.allow || c.payoff ? `<dt>Trade allowance</dt><dd>−${money2(c.allow)}</dd><dt>Trade payoff</dt><dd>+${money2(c.payoff)}</dd>` : ""}
      <dt>Down payment</dt><dd>−${money2(c.down)}</dd>
      <dt class="tot">${d.type === "cash" ? "Due at signing" : "Amount financed"}</dt><dd class="tot">${money2(d.type === "cash" ? c.balance : c.financed)}</dd>
      ${d.type !== "cash" ? `<dt>Payment</dt><dd style="font-weight:700;color:var(--brand)">${money2(c.payment)} ${FREQ[d.freq || "monthly"][0].toLowerCase()}</dd><dt>Number of payments</dt><dd>${c.nPay}</dd>
        <dt>Finance charge</dt><dd>${money2(c.finCharge)}</dd><dt>Total of payments</dt><dd>${money2(c.totalPay)}</dd>` : ""}
      ${k ? `<dt style="margin-top:8px">Vehicle cost</dt><dd style="margin-top:8px">${hasCost(k.id) ? money2(carCost(k.id)) : "not entered"}</dd>${hasCost(k.id) ? `<dt class="tot">Front gross</dt><dd class="tot" style="color:${c.gross < 0 ? "var(--bad)" : "var(--ok)"}">${money2(c.gross)}</dd>` : ""}` : ""}`;
  };
  $$("#d_type button").forEach((b) => (b.onclick = () => { if (locked) return; collect(); d.type = b.dataset.k; $$("#d_type button").forEach((x) => x.classList.toggle("on", x === b)); finBox(); upd(); }));
  finBox(); upd();
  $$("input,select,textarea", V).forEach((el) => { if (!el.closest("#finBox")) { const o = el.oninput; el.addEventListener("input", upd); el.addEventListener("change", upd); } });
  $("#d_car").addEventListener("change", () => { const k = car(v("d_car")); if (k && !locked) { $("#d_price").value = k.price; upd(); } });
  $$("[data-doc]").forEach((b) => (b.onclick = () => printDeal(b.dataset.doc, DB.deals.find((x) => x.id === d.id) || d)));
  const save = async () => { collect(); try { const s = await saveRec("deals", d); d = clone(s); return true; } catch (x) { toast(errMsg(x), 1); return false; } };
  if ($("#saveDeal")) $("#saveDeal").onclick = async () => { if (await save()) { toast("Draft saved"); go("#/deals/" + d.id); } };
  if ($("#sellDeal")) $("#sellDeal").onclick = async () => {
    collect();
    if (!d.customerId) return toast("Choose a customer first.", 1);
    if (!d.carId) return toast("Choose a vehicle first.", 1);
    if (!(d.price > 0)) return toast("Enter the sale price.", 1);
    if (d.type !== "cash" && !(calc(d).financed > 0)) return toast("Nothing left to finance. Switch the deal type to Cash.", 1);
    if (!confirm(`Mark deal ${dealNo(d)} as sold? The car will show as Sold on the website.`)) return;
    d.status = "sold"; d.soldAt = d.date || todayISO();
    if (d.type !== "cash" && !d.firstDue) d.firstDue = addPeriod(d.date, d.freq, 1);
    const k = car(d.carId); const prev = k && clone(k);
    if (k) { k.status = "sold"; k.soldAt = d.soldAt; k.featured = false; }
    const addTrade = $("#t_stock")?.checked && d.trade.make;
    if (addTrade) SITE.cars.push({ id: uid("c"), year: d.trade.year, make: d.trade.make, name: d.trade.make + " " + (d.trade.model || ""), vin: d.trade.vin || null, miles: d.trade.miles, price: 0, body: "Truck", equip: [], desc: "", img: "", cut: "", status: "hidden", featured: false, addedAt: d.soldAt });
    try {
      await saveRec("deals", d); await saveSite();
      if (addTrade) await saveRec("costs", { id: SITE.cars[SITE.cars.length - 1].id, purchasePrice: d.trade.allowance, purchaseDate: d.soldAt, source: "Trade-in on deal " + dealNo(d), expenses: [] });
      if (d.leadId) { const l = DB.leads.find((x) => x.id === d.leadId); if (l) { l.status = "won"; l.customerId = l.customerId || d.customerId; await saveRec("leads", l); } }
      toast("Sold! The website now shows the car as sold."); go("#/deals/" + d.id);
    } catch (x) { if (k && prev) Object.assign(k, prev); d.status = "draft"; toast(errMsg(x), 1); }
  };
  if ($("#voidDeal")) $("#voidDeal").onclick = async () => {
    if (DB.payments.some((p) => p.dealId === d.id)) { if (!confirm("This deal has payments recorded. Void it anyway? The payments stay in the records.")) return; }
    else if (!confirm(`Void deal ${dealNo(d)}? The car goes back on the lot.`)) return;
    d.status = "void"; const k = car(d.carId); if (k) { k.status = "lot"; delete k.soldAt; }
    try { await saveRec("deals", d); await saveSite(); toast("Deal voided. The car is back on the lot."); go("#/deals/" + d.id); } catch (x) { toast(errMsg(x), 1); }
  };
  if ($("#delDeal")) $("#delDeal").onclick = async () => { if (!confirm("Delete this draft?")) return; try { await delRec("deals", d.id); toast("Draft deleted"); go("#/deals"); } catch (x) { toast(errMsg(x), 1); } };
}

/* ================= collections (buy here pay here) ================= */
let colFilter = "open";
function collections(V) {
  const rows = bhphDeals().map((d) => [d, account(d)]);
  const f = rows.filter(([, a]) => colFilter === "all" ? true : colFilter === "late" ? a.pastDue > 0 : colFilter === "paid" ? a.payoff === 0 : a.payoff > 0)
    .sort((a, b) => b[1].daysLate - a[1].daysLate || (a[1].next?.date || "").localeCompare(b[1].next?.date || ""));
  const open = rows.filter(([, a]) => a.payoff > 0), late = rows.filter(([, a]) => a.pastDue > 0);
  const month = todayISO().slice(0, 7);
  V.innerHTML = `<div class="ph"><div><h1>Collections</h1><p>Buy here pay here accounts. Record payments, see who is late, print receipts.</p></div></div>
  <div class="grid g4" style="margin-bottom:14px">
    <div class="card kpi"><span>Open accounts</span><b>${open.length}</b><small>${money(open.reduce((s, [, a]) => s + a.payoff, 0))} still owed</small></div>
    <div class="card kpi"><span>Past due</span><b style="color:${late.length ? "var(--bad)" : "inherit"}">${late.length}</b><small>${money2(late.reduce((s, [, a]) => s + a.pastDue, 0))}</small></div>
    <div class="card kpi"><span>Collected this month</span><b>${money(DB.payments.filter((p) => (p.date || "").startsWith(month)).reduce((s, p) => s + n0(p.amount), 0))}</b><small>${DB.payments.filter((p) => (p.date || "").startsWith(month)).length} payments</small></div>
    <div class="card kpi"><span>Due next 7 days</span><b>${open.filter(([, a]) => a.next && days(todayISO(), a.next.date) >= 0 && days(todayISO(), a.next.date) <= 7).length}</b><small>accounts</small></div>
  </div>
  <div class="bar">${seg("colSeg", [["open", "Open"], ["late", `Past due (${late.length})`], ["paid", "Paid off"], ["all", "All"]], colFilter)}</div>
  ${table([{ h: "Customer", f: ([d]) => `<b>${esc(custName(cust(d.customerId)))}</b><span class="sub">${esc(cust(d.customerId)?.phone || "")}</span>` },
    { h: "Vehicle", f: ([d]) => esc(carTitle(car(d.carId))) }, { h: "Payment", r: 1, f: ([d, a]) => money2(a.calc.payment) },
    { h: "Next due", f: ([, a]) => (a.next && a.payoff ? fdate(a.next.date) : "—") }, { h: "Past due", r: 1, f: ([, a]) => (a.pastDue ? `<b style="color:var(--bad)">${money2(a.pastDue)}</b>` : "—") },
    { h: "Days late", r: 1, f: ([, a]) => a.daysLate || "—" }, { h: "Last paid", f: ([, a]) => (a.lastPay ? fdate(a.lastPay.date) : "—") },
    { h: "Payoff", r: 1, f: ([, a]) => money2(a.payoff) }, { h: "Status", f: ([, a]) => pill(a.status[0], a.status[1]) }], f, ([d]) => "#/collections/" + d.id)}`;
  bindRows(V);
  $$("#colSeg button").forEach((b) => (b.onclick = () => { colFilter = b.dataset.k; collections(V); }));
}
function collectionEdit(V, id) {
  const d = DB.deals.find((x) => x.id === id);
  if (!d) { V.innerHTML = '<p class="empty">Account not found. <a href="#/collections">Back</a></p>'; return; }
  const a = account(d), c = cust(d.customerId), sch = schedule(d);
  let cum = 0;
  V.innerHTML = `
  <div class="crumb"><a href="#/collections">Collections</a> / ${esc(custName(c))}</div>
  <div class="ph"><div><h1>${esc(custName(c))}</h1><p>${pill(a.status[0], a.status[1])} · ${esc(carTitle(car(d.carId)))} · deal <a href="#/deals/${d.id}">${dealNo(d)}</a></p></div>
    <div class="act">${c?.phone ? `<a class="b" href="tel:${esc(String(c.phone).replace(/[^\d+]/g, ""))}">Call</a><a class="b" href="sms:${esc(String(c.phone).replace(/[^\d+]/g, ""))}">Text</a>` : ""}<button class="b" type="button" data-doc="sched">Print schedule</button></div></div>
  <div class="split">
    <div class="grid">
      <div class="card"><h3>Record a payment</h3><div class="fg">${fld("p_date", "Date", todayISO(), "date")}${fld("p_amt", "Amount", a.pastDue || a.calc.payment, "number")}${sel("p_method", "Method", "Cash", PAY_METHODS)}${fld("p_note", "Note", "", "text")}</div>
        <div class="formft"><button class="b primary" type="button" id="addPay">Save payment</button></div></div>
      <div class="card"><h3>Payment history</h3>${table([{ h: "Date", f: (p) => fdate(p.date) }, { h: "Method", f: (p) => esc(p.method || "") }, { h: "Note", f: (p) => esc(p.note || "") },
        { h: "Amount", r: 1, f: (p) => money2(p.amount) }, { h: "", f: (p) => `<button class="b sm" type="button" data-rcpt="${p.id}">Receipt</button> <button class="b sm" type="button" data-delpay="${p.id}" aria-label="Delete payment">✕</button>` }], a.pays.slice().reverse())}</div>
      <div class="card"><h3>Schedule</h3>${table([{ h: "#", f: (s) => s.n }, { h: "Due", f: (s) => fdate(s.date) }, { h: "Amount", r: 1, f: (s) => money2(s.amount) },
        { h: "", f: (s) => { cum += s.amount; return cum <= a.paid + 0.005 ? pill("Paid", "ok") : s.date < todayISO() ? pill("Late", "bad") : cum - s.amount < a.paid ? pill("Part paid", "warn") : ""; } }], sch)}</div>
    </div>
    <div class="grid" style="position:sticky;top:70px">
      <div class="card"><h3>Account</h3><dl class="dl">
        <dt>Amount financed</dt><dd>${money2(a.calc.financed)}</dd><dt>APR</dt><dd>${n0(d.apr)}%</dd><dt>Payment</dt><dd>${money2(a.calc.payment)} ${FREQ[d.freq || "monthly"][0].toLowerCase()}</dd>
        <dt>Paid so far</dt><dd>${money2(a.paid)}</dd><dt>Interest paid</dt><dd>${money2(a.interestPaid)}</dd><dt>Principal left</dt><dd>${money2(a.principal)}</dd><dt>Interest since last payment</dt><dd>${money2(a.accrued)}</dd>
        <dt class="tot">Payoff today</dt><dd class="tot">${money2(a.payoff)}</dd>
        <dt>Past due</dt><dd style="color:${a.pastDue ? "var(--bad)" : "inherit"}">${money2(a.pastDue)}</dd><dt>Next payment</dt><dd>${a.next && a.payoff ? fdate(a.next.date) : "—"}</dd>
      </dl></div>
      ${c ? `<div class="card"><h3>Customer</h3><p style="margin:0">${esc(custName(c))}<br>${esc(c.phone || "")}<br>${esc(c.email || "")}<br>${esc([c.street, c.city, c.state, c.zip].filter(Boolean).join(", "))}</p><a class="b sm" style="margin-top:10px" href="#/customers/${c.id}">Open customer</a></div>` : ""}
    </div></div>`;
  $("#addPay").onclick = async () => {
    const amt = vn("p_amt"); if (!(amt > 0)) return toast("Enter the amount.", 1);
    const p = { id: uid("P"), dealId: d.id, customerId: d.customerId, date: v("p_date") || todayISO(), amount: amt, method: v("p_method"), note: v("p_note") };
    try { await saveRec("payments", p); toast("Payment saved"); collectionEdit(V, id); if (confirm("Print a receipt?")) printReceipt(p); } catch (x) { toast(errMsg(x), 1); }
  };
  $$("[data-rcpt]").forEach((b) => (b.onclick = () => printReceipt(DB.payments.find((p) => p.id === b.dataset.rcpt))));
  $$("[data-delpay]").forEach((b) => (b.onclick = async () => { if (!confirm("Delete this payment?")) return; try { await delRec("payments", b.dataset.delpay); toast("Payment deleted"); collectionEdit(V, id); } catch (x) { toast(errMsg(x), 1); } }));
  $("[data-doc]").onclick = () => printDeal("sched", d);
}

/* ================= reports ================= */
let repYear = new Date().getFullYear();
function reports(V) {
  const sold = DB.deals.filter((d) => d.status === "sold");
  const years = [...new Set([new Date().getFullYear(), ...sold.map((d) => +String(d.date).slice(0, 4))])].filter(Boolean).sort((a, b) => b - a);
  const months = Array.from({ length: 12 }, (_, i) => `${repYear}-${String(i + 1).padStart(2, "0")}`);
  const mrows = months.map((m) => { const ds = sold.filter((d) => (d.date || "").startsWith(m)); const g = ds.filter((d) => hasCost(d.carId));
    const dts = ds.map((d) => { const k = car(d.carId); return k ? days(inDate(k), d.date) : null; }).filter((x) => x !== null && x >= 0);
    return { m, n: ds.length, rev: ds.reduce((s, d) => s + n0(d.price), 0), gross: g.reduce((s, d) => s + calc(d).gross, 0), gN: g.length, fin: ds.filter((d) => d.type !== "cash").length, dts: dts.length ? Math.round(dts.reduce((a, b) => a + b, 0) / dts.length) : null,
      coll: DB.payments.filter((p) => (p.date || "").startsWith(m)).reduce((s, p) => s + n0(p.amount), 0) }; });
  const tot = mrows.reduce((t, r) => ({ n: t.n + r.n, rev: t.rev + r.rev, gross: t.gross + r.gross, coll: t.coll + r.coll }), { n: 0, rev: 0, gross: 0, coll: 0 });
  const lot = SITE.cars.filter((c) => c.status === "lot");
  const buckets = [["0–30 days", 0, 30], ["31–60 days", 31, 60], ["61–90 days", 61, 90], ["Over 90 days", 91, 1e9], ["No date", null, null]].map(([l, a, b]) => {
    const cs = lot.filter((c) => { const d = days(inDate(c)); return a === null ? d === null : d !== null && d >= a && d <= b; });
    return [l, cs.length, cs.reduce((s, c) => s + n0(c.price), 0), cs.reduce((s, c) => s + carCost(c.id), 0)]; });
  const src = {}; DB.leads.forEach((l) => { const k = l.source || "Other"; src[k] = src[k] || [0, 0]; src[k][0]++; if (l.status === "won") src[k][1]++; });
  const srcRows = Object.entries(src).sort((a, b) => b[1][0] - a[1][0]); const maxSrc = Math.max(1, ...srcRows.map(([, x]) => x[0]));
  const maxRev = Math.max(1, ...mrows.map((r) => r.rev));
  V.innerHTML = `<div class="ph"><div><h1>Reports</h1><p>Sales, profit, inventory age and where your leads come from.</p></div>
    <div class="act"><select id="repY" class="b" aria-label="Year">${years.map((y) => `<option ${y === repYear ? "selected" : ""}>${y}</option>`).join("")}</select><button class="b" id="repCsv" type="button">Export CSV</button></div></div>
  <div class="grid g4" style="margin-bottom:14px">
    <div class="card kpi"><span>Cars sold ${repYear}</span><b>${tot.n}</b></div><div class="card kpi"><span>Sales ${repYear}</span><b>${money(tot.rev)}</b></div>
    <div class="card kpi"><span>Front gross ${repYear}</span><b>${money(tot.gross)}</b><small>on deals with costs entered</small></div><div class="card kpi"><span>Collected ${repYear}</span><b>${money(tot.coll)}</b><small>BHPH payments</small></div></div>
  <div class="card"><h3>By month</h3>${table([{ h: "Month", f: (r) => parseD(r.m + "-01").toLocaleDateString("en-US", { month: "long" }) },
    { h: "Sales", f: (r) => `<div style="display:flex;align-items:center;gap:8px"><i style="display:block;height:8px;border-radius:2px;background:var(--brand);width:${Math.round((r.rev / maxRev) * 120)}px"></i></div>` },
    { h: "Sold", r: 1, f: (r) => r.n }, { h: "Financed", r: 1, f: (r) => r.fin }, { h: "Revenue", r: 1, f: (r) => money(r.rev) }, { h: "Front gross", r: 1, f: (r) => (r.gN ? money(r.gross) : "—") },
    { h: "Avg gross", r: 1, f: (r) => (r.gN ? money(r.gross / r.gN) : "—") }, { h: "Avg days to sell", r: 1, f: (r) => r.dts ?? "—" }, { h: "Collected", r: 1, f: (r) => money(r.coll) }], mrows)}</div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>Inventory age (on the lot)</h3>${table([{ h: "Age", f: (b) => b[0] }, { h: "Cars", r: 1, f: (b) => b[1] }, { h: "Asking", r: 1, f: (b) => money(b[2]) }, { h: "Cost", r: 1, f: (b) => (b[3] ? money(b[3]) : "—") }], buckets)}</div>
    <div class="card"><h3>Lead sources</h3>${srcRows.length ? `<div class="bars">${srcRows.map(([k, [n, w]]) => `<div><span>${esc(k)}</span><i style="width:${Math.round((n / maxSrc) * 100)}%"></i><span>${n}${w ? ` · ${w} sold` : ""}</span></div>`).join("")}</div>` : '<p style="color:var(--muted)">No leads yet.</p>'}</div>
  </div>`;
  {
    const yr = String(repYear), ys = sold.filter((d) => (d.date || "").startsWith(yr));
    const rev = ys.reduce((s, d) => s + n0(d.price), 0), docs = ys.reduce((s, d) => s + n0(d.docFee), 0);
    const cogs = ys.reduce((s, d) => s + carCost(d.carId), 0);
    let interest = 0; bhphDeals().forEach((d) => { const a = account(d); const tot = a.pays.reduce((s, p) => s + n0(p.amount), 0) || 1; interest += a.interestPaid * (a.pays.filter((p) => (p.date || "").startsWith(yr)).reduce((s, p) => s + n0(p.amount), 0) / tot); });
    const exps = DB.expenses.filter((e) => (e.date || "").startsWith(yr)); const opex = exps.reduce((s, e) => s + n0(e.amount), 0);
    const byCat = {}; exps.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + n0(e.amount)));
    const net = rev + docs - cogs + interest - opex;
    V.insertAdjacentHTML("beforeend", `<div class="card" style="margin-top:14px"><h3>Profit & loss ${yr}</h3><dl class="dl" style="max-width:520px">
      <dt>Car sales</dt><dd>${money2(rev)}</dd><dt>Doc fees</dt><dd>${money2(docs)}</dd><dt>Cost of the cars sold (purchase + recon)</dt><dd>−${money2(cogs)}</dd>
      <dt class="tot">Gross profit</dt><dd class="tot">${money2(rev + docs - cogs)}</dd><dt>Interest collected (BHPH)</dt><dd>${money2(interest)}</dd>
      ${Object.entries(byCat).map(([k, x]) => `<dt>${esc(k)}</dt><dd>−${money2(x)}</dd>`).join("")}<dt>Business expenses</dt><dd>−${money2(opex)}</dd>
      <dt class="tot">Net profit</dt><dd class="tot" style="color:${net < 0 ? "var(--bad)" : "var(--ok)"}">${money2(net)}</dd></dl>
      <p style="color:var(--muted);font-size:13px;margin:10px 0 0">A guide for you and your accountant, not a tax return. Cars sold without costs entered count as $0 cost.</p></div>`);
  }
  $("#repY").onchange = (e) => { repYear = +e.target.value; reports(V); };
  $("#repCsv").onclick = () => csvDownload(`report-${repYear}.csv`, [["Month", "Sold", "Financed", "Revenue", "Front gross", "Avg days to sell", "Collected"], ...mrows.map((r) => [r.m, r.n, r.fin, r.rev, r.gN ? r.gross : "", r.dts ?? "", r.coll])]);
}

/* ================= marketing (listing feeds) ================= */
function marketing(V) {
  const st = S(); st.feeds = st.feeds || {};
  for (const k of Object.keys(FEEDS.PRESETS)) st.feeds[k] = st.feeds[k] || { dealerId: "", includeSold: false };
  st.feeds.custom = st.feeds.custom || clone(FEEDS.DEFAULT_CUSTOM);
  const C = st.feeds.custom, url = (k) => location.origin + "/feeds/" + k + ".csv";
  const iS = 'style="width:100%;min-width:0;border:1px solid var(--line);border-radius:4px;padding:6px;background:var(--panel)"';
  const opts = (s) => `<option value="fixed" ${s === "fixed" ? "selected" : ""}>✎ Fixed value (type it)</option>` + Object.entries(FEEDS.FIELDS).map(([k, [l]]) => `<option value="${k}" ${s === k ? "selected" : ""}>${esc(l)}</option>`).join("");
  let adCar = (SITE.cars.find((c) => c.status === "lot") || {}).id;
  const posted = (id) => costOf(id).posted || {};
  const draw = () => {
    const lotCars = SITE.cars.filter((c) => c.status === "lot");
    if (!car(adCar)) adCar = lotCars[0]?.id;
    const ad = adCar ? FEEDS.adText(car(adCar), st, location.origin) : null;
    V.innerHTML = `<div class="ph"><div><h1>Marketing</h1><p>Send your inventory to listing sites. The feed links update every time you save a car.</p></div><div class="act"><button class="b primary" id="mkSave" type="button">Save</button></div></div>
    <div class="banner">Each site gives you a dealer ID when you sign up as a dealer, and tells you the file format it wants and how it collects it (feed link, email or FTP). If a site asks for different columns, build them in the custom export below.</div>
    <div class="grid g4">${Object.entries(FEEDS.PRESETS).map(([k, p]) => `<div class="card" style="display:grid;gap:10px;align-content:start"><h3 style="margin:0">${esc(p.label)}</h3>${p.note ? `<small style="color:var(--muted)">${esc(p.note)}</small>` : ""}
      <div class="f"><label for="dl_${k}">Dealer ID</label><input id="dl_${k}" data-dealer="${k}" value="${esc(st.feeds[k].dealerId || "")}"></div>
      <label class="chk"><input type="checkbox" data-sold="${k}" ${st.feeds[k].includeSold ? "checked" : ""}> Include sold cars</label>
      <button class="b" type="button" data-dl="${k}">Download CSV</button>
      <div style="font:500 11px var(--mono);color:var(--muted);overflow-wrap:anywhere">${esc(url(k))}</div><button class="b sm" type="button" data-copy="${k}">Copy feed link</button></div>`).join("")}</div>
    <div class="card" style="margin-top:14px"><h3>Custom export</h3>
      <div class="fg"><div class="f"><label for="cx_t">Export name</label><input id="cx_t" value="${esc(C.title || "")}"></div>
        ${sel("cx_d", "Separator", C.delimiter, [[",", "Comma ,"], [";", "Semicolon ;"], ["tab", "Tab"], ["|", "Pipe |"]])}
        <label class="chk" style="align-self:end;padding-bottom:10px"><input type="checkbox" id="cx_l" ${C.onlyLot !== false ? "checked" : ""}> Only cars on the lot</label></div>
      <div class="tw" style="margin-top:12px"><table class="t"><thead><tr><th>Column name</th><th>What goes in it</th><th>Fixed value</th><th></th></tr></thead><tbody>
      ${C.cols.map((c, i) => `<tr data-ci="${i}"><td><input data-c="h" value="${esc(c.h)}" ${iS}></td><td><select data-c="src" ${iS}>${opts(c.src)}</select></td>
        <td><input data-c="val" value="${esc(c.val || "")}" ${c.src === "fixed" ? "" : "disabled"} ${iS}></td>
        <td style="white-space:nowrap"><button class="b sm" type="button" data-mv="-1" ${i ? "" : "disabled"}>↑</button> <button class="b sm" type="button" data-mv="1" ${i < C.cols.length - 1 ? "" : "disabled"}>↓</button> <button class="b sm" type="button" data-rm>✕</button></td></tr>`).join("")}
      </tbody></table></div>
      <div class="formft" style="justify-content:flex-start"><button class="b" type="button" id="cxAdd">+ Add column</button><button class="b" type="button" data-dl="custom">Download CSV</button><button class="b sm" type="button" data-copy="custom">Copy feed link</button></div></div>
    <h2 class="sec">Which cars go where</h2>
    <div class="banner">Untick a car to keep it off a site. Only Public and Sale pending cars can be exported. Click Save at the top when you're done.</div>
    ${(() => { const cars = SITE.cars.filter((c) => c.status === "lot" || c.status === "pending"), fk = [...Object.keys(FEEDS.PRESETS), "custom"];
      const lab = (k) => (k === "custom" ? "Custom" : FEEDS.PRESETS[k].label);
      return cars.length ? `<div class="tw"><table class="t" style="font-size:13px"><thead><tr><th>Car</th><th title="Include in all exports">All</th>${fk.map((k) => `<th style="text-align:center;white-space:normal;min-width:64px">${esc(lab(k))}<br><button class="b sm" type="button" data-colall="${k}" style="padding:2px 6px;margin-top:4px">all / none</button></th>`).join("")}</tr></thead><tbody>
        ${cars.map((c) => `<tr><td><b>${esc(carTitle(c))}</b><span class="sub">${money(c.price)}${c.status === "pending" ? " · sale pending" : ""}</span></td><td><input type="checkbox" data-carall="${esc(c.id)}" ${c.noExport ? "" : "checked"} aria-label="Export this car"></td>
          ${fk.map((k) => `<td style="text-align:center"><input type="checkbox" data-cf="${esc(c.id)}|${k}" ${!c.noExport && !(c.feedsOff || []).includes(k) ? "checked" : ""} ${c.noExport ? "disabled" : ""} aria-label="${esc(lab(k))}"></td>`).join("")}</tr>`).join("")}</tbody></table></div>` : '<p class="empty">No public cars.</p>'; })()}
    <h2 class="sec">Send by FTP</h2>
    <div class="banner">Most listing sites give you FTP details (server, user, password) when you sign up. Enter them once per site, then click Send now, or tick “Send automatically every day”. Save the page above first so the dealer IDs are up to date.</div>
    <div id="ftpBox"></div>
    <h2 class="sec" id="classifieds">Classifieds: Craigslist, Facebook Marketplace, OfferUp, KSL</h2>
    <div class="banner">These sites don't take dealer files, so you post each car yourself. Pick a car: the ad below is written for you. Copy it, download the photo, open the site, paste, and mark it as posted so you know when to repost.</div>
    <div class="split"><div class="card"><div class="fg">${sel("adCar", "Car", adCar, lotCars.map((c) => [c.id, `${carTitle(c)} · ${money(c.price)}`]), "w2")}
        <div class="f"><label for="clCity">Craigslist area</label><input id="clCity" value="${esc(st.craigslistCity || "twinfalls")}" placeholder="twinfalls, boise…"></div></div>
      ${ad ? `<div class="f" style="margin-top:12px"><label for="adTitle">Title</label><input id="adTitle" value="${esc(ad.title)}"></div>
      <div class="f" style="margin-top:12px"><label for="adText">Ad text</label><textarea id="adText" class="adtext">${esc(ad.text)}</textarea></div>
      <div class="formft" style="justify-content:flex-start"><button class="b" type="button" data-cp="adTitle">Copy title</button><button class="b" type="button" data-cpv="${ad.price}">Copy price</button><button class="b primary" type="button" data-cp="adText">Copy ad text</button><button class="b" type="button" id="adPhoto">Download photo</button></div>` : '<p class="empty">No cars on the lot.</p>'}</div>
      <div class="card"><h3>Post it</h3>${FEEDS.CLASSIFIEDS.map(([k, l, u, how]) => `<div style="border-bottom:1px solid var(--line);padding:10px 0"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><b>${esc(l)}</b>
        <span style="display:flex;gap:6px"><a class="b sm" href="${esc(u(st))}" target="_blank" rel="noopener">Open ↗</a>${ad ? `<button class="b sm" type="button" data-posted="${k}">Mark posted</button>` : ""}</span></div>
        <small style="color:var(--muted)">${esc(how)}${ad && posted(adCar)[k] ? ` · <b style="color:var(--ok)">Posted ${fdate(posted(adCar)[k])}</b>` : ""}</small></div>`).join("")}</div></div>
    <div class="card" style="margin-top:14px"><h3>What's posted where</h3>${table([{ h: "Car", f: (c) => `<b>${esc(carTitle(c))}</b><span class="sub">${money(c.price)}</span>` },
      ...FEEDS.CLASSIFIEDS.map(([k, l]) => ({ h: l, f: (c) => { const d = posted(c.id)[k]; if (!d) return '<span style="color:var(--dim)">—</span>'; const age = days(d); return `<span style="color:${age > 30 ? "var(--warn)" : "var(--ok)"}">${fdate(d)}${age > 30 ? " · repost" : ""}</span>`; } }))], lotCars)}</div>`;
    const J = (m, b) => ({ method: m, headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    ftpPanel($("#ftpBox"), { get: () => api("/api/ftp"), put: (c) => api("/api/ftp", J("PUT", c)), send: (feed) => api("/api/ftp", J("POST", { feed })) }, toast);
    $("#adCar")?.addEventListener("change", (e) => { adCar = e.target.value; draw(); document.getElementById("classifieds").scrollIntoView(); });
    $("#clCity").oninput = (e) => (st.craigslistCity = e.target.value.trim());
    $$("[data-cp]").forEach((b) => (b.onclick = () => navigator.clipboard?.writeText($("#" + b.dataset.cp).value).then(() => toast("Copied"))));
    $$("[data-cpv]").forEach((b) => (b.onclick = () => navigator.clipboard?.writeText(b.dataset.cpv).then(() => toast("Copied"))));
    if ($("#adPhoto")) $("#adPhoto").onclick = async () => { const k = car(adCar); const a = document.createElement("a"); a.href = URL.createObjectURL(await (await fetch(k.img)).blob()); a.download = `${carTitle(k).replace(/\W+/g, "-")}.webp`; a.click(); };
    $$("[data-posted]").forEach((b) => (b.onclick = async () => { const k = clone(costOf(adCar)); k.expenses = k.expenses || []; k.posted = { ...(k.posted || {}), [b.dataset.posted]: todayISO() };
      try { await saveRec("costs", k); toast("Marked as posted"); draw(); document.getElementById("classifieds").scrollIntoView(); } catch (x) { toast(errMsg(x), 1); } }));
    $$("[data-dealer]").forEach((i) => (i.oninput = () => (st.feeds[i.dataset.dealer].dealerId = i.value.trim())));
    $$("[data-sold]").forEach((i) => (i.onchange = () => (st.feeds[i.dataset.sold].includeSold = i.checked)));
    $$("[data-dl]").forEach((b) => (b.onclick = () => { const r = FEEDS.buildFeed(SITE, b.dataset.dl, location.origin); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([r.csv], { type: "text/csv" })); a.download = r.filename; a.click(); }));
    $$("[data-copy]").forEach((b) => (b.onclick = () => navigator.clipboard?.writeText(url(b.dataset.copy)).then(() => toast("Link copied. Save first so it has your latest changes."))));
    $("#cx_t").oninput = (e) => (C.title = e.target.value); $("#cx_d").onchange = (e) => (C.delimiter = e.target.value); $("#cx_l").onchange = (e) => (C.onlyLot = e.target.checked);
    $("#cxAdd").onclick = () => { C.cols.push({ h: "New column", src: "fixed", val: "" }); draw(); };
    $$("tr[data-ci]").forEach((tr) => { const i = +tr.dataset.ci, c = C.cols[i];
      $("[data-c=h]", tr).oninput = (e) => (c.h = e.target.value); $("[data-c=val]", tr).oninput = (e) => (c.val = e.target.value);
      $("[data-c=src]", tr).onchange = (e) => { c.src = e.target.value; if (c.h === "New column" && FEEDS.FIELDS[c.src]) c.h = FEEDS.FIELDS[c.src][0]; draw(); };
      $$("[data-mv]", tr).forEach((b) => (b.onclick = () => { const j = i + +b.dataset.mv; [C.cols[i], C.cols[j]] = [C.cols[j], C.cols[i]]; draw(); }));
      $("[data-rm]", tr).onclick = () => { C.cols.splice(i, 1); draw(); }; });
    $$("[data-cf]").forEach((cb) => (cb.onchange = () => { const [id, k] = cb.dataset.cf.split("|"), c = car(id); c.feedsOff = (c.feedsOff || []).filter((x) => x !== k); if (!cb.checked) c.feedsOff.push(k); toast("Click Save to keep this change."); }));
    $$("[data-carall]").forEach((cb) => (cb.onchange = () => { car(cb.dataset.carall).noExport = !cb.checked; draw(); toast("Click Save to keep this change."); }));
    $$("[data-colall]").forEach((b) => (b.onclick = () => { const k = b.dataset.colall, cs = SITE.cars.filter((c) => (c.status === "lot" || c.status === "pending") && !c.noExport);
      const allOn = cs.every((c) => !(c.feedsOff || []).includes(k)); cs.forEach((c) => { c.feedsOff = (c.feedsOff || []).filter((x) => x !== k); if (allOn) c.feedsOff.push(k); }); draw(); toast("Click Save to keep this change."); }));
    $("#mkSave").onclick = async () => { try { await saveSite(); toast("Saved. Feed links are up to date."); } catch (x) { toast(errMsg(x), 1); } };
  };
  draw();
}

/* ================= websites & templates ================= */
let siteEdit = null, dealerNew = null, domEdit = null;
const DEALER_TPL = Object.keys(TEMPLATES).filter((k) => !TEMPLATES[k].original);
const netlifyHost = () => S().netlifyHost || "aands-auto.netlify.app";
function websites(V) {
  const st = S(); st.websites = st.websites || [];
  const main = st.mainTemplate || "night";
  const slugify = (t) => String(t || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const tplCard = (id, t, cur) => `<div class="card tpl ${cur ? "on" : ""}" data-tcard="${id}">${thumb("/?template=" + id, "Preview " + t.name)}
    <b>${esc(t.name)}</b><small style="color:var(--muted)">${esc(t.desc)}</small>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="b sm" type="button" data-big="${id}">🔍 Big preview</button>${cur ? pill("In use", "ok") : `<button class="b sm primary" type="button" data-use="${id}">Use this</button>`}</div></div>`;
  const W = siteEdit;
  V.innerHTML = `<div class="ph"><div><h1>Websites</h1><p>Choose the look of ${esc(location.host)}, or create more websites from the same inventory.</p></div></div>
  <h2 class="sec">Main website · ${esc(location.host)}</h2>
  <div class="grid g3">${Object.entries(TEMPLATES).map(([id, t]) => tplCard(id, t, id === main)).join("")}</div>
  <h2 class="sec">More websites</h2>
  <div class="banner">Make a second website, for example only trucks, only cars under $10,000, or a different brand name. Each one gets its own link right away. To give it its own domain, buy the domain, add it in Netlify (Domain management → Add domain alias) and type it below.</div>
  <div class="grid g3">${st.websites.filter((w) => !w.tenant).map((w) => `<div class="card tpl"><div class="sw">${(TEMPLATES[w.template] || TEMPLATES.classic).swatch.map((c, i) => `<i style="background:${i === 1 && w.accent ? esc(w.accent) : c}"></i>`).join("")}</div>
      <b>${esc(w.name)}</b><small style="color:var(--muted)">${esc((TEMPLATES[w.template] || TEMPLATES.classic).name)}${w.filter?.body ? " · only " + esc(w.filter.body) : ""}${w.filter?.maxPrice ? " · under " + money(w.filter.maxPrice) : ""}</small>
      <small style="font-family:var(--mono);overflow-wrap:anywhere">${esc(location.origin)}/w/${esc(w.slug)}${w.domain ? "<br>" + esc(w.domain) : ""}</small>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><a class="b sm" href="/w/${esc(w.slug)}" target="_blank" rel="noopener">Open ↗</a><button class="b sm" type="button" data-edit="${esc(w.id)}">Edit</button><button class="b sm danger" type="button" data-delw="${esc(w.id)}">Delete</button></div></div>`).join("")}
    <button class="card" type="button" id="newSite" style="cursor:pointer;display:grid;place-items:center;min-height:180px;font-weight:700;border-style:dashed">+ Create a website</button></div>
  ${W ? `<div class="card" id="wForm" style="margin-top:14px"><h3>${W.isNew ? "New website" : "Edit " + esc(W.name)}</h3><div class="fg">
      ${fld("w_name", "Website name", W.name, "text", "wide")}${fld("w_slug", "Link name", W.slug)}
      ${sel("w_tpl", "Template", W.template, Object.entries(TEMPLATES).filter(([, t]) => !t.original).map(([k, t]) => [k, t.name]))}
      <div class="f"><label for="w_acc">Main colour</label><input id="w_acc" type="color" value="${esc(W.accent || (TEMPLATES[W.template] || TEMPLATES.classic).vars.accent)}" style="height:40px;padding:2px"></div>
      ${fld("w_head", "Headline", W.heroTitle, "text", 'wide placeholder="Find your next truck"')}${area("w_tag", "Short intro under the headline", W.tagline)}${area("w_about", "About us text", W.about)}
      ${sel("w_body", "Which cars", W.filter?.body || "", [["", "All body types"], ...BODY_TYPES.map((b) => [b, "Only " + b])])}${fld("w_min", "Min price", W.filter?.minPrice, "number")}${fld("w_max", "Max price", W.filter?.maxPrice, "number")}
      ${fld("w_dom", "Own domain (optional)", W.domain, "text", 'wide placeholder="cheaptrucksburley.com"')}</div>
      <label class="chk" style="margin-top:10px"><input type="checkbox" id="w_sold" ${W.showSold ? "checked" : ""}> Also show sold cars</label>
      <div class="formft"><button class="b" type="button" id="wCancel">Cancel</button><button class="b primary" type="button" id="wSave">Save website</button></div></div>` : ""}
  <h2 class="sec">Dealer websites · own cars, own login</h2>
  <div class="card" style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><b>Template gallery for dealers</b><br><small style="color:var(--muted)">A public page with all 10 designs. Send it to a dealer so they can pick one.</small><br><code style="font-size:13px">${esc(location.origin)}/templates</code></div>
    <div style="display:flex;gap:6px"><a class="b" href="/templates" target="_blank" rel="noopener">Open ↗</a><button class="b primary" type="button" id="galCopy">Copy link</button></div></div>
  <div class="banner">A complete website for another dealer: their name, logo, phone and cars, and their own simple admin page (add cars, AI photo studio, messages, exports and FTP). You can open every dealer's admin with your own password too.</div>
  <div class="grid g2">${st.websites.filter((w) => w.tenant).map((w) => `<div class="card" style="display:grid;gap:8px">
      <div style="display:flex;justify-content:space-between;gap:8px"><b style="font-size:18px">${esc(w.name)}</b>${pill((TEMPLATES[w.template] || TEMPLATES.classic).name, "info")}</div>
      <small style="font-family:var(--mono);overflow-wrap:anywhere">Website: ${esc(location.origin)}/w/${esc(w.slug)}<br>Admin: ${esc(location.origin)}/w/${esc(w.slug)}/admin${w.domain ? "<br>Domain: " + esc(w.domain) : ""}</small>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><a class="b sm" href="/w/${esc(w.slug)}" target="_blank" rel="noopener">Open website ↗</a><a class="b sm primary" href="/w/${esc(w.slug)}/admin" target="_blank" rel="noopener">Open admin ↗</a>
        <button class="b sm" type="button" data-dom="${esc(w.id)}">Domain</button><button class="b sm" type="button" data-tpw="${esc(w.slug)}">New password</button><button class="b sm danger" type="button" data-tdel="${esc(w.id)}">Delete</button></div>
      ${domEdit === w.id ? `<div style="border-top:1px solid var(--line);padding-top:10px"><div class="fg">${fld("d_dom", "Domain", w.domain, "text", 'wide placeholder="joesautos.com"')}</div>
        ${w.domain ? `<ol style="font-size:14px;line-height:1.6;padding-left:18px;margin:10px 0">
          <li>In <b>Netlify</b>: your project → <b>Domain management</b> → <b>Add a domain alias</b> → type <b>${esc(w.domain)}</b> (and <b>www.${esc(w.domain)}</b>).</li>
          <li>Where the dealer bought the domain (GoDaddy etc.) → <b>DNS</b>: record <b>A</b>, name <b>@</b>, value <b>75.2.60.5</b>.</li>
          <li>Same place: record <b>CNAME</b>, name <b>www</b>, value <b>${esc(netlifyHost())}</b>.</li>
          <li>Wait 15 minutes to a few hours. Netlify adds the padlock (HTTPS) by itself.</li></ol>
          <div class="formft" style="justify-content:flex-start"><button class="b sm" type="button" id="dnsCopy">Copy these steps</button></div>` : ""}
        <div class="formft"><button class="b" type="button" id="domCancel">Close</button><button class="b primary" type="button" id="domSave">Save domain</button></div></div>` : ""}</div>`).join("")}
    <button class="card" type="button" id="newDealer" style="cursor:pointer;display:grid;place-items:center;min-height:160px;font-weight:700;border-style:dashed">+ Create a dealer website</button></div>
  ${dealerNew ? `<div class="card" id="dForm" style="margin-top:14px"><h3>New dealer website</h3><div class="fg">
      ${fld("n_name", "Dealer name", dealerNew.name, "text", "wide")}${fld("n_slug", "Link name", dealerNew.slug)}<input type="hidden" id="n_tpl" value="${esc(dealerNew.template)}">
      ${fld("n_phone", "Phone", dealerNew.phone, "tel")}${fld("n_email", "Email", dealerNew.email, "email")}${fld("n_street", "Street", dealerNew.street, "text", "wide")}${fld("n_city", "City", dealerNew.city)}${fld("n_state", "State", dealerNew.state)}${fld("n_zip", "ZIP", dealerNew.zip)}
      ${fld("n_dom", "Domain (optional, can be added later)", dealerNew.domain, "text", 'wide placeholder="joesautos.com"')}${fld("n_pw", "Admin password for the dealer (8+ characters)", "", "text")}
      <div class="f w2"><label>Logo</label><div class="photo" id="n_lg" style="aspect-ratio:3/1">${dealerNew.logo ? `<img src="${esc(dealerNew.logo)}" alt="" style="object-fit:contain">` : "No logo"}</div><input type="file" accept="image/*" id="n_lgf" style="font-size:13px;margin-top:6px"></div></div>
      <h2 class="sec">Choose the design</h2>
      <div class="grid g3" id="nPick">${DEALER_TPL.map((k) => `<div class="card tpl ${k === dealerNew.template ? "on" : ""}" data-pk="${k}">${thumb(demoUrl(k), "Preview " + TEMPLATES[k].name)}<b>${esc(TEMPLATES[k].name)}</b><small style="color:var(--muted)">${esc(TEMPLATES[k].desc)}</small>
        <button class="b sm ${k === dealerNew.template ? "" : "primary"}" type="button" data-choose="${k}">${k === dealerNew.template ? "✓ Chosen" : "Choose"}</button></div>`).join("")}</div>
      <div class="formft"><button class="b" type="button" id="nCancel">Cancel</button><button class="b primary" type="button" id="nSave">Create website</button></div></div>` : ""}`;
  $("#galCopy").onclick = () => navigator.clipboard?.writeText(location.origin + "/templates").then(() => toast("Link copied"));
  // ----- dealer websites -----
  $("#newDealer").onclick = () => { dealerNew = { name: "", slug: "", template: "classic", state: st.state || "" }; websites(V); $("#dForm").scrollIntoView(); $("#n_name").focus(); };
  if (dealerNew) {
    $("#n_name").oninput = () => { if (!dealerNew.slugTouched) $("#n_slug").value = slugify(v("n_name")); };
    $("#n_slug").oninput = () => (dealerNew.slugTouched = true);
    $("#n_lgf").onchange = async (e) => { const fl = e.target.files[0]; if (!fl) return; $("#n_lg").textContent = "Uploading…"; try { dealerNew.logo = await upload(fl, 600); $("#n_lg").innerHTML = `<img src="${esc(dealerNew.logo)}" alt="" style="object-fit:contain">`; } catch (_) { $("#n_lg").textContent = "Upload failed"; } };
    $("#nCancel").onclick = () => { dealerNew = null; websites(V); };
    const choose = (k) => { dealerNew.template = k; $("#n_tpl").value = k; $$("[data-pk]").forEach((c) => c.classList.toggle("on", c.dataset.pk === k));
      $$("[data-choose]").forEach((b) => { b.textContent = b.dataset.choose === k ? "✓ Chosen" : "Choose"; b.classList.toggle("primary", b.dataset.choose !== k); }); };
    $$("[data-choose]").forEach((b) => (b.onclick = () => choose(b.dataset.choose)));
    const bigD = (k) => { const i = DEALER_TPL.indexOf(k); openPreview(demoUrl(k), TEMPLATES[k].name + " · example", { onUse: () => choose(k), useLabel: "Choose this design",
      prev: () => bigD(DEALER_TPL[(i - 1 + DEALER_TPL.length) % DEALER_TPL.length]), next: () => bigD(DEALER_TPL[(i + 1) % DEALER_TPL.length]) }); };
    bindThumbs($("#nPick"), (url) => bigD(new URLSearchParams(url.split("?")[1]).get("template")));
    $("#nSave").onclick = async () => {
      const slug = slugify(v("n_slug") || v("n_name")), pw = v("n_pw"), dom = v("n_dom").replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").toLowerCase();
      if (!v("n_name")) return toast("Add the dealer name.", 1);
      if (!slug) return toast("Add a link name.", 1);
      if (st.websites.some((w) => w.slug === slug)) return toast("That link name is already used.", 1);
      if (pw.length < 8) return toast("The dealer password needs at least 8 characters.", 1);
      const settings = { name: v("n_name"), phone: v("n_phone"), email: v("n_email"), street: v("n_street"), city: v("n_city"), state: v("n_state"), zip: v("n_zip"), logo: dealerNew.logo || "", template: v("n_tpl"),
        hours: [["Monday – Friday", "9:00 AM – 6:00 PM"], ["Saturday", "10:00 AM – 4:00 PM"], ["Sunday", "Closed"]], apr: 12.9, feeds: {} };
      const J = (m, b) => ({ method: m, headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
      $("#nSave").disabled = true;
      try {
        await api(`/api/t/${slug}/data`, J("PUT", { settings, cars: [] }));
        await api(`/api/t/${slug}/password`, J("POST", { newPassword: pw }));
        st.websites.push({ id: uid("W"), slug, name: settings.name, template: settings.template, domain: dom, tenant: true });
        await saveSite();
        dealerNew = null; toast("Dealer website created"); websites(V);
        alert(`Done! Send these to the dealer:\n\nWebsite: ${location.origin}/w/${slug}\nAdmin: ${location.origin}/w/${slug}/admin\nPassword: ${pw}${dom ? "\n\nDomain " + dom + ": click “Domain” on the card for the DNS steps." : ""}`);
      } catch (x) { $("#nSave").disabled = false; toast(errMsg(x), 1); }
    };
  }
  $$("[data-dom]").forEach((b) => (b.onclick = () => { domEdit = domEdit === b.dataset.dom ? null : b.dataset.dom; websites(V); }));
  if ($("#domCancel")) $("#domCancel").onclick = () => { domEdit = null; websites(V); };
  if ($("#domSave")) $("#domSave").onclick = async () => { const w = st.websites.find((x) => x.id === domEdit), prev = w.domain;
    w.domain = v("d_dom").replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").toLowerCase();
    try { await saveSite(); toast("Domain saved"); websites(V); } catch (x) { w.domain = prev; toast(errMsg(x), 1); } };
  if ($("#dnsCopy")) $("#dnsCopy").onclick = () => { const w = st.websites.find((x) => x.id === domEdit);
    navigator.clipboard?.writeText(`Domain setup for ${w.domain}\n\n1. Netlify: Domain management → Add a domain alias → ${w.domain} and www.${w.domain}\n2. DNS at the domain company: A record, name @, value 75.2.60.5\n3. DNS: CNAME record, name www, value ${netlifyHost()}\n4. Wait 15 minutes to a few hours. HTTPS is added automatically.`).then(() => toast("Copied")); };
  $$("[data-tpw]").forEach((b) => (b.onclick = async () => { const pw = prompt("New password for this dealer (8+ characters):"); if (!pw) return; if (pw.length < 8) return toast("At least 8 characters.", 1);
    try { await api(`/api/t/${b.dataset.tpw}/password`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ newPassword: pw }) }); toast("Password changed"); } catch (x) { toast(errMsg(x), 1); } }));
  $$("[data-tdel]").forEach((b) => (b.onclick = async () => { const w = st.websites.find((x) => x.id === b.dataset.tdel);
    if (prompt(`This deletes ${w.name}'s website, cars and messages for good. Type DELETE to confirm.`) !== "DELETE") return;
    try { await api(`/api/t/${w.slug}/data`, { method: "DELETE" }); st.websites = st.websites.filter((x) => x.id !== w.id); await saveSite(); toast("Dealer website deleted"); websites(V); } catch (x) { toast(errMsg(x), 1); } }));
  const useMain = async (id) => { const prev = st.mainTemplate; st.mainTemplate = id;
    try { await saveSite(); toast(`Done. ${location.host} now uses ${TEMPLATES[id].name}.`); websites(V); } catch (x) { st.mainTemplate = prev; toast(errMsg(x), 1); } };
  $$("[data-use]").forEach((b) => (b.onclick = () => useMain(b.dataset.use)));
  const ids = Object.keys(TEMPLATES);
  const big = (id) => { const i = ids.indexOf(id);
    openPreview("/?template=" + id, TEMPLATES[id].name + " · " + TEMPLATES[id].desc, { onUse: id === main ? null : () => useMain(id), useLabel: "Use for " + location.host,
      prev: () => big(ids[(i - 1 + ids.length) % ids.length]), next: () => big(ids[(i + 1) % ids.length]) }); };
  $$("[data-big]").forEach((b) => (b.onclick = () => big(b.dataset.big)));
  bindThumbs(V, (url) => big(new URLSearchParams(url.split("?")[1]).get("template")));
  $("#newSite").onclick = () => { siteEdit = { isNew: true, id: uid("W"), name: "", slug: "", template: "classic", filter: {} }; websites(V); $("#wForm").scrollIntoView(); $("#w_name").focus(); };
  $$("[data-edit]").forEach((b) => (b.onclick = () => { siteEdit = clone(st.websites.find((w) => w.id === b.dataset.edit)); websites(V); $("#wForm").scrollIntoView(); }));
  $$("[data-delw]").forEach((b) => (b.onclick = async () => { if (!confirm("Delete this website? Its link stops working.")) return; const prev = st.websites; st.websites = st.websites.filter((w) => w.id !== b.dataset.delw);
    try { await saveSite(); toast("Website deleted"); websites(V); } catch (x) { st.websites = prev; toast(errMsg(x), 1); } }));
  if (W) {
    $("#w_name").oninput = () => { if (W.isNew && !W.slugTouched) $("#w_slug").value = slugify(v("w_name")); };
    $("#w_slug").oninput = () => (W.slugTouched = true);
    $("#w_acc").oninput = () => (W.accentTouched = true);
    $("#wCancel").onclick = () => { siteEdit = null; websites(V); };
    $("#wSave").onclick = async () => {
      const w = { id: W.id, name: v("w_name"), slug: slugify(v("w_slug") || v("w_name")), template: v("w_tpl"), accent: W.accentTouched ? v("w_acc") : W.accent || "", heroTitle: v("w_head"), tagline: v("w_tag"), about: v("w_about"),
        filter: { body: v("w_body"), minPrice: vn("w_min"), maxPrice: vn("w_max") }, domain: v("w_dom").replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase(), showSold: $("#w_sold").checked };
      if (!w.name) return toast("Give the website a name.", 1);
      if (!w.slug) return toast("Add a link name.", 1);
      if (st.websites.some((x) => x.slug === w.slug && x.id !== w.id)) return toast("Another website already uses that link name.", 1);
      const prev = clone(st.websites); const i = st.websites.findIndex((x) => x.id === w.id); if (i >= 0) st.websites[i] = w; else st.websites.push(w);
      try { await saveSite(); siteEdit = null; toast("Website saved"); websites(V); } catch (x) { st.websites = prev; toast(errMsg(x), 1); }
    };
  }
}

/* ================= settings ================= */
function settings(V) {
  const st = S();
  V.innerHTML = `<div class="ph"><div><h1>Settings</h1><p>Business details shown on the website and printed on your paperwork.</p></div><div class="act"><button class="b primary" id="setSave" type="button">Save</button></div></div>
  <div class="grid g2">
    <div class="card"><h3>Business</h3><div class="fg">${fld("s_name", "Business name", st.name, "text", "wide")}${fld("s_phone", "Phone", st.phone)}${fld("s_email", "Email", st.email)}
      ${fld("s_street", "Street", st.street, "text", "wide")}${fld("s_city", "City", st.city)}${fld("s_state", "State", st.state)}${fld("s_zip", "ZIP", st.zip)}${fld("s_lic", "Dealer licence #", st.license)}</div></div>
    <div class="card"><h3>Opening hours</h3><div class="fg">${st.hours.map((h, i) => fld("s_h" + i, h[0], h[1])).join("")}</div></div>
    <div class="card"><h3>Deal defaults</h3><div class="fg">${fld("s_tax", "Sales tax %", st.taxRate, "number")}${fld("s_doc", "Doc fee", st.docFee, "number")}${fld("s_title", "Title & registration", st.titleFee, "number")}${fld("s_apr", "Default APR % (BHPH)", st.apr, "number")}
      ${area("s_sp", "Salespeople (one per line)", (st.salespeople || []).join("\n"))}</div></div>
    <div class="card"><h3>Admin password</h3><p style="color:var(--muted);margin:0 0 12px;font-size:14px">The password set in Netlify (ADMIN_PASSWORD) always keeps working as a backup key.</p>
      <div class="fg">${fld("pw1", "New password (8+ characters)", "", "password")}${fld("pw2", "Repeat new password", "", "password")}</div><div class="formft"><button class="b" type="button" id="pwGo">Change password</button></div>
      <h2 class="sec">Website</h2><label class="chk"><input type="checkbox" id="s_insp" ${st.showInspections !== false ? "checked" : ""}> Show inspection reports on the website</label>
      <h2 class="sec">Appearance</h2>${seg("theme", [["", "Automatic"], ["light", "Light"], ["dark", "Dark"]], document.documentElement.dataset.theme || "")}</div>
  </div>`;
  $("#setSave").onclick = async () => {
    Object.assign(st, { name: v("s_name"), phone: v("s_phone"), email: v("s_email"), street: v("s_street"), city: v("s_city"), state: v("s_state"), zip: v("s_zip"), license: v("s_lic"),
      taxRate: vn("s_tax") ?? 0, docFee: vn("s_doc") ?? 0, titleFee: vn("s_title") ?? 0, apr: vn("s_apr") ?? 0, salespeople: v("s_sp").split("\n").map((s) => s.trim()).filter(Boolean), showInspections: $("#s_insp").checked });
    st.hours.forEach((h, i) => (h[1] = v("s_h" + i)));
    try { await saveSite(); toast("Saved. The website is updated."); } catch (x) { toast(errMsg(x), 1); }
  };
  $("#pwGo").onclick = async () => {
    const a = $("#pw1").value, b = $("#pw2").value;
    if (a.length < 8) return toast("Use at least 8 characters.", 1); if (a !== b) return toast("The two passwords are different.", 1);
    try { await api("/api/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ newPassword: a }) }); PW = a; try { sessionStorage.setItem("admPw", a); } catch (_) {} $("#pw1").value = $("#pw2").value = ""; toast("Password changed"); }
    catch (x) { toast("Could not change the password (" + (x.code || "error") + ")", 1); }
  };
  $$("#theme button").forEach((b) => (b.onclick = () => { const t = b.dataset.k; if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; try { localStorage.setItem("dmsTheme", t); } catch (_) {} settings(V); }));
}

/* ================= shared: dates, templates, documents ================= */
const addDays = (d, n) => { const x = parseD(d); x.setDate(x.getDate() + n); return iso(x); };
function fillTpl(text, x) {
  const st = S(), k = x.car;
  const first = String(x.name || "").split(" ")[0];
  return String(text || "").replace(/\{(\w+)\}/g, (m, t) => ({ first_name: first, name: x.name || "", car: k ? carTitle(k) : "the car", price: k ? money(k.price) : "", link: k ? `${location.origin}/#car-${k.id}` : location.origin,
    dealer: st.name, phone: st.phone || "", address: [st.street, st.city, st.state].filter(Boolean).join(", "), apply: location.origin + "/apply" }[t] ?? m));
}
function useTemplate(t, x) {
  const body = fillTpl(t.body, x);
  if (t.channel === "sms") { if (!x.phone) return toast("This contact has no phone number.", 1); location.href = `sms:${String(x.phone).replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(body)}`; }
  else { if (!x.email) return toast("This contact has no email.", 1); location.href = `mailto:${x.email}?subject=${encodeURIComponent(fillTpl(t.subject, x))}&body=${encodeURIComponent(body)}`; }
  navigator.clipboard?.writeText(body).catch(() => {});
}
// documents (images / PDF) attached to a deal or a customer: rec.docs = [{ name, url, at }]
function docsBox(el, rec, col) {
  rec.docs = rec.docs || [];
  const draw = () => {
    el.innerHTML = `${rec.docs.length ? `<div class="tw"><table class="t"><tbody>${rec.docs.map((d, i) => `<tr><td>${/\.pdf$/i.test(d.url) ? "📄" : "🖼"} <a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.name)}</a></td><td style="color:var(--muted);font-size:13px">${fdt(d.at)}</td><td class="r"><button class="b sm" type="button" data-rmdoc="${i}">✕</button></td></tr>`).join("")}</tbody></table></div>` : '<p style="color:var(--muted);margin:0 0 8px">No documents yet.</p>'}
      <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap"><input type="file" accept="image/*,application/pdf" multiple data-docs style="font-size:13px"><span style="color:var(--muted);font-size:13px">Photos of the licence, insurance card, signed papers, pay stubs. PDF or photo.</span></div>`;
    $("[data-docs]", el).onchange = async (e) => {
      for (const fl of e.target.files) {
        try {
          const isPdf = fl.type === "application/pdf";
          const body = isPdf ? fl : await shrink(fl, 2000);
          const r = await api("/api/upload", { method: "POST", headers: { "content-type": isPdf ? "application/pdf" : "image/webp" }, body });
          rec.docs.push({ name: fl.name, url: r.url, at: new Date().toISOString() });
        } catch (x) { toast("Could not upload " + fl.name, 1); }
      }
      try { Object.assign(rec, await saveRec(col, rec)); toast("Documents saved"); } catch (x) { toast(errMsg(x), 1); }
      draw();
    };
    $$("[data-rmdoc]", el).forEach((b) => (b.onclick = async () => { if (!confirm("Remove this document?")) return; rec.docs.splice(+b.dataset.rmdoc, 1); try { await saveRec(col, rec); } catch (x) { toast(errMsg(x), 1); } draw(); }));
  };
  draw();
}

/* ================= recon / service bay ================= */
const RECON = [["arrived", "Arrived"], ["mechanical", "Mechanic"], ["body", "Body & paint"], ["detail", "Detail"], ["photos", "Photos"], ["ready", "Front line"]];
const reconOf = (id) => DB.recon.find((r) => r.id === id);
function reconBoard(V) {
  const active = DB.recon.filter((r) => car(r.id) && r.stage !== "done");
  const candidates = SITE.cars.filter((c) => c.status !== "sold" && !reconOf(c.id));
  V.innerHTML = `<div class="ph"><div><h1>Recon</h1><p>Get cars from the auction to the front line: mechanic, body, detail, photos.</p></div>
    <div class="act">${sel("rcAdd", "", "", [["", "+ Put a car into recon…"], ...candidates.map((c) => [c.id, carTitle(c) + (c.stock ? " · #" + c.stock : "")])])}</div></div>
  <div class="pipeline" style="grid-template-columns:repeat(6,minmax(190px,1fr))">${RECON.map(([k, l]) => { const xs = active.filter((r) => r.stage === k); return `<div class="col"><h4>${l}<span>${xs.length}</span></h4>${xs.map((r) => { const c = car(r.id), open = (r.tasks || []).filter((t) => !t.done).length, d = days((r.since || "").slice(0, 10));
      return `<a class="lc" href="#/recon/${esc(r.id)}">${c.img ? `<img src="${esc(c.img)}" alt="" style="width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:4px;margin-bottom:6px">` : ""}<b>${esc(carTitle(c))}</b><small>${open ? open + " job" + (open > 1 ? "s" : "") + " open" : "No open jobs"} · ${d ?? 0} day${d === 1 ? "" : "s"} here</small><small>${money((r.tasks || []).reduce((s, t) => s + n0(t.cost), 0))} spent</small></a>`; }).join("") || '<p style="color:var(--dim);font-size:13px;margin:0">—</p>'}</div>`; }).join("")}</div>`;
  $("#rcAdd").onchange = async (e) => { const id = e.target.value; if (!id) return; try { await saveRec("recon", { id, stage: "arrived", since: new Date().toISOString(), tasks: [] }); go("#/recon/" + id); } catch (x) { toast(errMsg(x), 1); } };
}
function reconEdit(V, id) {
  const c = car(id); if (!c) return go("#/recon");
  const r = clone(reconOf(id) || { id, stage: "arrived", since: new Date().toISOString(), tasks: [] });
  const draw = () => {
    V.innerHTML = `<div class="crumb"><a href="#/recon">Recon</a> / ${esc(carTitle(c))}</div>
    <div class="ph"><div><h1>${esc(carTitle(c))}</h1><p>${c.stock ? "Stock #" + esc(c.stock) + " · " : ""}${c.vin ? esc(c.vin) : ""}</p></div><div class="act"><a class="b" href="#/inventory/${esc(id)}">Open car</a><button class="b primary" type="button" id="rcSave">Save</button></div></div>
    <div class="card"><h3>Stage</h3>${seg("rcStage", [...RECON, ["done", "Finished"]], r.stage)}</div>
    <div class="card" style="margin-top:14px"><h3>Jobs</h3><div class="tw"><table class="t"><thead><tr><th></th><th>Job</th><th>Who does it</th><th class="r">Cost</th><th></th></tr></thead><tbody>
      ${(r.tasks || []).map((t, i) => `<tr data-i="${i}"><td><input type="checkbox" data-t="done" ${t.done ? "checked" : ""} aria-label="Done"></td>
        <td><input data-t="desc" value="${esc(t.desc || "")}" placeholder="Oil change, brakes, windshield…" style="width:100%;border:1px solid var(--line);border-radius:4px;padding:6px;background:var(--panel)"></td>
        <td><input data-t="vendor" value="${esc(t.vendor || "")}" placeholder="Mechanic / shop" style="width:100%;border:1px solid var(--line);border-radius:4px;padding:6px;background:var(--panel)"></td>
        <td class="r"><input type="number" step="any" data-t="cost" value="${esc(t.cost ?? "")}" style="width:100px;text-align:right;border:1px solid var(--line);border-radius:4px;padding:6px;background:var(--panel)"></td>
        <td><button class="b sm" type="button" data-rm>✕</button></td></tr>`).join("") || '<tr><td colspan="5" class="empty">No jobs yet.</td></tr>'}</tbody></table></div>
      <div class="formft" style="justify-content:space-between"><button class="b" type="button" id="rcJob">+ Add job</button><b>Total ${money2((r.tasks || []).reduce((s, t) => s + n0(t.cost), 0))}</b></div>
      <p style="color:var(--muted);font-size:13px;margin:6px 0 0">When you tick a job as done, its cost is added to the car's expenses automatically (Inventory → Costs).</p></div>
    <div class="card" style="margin-top:14px">${area("rcNotes", "Notes", r.notes)}</div>`;
    $$("#rcStage button").forEach((b) => (b.onclick = () => { if (r.stage !== b.dataset.k) { r.stage = b.dataset.k; r.since = new Date().toISOString(); } $$("#rcStage button").forEach((x) => x.classList.toggle("on", x === b)); }));
    $$("tr[data-i]").forEach((tr) => { const t = r.tasks[+tr.dataset.i];
      $$("[data-t]", tr).forEach((el) => (el.oninput = el.onchange = () => { t[el.dataset.t] = el.type === "checkbox" ? el.checked : el.dataset.t === "cost" ? n0(el.value) : el.value; }));
      $("[data-rm]", tr).onclick = () => { r.tasks.splice(+tr.dataset.i, 1); draw(); }; });
    $("#rcJob").onclick = () => { r.tasks.push({ id: uid("J"), desc: "", vendor: "", cost: 0, done: false }); draw(); $$("[data-t=desc]").pop().focus(); };
    $("#rcSave").onclick = async () => {
      r.notes = v("rcNotes"); r.tasks = r.tasks.filter((t) => t.desc || n0(t.cost));
      const k = clone(costOf(id)); k.expenses = k.expenses || []; let changed = false;
      for (const t of r.tasks) if (t.done && n0(t.cost) && !k.expenses.some((e) => e.reconJob === t.id)) { k.expenses.push({ date: todayISO(), desc: "Recon: " + (t.desc || "job") + (t.vendor ? " (" + t.vendor + ")" : ""), amount: n0(t.cost), reconJob: t.id }); changed = true; }
      try { await saveRec("recon", r); if (changed) await saveRec("costs", k); toast(changed ? "Saved. Finished jobs were added to the car's costs." : "Saved"); go("#/recon"); } catch (x) { toast(errMsg(x), 1); }
    };
  };
  draw();
}

/* ================= calendar (appointments) ================= */
const APPT_TYPES = ["Test drive", "Viewing", "Delivery / signing", "Credit meeting", "Trade-in appraisal", "Other"];
let calStart = null;
function calendar(V) {
  const t = parseD(todayISO()); if (!calStart) { t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); calStart = iso(t); }
  const daysW = Array.from({ length: 7 }, (_, i) => addDays(calStart, i));
  const who = (a) => a.name || (a.leadId && DB.leads.find((l) => l.id === a.leadId)?.name) || custName(cust(a.customerId));
  const stPill = (a) => a.status === "showed" ? pill("Showed", "ok") : a.status === "noshow" ? pill("No-show", "bad") : a.status === "cancelled" ? pill("Cancelled") : pill("Booked", "info");
  V.innerHTML = `<div class="ph"><div><h1>Calendar</h1><p>Test drives, viewings, deliveries.</p></div><div class="act"><button class="b" id="cPrev" type="button">←</button><button class="b" id="cToday" type="button">This week</button><button class="b" id="cNext" type="button">→</button><a class="b primary" href="#/calendar/new">+ Appointment</a></div></div>
  <div class="grid" style="grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;overflow-x:auto">${daysW.map((d) => { const xs = DB.appts.filter((a) => a.date === d).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    return `<div class="col" style="min-width:150px;${d === todayISO() ? "border-color:var(--brand)" : ""}"><h4>${parseD(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}<span>${xs.length || ""}</span></h4>
      ${xs.map((a) => `<a class="lc" href="#/calendar/${esc(a.id)}"><b>${esc(a.time || "")} ${esc(who(a))}</b><small>${esc(a.type || "")}${a.carId && car(a.carId) ? " · " + esc(carTitle(car(a.carId))) : ""}</small>${stPill(a)}</a>`).join("")}</div>`; }).join("")}</div>
  <h2 class="sec">Coming up</h2>${table([{ h: "When", f: (a) => `${fdate(a.date)} ${esc(a.time || "")}` }, { h: "Who", f: (a) => `<b>${esc(who(a))}</b><span class="sub">${esc(a.phone || "")}</span>` }, { h: "What", f: (a) => esc(a.type || "") }, { h: "Car", f: (a) => esc(a.carId ? carTitle(car(a.carId)) : "") }, { h: "", f: stPill }],
    DB.appts.filter((a) => a.date >= todayISO() && a.status === "scheduled").sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))).slice(0, 20), (a) => "#/calendar/" + a.id)}`;
  bindRows(V);
  $("#cPrev").onclick = () => { calStart = addDays(calStart, -7); calendar(V); }; $("#cNext").onclick = () => { calStart = addDays(calStart, 7); calendar(V); }; $("#cToday").onclick = () => { calStart = null; calendar(V); };
}
function apptEdit(V, id, q) {
  const isNew = id === "new", L = q.lead && DB.leads.find((l) => l.id === q.lead);
  const a = isNew ? { id: uid("A"), date: addDays(todayISO(), 1), time: "10:00", type: "Test drive", status: "scheduled", leadId: L?.id || "", customerId: q.customer || L?.customerId || "", carId: q.car || L?.carId || "", name: L?.name || "", phone: L?.phone || "" } : clone(DB.appts.find((x) => x.id === id) || {});
  if (!a.id) return go("#/calendar");
  V.innerHTML = `<div class="crumb"><a href="#/calendar">Calendar</a> / ${isNew ? "New appointment" : esc(a.name || "Appointment")}</div>
  <div class="ph"><div><h1>${isNew ? "New appointment" : "Appointment"}</h1></div><div class="act">${isNew ? "" : '<button class="b danger" type="button" id="aDel">Delete</button>'}<button class="b primary" type="button" id="aSave">Save</button></div></div>
  <div class="card"><div class="fg">${fld("a_date", "Date", a.date, "date")}${fld("a_time", "Time", a.time, "time")}${sel("a_type", "Type", a.type, APPT_TYPES)}${sel("a_status", "Status", a.status, [["scheduled", "Booked"], ["showed", "Showed up"], ["noshow", "No-show"], ["cancelled", "Cancelled"]])}
    ${fld("a_name", "Customer name", a.name)}${fld("a_phone", "Phone", a.phone, "tel")}${sel("a_car", "Car", a.carId, [["", "—"], ...SITE.cars.filter((c) => c.status !== "hidden" || c.id === a.carId).map((c) => [c.id, carTitle(c)])], "w2")}
    ${sel("a_sp", "With", a.salesperson || "", [["", "—"], ...(S().salespeople || []).map((x) => [x, x])])}${area("a_notes", "Notes", a.notes)}</div>
    ${a.phone ? `<div class="formft" style="justify-content:flex-start"><a class="b sm" href="sms:${esc(String(a.phone).replace(/[^\d+]/g, ""))}?&body=${encodeURIComponent(`Hi ${String(a.name || "").split(" ")[0]}, this is ${S().name}. Just confirming your ${String(a.type).toLowerCase()} on ${fdate(a.date)} at ${a.time}. See you then! ${S().phone || ""}`)}">Text a reminder</a></div>` : ""}</div>`;
  $("#aSave").onclick = async () => {
    Object.assign(a, { date: v("a_date"), time: v("a_time"), type: v("a_type"), status: v("a_status"), name: v("a_name"), phone: v("a_phone"), carId: v("a_car") || null, salesperson: v("a_sp"), notes: v("a_notes") });
    if (!a.date) return toast("Pick a date.", 1);
    try { await saveRec("appts", a); if (isNew && L && L.status === "new") { L.status = "appointment"; await saveRec("leads", L); } else if (isNew && L && L.status === "contacted") { L.status = "appointment"; await saveRec("leads", L); }
      toast("Appointment saved"); calStart = null; go("#/calendar"); } catch (x) { toast(errMsg(x), 1); }
  };
  if ($("#aDel")) $("#aDel").onclick = async () => { if (!confirm("Delete this appointment?")) return; try { await delRec("appts", a.id); go("#/calendar"); } catch (x) { toast(errMsg(x), 1); } };
}

/* ================= tasks ================= */
let taskFilter = "open";
function tasksPage(V) {
  const today = todayISO();
  const L = DB.tasks.filter((t) => taskFilter === "all" || (taskFilter === "done" ? t.done : !t.done)).sort((a, b) => (a.done - b.done) || (a.due || "9").localeCompare(b.due || "9"));
  const link = (t) => t.leadId && DB.leads.find((l) => l.id === t.leadId) ? `<a href="#/leads/${esc(t.leadId)}">${esc(DB.leads.find((l) => l.id === t.leadId).name)}</a>` : t.customerId && cust(t.customerId) ? `<a href="#/customers/${esc(t.customerId)}">${esc(custName(cust(t.customerId)))}</a>` : "";
  V.innerHTML = `<div class="ph"><div><h1>Tasks</h1><p>Calls to make, papers to chase, follow-ups.</p></div></div>
  <div class="card" style="margin-bottom:14px"><div class="fg">${fld("t_title", "New task", "", "text", 'wide placeholder="Call John about the Tacoma"')}${fld("t_due", "Due", today, "date")}<div class="f" style="align-self:end"><button class="b primary" type="button" id="tAdd">Add task</button></div></div></div>
  <div class="bar">${seg("tSeg", [["open", "Open"], ["done", "Done"], ["all", "All"]], taskFilter)}</div>
  <div class="tw"><table class="t"><tbody>${L.map((t) => `<tr><td style="width:36px"><input type="checkbox" data-done="${esc(t.id)}" ${t.done ? "checked" : ""} aria-label="Done"></td>
    <td style="${t.done ? "text-decoration:line-through;color:var(--muted)" : ""}"><b>${esc(t.title)}</b><span class="sub">${link(t)}</span></td>
    <td>${t.due ? `<span style="color:${!t.done && t.due < today ? "var(--bad)" : !t.done && t.due === today ? "var(--warn)" : "inherit"}">${t.due === today ? "Today" : fdate(t.due)}</span>` : ""}</td>
    <td class="r"><button class="b sm" type="button" data-tdel="${esc(t.id)}">✕</button></td></tr>`).join("") || '<tr><td class="empty">Nothing here.</td></tr>'}</tbody></table></div>`;
  $("#tAdd").onclick = async () => { const title = v("t_title"); if (!title) return; try { await saveRec("tasks", { id: uid("T"), title, due: v("t_due") || null, done: false }); tasksPage(V); renderNav("tasks"); } catch (x) { toast(errMsg(x), 1); } };
  $$("#tSeg button").forEach((b) => (b.onclick = () => { taskFilter = b.dataset.k; tasksPage(V); }));
  $$("[data-done]").forEach((c) => (c.onchange = async () => { const t = DB.tasks.find((x) => x.id === c.dataset.done); t.done = c.checked; try { await saveRec("tasks", t); tasksPage(V); renderNav("tasks"); } catch (x) { toast(errMsg(x), 1); } }));
  $$("[data-tdel]").forEach((b) => (b.onclick = async () => { try { await delRec("tasks", b.dataset.tdel); tasksPage(V); renderNav("tasks"); } catch (x) { toast(errMsg(x), 1); } }));
}

/* ================= opportunities (equity mining) ================= */
function opportunities(V) {
  const today = todayISO();
  const custOf = (d) => cust(d.customerId);
  // 1. buy-here-pay-here customers in good standing who have paid off most of their car: offer an upgrade
  const upgrade = bhphDeals().map((d) => [d, account(d)]).filter(([, a]) => a.payoff > 0 && a.pastDue === 0 && a.paid >= a.calc.totalPay * 0.6);
  // 2. paid-off BHPH customers: ready for their next car
  const paidOff = bhphDeals().map((d) => [d, account(d)]).filter(([, a]) => a.payoff === 0);
  // 3. bought 2+ years ago: time to trade up
  const old = DB.deals.filter((d) => d.status === "sold" && d.type !== "bhph" && d.date && days(d.date) >= 730);
  // 4. lost or cold leads from the last 90 days with a phone number: try again
  const cold = DB.leads.filter((l) => ["lost", "contacted"].includes(l.status) && l.phone && days((l.createdAt || "").slice(0, 10)) <= 90 && days((l.createdAt || "").slice(0, 10)) >= 14);
  // 5. birthdays this month
  const bdays = DB.customers.filter((c) => c.dob && c.dob.slice(5, 7) === today.slice(5, 7));
  const row = (c, why, extra = "") => `<tr><td><b>${esc(custName(c))}</b><span class="sub">${esc(c?.phone || "")}</span></td><td>${why}</td><td class="r" style="white-space:nowrap">${c?.phone ? `<a class="b sm" href="tel:${esc(String(c.phone).replace(/[^\d+]/g, ""))}">Call</a> <a class="b sm" href="sms:${esc(String(c.phone).replace(/[^\d+]/g, ""))}">Text</a>` : ""} ${c ? `<a class="b sm" href="#/customers/${esc(c.id)}">Open</a>` : ""}${extra}</td></tr>`;
  const sec = (title, desc, rows) => `<div class="card" style="margin-bottom:14px"><h3>${title} <span style="text-transform:none;letter-spacing:0;font-family:var(--body)">${rows.length}</span></h3><p style="color:var(--muted);margin:-6px 0 10px;font-size:14px">${desc}</p>
    ${rows.length ? `<div class="tw"><table class="t"><tbody>${rows.join("")}</tbody></table></div>` : '<p style="color:var(--dim);margin:0">Nobody right now.</p>'}</div>`;
  V.innerHTML = `<div class="ph"><div><h1>Opportunities</h1><p>People already in your records who are likely to buy again. Call them first.</p></div></div>
  ${sec("Ready for an upgrade", "Buy-here-pay-here customers who always pay and have paid 60% or more. Offer to roll them into a newer car.", upgrade.map(([d, a]) => row(custOf(d), `${esc(carTitle(car(d.carId)))} · ${Math.round((a.paid / a.calc.totalPay) * 100)}% paid · owes ${money(a.payoff)}`)))}
  ${sec("Paid off", "Finished paying. Thank them and offer their next car.", paidOff.map(([d]) => row(custOf(d), `${esc(carTitle(car(d.carId)))} paid off`)))}
  ${sec("Time to trade up", "Bought from you two or more years ago.", old.map((d) => row(custOf(d), `${esc(carTitle(car(d.carId)))} · bought ${fdate(d.date)}`)))}
  ${sec("Second chance", "Leads from the last 3 months who didn't buy. Try again with a new car.", cold.map((l) => `<tr><td><b>${esc(l.name)}</b><span class="sub">${esc(l.phone)}</span></td><td>${leadPill(l.status)} · ${fdate((l.createdAt || "").slice(0, 10))}</td><td class="r" style="white-space:nowrap"><a class="b sm" href="tel:${esc(l.phone.replace(/[^\d+]/g, ""))}">Call</a> <a class="b sm" href="#/leads/${esc(l.id)}">Open</a></td></tr>`))}
  ${sec("Birthdays this month", "Send a quick happy birthday text.", bdays.map((c) => row(c, `🎂 ${parseD(c.dob).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`)))}`;
}

/* ================= expenses (business costs) ================= */
const EXP_CATS = ["Rent", "Utilities", "Payroll", "Advertising", "Insurance", "Floor plan interest", "Auction fees", "Transport", "Office", "Licences & fees", "Other"];
function expensesPage(V) {
  const L = DB.expenses.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const month = todayISO().slice(0, 7);
  V.innerHTML = `<div class="ph"><div><h1>Expenses</h1><p>Business costs that aren't tied to one car. Used for the profit & loss in Reports.</p></div><div class="act"><button class="b" id="eCsv" type="button">Export CSV</button></div></div>
  <div class="grid g3" style="margin-bottom:14px"><div class="card kpi"><span>This month</span><b>${money(L.filter((e) => (e.date || "").startsWith(month)).reduce((s, e) => s + n0(e.amount), 0))}</b></div>
    <div class="card kpi"><span>This year</span><b>${money(L.filter((e) => (e.date || "").startsWith(month.slice(0, 4))).reduce((s, e) => s + n0(e.amount), 0))}</b></div></div>
  <div class="card" style="margin-bottom:14px"><div class="fg">${fld("e_date", "Date", todayISO(), "date")}${sel("e_cat", "Category", "Rent", EXP_CATS)}${fld("e_vendor", "Paid to", "")}${fld("e_amt", "Amount", "", "number")}${fld("e_note", "Note", "")}
    <div class="f" style="align-self:end"><button class="b primary" type="button" id="eAdd">Add expense</button></div></div></div>
  ${table([{ h: "Date", f: (e) => fdate(e.date) }, { h: "Category", f: (e) => esc(e.category) }, { h: "Paid to", f: (e) => esc(e.vendor || "") }, { h: "Note", f: (e) => esc(e.note || "") }, { h: "Amount", r: 1, f: (e) => money2(e.amount) },
    { h: "", f: (e) => `<button class="b sm" type="button" data-edel="${esc(e.id)}">✕</button>` }], L)}`;
  $("#eAdd").onclick = async () => { const amount = vn("e_amt"); if (!(amount > 0)) return toast("Enter the amount.", 1);
    try { await saveRec("expenses", { id: uid("E"), date: v("e_date") || todayISO(), category: v("e_cat"), vendor: v("e_vendor"), amount, note: v("e_note") }); toast("Expense added"); expensesPage(V); } catch (x) { toast(errMsg(x), 1); } };
  $$("[data-edel]").forEach((b) => (b.onclick = async () => { if (!confirm("Delete this expense?")) return; try { await delRec("expenses", b.dataset.edel); expensesPage(V); } catch (x) { toast(errMsg(x), 1); } }));
  $("#eCsv").onclick = () => csvDownload("expenses.csv", [["Date", "Category", "Paid to", "Note", "Amount"], ...L.map((e) => [e.date, e.category, e.vendor || "", e.note || "", e.amount])]);
}

/* ================= message templates ================= */
const DEFAULT_TPLS = [
  { name: "Thanks for your interest", channel: "sms", body: "Hi {first_name}, this is {dealer}. Thanks for asking about the {car}. When would you like to come see it? {phone}" },
  { name: "Car still available", channel: "email", subject: "The {car} is still available", body: "Hi {first_name},\n\nGood news: the {car} is still available at {price}.\n\nPhotos and details: {link}\nGet pre-approved in 3 minutes: {apply}\n\nWe're at {address}. Call or text {phone} anytime.\n\n{dealer}" },
  { name: "Appointment reminder", channel: "sms", body: "Hi {first_name}, just a reminder of your visit at {dealer} tomorrow. Reply if you need to change the time. {phone}" },
  { name: "Payment reminder", channel: "sms", body: "Hi {first_name}, friendly reminder from {dealer}: your car payment is due soon. Questions? Call {phone}." },
];
function templatesPage(V) {
  V.innerHTML = `<div class="ph"><div><h1>Message templates</h1><p>Ready-made texts and emails. Use them from any lead: they open in your phone or email with the name, car and price filled in.</p></div>
    <div class="act">${DB.templates.length ? "" : '<button class="b" type="button" id="tplDefaults">Add starter templates</button>'}<button class="b primary" type="button" id="tplNew">+ New template</button></div></div>
  <div class="banner">You can use: {first_name} {name} {car} {price} {link} {apply} {dealer} {phone} {address}</div>
  <div class="grid g2">${DB.templates.map((t) => `<div class="card" data-tid="${esc(t.id)}"><div class="fg">${fld("n_" + t.id, "Name", t.name, "text", "wide")}${sel("c_" + t.id, "Type", t.channel, [["sms", "Text message"], ["email", "Email"]])}
    ${t.channel === "email" ? fld("s_" + t.id, "Subject", t.subject, "text", "wide") : ""}${area("b_" + t.id, "Message", t.body)}</div>
    <div class="formft"><button class="b danger sm" type="button" data-tpdel="${esc(t.id)}">Delete</button><button class="b sm primary" type="button" data-tpsave="${esc(t.id)}">Save</button></div></div>`).join("")}</div>`;
  const add = async (t) => { await saveRec("templates", { id: uid("M"), ...t }); };
  if ($("#tplDefaults")) $("#tplDefaults").onclick = async () => { try { for (const t of DEFAULT_TPLS) await add(t); templatesPage(V); } catch (x) { toast(errMsg(x), 1); } };
  $("#tplNew").onclick = async () => { try { await add({ name: "New template", channel: "sms", body: "Hi {first_name}, " }); templatesPage(V); } catch (x) { toast(errMsg(x), 1); } };
  $$("[data-tpsave]").forEach((b) => (b.onclick = async () => { const id = b.dataset.tpsave, t = DB.templates.find((x) => x.id === id);
    Object.assign(t, { name: v("n_" + id), channel: v("c_" + id), subject: document.getElementById("s_" + id) ? v("s_" + id) : t.subject || "", body: document.getElementById("b_" + id).value });
    try { await saveRec("templates", t); toast("Saved"); templatesPage(V); } catch (x) { toast(errMsg(x), 1); } }));
  $$("[data-tpdel]").forEach((b) => (b.onclick = async () => { if (!confirm("Delete this template?")) return; try { await delRec("templates", b.dataset.tpdel); templatesPage(V); } catch (x) { toast(errMsg(x), 1); } }));
}

/* ================= printing ================= */
const PCSS = `*{box-sizing:border-box}body{font:13px/1.45 Arial,Helvetica,sans-serif;color:#111;margin:0;padding:28px}h1{font-size:22px;margin:0 0 4px;text-transform:uppercase;letter-spacing:.02em}h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #111;padding-bottom:3px;margin:18px 0 8px}
table{width:100%;border-collapse:collapse}td,th{padding:5px 6px;border:1px solid #999;text-align:left;vertical-align:top}th{background:#eee;font-size:11px;text-transform:uppercase}.r{text-align:right}.hd{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #111;padding-bottom:10px;margin-bottom:10px}
.hd img{height:56px}.muted{color:#555}.sig{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px}.sig div{border-top:1px solid #111;padding-top:4px;font-size:11px}.box{border:2px solid #111;padding:10px;margin:10px 0}.big{font-size:28px;font-weight:700}
@media print{body{padding:0}.noprint{display:none}}@page{margin:14mm}`;
function printWin(title, body) {
  const w = window.open("", "_blank"); if (!w) { toast("Allow pop-ups for this site to print.", 1); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PCSS}</style></head><body><div class="noprint" style="margin-bottom:16px"><button onclick="print()" style="padding:8px 16px;font-size:14px">Print</button></div>${body}</body></html>`);
  w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (_) {} }, 400);
}
const dealerHead = (title, right = "") => { const st = S(); return `<div class="hd"><div style="display:flex;gap:12px;align-items:center"><img src="${location.origin}/img/logo.png" alt=""><div><b style="font-size:16px">${esc(st.name)}</b><br>${esc(st.street)}, ${esc(st.city)}, ${esc(st.state)} ${esc(st.zip)}<br>${esc(st.phone)} · ${esc(st.email)}${st.license ? "<br>Dealer licence #" + esc(st.license) : ""}</div></div><div style="text-align:right"><h1>${title}</h1>${right}</div></div>`; };
const vehRow = (k) => `<table><tr><th>Year</th><th>Make</th><th>Model</th><th>Body</th><th>Colour</th></tr><tr><td>${esc(k.year)}</td><td>${esc(k.make)}</td><td>${esc(modelOf(k))} ${esc(k.trim || "")}</td><td>${esc(k.body || "")}</td><td>${esc(k.ext || "")}</td></tr>
  <tr><th colspan="2">VIN</th><th>Stock #</th><th colspan="2">Odometer</th></tr><tr><td colspan="2" style="font-family:monospace;font-size:14px">${esc(k.vin || "")}</td><td>${esc(k.stock || "")}</td><td colspan="2">${k.miles ? int(k.miles) + " miles" : ""}</td></tr></table>`;
function printDeal(kind, d) {
  const k = car(d.carId) || {}, c = cust(d.customerId) || {}, x = calc(d), st = S();
  const buyer = `<table><tr><th>Buyer</th><th>Address</th><th>Phone</th><th>Driver's licence</th></tr><tr><td>${esc(custName(c))}</td><td>${esc([c.street, c.city, c.state, c.zip].filter(Boolean).join(", "))}</td><td>${esc(c.phone || "")}</td><td>${esc([c.dl, c.dlState].filter(Boolean).join(" "))}</td></tr></table>`;
  if (kind === "bos") {
    printWin("Bill of Sale " + dealNo(d), `${dealerHead("Bill of Sale", `Deal ${dealNo(d)}<br>Date: ${fdate(d.date)}`)}
      <h2>Buyer</h2>${buyer}<h2>Vehicle</h2>${vehRow(k)}
      ${d.trade?.make ? `<h2>Trade-in</h2><table><tr><th>Vehicle</th><th>VIN</th><th>Miles</th><th class="r">Allowance</th><th class="r">Payoff</th><th>Lienholder</th></tr><tr><td>${esc([d.trade.year, d.trade.make, d.trade.model].filter(Boolean).join(" "))}</td><td>${esc(d.trade.vin || "")}</td><td>${d.trade.miles ? int(d.trade.miles) : ""}</td><td class="r">${money2(x.allow)}</td><td class="r">${money2(x.payoff)}</td><td>${esc(d.trade.lienholder || "")}</td></tr></table>` : ""}
      <h2>Price</h2><table style="width:60%;margin-left:auto"><tr><td>Vehicle price</td><td class="r">${money2(x.price)}</td></tr><tr><td>Doc fee</td><td class="r">${money2(x.doc)}</td></tr><tr><td>Title & registration</td><td class="r">${money2(x.title)}</td></tr>
        <tr><td>Sales tax (${n0(d.taxRate)}%)</td><td class="r">${money2(x.tax)}</td></tr><tr><th>Total</th><th class="r">${money2(x.total)}</th></tr>
        ${x.allow || x.payoff ? `<tr><td>Less trade allowance</td><td class="r">−${money2(x.allow)}</td></tr><tr><td>Plus trade payoff</td><td class="r">+${money2(x.payoff)}</td></tr>` : ""}
        <tr><td>Less down payment</td><td class="r">−${money2(x.down)}</td></tr><tr><th>${d.type === "cash" ? "Balance due" : "Amount financed"}</th><th class="r">${money2(d.type === "cash" ? x.balance : x.financed)}</th></tr></table>
      ${d.type !== "cash" ? `<p><b>Financing:</b> ${d.type === "bhph" ? esc(st.name) : esc(d.lender || "outside lender")} · ${x.nPay} payments of ${money2(x.payment)} (${FREQ[d.freq || "monthly"][0].toLowerCase()}), first due ${fdate(d.firstDue)} · APR ${n0(d.apr)}%</p>` : ""}
      <div class="box"><b>Odometer statement.</b> The seller states that the odometer reading shown above is, to the best of the seller's knowledge, the actual mileage of the vehicle unless otherwise noted.</div>
      <div class="box"><b>Sold AS IS.</b> Unless a written warranty is given on the Buyers Guide, this vehicle is sold as is, with no warranty, express or implied. The buyer has received a copy of the Buyers Guide.</div>
      <div class="sig"><div>Buyer signature / date</div><div>Seller (${esc(st.name)}) signature / date</div></div>`);
  } else if (kind === "guide") {
    printWin("Buyers Guide", `<div style="border:3px solid #111;padding:18px;max-width:720px;margin:auto">
      <h1 style="text-align:center;font-size:30px">Buyers Guide</h1>
      <p style="text-align:center;font-weight:700">IMPORTANT: Spoken promises are difficult to enforce. Ask the dealer to put all promises in writing. Keep this form.</p>
      <table><tr><th>Vehicle make</th><th>Model</th><th>Year</th><th>VIN</th></tr><tr><td>${esc(k.make || "")}</td><td>${esc(modelOf(k))}</td><td>${esc(k.year || "")}</td><td style="font-family:monospace">${esc(k.vin || "")}</td></tr>
        <tr><th colspan="2">Dealer stock number (optional)</th><td colspan="2">${esc(k.stock || "")}</td></tr></table>
      <h2>Warranties for this vehicle:</h2>
      <div class="box"><span style="font-size:22px">☒</span> <b style="font-size:20px">AS IS – NO DEALER WARRANTY</b><br>THE DEALER DOES NOT PROVIDE A WARRANTY FOR ANY REPAIRS AFTER SALE.</div>
      <div class="box"><span style="font-size:22px">☐</span> <b style="font-size:20px">DEALER WARRANTY</b><br>☐ FULL WARRANTY. &nbsp; ☐ LIMITED WARRANTY. The dealer will pay ____% of the labor and ____% of the parts for the covered systems that fail during the warranty period. Ask the dealer for a copy of the warranty, and for any documents that explain warranty coverage, exclusions, and repair obligations.<br>Systems covered / duration: ______________________________________________</div>
      <p>☐ NON-DEALER WARRANTIES FOR THIS VEHICLE: ☐ Manufacturer's Warranty Still Applies. ☐ Manufacturer's Used Vehicle Warranty Applies. ☐ Other Used Vehicle Warranty Applies.<br>☐ SERVICE CONTRACT. A service contract on this vehicle is available for an extra charge.</p>
      <p><b>ASK THE DEALER IF YOUR MECHANIC CAN INSPECT THE VEHICLE ON OR OFF THE LOT.</b></p>
      <p><b>OBTAIN A VEHICLE HISTORY REPORT AND CHECK FOR OPEN SAFETY RECALLS.</b> For information on how to obtain a vehicle history report, visit ftc.gov/usedcars. To check for open safety recalls, visit safercar.gov. You will need the vehicle identification number (VIN) shown above to make the best use of the resources on these sites.</p>
      <p><b>SEE OTHER SIDE</b> for important additional information, including a list of major defects that may occur in used motor vehicles.</p>
      <p class="muted" style="font-size:11px">Si el concesionario gestiona la venta en español, pídale una copia de la Guía del Comprador en español.</p>
      <table><tr><th>Dealer name</th><td>${esc(st.name)}</td></tr><tr><th>Address</th><td>${esc(st.street)}, ${esc(st.city)}, ${esc(st.state)} ${esc(st.zip)}</td></tr><tr><th>Telephone</th><td>${esc(st.phone)}</td></tr><tr><th>Email</th><td>${esc(st.email)}</td></tr></table>
      <p><b>For complaints after sale, contact:</b> ${esc(st.name)}, ${esc(st.phone)}</p></div>`);
  } else if (kind === "sched") {
    const sch = schedule(d);
    printWin("Payment schedule " + dealNo(d), `${dealerHead("Payment Schedule", `Deal ${dealNo(d)}<br>${fdate(d.date)}`)}
      <h2>Buyer</h2>${buyer}<h2>Vehicle</h2>${vehRow(k)}
      <h2>Terms</h2><table><tr><th>Annual percentage rate</th><th>Finance charge</th><th>Amount financed</th><th>Total of payments</th></tr><tr><td class="big">${n0(d.apr)}%</td><td class="big">${money2(x.finCharge)}</td><td class="big">${money2(x.financed)}</td><td class="big">${money2(x.totalPay)}</td></tr></table>
      <p>${x.nPay} payments of ${money2(x.payment)}, ${FREQ[d.freq || "monthly"][0].toLowerCase()}, starting ${fdate(d.firstDue)}. Payable to ${d.type === "bhph" ? esc(st.name) : esc(d.lender || "the lender")}.</p>
      <h2>Schedule</h2><table><tr><th>#</th><th>Due date</th><th class="r">Amount</th><th>Paid</th></tr>${sch.map((s) => `<tr><td>${s.n}</td><td>${fdate(s.date)}</td><td class="r">${money2(s.amount)}</td><td style="width:30%"></td></tr>`).join("")}</table>
      <div class="sig"><div>Buyer signature / date</div><div>${esc(st.name)} / date</div></div>`);
  }
}
function printReceipt(p) {
  const d = DB.deals.find((x) => x.id === p.dealId) || {}, c = cust(p.customerId) || {}, a = account(d);
  printWin("Receipt", `${dealerHead("Payment Receipt", `Receipt ${esc(p.id)}<br>${fdate(p.date)}`)}
    <table><tr><th>Received from</th><td>${esc(custName(c))}</td></tr><tr><th>Vehicle</th><td>${esc(carTitle(car(d.carId)))} ${car(d.carId)?.vin ? "· VIN " + esc(car(d.carId).vin) : ""}</td></tr>
    <tr><th>Amount</th><td class="big">${money2(p.amount)}</td></tr><tr><th>Method</th><td>${esc(p.method || "")}</td></tr>${p.note ? `<tr><th>Note</th><td>${esc(p.note)}</td></tr>` : ""}
    <tr><th>Balance (payoff) after today</th><td>${money2(a.payoff)}</td></tr><tr><th>Next payment due</th><td>${a.next && a.payoff ? fdate(a.next.date) + " · " + money2(a.next.amount) : "—"}</td></tr></table>
    <div class="sig"><div>Received by</div><div>Date</div></div>`);
}
function printSticker(k) {
  const st = S();
  printWin("Window sticker", `<div style="max-width:720px;margin:auto;border:3px solid #111;padding:20px">
    <div style="display:flex;justify-content:space-between;align-items:center"><img src="${location.origin}/img/logo.png" style="height:70px" alt=""><div style="text-align:right"><b style="font-size:18px">${esc(st.name)}</b><br>${esc(st.phone)}<br>${esc(location.host)}</div></div>
    <h1 style="font-size:40px;margin:14px 0 0">${esc(k.year)} ${esc(k.name)}</h1><div style="font-size:18px" class="muted">${esc(k.trim || "")}</div>
    <div style="font-size:64px;font-weight:800;margin:12px 0">${money(k.price)}</div>
    ${k.img ? `<img src="${esc(new URL(k.img, location.origin).href)}" style="width:100%;aspect-ratio:3/2;object-fit:cover;border:1px solid #999" alt="">` : ""}
    <table style="margin-top:12px;font-size:15px"><tr><th>Mileage</th><td>${k.miles ? int(k.miles) : "—"}</td><th>Engine</th><td>${esc(k.engine || "—")}</td></tr><tr><th>Transmission</th><td>${esc(k.trans || "—")}</td><th>Drivetrain</th><td>${esc(k.drive || "—")}</td></tr>
    <tr><th>Exterior</th><td>${esc(k.ext || "—")}</td><th>Interior</th><td>${esc(k.int || "—")}</td></tr><tr><th>MPG</th><td>${esc(k.mpg || "—")}</td><th>Fuel</th><td>${esc(k.fuel || "—")}</td></tr>
    <tr><th>VIN</th><td colspan="3" style="font-family:monospace">${esc(k.vin || "—")}</td></tr><tr><th>Stock #</th><td colspan="3">${esc(k.stock || "—")}</td></tr></table>
    ${(k.equip || []).length ? `<h2>Equipment</h2><div style="columns:2;font-size:15px">${k.equip.map((e) => "✓ " + esc(e)).join("<br>")}</div>` : ""}
    <p class="muted" style="margin-top:14px">Price excludes tax, title and fees. See the Buyers Guide for warranty information.</p></div>`);
}

/* ================= go ================= */
try { const t = localStorage.getItem("dmsTheme"); if (t) document.documentElement.dataset.theme = t; } catch (_) {}
boot();
