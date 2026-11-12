import { getStore } from "@netlify/blobs";
import { checkPassword, json } from "../lib/auth.mjs";
import { SEED_VERSION, OLD_IDS, ADD_FRONT, ADD_BACK, SETTINGS_UPDATE, REBRAND, ATLANTIC_CARS } from "../lib/seed-cars.mjs";

// GET  /api/data  -> the saved site data (cars + business details), or 204 if nothing saved yet
// PUT  /api/data  -> save new site data (admin password required)
export default async (req) => {
  const store = getStore({ name: "site", consistency: "strong" });

  if (req.method === "GET") {
    const data = await store.get("data", { type: "json" });
    if (!data) return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
    // one-time clean-up of the saved data (see seed-cars.mjs)
    const seeded = +((await store.get("seed-version", { type: "text" })) || 0);
    if (seeded < SEED_VERSION && Array.isArray(data.cars)) {
      if (seeded < 3) {
        if (seeded === 1) { const drop = new Set(OLD_IDS); data.cars = data.cars.filter((c) => !drop.has(c.id)); }
        const have = new Set(data.cars.map((c) => c.id));
        data.cars = [...ADD_FRONT.filter((c) => !have.has(c.id)), ...data.cars, ...ADD_BACK.filter((c) => !have.has(c.id))];
        data.settings = { ...(data.settings || {}), ...SETTINGS_UPDATE };
      }
      if (seeded < 4) { // new name and address: Atlantic Auto Sales, Des Moines
        data.settings = { ...(data.settings || {}), ...REBRAND.settings };
        const fix = (t) => REBRAND.text.reduce((x, [a, b]) => x.split(a).join(b), t);
        for (const k of ["heroTitle", "tagline", "about"]) if (typeof data.settings[k] === "string") data.settings[k] = fix(data.settings[k]);
        for (const c of data.cars) if (typeof c.desc === "string") c.desc = fix(c.desc);
      }
      if (seeded < 5) data.cars = [];
      if (seeded < 7) { const have = new Set(data.cars.map((c) => c.id)); data.cars = [...data.cars, ...ATLANTIC_CARS.filter((c) => !have.has(c.id)).map((c) => ({ ...c }))]; }
      await store.set("backup-" + new Date().toISOString(), JSON.stringify(await store.get("data", { type: "json" })));
      await store.set("data", JSON.stringify(data));
      await store.set("seed-version", String(SEED_VERSION));
    }
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
