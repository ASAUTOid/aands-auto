import { getStore } from "@netlify/blobs";
import { randomUUID, randomBytes, scryptSync, createHash, timingSafeEqual } from "node:crypto";
import { checkPassword, json } from "../lib/auth.mjs";
import { mask, merge, sendFeed } from "../lib/ftp.mjs";

// Dealer websites made in Dashboard → Websites. Each dealer has its own cars, messages and admin password.
// GET    /api/t/<slug>/data      public: settings + cars
// PUT    /api/t/<slug>/data      save settings + cars (dealer password or main admin password)
// DELETE /api/t/<slug>/data      delete the dealer website (main admin only)
// POST   /api/t/<slug>/login     check a password
// POST   /api/t/<slug>/password  { newPassword } set the dealer's password
// POST   /api/t/<slug>/upload    upload a photo or logo
// GET    /api/t/<slug>/leads     customer messages (dealer)
// PUT    /api/t/<slug>/leads     save messages after marking read / deleting (dealer)
// GET/PUT /api/t/<slug>/ftp      FTP settings for this dealer's feeds (passwords hidden)
// POST   /api/t/<slug>/ftpsend   { feed } send one feed by FTP now
const store = () => getStore({ name: "tenants", consistency: "strong" });
const same = (a, b) => timingSafeEqual(createHash("sha256").update(String(a)).digest(), createHash("sha256").update(String(b)).digest());

async function role(req, slug) {
  if (await checkPassword(req)) return "owner"; // main A & S admin can manage every dealer site
  const pw = req.headers.get("x-admin-password") || "";
  const auth = pw && (await store().get("auth/" + slug, { type: "json" }));
  if (auth && same(scryptSync(pw, Buffer.from(auth.salt, "hex"), 32).toString("hex"), auth.hash)) return "dealer";
  return null;
}
const TYPES = { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" };

export default async (req, context) => {
  const { slug, action } = context.params;
  if (!/^[a-z0-9-]{1,40}$/.test(slug || "")) return json({ error: "bad_site" }, 400);
  const key = "site/" + slug, m = req.method;

  if (action === "data" && m === "GET") {
    const d = await store().get(key, { type: "json" });
    return d ? json(d) : json({ error: "not_found" }, 404);
  }
  const who = await role(req, slug);

  if (action === "login" && m === "POST") return who ? json({ ok: true, role: who }) : json({ error: "unauthorized" }, 401);
  if (!who) return json({ error: "unauthorized" }, 401);

  if (action === "data" && m === "PUT") {
    let d; try { d = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
    if (!d || typeof d.settings !== "object" || !Array.isArray(d.cars)) return json({ error: "bad_data" }, 400);
    if (JSON.stringify(d).length > 4_000_000) return json({ error: "too_large" }, 413);
    if (who !== "owner" && !(await store().get(key, { type: "json" }))) return json({ error: "not_found" }, 404);
    await store().setJSON(key, d);
    return json({ ok: true });
  }
  if (action === "data" && m === "DELETE") {
    if (who !== "owner") return json({ error: "forbidden" }, 403);
    await Promise.all([store().delete(key), store().delete("auth/" + slug), store().delete("leads/" + slug)]);
    return json({ ok: true });
  }
  if (action === "password" && m === "POST") {
    let b; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
    const pw = String(b?.newPassword || "");
    if (pw.length < 8) return json({ error: "too_short" }, 400);
    const salt = randomBytes(16);
    await store().setJSON("auth/" + slug, { salt: salt.toString("hex"), hash: scryptSync(pw, salt, 32).toString("hex") });
    return json({ ok: true });
  }
  if (action === "upload" && m === "POST") {
    const type = (req.headers.get("content-type") || "").split(";")[0].trim();
    if (!TYPES[type]) return json({ error: "unsupported_type" }, 415);
    const buf = await req.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > 5_000_000) return json({ error: "bad_size" }, 413);
    const id = randomUUID().replace(/-/g, "") + "." + TYPES[type];
    await getStore("photos").set(id, buf, { metadata: { contentType: type } });
    return json({ url: "/photo/" + id });
  }
  if (action === "leads" && m === "GET") return json(Object.values((await store().get("leads/" + slug, { type: "json" })) || {}));
  if (action === "leads" && m === "PUT") {
    let arr; try { arr = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
    if (!Array.isArray(arr)) return json({ error: "bad_data" }, 400);
    await store().setJSON("leads/" + slug, Object.fromEntries(arr.filter((l) => l && l.id).map((l) => [l.id, l])));
    return json({ ok: true });
  }
  if (action === "ftp") {
    const cfg = (await store().get("ftp/" + slug, { type: "json" })) || {};
    if (m === "GET") return json(mask(cfg));
    if (m === "PUT") { let b; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); } const next = merge(cfg, b); await store().setJSON("ftp/" + slug, next); return json(mask(next)); }
  }
  if (action === "ftpsend" && m === "POST") {
    let b; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
    const name = String(b?.feed || ""), cfg = (await store().get("ftp/" + slug, { type: "json" })) || {};
    const td = await store().get(key, { type: "json" });
    if (!td) return json({ error: "not_found" }, 404);
    if (!cfg[name]) return json({ error: "Save the FTP details for this feed first." }, 400);
    cfg[name] = await sendFeed(td, name, cfg[name], b.base && /^https:\/\/[a-z0-9.-]+(\/w\/[a-z0-9-]+)?$/.test(b.base) ? b.base : new URL(req.url).origin + "/w/" + slug);
    await store().setJSON("ftp/" + slug, cfg);
    return json(mask(cfg)[name]);
  }
  return json({ error: "not_found" }, 404);
};

export const config = { path: "/api/t/:slug/:action" };
