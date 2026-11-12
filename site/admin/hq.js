// DealerVexa HQ: every dealer on the platform, sign-ups, invoices and crypto payments, plans and wallets.
import { TEMPLATES } from "../t/templates.js";

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (v) => "$" + Math.round(+v || 0).toLocaleString("en-US");
const fdate = (s) => (s ? new Date(String(s).length <= 10 ? s + "T12:00:00" : s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
const ago = (s) => { if (!s) return "never"; const d = Math.round((Date.now() - new Date(s)) / 864e5); return d <= 0 ? "today" : d === 1 ? "yesterday" : d + " days ago"; };
const pill = (t, k = "") => `<span class="pill ${k}">${esc(t)}</span>`;
const DEALER_TPL = Object.keys(TEMPLATES).filter((k) => !TEMPLATES[k].original);
const EXPLORER = (coin, tx) => !tx ? "" : /BTC/i.test(coin) ? `https://mempool.space/tx/${tx}` : /TRC/i.test(coin) ? `https://tronscan.org/#/transaction/${tx}` : /SOL/i.test(coin) ? `https://solscan.io/tx/${tx}` : /XRP/i.test(coin) ? `https://xrpscan.com/tx/${tx}` : `https://etherscan.io/tx/${tx}`;
let PW = "", CFG = null;

function toast(t, err) { const el = $("#toast"); el.textContent = t; el.className = "toast on" + (err ? " err" : ""); clearTimeout(toast.t); toast.t = setTimeout(() => (el.className = "toast"), err ? 5000 : 2200); }
async function api(url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { ...(opt.body && typeof opt.body === "string" ? { "content-type": "application/json" } : {}), ...(opt.headers || {}), "x-admin-password": PW } });
  let b = null; try { b = await r.json(); } catch (_) {}
  if (r.status === 401) { logout(); throw { code: "unauthorized" }; }
  if (!r.ok) throw { code: (b && b.error) || "http_" + r.status };
  return b;
}
const J = (m, b) => ({ method: m, body: JSON.stringify(b) });
const err = (x) => (x && x.code) || "error";

/* ---------- login ---------- */
async function tryLogin(pw) { try { const r = await fetch("/api/login", { method: "POST", headers: { "x-admin-password": pw } }); return r.status === 401 ? false : r.ok ? true : null; } catch (_) { return null; } }
function logout() { PW = ""; try { sessionStorage.removeItem("hqPw"); } catch (_) {} $("#app").hidden = true; $("#login").hidden = false; }
async function boot() {
  let saved = ""; try { saved = sessionStorage.getItem("hqPw") || ""; } catch (_) {}
  if (saved && (await tryLogin(saved))) return start(saved);
  $("#login").hidden = false; $("#loginPw").focus();
  $("#loginForm").onsubmit = async (e) => { e.preventDefault(); const pw = $("#loginPw").value; $("#loginErr").textContent = "Checking…"; const ok = await tryLogin(pw);
    if (ok) { try { sessionStorage.setItem("hqPw", pw); } catch (_) {} $("#loginErr").textContent = ""; start(pw); } else $("#loginErr").textContent = ok === null ? "Could not reach the server." : "Wrong password."; };
}
function start(pw) {
  PW = pw;
  $("#login").hidden = true; $("#app").hidden = false;
  $("#logout").onclick = logout; $("#burger").onclick = () => document.body.classList.toggle("nav-open");
  window.onhashchange = route; route();
}

