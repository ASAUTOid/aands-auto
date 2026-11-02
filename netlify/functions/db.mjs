import { checkPassword, json } from "../lib/auth.mjs";
import { COLLECTIONS, readAll, writeAll } from "../lib/db.mjs";

// Admin-only storage for the dealer dashboard.
// GET    /api/db/<collection>        -> all records (array)
// PUT    /api/db/<collection>/<id>   -> create or replace one record
// DELETE /api/db/<collection>/<id>   -> delete one record
export default async (req, context) => {
  if (!(await checkPassword(req))) return json({ error: "unauthorized" }, 401);
  const { col, id } = context.params;
  if (!COLLECTIONS.includes(col)) return json({ error: "unknown_collection" }, 404);

  if (req.method === "GET" && !id) return json(Object.values(await readAll(col)));

  if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return json({ error: "bad_id" }, 400);
  const all = await readAll(col);

  if (req.method === "PUT") {
    let rec;
    try { rec = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
    if (!rec || typeof rec !== "object" || Array.isArray(rec)) return json({ error: "bad_record" }, 400);
    if (JSON.stringify(rec).length > 200_000) return json({ error: "too_large" }, 413);
    all[id] = { ...rec, id, updatedAt: new Date().toISOString(), createdAt: all[id]?.createdAt || rec.createdAt || new Date().toISOString() };
    await writeAll(col, all);
    return json(all[id]);
  }
  if (req.method === "DELETE") {
    delete all[id];
    await writeAll(col, all);
    return json({ ok: true });
  }
  return json({ error: "method_not_allowed" }, 405);
};

export const config = { path: ["/api/db/:col", "/api/db/:col/:id"] };
