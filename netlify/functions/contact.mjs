import { json } from "../lib/auth.mjs";
import { readMap, writeMap, newId } from "../lib/hq.mjs";

// POST /api/contact  { name, email, phone, dealer, message }  — the DealerVexa contact page.
// Each message becomes a ticket in HQ → Support (marked as a website contact, answered by email/phone).
const clip = (v, n) => String(v ?? "").trim().slice(0, n);
export default async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  if (b.website) return json({ ok: true }); // honeypot
  const c = { name: clip(b.name, 120), email: clip(b.email, 160), phone: clip(b.phone, 40), dealer: clip(b.dealer, 120) };
  const text = clip(b.message, 4000);
  if (!c.name || !text || (!c.email && !c.phone)) return json({ error: "missing_fields" }, 400);
  if (c.email && !/^\S+@\S+\.\S+$/.test(c.email)) return json({ error: "bad_email" }, 400);
  const all = await readMap("tickets");
  const recent = Object.values(all).filter((t) => t.contact && t.contact.email === c.email && Date.now() - Date.parse(t.createdAt) < 60_000);
  if (c.email && recent.length) return json({ ok: true });
  const now = new Date().toISOString(), id = newId("H");
  all[id] = { id, slug: "", contact: c, subject: "Website contact: " + (c.dealer || c.name), page: "/contact", status: "open", messages: [{ from: "visitor", text, at: now }], createdAt: now, updatedAt: now };
  await writeMap("tickets", all);
  return json({ ok: true });
};

export const config = { path: "/api/contact" };