/* ---------- router ---------- */
const NAV = [["overview", "▦", "Overview"], ["dealers", "🏪", "Dealers"], ["problems", "⚠", "Problems"], ["support", "🛟", "Support"], ["signups", "📝", "Sign-ups"], ["invoices", "💳", "Invoices & payments"], ["domains", "🌐", "Domains"], ["plans", "⚙", "Plans & wallets"], ["links", "🔗", "Pages & links"]];
async function route() {
  document.body.classList.remove("nav-open");
  const [page, id] = (location.hash.replace(/^#\/?/, "") || "overview").split("/");
  $("#nav").innerHTML = NAV.map(([k, ic, l]) => `<a href="#/${k}" class="${page === k ? "on" : ""}"><span class="ic">${ic}</span>${l}</a>`).join("");
  const V = $("#view"); V.innerHTML = '<p class="empty">Loading…</p>'; scrollTo(0, 0);
  try {
    if (!CFG) CFG = await api("/api/hq/config");
    await ({ overview, dealers: id === "new" ? newDealer : dealers, problems, support, signups, invoices, domains, plans, links }[page] || overview)(V, id);
  } catch (x) { V.innerHTML = `<p class="empty">Could not load (${esc(err(x))}).</p>`; }
}
const go = (h) => (location.hash === h ? route() : (location.hash = h));
const planOf = (id) => (CFG.plans || []).find((p) => p.id === id);
function tbl(cols, rows) {
  if (!rows.length) return '<div class="tw"><div class="empty">Nothing here yet.</div></div>';
  return `<div class="tw"><table class="t"><thead><tr>${cols.map((c) => `<th class="${c.r ? "r" : ""}">${c.h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td class="${c.r ? "r num" : ""}">${c.f(r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
const statusPill = (d) => d.suspended ? pill("Paused", "bad") : d.paidUntil && d.paidUntil < new Date().toISOString().slice(0, 10) ? pill("Payment due", "warn") : pill("Active", "ok");
// open a dealer's panel as the owner (the panel picks up the HQ password from this browser)
const openPanel = (slug) => { try { sessionStorage.setItem("tpw:" + slug, PW); } catch (_) {} window.open(`/w/${slug}/admin`, "_blank"); };

/* ---------- overview ---------- */
async function overview(V) {
  const [o, su, inv] = await Promise.all([api("/api/hq/overview"), api("/api/hq/signups"), api("/api/hq/invoices")]);
  const D = o.dealers, active = D.filter((d) => !d.suspended);
  const mrr = active.reduce((s, d) => s + (planOf(d.plan)?.price || 0), 0);
  const pending = su.filter((s) => s.status === "payment_submitted" || s.status === "awaiting_payment");
  const unpaid = inv.filter((i) => i.status === "unpaid" || i.status === "submitted");
  const quiet = D.filter((d) => !d.suspended && (!d.lastActive || Date.now() - new Date(d.lastActive) > 14 * 864e5));
  V.innerHTML = `<div class="ph"><div><h1>DealerVexa HQ</h1><p>CRM · DMS · automotive marketing · websites · AI photo studio</p></div></div>
  <div class="grid g4"><a class="card kpi" href="#/dealers"><span>Dealers</span><b>${D.length}</b><small>${active.length} active · ${D.length - active.length} paused</small></a>
    <div class="card kpi"><span>Monthly revenue</span><b>${money(mrr)}</b><small>from active plans</small></div>
    <a class="card kpi" href="#/signups"><span>New sign-ups</span><b>${pending.length}</b><small>${su.filter((s) => s.status === "payment_submitted").length} paid, waiting for you</small></a>
    <a class="card kpi" href="#/invoices"><span>Open invoices</span><b>${unpaid.length}</b><small>${money(unpaid.reduce((s, i) => s + i.amount, 0))} · ${unpaid.filter((i) => i.status === "submitted").length} to confirm</small></a></div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>Sign-ups to handle <a href="#/signups">All →</a></h3>${tbl([{ h: "Dealer", f: (s) => `<b>${esc(s.dealer)}</b><span class="sub">${esc(s.contact)} · ${esc(s.phone)}</span>` }, { h: "Plan", f: (s) => esc(planOf(s.plan)?.name || s.plan) }, { h: "", f: (s) => s.status === "payment_submitted" ? pill("Paid · check", "info") : pill("Waiting for payment", "warn") }], pending.slice(0, 6))}</div>
    <div class="card"><h3>Dealers who may need help</h3><p style="color:var(--muted);font-size:13px;margin:-6px 0 10px">No activity for 2 weeks: give them a call.</p>${tbl([{ h: "Dealer", f: (d) => `<b>${esc(d.name)}</b><span class="sub">${esc(d.phone || d.email || "")}</span>` }, { h: "Last active", f: (d) => ago(d.lastActive || d.lastLogin) }, { h: "", f: (d) => `<button class="b sm" type="button" data-open="${esc(d.slug)}">Open panel</button>` }], quiet.slice(0, 6))}</div></div>
  <div class="card" style="margin-top:14px"><h3>Atlantic Auto Sales (your own lot)</h3><p style="margin:0">${o.main.cars} cars for sale · <a href="/panel/" target="_blank" rel="noopener">Open the A & S panel ↗</a> · <a href="/" target="_blank" rel="noopener">aands-auto.com ↗</a></p></div>`;
  $$("[data-open]").forEach((b) => (b.onclick = () => openPanel(b.dataset.open)));
}

/* ---------- dealers ---------- */
let dq = "", dom = null;
async function dealers(V) {
  const o = await api("/api/hq/overview");
  const draw = () => {
    const L = o.dealers.filter((d) => !dq || [d.name, d.slug, d.domain, d.city, d.email, d.phone].join(" ").toLowerCase().includes(dq.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
    V.innerHTML = `<div class="ph"><div><h1>Dealers</h1><p>${o.dealers.length} dealers on DealerVexa</p></div><div class="act"><a class="b primary" href="#/dealers/new">+ New dealer</a></div></div>
    <div class="bar"><div class="f" style="flex:1 1 260px"><input id="dq" type="search" placeholder="Search dealers…" value="${esc(dq)}" aria-label="Search"></div></div>
    ${tbl([{ h: "Dealer", f: (d) => `<b>${esc(d.name)}</b><span class="sub">${esc(d.city)}${d.phone ? " · " + esc(d.phone) : ""}</span><span class="sub" style="font-family:var(--mono)">/w/${esc(d.slug)}${d.domain ? " · " + esc(d.domain) : ""}</span>` },
      { h: "Plan", f: (d) => `<select data-plan="${esc(d.slug)}" class="b sm" aria-label="Plan">${CFG.plans.map((p) => `<option value="${esc(p.id)}" ${p.id === d.plan ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select>` },
      { h: "Status", f: (d) => `${statusPill(d)}<span class="sub">paid until ${fdate(d.paidUntil)}</span>` },
      { h: "Cars", r: 1, f: (d) => d.cars }, { h: "Leads", r: 1, f: (d) => `${d.leads}${d.newLeads ? ` <span class="pill info">${d.newLeads} new</span>` : ""}` }, { h: "Sold", r: 1, f: (d) => d.sold },
      { h: "Last active", f: (d) => ago(d.lastActive || d.lastLogin) },
      { h: "", f: (d) => `<div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end"><a class="b sm" href="/w/${esc(d.slug)}" target="_blank" rel="noopener">Site ↗</a><button class="b sm primary" type="button" data-open="${esc(d.slug)}">Panel ↗</button>
        <button class="b sm" type="button" data-inv="${esc(d.slug)}">+ Invoice</button><button class="b sm" type="button" data-dom="${esc(d.slug)}">Domain</button><button class="b sm" type="button" data-pw="${esc(d.slug)}">Password</button>
        <button class="b sm ${d.suspended ? "" : "danger"}" type="button" data-sus="${esc(d.slug)}">${d.suspended ? "Resume" : "Pause"}</button><button class="b sm danger" type="button" data-del="${esc(d.slug)}">✕</button></div>
        ${dom === d.slug ? `<div style="text-align:left;margin-top:10px;border-top:1px solid var(--line);padding-top:10px"><div class="f"><label>Domain</label><input id="domIn" value="${esc(d.domain)}" placeholder="joesautos.com"></div>
          <ol style="font-size:13px;line-height:1.6;padding-left:18px">
            <li>Netlify → Domain management → <b>Add a domain alias</b> → the domain and www.domain.</li>
            <li>At the domain company → DNS: <b>A</b> record, name <b>@</b>, value <b>75.2.60.5</b>.</li>
            <li><b>CNAME</b> record, name <b>www</b>, value <b>aands-auto.netlify.app</b>.</li></ol>
          <button class="b sm primary" type="button" id="domSave">Save domain</button></div>` : ""}` }], L)}`;
    $("#dq").oninput = (e) => { dq = e.target.value; draw(); $("#dq").focus(); $("#dq").setSelectionRange(dq.length, dq.length); };
    $$("[data-open]").forEach((b) => (b.onclick = () => openPanel(b.dataset.open)));
    $$("[data-plan]").forEach((s) => (s.onchange = async () => { try { await api("/api/hq/status/" + s.dataset.plan, J("PUT", { plan: s.value })); toast("Plan changed"); } catch (x) { toast(err(x), 1); } }));
    $$("[data-sus]").forEach((b) => (b.onclick = async () => { const d = o.dealers.find((x) => x.slug === b.dataset.sus);
      if (!d.suspended && !confirm(`Pause ${d.name}? Their website shows "temporarily unavailable" and they can only open Billing.`)) return;
      try { await api("/api/hq/status/" + d.slug, J("PUT", { suspended: !d.suspended })); d.suspended = !d.suspended; toast(d.suspended ? "Paused" : "Active again"); draw(); } catch (x) { toast(err(x), 1); } }));
    $$("[data-inv]").forEach((b) => (b.onclick = async () => { const d = o.dealers.find((x) => x.slug === b.dataset.inv), p = planOf(d.plan) || CFG.plans[0];
      const period = prompt("Invoice for (e.g. December 2026):", new Date(Date.now() + 15 * 864e5).toLocaleDateString("en-US", { month: "long", year: "numeric" })); if (!period) return;
      const amount = prompt("Amount in USD:", p?.price || 0); if (amount === null) return;
      try { await api("/api/hq/invoices", J("POST", { slug: d.slug, plan: d.plan, amount: +amount, period })); toast("Invoice created. The dealer sees it in Billing."); } catch (x) { toast(err(x), 1); } }));
    $$("[data-pw]").forEach((b) => (b.onclick = async () => { const pw = prompt("New password for this dealer (8+ characters):"); if (!pw) return; if (pw.length < 8) return toast("At least 8 characters.", 1);
      try { await api(`/api/t/${b.dataset.pw}/password`, J("POST", { newPassword: pw })); toast("Password changed. Send it to the dealer."); } catch (x) { toast(err(x), 1); } }));
    $$("[data-dom]").forEach((b) => (b.onclick = () => { dom = dom === b.dataset.dom ? null : b.dataset.dom; draw(); }));
    if ($("#domSave")) $("#domSave").onclick = async () => { const d = o.dealers.find((x) => x.slug === dom), val = $("#domIn").value.trim();
      try { const r = await api(`/api/t/${dom}/domain`, J("POST", { domain: val })); d.domain = r.domain; dom = null; draw();
        alert(r.nameservers.length ? `Connected in Netlify. The dealer must set these name servers at their domain company:\n\n${r.nameservers.join("\n")}` : "Domain saved. Netlify is not linked (NETLIFY_TOKEN), so add it by hand in Netlify → Domain management."); } catch (x) { toast(err(x), 1); } };
    $$("[data-del]").forEach((b) => (b.onclick = async () => { const d = o.dealers.find((x) => x.slug === b.dataset.del);
      if (prompt(`This deletes ${d.name}: website, cars, customers, deals. It can't be undone. Type DELETE to confirm.`) !== "DELETE") return;
      try { await api(`/api/t/${d.slug}/data`, { method: "DELETE" }); const site = await (await fetch("/api/data", { cache: "no-store" })).json(); site.settings.websites = (site.settings.websites || []).filter((w) => w.slug !== d.slug); await api("/api/data", J("PUT", site));
        o.dealers = o.dealers.filter((x) => x.slug !== d.slug); toast("Dealer deleted"); draw(); } catch (x) { toast(err(x), 1); } }));
  };
  draw();
}
async function newDealer(V) {
  const slugify = (t) => String(t || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  V.innerHTML = `<div class="crumb"><a href="#/dealers">Dealers</a> / New dealer</div><div class="ph"><div><h1>New dealer</h1><p>Creates their website and panel straight away.</p></div></div>
  <div class="card"><div class="fg">
    ${[["n_name", "Dealer name"], ["n_slug", "Website link (aands-auto.com/w/…)"], ["n_phone", "Phone"], ["n_email", "Email"], ["n_city", "City"], ["n_state", "State"], ["n_domain", "Own domain (optional)"], ["n_pw", "Password for the dealer (8+)"]].map(([id, l]) => `<div class="f"><label for="${id}">${l}</label><input id="${id}"></div>`).join("")}
    <div class="f"><label for="n_plan">Plan</label><select id="n_plan">${CFG.plans.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} · ${money(p.price)}/mo</option>`).join("")}</select></div>
    <div class="f"><label for="n_tpl">Template</label><select id="n_tpl">${DEALER_TPL.map((k) => `<option value="${k}">${esc(TEMPLATES[k].name)}</option>`).join("")}</select></div></div>
    <p style="font-size:13px;color:var(--muted)">See the designs: <a href="/templates" target="_blank" rel="noopener">template gallery ↗</a></p>
    <div class="formft"><a class="b" href="#/dealers">Cancel</a><button class="b primary" type="button" id="create">Create dealer</button></div></div>`;
  let touched = false; $("#n_slug").oninput = () => (touched = true); $("#n_name").oninput = () => { if (!touched) $("#n_slug").value = slugify($("#n_name").value); };
  $("#create").onclick = async () => {
    const g = (id) => $("#" + id).value.trim(), slug = slugify(g("n_slug") || g("n_name"));
    if (!g("n_name")) return toast("Add the dealer name.", 1);
    try { await api("/api/hq/dealers", J("POST", { slug, name: g("n_name"), phone: g("n_phone"), email: g("n_email"), city: g("n_city"), state: g("n_state"), domain: g("n_domain").replace(/^https?:\/\//, "").replace(/^www\./, ""), password: g("n_pw"), plan: g("n_plan"), template: g("n_tpl") }));
      alert(`Done! Send this to the dealer:\n\nWebsite: ${location.origin}/w/${slug}\nPanel: ${location.origin}/w/${slug}/admin\nPassword: ${g("n_pw")}`); go("#/dealers"); }
    catch (x) { toast(err(x), 1); }
  };
}

/* ---------- problems: what's wrong, where ---------- */
async function problems(V) {
  const [o, errs, inv] = await Promise.all([api("/api/hq/overview"), api("/api/hq/errors"), api("/api/hq/invoices")]);
  const today = new Date().toISOString().slice(0, 10), issues = [];
  for (const d of o.dealers) {
    const add = (level, what, fix, alias) => issues.push({ d, level, what, fix, alias });
    if (d.suspended) add(2, "Account is paused", "Billing: check their invoice, then Resume in Dealers.");
    if (d.paidUntil && d.paidUntil < today && !d.suspended) add(2, `Payment due since ${fdate(d.paidUntil)}`, "Create an invoice or call them.");
    inv.filter((i) => i.slug === d.slug && i.status === "submitted").forEach((i) => add(2, `Says they paid ${money(i.amount)} (${i.coin || "crypto"})`, "Check the transaction, then Mark paid in Invoices."));
    d.ftpErrors.forEach((e) => add(2, "Export failed · " + e, "Open their panel → Marketing → Send by FTP and check the server, user and password."));
    if (!d.lastActive && !d.lastLogin) add(1, "Never logged in", "Send them their panel link and password again.");
    else if (Date.now() - new Date(d.lastActive || d.lastLogin) > 14 * 864e5) add(1, "No activity for 2 weeks", "Give them a call; they may need help.");
    if (d.newLeads >= 5) add(1, `${d.newLeads} customer messages not answered`, "Remind them to answer their leads.");
    if (d.domain && !d.aliasAdded) add(2, `New domain ${d.domain}: add it in Netlify`, `Netlify → Domain management → Add a domain alias → "${d.domain}" and "www.${d.domain}". Then click Done.`, d.slug);
    d.profile.forEach((p) => add(0, "Website: " + p, "Open their panel → Settings / Inventory."));
  }
  const errBy = {}; errs.forEach((e) => (errBy[e.slug] = (errBy[e.slug] || 0) + e.count));
  issues.sort((a, b) => b.level - a.level);
  const lv = (l) => (l === 2 ? pill("Urgent", "bad") : l === 1 ? pill("Check", "warn") : pill("Tip", "info"));
  V.innerHTML = `<div class="ph"><div><h1>Problems</h1><p>Everything that needs your attention, checked automatically for every dealer.</p></div></div>
  <div class="card"><h3>Dealer issues <span>${issues.filter((i) => i.level === 2).length} urgent</span></h3>
    ${tbl([{ h: "", f: (i) => lv(i.level) }, { h: "Dealer", f: (i) => `<b>${esc(i.d.name)}</b><span class="sub">${esc(i.d.phone || i.d.email || "")}</span>` }, { h: "Problem", f: (i) => esc(i.what) }, { h: "What to do", f: (i) => `<span style="color:var(--muted);font-size:13px">${esc(i.fix)}</span>` },
      { h: "", f: (i) => i.alias ? `<button class="b sm primary" type="button" data-alias="${esc(i.alias)}">✓ Done</button>` : `<button class="b sm primary" type="button" data-open="${esc(i.d.slug)}">Open panel</button>` }], issues)}</div>
  <div class="card" style="margin-top:14px"><h3>Error log <span><button class="b sm" type="button" id="clrErr">Clear all</button></span></h3>
    <p style="color:var(--muted);font-size:13px;margin:-6px 0 10px">Errors from dealer panels and websites, sent automatically. Same error = one row with a count.</p>
    ${tbl([{ h: "Where", f: (e) => `<b>${esc(e.slug)}</b><span class="sub">${esc(e.where)}</span>` }, { h: "Error", f: (e) => `<span style="font-family:var(--mono);font-size:12px">${esc(e.message)}</span>${e.url ? `<span class="sub" style="overflow-wrap:anywhere">${esc(e.url)}</span>` : ""}${e.stack ? `<details><summary style="cursor:pointer;font-size:12px">details</summary><pre style="white-space:pre-wrap;font-size:11px">${esc(e.stack)}</pre></details>` : ""}` },
      { h: "Times", r: 1, f: (e) => e.count }, { h: "Last", f: (e) => ago(e.last) }, { h: "", f: (e) => `<button class="b sm" type="button" data-rmerr="${esc(e.id)}">✓ Fixed</button>` }], errs)}</div>`;
  $$("[data-open]").forEach((b) => (b.onclick = () => openPanel(b.dataset.open)));
  $$("[data-alias]").forEach((b) => (b.onclick = async () => { try { await api("/api/hq/status/" + b.dataset.alias, J("PUT", { aliasAdded: true })); toast("Marked done"); problems(V); } catch (x) { toast(err(x), 1); } }));
  $("#clrErr").onclick = async () => { if (!confirm("Clear the whole error log?")) return; await api("/api/hq/errors", { method: "DELETE" }); problems(V); };
  $$("[data-rmerr]").forEach((b) => (b.onclick = async () => { await api("/api/hq/errors/" + b.dataset.rmerr, { method: "DELETE" }); problems(V); }));
}

/* ---------- support: dealers' questions ---------- */
let tf = "open";
async function support(V) {
  const all = await api("/api/hq/tickets");
  const L = all.filter((t) => tf === "all" || (tf === "open" ? t.status === "open" : t.status === tf));
  V.innerHTML = `<div class="ph"><div><h1>Support</h1><p>Questions dealers sent from the Help page in their panel, and messages from the DealerVexa contact page.</p></div></div>
  <div class="bar"><div class="seg" id="tfSeg">${[["open", `Waiting (${all.filter((t) => t.status === "open").length})`], ["answered", "Answered"], ["closed", "Closed"], ["all", "All"]].map(([k, l]) => `<button type="button" data-k="${k}" class="${tf === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
  ${L.map((t) => `<div class="card" style="margin-bottom:12px"><h3>${esc(t.subject)} <span>${esc(t.slug)} · ${ago(t.updatedAt)}</span></h3>${t.page ? `<p style="color:var(--muted);font-size:12px;margin:-6px 0 6px">From the page: ${esc(t.page)}</p>` : ""}
    ${t.messages.map((mm) => `<div class="note" style="border-left-color:${mm.from === "hq" ? "var(--brand)" : "var(--line)"}"><b>${mm.from === "hq" ? "You (DealerVexa)" : t.contact ? esc(t.contact.name + (t.contact.dealer ? " · " + t.contact.dealer : "") + (t.contact.email ? " · " + t.contact.email : "")) : esc(t.slug)}</b> <small style="display:inline">${fdate(mm.at)}</small><div style="white-space:pre-wrap">${esc(mm.text)}</div></div>`).join("")}
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">${t.contact ? "" : `<input data-rep="${esc(t.id)}" placeholder="Write your answer…" style="flex:1 1 260px;border:1px solid var(--line);border-radius:6px;padding:9px;background:var(--panel)">`}
      ${t.contact ? `${t.contact.email ? `<a class="b primary" href="mailto:${esc(t.contact.email)}?subject=${encodeURIComponent("Re: DealerVexa")}">Reply by email</a>` : ""}${t.contact.phone ? `<a class="b" href="tel:${esc(t.contact.phone)}">Call ${esc(t.contact.phone)}</a>` : ""}` : `<button class="b primary" type="button" data-send="${esc(t.id)}">Answer</button><button class="b" type="button" data-open="${esc(t.slug)}">Open their panel</button>`}${t.status !== "closed" ? `<button class="b" type="button" data-close="${esc(t.id)}">Close</button>` : ""}</div></div>`).join("") || '<div class="card empty">No questions here.</div>'}`;
  $$("#tfSeg button").forEach((b) => (b.onclick = () => { tf = b.dataset.k; support(V); }));
  $$("[data-open]").forEach((b) => (b.onclick = () => openPanel(b.dataset.open)));
  $$("[data-send]").forEach((b) => (b.onclick = async () => { const i = $(`[data-rep="${b.dataset.send}"]`); if (!i.value.trim()) return; try { await api("/api/hq/tickets/" + b.dataset.send, J("PUT", { reply: i.value.trim() })); toast("Answer sent. The dealer sees it in Help."); support(V); } catch (x) { toast(err(x), 1); } }));
  $$("[data-close]").forEach((b) => (b.onclick = async () => { await api("/api/hq/tickets/" + b.dataset.close, J("PUT", { status: "closed" })); support(V); }));
}

/* ---------- sign-ups ---------- */
let sf = "open";
async function signups(V) {
  const all = await api("/api/hq/signups");
  const L = all.filter((s) => sf === "all" || (sf === "open" ? ["awaiting_payment", "payment_submitted"].includes(s.status) : s.status === sf));
  const st = (s) => ({ awaiting_payment: pill("Waiting for payment", "warn"), payment_submitted: pill("Paid · check it", "info"), approved: pill("Live", "ok"), rejected: pill("Rejected", "bad") }[s.status] || pill(s.status));
  V.innerHTML = `<div class="ph"><div><h1>Sign-ups</h1><p>Dealers who signed up at <a href="/signup" target="_blank" rel="noopener">${esc(location.host)}/signup</a>. Check the payment, then click Approve: their website and panel go live.</p></div></div>
  <div class="bar"><div class="seg" id="sfSeg">${[["open", "To handle"], ["approved", "Live"], ["rejected", "Rejected"], ["all", "All"]].map(([k, l]) => `<button type="button" data-k="${k}" class="${sf === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
  ${tbl([{ h: "Dealer", f: (s) => `<b>${esc(s.dealer)}</b><span class="sub">${esc(s.contact)} · ${esc(s.email)} · ${esc(s.phone)}</span><span class="sub">${esc([s.city, s.state].filter(Boolean).join(", "))} · /w/${esc(s.slug)} · ${esc(TEMPLATES[s.template]?.name || s.template)}</span>` },
    { h: "Plan", f: (s) => `${esc(planOf(s.plan)?.name || s.plan)}<span class="sub">${money(s.amount)}</span>` },
    { h: "Payment", f: (s) => s.txHash ? `${esc(s.coin)}<span class="sub" style="font-family:var(--mono);overflow-wrap:anywhere">${esc(s.txHash.slice(0, 18))}…</span><a href="${esc(EXPLORER(s.coin, s.txHash))}" target="_blank" rel="noopener">Check on the blockchain ↗</a>` : '<span style="color:var(--dim)">—</span>' },
    { h: "Status", f: (s) => `${st(s)}<span class="sub">${fdate(s.createdAt)}</span>` },
    { h: "", f: (s) => ["awaiting_payment", "payment_submitted"].includes(s.status) ? `<button class="b sm primary" type="button" data-ok="${esc(s.id)}">Approve</button> <button class="b sm danger" type="button" data-no="${esc(s.id)}">Reject</button>` : s.status === "approved" ? `<a class="b sm" href="/w/${esc(s.slug)}" target="_blank" rel="noopener">Site ↗</a>` : "" }], L)}`;
  $$("#sfSeg button").forEach((b) => (b.onclick = () => { sf = b.dataset.k; signups(V); }));
  $$("[data-ok]").forEach((b) => (b.onclick = async () => { const s = all.find((x) => x.id === b.dataset.ok);
    if (!s.txHash && !confirm("No payment was sent for this sign-up yet. Approve anyway?")) return;
    try { await api(`/api/hq/signups/${s.id}/approve`, { method: "POST" }); toast(`${s.dealer} is live!`); alert(`Send this to ${s.contact}:\n\nYour website: ${location.origin}/w/${s.slug}\nYour panel: ${location.origin}/w/${s.slug}/admin\n(log in with the password chosen at sign-up)`); signups(V); } catch (x) { toast(err(x), 1); } }));
  $$("[data-no]").forEach((b) => (b.onclick = async () => { if (!confirm("Reject this sign-up?")) return; try { await api(`/api/hq/signups/${b.dataset.no}`, J("PUT", { status: "rejected" })); signups(V); } catch (x) { toast(err(x), 1); } }));
}

/* ---------- invoices ---------- */
let invf = "open";
async function invoices(V) {
  const all = await api("/api/hq/invoices");
  const L = all.filter((i) => invf === "all" || (invf === "open" ? ["unpaid", "submitted"].includes(i.status) : i.status === invf));
  V.innerHTML = `<div class="ph"><div><h1>Invoices & payments</h1><p>Paid ${money(all.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0))} in total · open ${money(all.filter((i) => ["unpaid", "submitted"].includes(i.status)).reduce((s, i) => s + i.amount, 0))}</p></div></div>
  <div class="bar"><div class="seg" id="ifSeg">${[["open", "Open"], ["paid", "Paid"], ["void", "Cancelled"], ["all", "All"]].map(([k, l]) => `<button type="button" data-k="${k}" class="${invf === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
  ${tbl([{ h: "Dealer", f: (i) => `<b>${esc(i.slug)}</b><span class="sub">${esc(i.period || "")}</span>` }, { h: "Amount", r: 1, f: (i) => money(i.amount) },
    { h: "Payment", f: (i) => i.txHash ? `${esc(i.coin || "")} <a href="${esc(EXPLORER(i.coin, i.txHash))}" target="_blank" rel="noopener">check ↗</a>` : "—" },
    { h: "Status", f: (i) => (i.status === "paid" ? pill("Paid " + fdate(i.paidAt), "ok") : i.status === "submitted" ? pill("Dealer says paid", "info") : i.status === "void" ? pill("Cancelled") : pill("Unpaid", "warn")) },
    { h: "", f: (i) => ["unpaid", "submitted"].includes(i.status) ? `<button class="b sm primary" type="button" data-paid="${esc(i.id)}">Mark paid</button> <button class="b sm" type="button" data-void="${esc(i.id)}">Cancel</button>` : "" }], L)}`;
  $$("#ifSeg button").forEach((b) => (b.onclick = () => { invf = b.dataset.k; invoices(V); }));
  $$("[data-paid]").forEach((b) => (b.onclick = async () => { try { await api("/api/hq/invoices/" + b.dataset.paid, J("PUT", { status: "paid" })); toast("Marked paid. The dealer's paid-until date moved one month."); invoices(V); } catch (x) { toast(err(x), 1); } }));
  $$("[data-void]").forEach((b) => (b.onclick = async () => { if (!confirm("Cancel this invoice?")) return; try { await api("/api/hq/invoices/" + b.dataset.void, J("PUT", { status: "void" })); invoices(V); } catch (x) { toast(err(x), 1); } }));
}

/* ---------- domains bought through DealerVexa ---------- */
async function domains(V) {
  const r = await api("/api/hq/domains");
  const st = (x) => ({ awaiting_payment: pill("Waiting for payment", "warn"), paid: pill(r.porkbun ? "Paid · buying" : "Paid · buy it now", "bad"), registered: pill("Bought · connecting", "info"), connected: pill("Connected", "ok"), expired: pill("Payment page expired"), cancelled: pill("Cancelled") }[x.status] || pill(x.status));
  V.innerHTML = `<div class="ph"><div><h1>Domains</h1><p>Domains dealers asked to buy through DealerVexa.</p></div></div>
  ${r.porkbun ? '<div class="banner">Porkbun is linked: domains are bought automatically. USDC: the dealer pays Porkbun directly. Other coins: the dealer pays you, and when you mark the invoice paid the domain is bought from your Porkbun credit.</div>' : '<div class="banner warn">Porkbun is not linked: add PORKBUN_API_KEY and PORKBUN_SECRET_KEY in Netlify to buy domains automatically.</div>'}
  ${r.auto ? '<div class="banner">Netlify is linked: when you click "Bought, connect it", the domain is added to the site and its DNS zone is created automatically.</div>' : '<div class="banner warn">Netlify is not linked yet. Add NETLIFY_TOKEN and NETLIFY_SITE_ID in Netlify → Environment variables to connect domains automatically.</div>'}
  <div class="card" style="margin-bottom:14px"><b>How to buy:</b> in Netlify go to <b>Domains → Register a domain</b> (or your favourite registrar), buy the name for 1 year, then click <b>Bought, connect it</b> below. Domains bought in Netlify work straight away; others need the name servers shown to the dealer.</div>
  ${tbl([{ h: "Domain", f: (x) => `<b>${esc(x.domain)}</b><span class="sub">${esc(x.slug)} · ${fdate(x.createdAt)} · ${x.method === "usdc" ? "USDC direct" : "invoice"}</span>${x.lastError ? `<span class="sub" style="color:var(--bad)">${esc(x.lastError)}</span>` : ""}` }, { h: "Price", r: 1, f: (x) => "$" + (+x.price || 0).toFixed(2) }, { h: "Status", f: (x) => st(x) + (["paid", "registered"].includes(x.status) ? ` <button class="b sm" type="button" data-retry="${esc(x.id)}">↻ Retry</button>` : "") },
    { h: "", f: (x) => x.status === "paid" || x.status === "awaiting_payment" ? `<button class="b sm primary" type="button" data-done="${esc(x.id)}">Bought, connect it</button> <button class="b sm" type="button" data-cancel="${esc(x.id)}">Cancel</button>` : "" }], r.requests)}`;
  $$("[data-done]").forEach((b) => (b.onclick = async () => { if (!confirm("Did you buy this domain? It will be connected to the dealer's website now.")) return;
    try { await api(`/api/hq/domains/${b.dataset.done}/done`, { method: "POST" }); toast("Connected"); domains(V); } catch (x) { toast(err(x), 1); } }));
  $$("[data-cancel]").forEach((b) => (b.onclick = async () => { await api("/api/hq/domains/" + b.dataset.cancel, J("PUT", { status: "cancelled" })); domains(V); }));
  $$("[data-retry]").forEach((b) => (b.onclick = async () => { b.disabled = true; try { const x = await api(`/api/hq/domains/${b.dataset.retry}/retry`, { method: "POST" }); toast(x.status === "connected" ? "Connected" : x.lastError || "Still working", x.status !== "connected"); domains(V); } catch (x) { toast(err(x), 1); } }));
}

/* ---------- plans & wallets ---------- */
async function plans(V) {
  const c = await api("/api/hq/config"); CFG = c;
  V.innerHTML = `<div class="ph"><div><h1>Plans & wallets</h1><p>What dealers see and pay on the sign-up page.</p></div><div class="act"><button class="b primary" type="button" id="save">Save</button></div></div>
  <div class="card"><h3>Plans (USD per month)</h3>${c.plans.map((p, i) => `<div class="fg" style="margin-bottom:10px"><div class="f"><label>Name</label><input data-p="${i}|name" value="${esc(p.name)}"></div><div class="f"><label>Price</label><input type="number" data-p="${i}|price" value="${esc(p.price)}"></div><div class="f w2"><label>What's included</label><input data-p="${i}|desc" value="${esc(p.desc)}"></div></div>`).join("")}</div>
  <div class="card" style="margin-top:14px"><h3>Crypto wallets</h3><p style="color:var(--muted);font-size:13px;margin:-6px 0 10px">Paste your receiving addresses. Only filled-in coins are offered to dealers. Double-check every address: crypto sent to a wrong address can't be recovered.</p>
    <div class="fg">${Object.entries(c.wallets).map(([k, a]) => `<div class="f w2"><label>${esc(k)}</label><input data-w="${esc(k)}" value="${esc(a)}" style="font-family:var(--mono);font-size:13px"></div>`).join("")}</div></div>
  <div class="card" style="margin-top:14px"><div class="fg"><div class="f"><label>Your extra on domains paid in BTC / USDT / ETH… (USD)</label><input type="number" step="0.01" id="domF" value="${esc(c.domainFee ?? 0)}"></div><div class="f"><label>Domain price if Porkbun is not linked (USD / year)</label><input type="number" id="domP" value="${esc(c.domainPrice ?? 25)}"></div><div class="f"><label>Free dealer addresses: your domain (e.g. dealervexa.com → joesautos.dealervexa.com)</label><input id="subB" placeholder="dealervexa.com" value="${esc(c.subdomainBase || "")}"></div></div>
    <div class="fg" style="margin-top:10px"><div class="f w2"><label>Your e-mail for notifications (new sign-ups, payments, help requests, contact messages)</label><input type="email" id="ownE" value="${esc(c.ownerEmail || "")}" placeholder="you@gmail.com"></div></div>
    <p style="font-size:13px;margin:6px 0 0;color:${c.mailOn ? "var(--ok,#18794e)" : "var(--muted)"}">${c.mailOn ? "✓ E-mails are on: dealers get their links, invoices and receipts automatically." : "E-mails are off. To turn them on, add RESEND_API_KEY in Netlify → Environment variables (see the guide)."}</p>
    <label class="chk" style="margin-top:10px"><input type="checkbox" id="open" ${c.signupOpen ? "checked" : ""}> Sign-ups are open (the /signup page takes new dealers)</label></div>`;
  $("#save").onclick = async () => {
    const pl = c.plans.map((p) => ({ ...p })); $$("[data-p]").forEach((i) => { const [n, k] = i.dataset.p.split("|"); pl[+n][k] = k === "price" ? +i.value : i.value; });
    const w = {}; $$("[data-w]").forEach((i) => (w[i.dataset.w] = i.value.trim()));
    try { CFG = await api("/api/hq/config", J("PUT", { plans: pl, wallets: w, signupOpen: $("#open").checked, domainPrice: +$("#domP").value, domainFee: +$("#domF").value, subdomainBase: $("#subB").value, ownerEmail: $("#ownE").value })); toast("Saved"); } catch (x) { toast(err(x), 1); }
  };
}

/* ---------- links ---------- */
function links(V) {
  const o = location.origin, L = [["Sign-up page for dealers", "/signup"], ["Template gallery", "/templates"], ["Atlantic Auto Sales panel", "/panel/"], ["Atlantic Auto Sales website", "/"], ["Online credit application (Atlantic)", "/apply"]];
  V.innerHTML = `<div class="ph"><div><h1>Pages & links</h1></div></div><div class="card">${L.map(([l, u]) => `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)"><span><b>${esc(l)}</b><br><code style="font-size:13px">${esc(o + u)}</code></span><span style="display:flex;gap:6px"><a class="b sm" href="${esc(u)}" target="_blank" rel="noopener">Open ↗</a><button class="b sm" type="button" data-c="${esc(o + u)}">Copy</button></span></div>`).join("")}</div>`;
  $$("[data-c]").forEach((b) => (b.onclick = () => navigator.clipboard?.writeText(b.dataset.c).then(() => toast("Copied"))));
}

boot();
