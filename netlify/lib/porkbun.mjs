// Porkbun API v3: check, buy (paid by the dealer directly in USDC on a Coinbase page) and point domains at Netlify.
// Environment variables in Netlify: PORKBUN_API_KEY, PORKBUN_SECRET_KEY (API key with read, purchase and domains permissions).
import { randomUUID } from "node:crypto";
const API = "https://api.porkbun.com/api/json/v3";
export const hasPorkbun = () => !!(process.env.PORKBUN_API_KEY && process.env.PORKBUN_SECRET_KEY);
async function pb(path, body = {}, idem) {
  const r = await fetch(API + path, { method: "POST", headers: { "content-type": "application/json", ...(idem ? { "Idempotency-Key": idem } : {}) },
    body: JSON.stringify({ apikey: process.env.PORKBUN_API_KEY, secretapikey: process.env.PORKBUN_SECRET_KEY, ...body }) });
  let b = {}; try { b = await r.json(); } catch (_) {}
  return { http: r.status, ...b, headers: r.headers };
}
// look for a field anywhere in the answer (the payment details sit in the 402 body)
const find = (o, k) => { if (!o || typeof o !== "object") return undefined; if (k in o) return o[k]; for (const v of Object.values(o)) { const x = find(v, k); if (x !== undefined) return x; } return undefined; };

export async function pbCheck(domain) {
  const r = await pb("/domain/checkDomain/" + domain);
  if (r.status !== "SUCCESS") throw new Error(r.message || "Porkbun check failed");
  const x = r.response || {};
  return { available: x.avail === "yes", premium: x.premium === "yes", price: +x.price || null, renewal: +(x.additional?.renewal?.price) || null, cents: Math.round((+x.price || 0) * 100) };
}
// step 1: open a USDC checkout for the dealer; nothing is charged
export async function pbStartPurchase(domain, cents) {
  const r = await pb("/domain/create/" + domain, { cost: cents, agreeToTerms: "yes", payWith: "usdc" }, "dvx-open-" + domain + "-" + cents);
  if (r.status === "SUCCESS") return { done: true };
  if (r.http === 402 || r.code === "PAYMENT_REQUIRED") {
    const payUrl = find(r, "payUrl") || find(r, "x402Url"), checkoutId = find(r, "checkoutId") || find(r, "usdcCheckoutId");
    if (!payUrl || !checkoutId) throw new Error("Porkbun did not return a payment page");
    return { payUrl, checkoutId, expiresAt: find(r, "expiresAt") || null };
  }
  throw new Error(r.message || r.code || "Porkbun error");
}
// step 2: after the dealer paid, complete the registration (if the paid checkout already went to credit, buy from that credit)
export async function pbFinishPurchase(domain, cents, checkoutId) {
  let r = await pb("/domain/create/" + domain, { cost: cents, agreeToTerms: "yes", payWith: "usdc", usdcCheckoutId: checkoutId }, "dvx-done-" + checkoutId);
  if (r.status === "SUCCESS") return { state: "registered" };
  if (r.code === "PAYMENT_ALREADY_USED") { r = await pb("/domain/create/" + domain, { cost: cents, agreeToTerms: "yes" }, "dvx-credit-" + checkoutId); if (r.status === "SUCCESS") return { state: "registered" }; }
  if (r.code === "PAYMENT_PENDING") return { state: "pending", retryAfter: r.retryAfter || 30 };
  if (r.code === "PAYMENT_REQUIRED" || r.http === 402 || r.code === "PAYMENT_NOT_FOUND") return { state: "unpaid" };
  if (r.code === "PAYMENT_EXPIRED") return { state: "expired" };
  if (r.code === "PAYMENT_MISMATCH") return { state: "mismatch", message: r.message };
  return { state: "error", message: r.message || r.code || "Porkbun error" };
}
export async function pbSetNameservers(domain, ns) {
  const r = await pb("/domain/updateNs/" + domain, { ns }, "dvx-ns-" + domain + "-" + ns.join(","));
  if (r.status !== "SUCCESS") throw new Error(r.message || "Could not set the name servers");
  return true;
}
// buy from the Porkbun account credit (used when the dealer paid DealerVexa in USDT / BTC)
export async function pbBuyFromCredit(domain, cents, key) {
  const r = await pb("/domain/create/" + domain, { cost: cents, agreeToTerms: "yes" }, "dvx-credit-" + key);
  if (r.status === "SUCCESS") return { state: "registered" };
  return { state: "error", message: r.message || r.code || "Porkbun error" };
}
export const idem = () => randomUUID();
