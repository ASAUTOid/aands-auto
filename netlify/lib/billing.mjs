// Shared billing steps, used by HQ (manual approve / mark paid) and by the automatic crypto payments.
import { getConfig, readMap, writeMap, statusOf, setStatus, createDealer, newId } from "./hq.mjs";
import { advance } from "./domains.mjs";
import { mail } from "./mail.mjs";

export const addMonth = (d, n = 1) => { const x = d ? new Date(d) : new Date(); if (x < new Date()) x.setTime(Date.now()); x.setMonth(x.getMonth() + n); return x.toISOString().slice(0, 10); };

// turn a sign-up into a live dealer; pay = { coin, txHash } when known
export async function approveSignup(id, pay = {}) {
  const all = await readMap("signups"), s = all[id];
  if (!s) return { error: "not_found" };
  if (s.status === "approved") return { ok: true, slug: s.slug, already: true };
  try { await createDealer({ slug: s.slug, plan: s.plan, auth: s.auth, createdBy: "signup", settings: { name: s.dealer, phone: s.phone, email: s.email, city: s.city, state: s.state, template: s.template || "classic" } }); }
  catch (e) { return { error: e.message === "slug_taken" ? "That link name is taken. Change it on the sign-up first." : "Could not create the dealer." }; }
  const cfg = await getConfig(), plan = cfg.plans.find((p) => p.id === s.plan) || cfg.plans[0];
  await setStatus(s.slug, { paidUntil: addMonth(null, 1), contact: s.contact });
  const inv = await readMap("invoices"), iid = newId("I");
  inv[iid] = { id: iid, slug: s.slug, plan: plan?.id, amount: plan?.price || 0, period: "First month", status: "paid", coin: pay.coin || s.coin, txHash: pay.txHash || s.txHash, auto: !!pay.auto, createdAt: s.createdAt, paidAt: new Date().toISOString() };
  await writeMap("invoices", inv);
  Object.assign(s, { status: "approved", approvedAt: new Date().toISOString(), ...(pay.auto ? { coin: pay.coin, txHash: pay.txHash, autoPaid: true } : {}) }); delete s.auth;
  await writeMap("signups", all);
  await mail.approved(s);
  return { ok: true, slug: s.slug };
}

// an invoice was paid: extend the plan (or continue the domain purchase) and send the receipt
export async function markInvoicePaid(id, pay = {}) {
  const inv = await readMap("invoices"), i = inv[id];
  if (!i) return { error: "not_found" };
  if (i.status === "paid") return { ...i, already: true };
  Object.assign(i, { status: "paid", paidAt: new Date().toISOString(), ...(pay.coin ? { coin: pay.coin } : {}), ...(pay.txHash ? { txHash: pay.txHash } : {}), ...(pay.auto ? { auto: true } : {}) });
  await writeMap("invoices", inv);
  if (i.domainRequest) { const reqs = await readMap("domainRequests"); if (reqs[i.domainRequest]) { reqs[i.domainRequest].status = "paid"; await writeMap("domainRequests", reqs); await advance(i.domainRequest); } }
  else { const st = await statusOf(i.slug), until = addMonth(st.paidUntil, 1); await setStatus(i.slug, { paidUntil: until, suspended: false }); await mail.paid(i, until); }
  return i;
}
