import { promises as dns } from "node:dns";

// Talks to the Netlify API to connect dealer domains to this site automatically.
// Needs two environment variables in Netlify: NETLIFY_TOKEN (personal access token) and NETLIFY_SITE_ID (this site's ID).
const API = "https://api.netlify.com/api/v1";
export const hasNetlify = () => !!(process.env.NETLIFY_TOKEN && (process.env.NETLIFY_SITE_ID || process.env.SITE_ID));
const siteId = () => process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
async function nf(path, opt = {}) {
  const r = await fetch(API + path, { ...opt, headers: { authorization: "Bearer " + process.env.NETLIFY_TOKEN, "content-type": "application/json", ...(opt.headers || {}) } });
  const text = await r.text(); let b = null; try { b = JSON.parse(text); } catch (_) {}
  if (!r.ok) { const e = new Error((b && (b.message || b.errors && JSON.stringify(b.errors))) || `Netlify ${r.status}`); e.status = r.status; throw e; }
  return b;
}
export const cleanDomain = (d) => String(d || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
export const validDomain = (d) => /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(d);

async function findZone(domain) {
  const zones = await nf("/dns_zones");
  return (zones || []).find((z) => z.name === domain) || null;
}
// adds domain + www to this site and creates a Netlify DNS zone; returns the nameservers the dealer must use
export async function connectDomain(domain) {
  const site = await nf(`/sites/${siteId()}`);
  const aliases = new Set(site.domain_aliases || []);
  const before = aliases.size; aliases.add(domain); aliases.add("www." + domain);
  if (aliases.size !== before) await nf(`/sites/${siteId()}`, { method: "PATCH", body: JSON.stringify({ domain_aliases: [...aliases] }) });
  let zone = await findZone(domain);
  if (!zone) zone = await nf("/dns_zones", { method: "POST", body: JSON.stringify({ name: domain, site_id: siteId(), account_slug: site.account_slug }) });
  return { nameservers: zone.dns_servers || [], zoneId: zone.id };
}
export async function disconnectDomain(domain) {
  const site = await nf(`/sites/${siteId()}`);
  const aliases = (site.domain_aliases || []).filter((a) => a !== domain && a !== "www." + domain);
  await nf(`/sites/${siteId()}`, { method: "PATCH", body: JSON.stringify({ domain_aliases: aliases }) });
  const zone = await findZone(domain); if (zone) await nf(`/dns_zones/${zone.id}`, { method: "DELETE" }).catch(() => {});
}
// is the dealer's domain using our nameservers yet?
export async function checkDomain(domain, expected = []) {
  let ns = []; try { ns = (await dns.resolveNs(domain)).map((x) => x.toLowerCase().replace(/\.$/, "")); } catch (_) {}
  const want = expected.map((x) => x.toLowerCase().replace(/\.$/, ""));
  const connected = want.length ? want.every((x) => ns.includes(x)) : false;
  return { nameserversNow: ns, connected };
}
// free / taken check through the public RDAP registry lookup
export async function domainAvailable(domain) {
  try { const r = await fetch("https://rdap.org/domain/" + encodeURIComponent(domain), { redirect: "follow" }); if (r.status === 404) return true; if (r.ok) return false; } catch (_) {}
  return null; // unknown
}
