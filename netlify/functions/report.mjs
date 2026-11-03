import { json } from "../lib/auth.mjs";
import { readMap, writeMap } from "../lib/hq.mjs";

// POST /api/report  { where, slug, message, stack, url }  — panels and websites send their errors here so HQ can see problems.
const clip = (v, n) => String(v ?? "").slice(0, n);
export default async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ ok: true }); }
  const msg = clip(b.message, 400); if (!msg) return json({ ok: true });
  const all = await readMap("errors"), key = clip(b.slug, 40) + "|" + msg;
  const now = new Date().toISOString();
  // same error from the same place: count it instead of storing it again
  const hit = Object.values(all).find((e) => e.key === key);
  if (hit) { hit.count = (hit.count || 1) + 1; hit.last = now; hit.url = clip(b.url, 300); }
  else {
    const id = "E" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    all[id] = { id, key, where: clip(b.where, 30), slug: clip(b.slug, 40), message: msg, stack: clip(b.stack, 1500), url: clip(b.url, 300), ua: clip(req.headers.get("user-agent"), 200), first: now, last: now, count: 1 };
    const ids = Object.values(all).sort((a, b) => (a.last || "").localeCompare(b.last || "")).map((e) => e.id);
    while (ids.length > 400) delete all[ids.shift()];
  }
  await writeMap("errors", all);
  return json({ ok: true });
};

export const config = { path: "/api/report" };
