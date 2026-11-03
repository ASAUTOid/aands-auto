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
  if (!lead.name || (!lead.phone && !lead.email)) return json({ error: "missing_fields" }, 400);
  const all = await readAll("leads");
  if (Object.keys(all).length > 20000) return json({ error: "full" }, 507);
  const id = newId("L");
  all[id] = { ...lead, id, createdAt: new Date().toISOString() };
  await writeAll("leads", all);
  return json({ ok: true });
};

export const config = { path: "/api/lead" };
