import { checkPassword, json } from "../lib/auth.mjs";
import { tenants, hq, siteStore, getConfig, readMap, writeMap, statusOf, setStatus, createDealer, newId, hashPw, SLUG_RE, RESERVED, listDomain } from "../lib/hq.mjs";
import { hasNetlify, connectDomain } from "../lib/netlify.mjs";
import { hasPorkbun } from "../lib/porkbun.mjs";
import { advance } from "../lib/domains.mjs";

// DealerVexa HQ (owner only, HQ password)
// GET  /api/hq/overview                 every dealer with stats
// PUT  /api/hq/status/<slug>            { suspended, plan, paidUntil, notes }
// POST /api/hq/dealers                  create a dealer { slug, name, phone, email, …, password, plan, template }
// GET/PUT /api/hq/config                plans, crypto wallets, sign-ups open
// GET  /api/hq/signups                  sign-up requests
// POST /api/hq/signups/<id>/approve     create the dealer from a sign-up
// PUT  /api/hq/signups/<id>             { status, note }
// GET  /api/hq/invoices                 all invoices
// POST /api/hq/invoices                 { slug, plan, amount, period, note } new invoice
// PUT  /api/hq/invoices/<id>            { status: "paid" | "unpaid" | "void", txHash }
const body = async (req) => { try { return await req.json(); } catch { return undefined; } };
const addMonth = (d, n = 1) => { const x = d ? new Date(d) : new Date(); if (x < new Date()) x.setTime(Date.now()); x.setMonth(x.getMonth() + n); return x.toISOString().slice(0, 10); };

