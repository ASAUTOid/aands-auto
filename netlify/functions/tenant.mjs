import { getStore } from "@netlify/blobs";
import { randomUUID, scryptSync, createHash, timingSafeEqual } from "node:crypto";
import { checkPassword, json } from "../lib/auth.mjs";
import { mask, merge, sendFeed } from "../lib/ftp.mjs";
import { COLLECTIONS } from "../lib/db.mjs";
import { hashPw, statusOf, setStatus, readMap, writeMap, newId, getConfig, listDomain } from "../lib/hq.mjs";
import { hasNetlify, connectDomain, disconnectDomain, checkDomain, domainAvailable, cleanDomain, validDomain, dnsRecords } from "../lib/netlify.mjs";
import { hasPorkbun, pbCheck, pbStartPurchase } from "../lib/porkbun.mjs";
import { advance } from "../lib/domains.mjs";
import { mail } from "../lib/mail.mjs";

// Everything for one dealer on the platform. The owner (HQ password) can do everything; the dealer uses their own password.
// GET    /api/t/<slug>/data              public: settings + cars (+ suspended flag)
// PUT    /api/t/<slug>/data              save settings + cars
// DELETE /api/t/<slug>/data              delete the dealer (HQ only)
// POST   /api/t/<slug>/login             check a password -> { role: "owner" | "dealer" }
// POST   /api/t/<slug>/password          { newPassword }
// POST   /api/t/<slug>/upload            photo / logo / PDF
// GET    /api/t/<slug>/db/<col>          dealer records (leads, customers, deals, payments, …)
// PUT    /api/t/<slug>/db/<col>/<id>     create / replace one record
// DELETE /api/t/<slug>/db/<col>/<id>
// GET/PUT /api/t/<slug>/ftp, POST /api/t/<slug>/ftpsend   FTP delivery of feeds
// GET    /api/t/<slug>/billing           plan, invoices, wallets
// POST   /api/t/<slug>/billing           { invoiceId, coin, txHash } "I paid"
const store = () => getStore({ name: "tenants", consistency: "strong" });
const same = (a, b) => timingSafeEqual(createHash("sha256").update(String(a)).digest(), createHash("sha256").update(String(b)).digest());
const TYPES = { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg", "application/pdf": "pdf" };

async function role(req, slug) {
  if (await checkPassword(req)) return "owner";
  const pw = req.headers.get("x-admin-password") || "";
  const auth = pw && (await store().get("auth/" + slug, { type: "json" }));
  if (auth && same(scryptSync(pw, Buffer.from(auth.salt, "hex"), 32).toString("hex"), auth.hash)) return "dealer";
  return null;
}
const body = async (req) => { try { return await req.json(); } catch { return undefined; } };
// legacy: messages used to live in leads/<slug>; fold them into the records
async function readCol(slug, col) {
  const m = (await store().get(`db/${slug}/${col}`, { type: "json" })) || {};
  if (col === "leads") { const old = (await store().get("leads/" + slug, { type: "json" })) || {}; for (const [k, v] of Object.entries(old)) if (!m[k]) m[k] = { notes: [], source: "Website", ...v }; }
  return m;
}

export default async (req, context) => {
  const { slug, action = "db", col, id } = context.params;
  if (!/^[a-z0-9-]{1,40}$/.test(slug || "")) return json({ error: "bad_site" }, 400);
  const key = "site/" + slug, m = req.method;

  if (action === "data" && m === "GET") {
    const d = await store().get(key, { type: "json" });
    if (!d) return json({ error: "not_found" }, 404);
    const st = await statusOf(slug);
    return json(st.suspended ? { ...d, suspended: true } : d);
  }
  const who = await role(req, slug);
  if (who === "dealer" && (await statusOf(slug)).suspended && action !== "billing" && action !== "login") return json({ error: "suspended" }, 403);
  if (action === "login" && m === "POST") {
    if (!who) return json({ error: "unauthorized" }, 401);
    const st = await statusOf(slug);
    if (who === "dealer") await setStatus(slug, { lastLogin: new Date().toISOString() });
    return json({ ok: true, role: who, suspended: !!st.suspended });
  }
  if (!who) return json({ error: "unauthorized" }, 401);
  const touch = () => (who === "dealer" ? setStatus(slug, { lastActive: new Date().toISOString() }) : null);

  if (action === "data" && m === "PUT") {
    const d = await body(req);
    if (!d || typeof d.settings !== "object" || !Array.isArray(d.cars)) return json({ error: "bad_data" }, 400);
    if (JSON.stringify(d).length > 4_000_000) return json({ error: "too_large" }, 413);
    if (who !== "owner" && !(await store().get(key, { type: "json" }))) return json({ error: "not_found" }, 404);
    delete d.suspended;
    await store().setJSON(key, d); await touch();
    return json({ ok: true });
  }
  if (action === "data" && m === "DELETE") {
    if (who !== "owner") return json({ error: "forbidden" }, 403);
    const { blobs } = await store().list({ prefix: `db/${slug}/` });
    await Promise.all([key, "auth/" + slug, "leads/" + slug, "ftp/" + slug, "status/" + slug, ...blobs.map((b) => b.key)].map((k) => store().delete(k)));
    return json({ ok: true });
  }
  if (action === "password" && m === "POST") {
    const b = await body(req); const pw = String(b?.newPassword || "");
    if (pw.length < 8) return json({ error: "too_short" }, 400);
    await store().setJSON("auth/" + slug, hashPw(pw));
    return json({ ok: true });
  }
  if (action === "upload" && m === "POST") {
    const type = (req.headers.get("content-type") || "").split(";")[0].trim();
    if (!TYPES[type]) return json({ error: "unsupported_type" }, 415);
    const buf = await req.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > 8_000_000) return json({ error: "bad_size" }, 413);
    const pid = randomUUID().replace(/-/g, "") + "." + TYPES[type];
    await getStore("photos").set(pid, buf, { metadata: { contentType: type } });
    return json({ url: "/photo/" + pid });
  }
  if (action === "db") {
    if (!COLLECTIONS.includes(col)) return json({ error: "unknown_collection" }, 404);
    if (m === "GET" && !id) return json(Object.values(await readCol(slug, col)));
    if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return json({ error: "bad_id" }, 400);
    const all = await readCol(slug, col);
    if (m === "PUT") {
      const rec = await body(req);
      if (!rec || typeof rec !== "object" || Array.isArray(rec)) return json({ error: "bad_record" }, 400);
      if (JSON.stringify(rec).length > 200_000) return json({ error: "too_large" }, 413);
      all[id] = { ...rec, id, updatedAt: new Date().toISOString(), createdAt: all[id]?.createdAt || rec.createdAt || new Date().toISOString() };
      await store().setJSON(`db/${slug}/${col}`, all); await touch();
      return json(all[id]);
    }
    if (m === "DELETE") { delete all[id]; await store().setJSON(`db/${slug}/${col}`, all); if (col === "leads") { const old = (await store().get("leads/" + slug, { type: "json" })) || {}; if (old[id]) { delete old[id]; await store().setJSON("leads/" + slug, old); } } return json({ ok: true }); }
  }
  // old simple admin
  if (action === "leads" && m === "GET") return json(Object.values(await readCol(slug, "leads")));
  if (action === "ftp") {
    const cfg = (await store().get("ftp/" + slug, { type: "json" })) || {};
    if (m === "GET") return json(mask(cfg));
    if (m === "PUT") { const b = await body(req); if (!b) return json({ error: "bad_json" }, 400); const next = merge(cfg, b); await store().setJSON("ftp/" + slug, next); return json(mask(next)); }
  }
  if (action === "ftpsend" && m === "POST") {
    const b = await body(req); if (!b) return json({ error: "bad_json" }, 400);
    const name = String(b.feed || ""), cfg = (await store().get("ftp/" + slug, { type: "json" })) || {};
    const td = await store().get(key, { type: "json" });
    if (!td) return json({ error: "not_found" }, 404);
    if (!cfg[name]) return json({ error: "Save the FTP details for this feed first." }, 400);
    cfg[name] = await sendFeed(td, name, cfg[name], b.base && /^https:\/\/[a-z0-9.-]+(\/w\/[a-z0-9-]+)?$/.test(b.base) ? b.base : new URL(req.url).origin + "/w/" + slug);
    await store().setJSON("ftp/" + slug, cfg);
    return json(mask(cfg)[name]);
  }
  // Domain: connect the dealer's own domain automatically (Netlify API), check it, or ask to buy one through DealerVexa
  if (action === "domain") {
    const st = await statusOf(slug);
    if (m === "GET") { const out = { domain: st.domain || "", nameservers: st.nameservers || [], records: dnsRecords(), auto: hasNetlify(), buy: hasPorkbun(), free: (await getConfig()).subdomainBase ? `${slug}.${(await getConfig()).subdomainBase}` : "", requests: Object.values(await readMap("domainRequests")).filter((x) => x.slug === slug) };
      if (st.domain) Object.assign(out, await checkDomain(st.domain, st.nameservers || [])); return json(out); }
    if (m === "POST") {
      const b = await body(req), domain = cleanDomain(b?.domain);
      if (!validDomain(domain)) return json({ error: "That doesn't look like a domain (example: joesautos.com)." }, 400);
      let ns = [];
      if (hasNetlify()) { try { ns = (await connectDomain(domain)).nameservers; } catch (e) { return json({ error: "Could not connect the domain: " + e.message }, 502); } }
      await setStatus(slug, { domain, nameservers: ns, domainAddedAt: new Date().toISOString(), aliasAdded: hasNetlify() });
      await listDomain(slug, domain);
      return json({ domain, nameservers: ns, records: dnsRecords(), auto: hasNetlify() });
    }
    if (m === "DELETE") { if (st.domain && hasNetlify()) await disconnectDomain(st.domain).catch(() => {}); await setStatus(slug, { domain: "", nameservers: [] }); await listDomain(slug, ""); return json({ ok: true }); }
  }
  if (action === "domaincheck" && m === "GET") {
    const d = cleanDomain(new URL(req.url).searchParams.get("name")); if (!validDomain(d)) return json({ error: "bad_domain" }, 400);
    const cfg = await getConfig(), fee = +cfg.domainFee || 0;
    if (hasPorkbun()) { try { const x = await pbCheck(d); return json({ domain: d, available: x.available && !x.premium, premium: x.premium, price: x.price, renewal: x.renewal, priceOther: x.price ? +(x.price + fee).toFixed(2) : null, usdc: true }); } catch (e) { return json({ error: e.message }, 502); } }
    return json({ domain: d, available: await domainAvailable(d), price: null, priceOther: cfg.domainPrice ?? 25, usdc: false });
  }
  // buy: "usdc" = the dealer pays Porkbun directly on a Coinbase page (automatic); "invoice" = pays DealerVexa in BTC / USDT / ETH / SOL / XRP …
  if (action === "domainbuy" && m === "POST") {
    const b = await body(req), d = cleanDomain(b?.domain); if (!validDomain(d)) return json({ error: "bad_domain" }, 400);
    const cfg = await getConfig(), reqs = await readMap("domainRequests"), rid = newId("R"), now = new Date().toISOString();
    let price = cfg.domainPrice ?? 25, cents = 0;
    if (hasPorkbun()) { const x = await pbCheck(d); if (!x.available || x.premium) return json({ error: "That domain is not available." }, 400); price = x.price; cents = x.cents; }
    if (b.method === "usdc") {
      if (!hasPorkbun()) return json({ error: "Direct USDC payment is not set up yet." }, 400);
      let p; try { p = await pbStartPurchase(d, cents); } catch (e) { return json({ error: e.message }, 502); }
      reqs[rid] = { id: rid, slug, domain: d, price, cents, method: "usdc", checkoutId: p.checkoutId, payUrl: p.payUrl, status: p.done ? "registered" : "awaiting_payment", createdAt: now };
      await writeMap("domainRequests", reqs);
      if (p.done) await advance(rid);
      return json(reqs[rid]);
    }
    const total = +(price + (+cfg.domainFee || 0)).toFixed(2), inv = await readMap("invoices"), iid = newId("I");
    inv[iid] = { id: iid, slug, plan: "domain", amount: total, period: `Domain ${d} (1 year)`, status: "unpaid", createdAt: now, domainRequest: rid };
    reqs[rid] = { id: rid, slug, domain: d, price: total, cents, method: "invoice", invoiceId: iid, status: "awaiting_payment", createdAt: now };
    await writeMap("invoices", inv); await writeMap("domainRequests", reqs);
    return json(reqs[rid]);
  }
  // "I've paid" on the Coinbase page: finish the purchase and connect the domain
  if (action === "domainconfirm" && m === "POST") {
    const b = await body(req), reqs = await readMap("domainRequests"), r = reqs[String(b?.id || "")];
    if (!r || r.slug !== slug) return json({ error: "not_found" }, 404);
    return json(await advance(r.id));
  }
  // Help: the dealer writes to DealerVexa, HQ answers
  if (action === "help") {
    const all = await readMap("tickets");
    if (m === "GET") return json(Object.values(all).filter((t) => t.slug === slug).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")));
    if (m === "POST") {
      const b = await body(req); const text = String(b?.text || "").trim().slice(0, 4000); if (!text) return json({ error: "empty" }, 400);
      const now = new Date().toISOString(); let newT = null;
      if (b.ticketId && all[b.ticketId] && all[b.ticketId].slug === slug) { const t = all[b.ticketId]; t.messages.push({ from: who === "owner" ? "hq" : "dealer", text, at: now }); t.status = who === "owner" ? "answered" : "open"; t.updatedAt = now; }
      else { const tid = newId("H"); newT = tid; all[tid] = { id: tid, slug, subject: String(b.subject || text.slice(0, 60)).slice(0, 120), page: String(b.page || "").slice(0, 200), status: "open", messages: [{ from: "dealer", text, at: now }], createdAt: now, updatedAt: now }; }
      await writeMap("tickets", all); if (newT && who === "dealer") await mail.newTicket(all[newT], text, false);
      return json({ ok: true });
    }
  }
  if (action === "billing") {
    const cfg = await getConfig(), inv = await readMap("invoices"), st = await statusOf(slug);
    if (m === "GET") return json({ status: { plan: st.plan, paidUntil: st.paidUntil || null, suspended: !!st.suspended }, plans: cfg.plans, wallets: cfg.wallets, invoices: Object.values(inv).filter((i) => i.slug === slug).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")) });
    if (m === "POST") {
      const b = await body(req); const i = inv[String(b?.invoiceId || "")];
      if (!i || i.slug !== slug) return json({ error: "not_found" }, 404);
      if (i.status === "paid") return json({ error: "already_paid" }, 400);
      Object.assign(i, { status: "submitted", coin: String(b.coin || "").slice(0, 30), txHash: String(b.txHash || "").trim().slice(0, 200), submittedAt: new Date().toISOString() });
      await writeMap("invoices", inv);
      return json(i);
    }
  }
  return json({ error: "not_found" }, 404);
};

export const config = { path: ["/api/t/:slug/:action", "/api/t/:slug/db/:col", "/api/t/:slug/db/:col/:id"] };
