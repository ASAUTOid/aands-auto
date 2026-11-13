// Automatic crypto payments through NOWPayments (https://nowpayments.io).
// Turned on by NOWPAYMENTS_API_KEY + NOWPAYMENTS_IPN_SECRET in Netlify. Without them, dealers pay to your wallets and you confirm by hand.
// The dealer picks the coin on the NOWPayments page; the money goes to the payout wallet set in your NOWPayments account.
import { createHmac, timingSafeEqual } from "node:crypto";

export const hasPay = () => !!(process.env.NOWPAYMENTS_API_KEY && process.env.NOWPAYMENTS_IPN_SECRET);
const base = () => (process.env.DVX_URL || process.env.URL || "https://dealervexa.com").replace(/\/$/, "");

// kind: "S" sign-up, "I" invoice
export async function createPayLink({ kind, id, amount, desc, back }) {
  const r = await fetch("https://api.nowpayments.io/v1/invoice", { method: "POST", headers: { "x-api-key": process.env.NOWPAYMENTS_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ price_amount: +(+amount).toFixed(2), price_currency: "usd", order_id: `${kind}:${id}`, order_description: String(desc || "DealerVexa").slice(0, 120),
      ipn_callback_url: base() + "/api/pay/ipn", success_url: base() + (back || "/login"), cancel_url: base() + (back || "/signup") }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.invoice_url) throw new Error(j.message || "Payment page could not be created (" + r.status + ")");
  return { payUrl: j.invoice_url, payId: String(j.id) };
}

// NOWPayments signs the JSON body (keys sorted, all levels) with HMAC-SHA512 and the IPN secret
const sortDeep = (o) => (Array.isArray(o) ? o.map(sortDeep) : o && typeof o === "object" ? Object.keys(o).sort().reduce((a, k) => ((a[k] = sortDeep(o[k])), a), {}) : o);
export function validIpn(bodyObj, sig) {
  if (!sig || !process.env.NOWPAYMENTS_IPN_SECRET) return false;
  const mine = createHmac("sha512", process.env.NOWPAYMENTS_IPN_SECRET).update(JSON.stringify(sortDeep(bodyObj))).digest("hex");
  const a = Buffer.from(mine), b = Buffer.from(String(sig).toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}
