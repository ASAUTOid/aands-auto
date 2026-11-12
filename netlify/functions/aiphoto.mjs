import { randomUUID } from "node:crypto";
import { json } from "../lib/auth.mjs";
import { hasAI, who, usage, jobs, safePath, PRESETS } from "../lib/ai.mjs";

// AI scene photos
// GET  /api/ai/photo?slug=x            { on, used, limit, presets }
// GET  /api/ai/photo?slug=x&id=JOB     { status: working | done | error, url, error }
// POST /api/ai/photo { slug, photo, scene | preset, hint }  -> { id }   (the picture is made in the background)
export default async (req) => {
  const u = new URL(req.url), m = req.method;
  let b = {}; if (m === "POST") { try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); } }
  const slug = String((m === "POST" ? b.slug : u.searchParams.get("slug")) || "").toLowerCase();
  if (slug && !/^[a-z0-9-]{1,40}$/.test(slug)) return json({ error: "bad_site" }, 400);
  const role = await who(req, slug); if (!role) return json({ error: "unauthorized" }, 401);
  if (m === "GET") {
    const id = u.searchParams.get("id");
    if (id) { const j = /^[a-f0-9]{32}$/.test(id) && (await jobs().get(id, { type: "json" })); if (!j || j.slug !== slug) return json({ error: "not_found" }, 404);
      if (j.status === "working" && Date.now() - Date.parse(j.createdAt) > 180_000) return json({ status: "error", error: "This took too long. Please try again." });
      return json({ status: j.status, url: j.url, error: j.error }); }
    return json({ on: hasAI(), ...(await usage(slug)), presets: Object.keys(PRESETS) });
  }
  if (m !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!hasAI()) return json({ error: "AI photos are not turned on yet." }, 400);
  const photo = safePath(b.photo), scene = b.scene ? safePath(b.scene) : null;
  if (!photo || (b.scene && !scene)) return json({ error: "Save the photo first, then try again." }, 400);
  const us = await usage(slug);
  if (role !== "owner" && us.limit != null && us.used >= us.limit) return json({ error: `You used all ${us.limit} AI photos for this month. Ask us for more, or wait for next month.` }, 429);
  const id = randomUUID().replace(/-/g, "");
  await jobs().setJSON(id, { id, slug, photo, scene, preset: String(b.preset || "").slice(0, 20), hint: String(b.hint || "").slice(0, 200), status: "queued", createdAt: new Date().toISOString() });
  // hand over to the background function (it may run for minutes; this call returns at once)
  const r = await fetch(new URL("/.netlify/functions/aiphoto-background", process.env.URL || req.url), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null);
  if (!r || (r.status !== 202 && !r.ok)) { await jobs().delete(id); return json({ error: "Could not start the AI. Please try again." }, 502); }
  return json({ id });
};

export const config = { path: "/api/ai/photo" };