export default async (req, context) => {
  if (!(await checkPassword(req))) return json({ error: "unauthorized" }, 401);
  const { what, id, op } = context.params, m = req.method;

  if (what === "overview" && m === "GET") {
    const site = (await siteStore().get("data", { type: "json" })) || {};
    const list = (site.settings?.websites || []).filter((w) => w.tenant);
    const { blobs } = await tenants().list({ prefix: "site/" });
    const slugs = [...new Set([...list.map((w) => w.slug), ...blobs.map((b) => b.key.slice(5))])];
    const inv = Object.values(await readMap("invoices"));
    const out = await Promise.all(slugs.map(async (slug) => {
      const d = (await tenants().get("site/" + slug, { type: "json" })) || { settings: {}, cars: [] };
      const st = await statusOf(slug), leads = (await tenants().get(`db/${slug}/leads`, { type: "json" })) || {}, deals = (await tenants().get(`db/${slug}/deals`, { type: "json" })) || {};
      const w = list.find((x) => x.slug === slug) || {};
      const ftp = (await tenants().get("ftp/" + slug, { type: "json" })) || {};
      const ftpErrors = Object.entries(ftp).filter(([, c]) => c.lastError).map(([k, c]) => `${k}: ${c.lastError}`);
      const profile = [!d.settings.phone && "no phone number", !d.settings.logo && "no logo", !(d.settings.street || d.settings.city) && "no address", !d.cars.length && "no cars yet"].filter(Boolean);
      return { slug, name: d.settings.name || w.name || slug, domain: w.domain || "", template: d.settings.template, phone: d.settings.phone || "", email: d.settings.email || "", city: [d.settings.city, d.settings.state].filter(Boolean).join(", "),
        cars: d.cars.filter((c) => c.status === "lot" || c.status === "pending").length, carsTotal: d.cars.length, leads: Object.keys(leads).length, newLeads: Object.values(leads).filter((l) => l.status === "new").length,
        sold: Object.values(deals).filter((x) => x.status === "sold").length, ftpErrors, profile, ...st, unpaid: inv.filter((i) => i.slug === slug && i.status !== "paid" && i.status !== "void").length };
    }));
    const main = { name: site.settings?.name || "A & S Auto", cars: (site.cars || []).filter((c) => c.status === "lot" || c.status === "pending").length };
    return json({ dealers: out, main });
  }
  if (what === "status" && m === "PUT") {
    if (!SLUG_RE.test(id || "")) return json({ error: "bad_site" }, 400);
    const b = (await body(req)) || {}, patch = {};
    for (const k of ["suspended", "plan", "paidUntil", "notes", "aliasAdded"]) if (k in b) patch[k] = b[k];
    return json(await setStatus(id, patch));
  }
  if (what === "dealers" && m === "POST") {
    const b = (await body(req)) || {}; const slug = String(b.slug || "").toLowerCase();
    if (!SLUG_RE.test(slug) || RESERVED.has(slug)) return json({ error: "Pick another link name." }, 400);
    if (String(b.password || "").length < 8) return json({ error: "The password needs 8+ characters." }, 400);
    try {
      const s = await createDealer({ slug, plan: b.plan, auth: hashPw(String(b.password)), settings: { name: String(b.name || slug).slice(0, 80), phone: b.phone || "", email: b.email || "", street: b.street || "", city: b.city || "", state: b.state || "", zip: b.zip || "", logo: b.logo || "", template: b.template || "classic", domain: b.domain || "" } });
      if (b.domain) { const site = await siteStore().get("data", { type: "json" }); const w = site?.settings?.websites?.find((x) => x.slug === slug); if (w) { w.domain = b.domain; await siteStore().setJSON("data", site); } }
      return json({ ok: true, slug, settings: s });
    } catch (e) { return json({ error: e.message === "slug_taken" ? "That link name is taken." : "Could not create the dealer." }, 400); }
  }
  if (what === "config") {
    if (m === "GET") return json(await getConfig());
    if (m === "PUT") { const b = (await body(req)) || {}; const cur = await getConfig();
      const next = { ...cur, ...(b.plans ? { plans: b.plans.slice(0, 10).map((p) => ({ id: String(p.id || "").slice(0, 30), name: String(p.name || "").slice(0, 40), price: +p.price || 0, desc: String(p.desc || "").slice(0, 300) })) } : {}),
        ...(b.wallets ? { wallets: Object.fromEntries(Object.entries(b.wallets).slice(0, 12).map(([k, v]) => [String(k).slice(0, 30), String(v || "").trim().slice(0, 120)])) } : {}), ...("signupOpen" in b ? { signupOpen: !!b.signupOpen } : {}), ...("domainPrice" in b ? { domainPrice: +b.domainPrice || 0 } : {}), ...("domainFee" in b ? { domainFee: +b.domainFee || 0 } : {}), ...("subdomainBase" in b ? { subdomainBase: String(b.subdomainBase || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^\*?\.|^www\./g, "").replace(/\/.*$/, "").slice(0, 60) } : {}) };
      await hq().setJSON("config", next); return json(next); }
  }
  if (what === "signups") {
    const all = await readMap("signups");
    if (m === "GET" && !id) return json(Object.values(all).map(({ auth, ...x }) => x).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
    const s = all[id]; if (!s) return json({ error: "not_found" }, 404);
    if (op === "approve" && m === "POST") {
      try {
        await createDealer({ slug: s.slug, plan: s.plan, auth: s.auth, createdBy: "signup", settings: { name: s.dealer, phone: s.phone, email: s.email, city: s.city, state: s.state, template: s.template || "classic" } });
      } catch (e) { return json({ error: e.message === "slug_taken" ? "That link name is taken. Change it on the sign-up first." : "Could not create the dealer." }, 400); }
      const cfg = await getConfig(), plan = cfg.plans.find((p) => p.id === s.plan) || cfg.plans[0];
      await setStatus(s.slug, { paidUntil: addMonth(null, 1), contact: s.contact });
      const inv = await readMap("invoices"), iid = newId("I");
      inv[iid] = { id: iid, slug: s.slug, plan: plan?.id, amount: plan?.price || 0, period: "First month", status: "paid", coin: s.coin, txHash: s.txHash, createdAt: s.createdAt, paidAt: new Date().toISOString() };
      await writeMap("invoices", inv);
      s.status = "approved"; s.approvedAt = new Date().toISOString(); delete s.auth; await writeMap("signups", all);
      return json({ ok: true, slug: s.slug });
    }
    if (m === "PUT") { const b = (await body(req)) || {}; if (b.status) s.status = String(b.status).slice(0, 30); if ("note" in b) s.note = String(b.note || "").slice(0, 500); if (b.slug && SLUG_RE.test(b.slug)) s.slug = b.slug; await writeMap("signups", all); const { auth, ...x } = s; return json(x); }
  }
  if (what === "invoices") {
    const inv = await readMap("invoices");
    if (m === "GET") return json(Object.values(inv).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
    if (m === "POST") { const b = (await body(req)) || {}; if (!SLUG_RE.test(b.slug || "")) return json({ error: "bad_site" }, 400);
      const iid = newId("I"); inv[iid] = { id: iid, slug: b.slug, plan: String(b.plan || ""), amount: +b.amount || 0, period: String(b.period || "").slice(0, 60), note: String(b.note || "").slice(0, 300), status: "unpaid", createdAt: new Date().toISOString() };
      await writeMap("invoices", inv); return json(inv[iid]); }
    if (m === "PUT" && inv[id]) { const b = (await body(req)) || {}; const i = inv[id];
      if (b.status) { i.status = b.status; if (b.status === "paid") { i.paidAt = new Date().toISOString();
        if (i.domainRequest) { const reqs = await readMap("domainRequests"); if (reqs[i.domainRequest]) { reqs[i.domainRequest].status = "paid"; await writeMap("domainRequests", reqs); await writeMap("invoices", inv); await advance(i.domainRequest); } }
        else { const st = await statusOf(i.slug); await setStatus(i.slug, { paidUntil: addMonth(st.paidUntil, 1), suspended: false }); } } }
      if ("txHash" in b) i.txHash = String(b.txHash || "").slice(0, 200);
      await writeMap("invoices", inv); return json(i); }
  }
  if (what === "domains") {
    const reqs = await readMap("domainRequests");
    if (m === "GET") return json({ auto: hasNetlify(), porkbun: hasPorkbun(), requests: Object.values(reqs).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")) });
    // HQ bought the domain (in Netlify / the registrar): connect it to the dealer automatically
    if (m === "POST" && op === "done" && reqs[id]) { const r = reqs[id]; let ns = [];
      if (hasNetlify()) { try { ns = (await connectDomain(r.domain)).nameservers; } catch (e) { return json({ error: "Could not connect: " + e.message }, 502); } }
      await setStatus(r.slug, { domain: r.domain, nameservers: ns, domainAddedAt: new Date().toISOString() }); await listDomain(r.slug, r.domain);
      r.status = "connected"; r.doneAt = new Date().toISOString(); await writeMap("domainRequests", reqs); return json(r); }
    if (m === "POST" && op === "retry" && reqs[id]) return json(await advance(id));
    if (m === "PUT" && reqs[id]) { const b = (await body(req)) || {}; if (b.status) reqs[id].status = String(b.status).slice(0, 20); await writeMap("domainRequests", reqs); return json(reqs[id]); }
  }
  if (what === "errors") {
    const all = await readMap("errors");
    if (m === "GET") return json(Object.values(all).sort((a, b) => (b.last || "").localeCompare(a.last || "")));
    if (m === "DELETE") { if (id) delete all[id]; else for (const k of Object.keys(all)) delete all[k]; await writeMap("errors", all); return json({ ok: true }); }
  }
  if (what === "tickets") {
    const all = await readMap("tickets");
    if (m === "GET") return json(Object.values(all).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")));
    if (m === "PUT" && all[id]) { const b = (await body(req)) || {}, t = all[id], now = new Date().toISOString();
      if (b.reply) { t.messages.push({ from: "hq", text: String(b.reply).slice(0, 4000), at: now }); t.status = "answered"; }
      if (b.status) t.status = String(b.status).slice(0, 20); t.updatedAt = now;
      await writeMap("tickets", all); return json(t); }
  }
  return json({ error: "not_found" }, 404);
};

export const config = { path: ["/api/hq/:what", "/api/hq/:what/:id", "/api/hq/:what/:id/:op"] };
