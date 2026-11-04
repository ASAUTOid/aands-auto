// Domain purchases for dealers: Porkbun buys it, Netlify serves it, the dealer's website goes live on it.
import { readMap, writeMap, setStatus, listDomain } from "./hq.mjs";
import { hasNetlify, connectDomain } from "./netlify.mjs";
import { hasPorkbun, pbFinishPurchase, pbBuyFromCredit, pbSetNameservers } from "./porkbun.mjs";

// after the registration: create the Netlify zone, point the domain's name servers at it, list it for the dealer
export async function connectBought(r) {
  let ns = [];
  if (hasNetlify()) ns = (await connectDomain(r.domain)).nameservers;
  if (ns.length && hasPorkbun()) await pbSetNameservers(r.domain, ns);
  await setStatus(r.slug, { domain: r.domain, nameservers: ns, domainAddedAt: new Date().toISOString() });
  await listDomain(r.slug, r.domain);
  return ns;
}

// moves one request forward as far as it can go; safe to call again and again
export async function advance(id) {
  const reqs = await readMap("domainRequests"), r = reqs[id]; if (!r) return null;
  try {
    if (r.status === "awaiting_payment" && r.method === "usdc" && r.checkoutId) {
      const x = await pbFinishPurchase(r.domain, r.cents, r.checkoutId);
      if (x.state === "registered") { r.status = "registered"; r.registeredAt = new Date().toISOString(); }
      else if (x.state === "expired") r.status = "expired";
      else if (x.state === "error" || x.state === "mismatch") { r.lastError = x.message; }
    }
    if (r.status === "paid" && hasPorkbun() && r.cents) { // paid to DealerVexa in another coin: buy from the Porkbun credit
      const x = await pbBuyFromCredit(r.domain, r.cents, r.id);
      if (x.state === "registered") { r.status = "registered"; r.registeredAt = new Date().toISOString(); } else r.lastError = x.message;
    }
    if (r.status === "registered") { r.nameservers = await connectBought(r); r.status = "connected"; r.doneAt = new Date().toISOString(); r.lastError = null; }
  } catch (e) { r.lastError = String(e.message || e).slice(0, 300); }
  reqs[id] = r; await writeMap("domainRequests", reqs);
  return r;
}
