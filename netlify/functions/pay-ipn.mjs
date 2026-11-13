import { json } from "../lib/auth.mjs";
import { readMap, writeMap } from "../lib/hq.mjs";
import { validIpn } from "../lib/pay.mjs";
import { approveSignup, markInvoicePaid } from "../lib/billing.mjs";

// POST /api/pay/ipn  — NOWPayments tells us about a payment. Only a correctly signed message with status
// "finished" and the full amount turns an account on or marks an invoice paid.
export default async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  if (!validIpn(b, req.headers.get("x-nowpayments-sig"))) return json({ error: "bad_signature" }, 401);
  const [kind, id] = String(b.order_id || "").split(":"), status = String(b.payment_status || "");
  const pay = { coin: String(b.pay_currency || "").toUpperCase().slice(0, 20), txHash: "NOWPayments #" + String(b.payment_id || "").slice(0, 40), auto: true };
  const paid = +b.price_amount || 0;
  if (kind === "S") {
    const all = await readMap("signups"), s = all[id]; if (!s) return json({ ok: true });
    if (status === "finished" && paid + 0.01 >= (+s.amount || 0)) { const r = await approveSignup(id, pay); return json(r.error ? { ok: false, error: r.error } : { ok: true }); }
    if (s.status === "awaiting_payment" || s.status === "payment_submitted") { s.payStatus = status; await writeMap("signups", all); }
  } else if (kind === "I") {
    const inv = await readMap("invoices"), i = inv[id]; if (!i) return json({ ok: true });
    if (status === "finished" && paid + 0.01 >= (+i.amount || 0)) { await markInvoicePaid(id, pay); return json({ ok: true }); }
    if (i.status !== "paid") { i.payStatus = status; await writeMap("invoices", inv); }
  }
  return json({ ok: true });
};

export const config = { path: "/api/pay/ipn" };
