import { getStore } from "@netlify/blobs";
import { json } from "../lib/auth.mjs";
import { readAll, writeAll, newId } from "../lib/db.mjs";

// POST /api/lead -> public: the website's contact and trade-in forms send customer requests here.
const clip = (v, n) => String(v ?? "").trim().slice(0, n);
export default async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let b;
  try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  if (b.website) return json({ ok: true }); // hidden honeypot field: bots fill it, people don't
  const lead = {
    type: ["contact", "trade", "viewing", "credit"].includes(b.type) ? b.type : "contact",
    name: clip(b.name, 120), phone: clip(b.phone, 40), email: clip(b.email, 160),
    message: clip(b.message, 4000), vin: clip(b.vin, 17), miles: clip(b.miles, 20), carId: clip(b.carId, 40),
    source: b.site ? "Website: " + clip(b.site, 60) : "Website", status: "new", notes: [],
  };
  if (b.credit && typeof b.credit === "object") lead.credit = Object.fromEntries(Object.entries(b.credit).slice(0, 30).map(([k, v]) => [clip(k, 30), clip(v, 200)]));
  if (!lead.name || (!lead.phone && !lead.email)) return json({ error: "missing_fields" }, 400);
  // messages sent from a dealer website go to that dealer's own admin
  const tenant = clip(b.tenant, 40);
  if (tenant) {
    if (!/^[a-z0-9-]+$/.test(tenant)) return json({ error: "bad_site" }, 400);
    const ts = getStore({ name: "tenants", consistency: "strong" });
    if (!(await ts.get("site/" + tenant, { type: "json" }))) return json({ error: "not_found" }, 404);
    const map = (await ts.get(`db/${tenant}/leads`, { type: "json" })) || {};
    if (Object.keys(map).length > 5000) return json({ error: "full" }, 507);
    const id = newId("L");
    map[id] = { ...lead, source: "Website", id, createdAt: new Date().toISOString() };
    await ts.setJSON(`db/${tenant}/leads`, map);
    return json({ ok: true });
  }
  await mailOut(req, lead);
  const all = await readAll("leads");
  if (Object.keys(all).length > 20000) return json({ error: "full" }, 507);
  const id = newId("L");
  all[id] = { ...lead, id, createdAt: new Date().toISOString() };
  await writeAll("leads", all);
  return json({ ok: true });
};

// Netlify Forms: the hidden "lead" form in index.html makes Netlify e-mail every message
// (Netlify → Forms → Form notifications → Email notification, one per address).
async function mailOut(req, lead) {
  const site = process.env.URL || new URL(req.url).origin;
  const label = { contact: "Contact message", trade: "Trade-in request", viewing: "Viewing / test drive", credit: "Credit application" }[lead.type] || "Message";
  const credit = lead.credit ? Object.entries(lead.credit).map(([k, v]) => `${k}: ${v}`).join("\n") : "";
  const f = { "form-name": "lead", subject: `Atlantic Auto Sales website: ${label} from ${lead.name}`, type: label, name: lead.name, phone: lead.phone, email: lead.email,
    message: [lead.message, credit].filter(Boolean).join("\n\n"), vin: lead.vin, miles: lead.miles, car: lead.carId };
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    await fetch(site + "/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(f).toString(), signal: ctl.signal });
    clearTimeout(t);
  } catch (_) { /* the lead is still saved in the dashboard */ }
}

export const config = { path: "/api/lead" };
