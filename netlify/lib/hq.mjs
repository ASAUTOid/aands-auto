import { getStore } from "@netlify/blobs";
import { randomBytes, scryptSync } from "node:crypto";

// Shared helpers for the business side: dealer accounts, plans, sign-ups, invoices.
export const tenants = () => getStore({ name: "tenants", consistency: "strong" });
export const hq = () => getStore({ name: "hq", consistency: "strong" });
export const siteStore = () => getStore({ name: "site", consistency: "strong" });
export const SLUG_RE = /^[a-z0-9-]{2,40}$/;
export const RESERVED = new Set(["admin", "panel", "api", "hq", "signup", "apply", "templates", "inspection", "feeds", "photo", "w", "t", "img", "cut", "bg", "demo", "aands", "www", "app"]);

export const DEFAULT_CONFIG = {
  signupOpen: true,
  plans: [
    { id: "starter", name: "Starter", price: 49, desc: "Website, inventory, leads, AI photo studio, inspections." },
    { id: "pro", name: "Pro", price: 99, desc: "Everything in Starter + deals, buy-here-pay-here collections, exports to every listing site, FTP." },
    { id: "dealer-plus", name: "Dealer Plus", price: 179, desc: "Everything in Pro + your own domain set up for you, priority help." },
  ],
  wallets: { BTC: "", ETH: "", "USDT (TRC-20)": "", "USDT (ERC-20)": "", USDC: "" },
  trialDays: 0,
};
export async function getConfig() { return { ...DEFAULT_CONFIG, ...((await hq().get("config", { type: "json" })) || {}) }; }

export const hashPw = (pw) => { const salt = randomBytes(16); return { salt: salt.toString("hex"), hash: scryptSync(pw, salt, 32).toString("hex") }; };
export const newId = (p) => p + Date.now().toString(36) + randomBytes(3).toString("hex");
export async function readMap(key) { return (await hq().get(key, { type: "json" })) || {}; }
export async function writeMap(key, m) { await hq().setJSON(key, m); }
export async function statusOf(slug) { return (await tenants().get("status/" + slug, { type: "json" })) || {}; }
export async function setStatus(slug, patch) { const s = { ...(await statusOf(slug)), ...patch }; await tenants().setJSON("status/" + slug, s); return s; }

// Creates a dealer website + account (used by HQ "create dealer" and when a sign-up is approved)
export async function createDealer({ slug, settings, auth, plan, createdBy = "hq" }) {
  if (!SLUG_RE.test(slug) || RESERVED.has(slug)) throw new Error("bad_slug");
  if (await tenants().get("site/" + slug, { type: "json" })) throw new Error("slug_taken");
  const s = { hours: [["Monday – Friday", "9:00 AM – 6:00 PM"], ["Saturday", "10:00 AM – 4:00 PM"], ["Sunday", "Closed"]], apr: 12.9, feeds: {}, template: "classic", ...settings };
  await tenants().setJSON("site/" + slug, { settings: s, cars: [] });
  if (auth) await tenants().setJSON("auth/" + slug, auth);
  await setStatus(slug, { plan: plan || "starter", createdAt: new Date().toISOString(), createdBy, suspended: false });
  // list it on the platform so /w/<slug> and its domain work
  const site = (await siteStore().get("data", { type: "json" })) || null;
  if (site) {
    site.settings = site.settings || {}; site.settings.websites = site.settings.websites || [];
    if (!site.settings.websites.some((w) => w.slug === slug)) site.settings.websites.push({ id: newId("W"), slug, name: s.name, template: s.template, domain: s.domain || "", tenant: true });
    await siteStore().setJSON("data", site);
  }
  return s;
}
