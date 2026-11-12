import { json } from "../lib/auth.mjs";
import { mail } from "../lib/mail.mjs";
import { tenants, getConfig, readMap, writeMap, newId, hashPw, SLUG_RE, RESERVED } from "../lib/hq.mjs";

// Public DealerVexa sign-up
// GET  /api/signup                   plans, wallets, open or not
// POST /api/signup                   new dealer request -> { id, amount, wallets }
// POST /api/signup/<id>              { coin, txHash } "I paid"
// GET  /api/signup/check?slug=x      is this link name free?
const clip = (v, n) => String(v ?? "").trim().slice(0, n);
export default async (req, context) => {
  const cfg = await getConfig(), id = context.params.id, m = req.method;
  if (m === "GET" && id === "check") {
    const slug = new URL(req.url).searchParams.get("slug") || "";
    const ok = SLUG_RE.test(slug) && !RESERVED.has(slug) && !(await tenants().get("site/" + slug, { type: "json" })) && !Object.values(await readMap("signups")).some((s) => s.slug === slug && s.status !== "rejected");
    return json({ ok });
  }
  if (m === "GET") return json({ open: cfg.signupOpen, plans: cfg.plans, wallets: Object.fromEntries(Object.entries(cfg.wallets).filter(([, v]) => v)) });
  if (m !== "POST") return json({ error: "method_not_allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const all = await readMap("signups");
  if (id) {
    const s = all[id]; if (!s) return json({ error: "not_found" }, 404);
    if (s.status !== "awaiting_payment" && s.status !== "payment_submitted") return json({ error: "closed" }, 400);
    Object.assign(s, { coin: clip(b.coin, 30), txHash: clip(b.txHash, 200), status: "payment_submitted", paidAt: new Date().toISOString() });
    await writeMap("signups", all);
    await mail.paymentSubmitted(s);
    return json({ ok: true });
  }
  if (!cfg.signupOpen) return json({ error: "Sign-ups are closed right now." }, 403);
  if (b.website) return json({ ok: true }); // bots
  const slug = clip(b.slug, 40).toLowerCase(), plan = cfg.plans.find((p) => p.id === b.plan) || cfg.plans[0];
  if (!clip(b.dealer, 80) || !clip(b.contact, 80) || !clip(b.email, 160) || !clip(b.phone, 40)) return json({ error: "Please fill in all the required fields." }, 400);
  if (!SLUG_RE.test(slug) || RESERVED.has(slug)) return json({ error: "Pick another website link (letters, numbers and dashes)." }, 400);
  if (await tenants().get("site/" + slug, { type: "json" }) || Object.values(all).some((s) => s.slug === slug && s.status !== "rejected")) return json({ error: "That website link is taken. Pick another one." }, 400);
  if (String(b.password || "").length < 8) return json({ error: "The password needs at least 8 characters." }, 400);
  if (Object.keys(all).length > 5000) return json({ error: "full" }, 507);
  const sid = newId("S");
  all[sid] = { id: sid, dealer: clip(b.dealer, 80), contact: clip(b.contact, 80), email: clip(b.email, 160), phone: clip(b.phone, 40), city: clip(b.city, 60), state: clip(b.state, 30), slug, template: clip(b.template, 30) || "classic",
    plan: plan?.id, amount: plan?.price || 0, status: "awaiting_payment", createdAt: new Date().toISOString(), auth: hashPw(String(b.password)) };
  await writeMap("signups", all);
  await mail.signupReceived({ ...all[sid], plan: plan?.name });
  return json({ id: sid, amount: plan?.price || 0, plan: plan?.name, wallets: Object.fromEntries(Object.entries(cfg.wallets).filter(([, v]) => v)) });
};

export const config = { path: ["/api/signup", "/api/signup/:id"] };
