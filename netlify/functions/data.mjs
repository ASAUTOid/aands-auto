import { getStore } from "@netlify/blobs";
import { checkPassword, json } from "../lib/auth.mjs";

// GET  /api/data  -> the saved site data (cars + business details), or 204 if nothing saved yet
// PUT  /api/data  -> save new site data (admin password required)
export default async (req) => {
  const store = getStore({ name: "site", consistency: "strong" });

  if (req.method === "GET") {
    const data = await store.get("data", { type: "json" });
    if (!data) return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
    return json(data);
  }

  if (req.method === "PUT") {
    if (!(await checkPassword(req))) return json({ error: "unauthorized" }, 401);
    let data;
    try { data = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
    if (!data || !Array.isArray(data.cars) || typeof data.settings !== "object") {
      return json({ error: "bad_data" }, 400);
    }
    const raw = JSON.stringify(data);
    if (raw.length > 4_000_000) return json({ error: "too_large" }, 413);
    // keep the previous version as a backup before overwriting
    const prev = await store.get("data", { type: "text" });
    if (prev) await store.set("backup-" + new Date().toISOString(), prev);
    await store.set("data", raw);
    return json({ ok: true });
  }

  return json({ error: "method_not_allowed" }, 405);
};

export const config = { path: "/api/data" };
