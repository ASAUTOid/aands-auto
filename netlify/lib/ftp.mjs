import { Client } from "basic-ftp";
import { Readable } from "node:stream";
import { buildFeed, FEED_NAMES } from "../../site/feeds.js";

// FTP settings per feed: { host, port, user, password, secure, dir, filename, auto, lastSent, lastError, lastCount }
// Passwords are kept in private storage and never sent back to the browser.
export const mask = (cfg) => Object.fromEntries(Object.entries(cfg || {}).map(([k, c]) => [k, { ...c, password: "", hasPassword: !!c.password }]));
export function merge(old, incoming) {
  const out = {};
  for (const k of FEED_NAMES) {
    const n = incoming?.[k], o = old?.[k];
    if (!n) { if (o) out[k] = o; continue; }
    out[k] = {
      host: String(n.host || "").trim().replace(/^s?ftps?:\/\//, "").replace(/\/.*$/, ""), port: +n.port || 21, user: String(n.user || "").trim(),
      password: n.password ? String(n.password) : o?.password || "", secure: !!n.secure, dir: String(n.dir || "").trim(), filename: String(n.filename || "").trim(),
      auto: !!n.auto, lastSent: o?.lastSent || null, lastError: o?.lastError || null, lastCount: o?.lastCount ?? null,
    };
  }
  return out;
}

// Upload one feed. Returns the updated config entry (with lastSent / lastError).
export async function sendFeed(data, name, cfg, base) {
  const feed = buildFeed(data, name, base);
  const now = new Date().toISOString();
  if (!feed) return { ...cfg, lastError: "Unknown feed", lastErrorAt: now };
  if (!cfg?.host || !cfg?.user) return { ...cfg, lastError: "Add the FTP server and user first", lastErrorAt: now };
  const client = new Client(20000);
  try {
    await client.access({ host: cfg.host, port: cfg.port || 21, user: cfg.user, password: cfg.password || "", secure: cfg.secure ? true : false, secureOptions: { rejectUnauthorized: false } });
    if (cfg.dir) await client.ensureDir(cfg.dir);
    await client.uploadFrom(Readable.from([feed.csv]), cfg.filename || feed.filename);
    return { ...cfg, lastSent: now, lastCount: feed.count, lastError: null };
  } catch (e) {
    return { ...cfg, lastError: String(e && e.message || e).slice(0, 300), lastErrorAt: now };
  } finally {
    client.close();
  }
}
