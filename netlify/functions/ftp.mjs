import { getStore } from "@netlify/blobs";
import { checkPassword, json } from "../lib/auth.mjs";
import { mask, merge, sendFeed } from "../lib/ftp.mjs";

// FTP delivery of the A & S inventory feeds (main dashboard → Marketing).
// GET  /api/ftp          -> FTP settings per feed (passwords hidden)
// PUT  /api/ftp          -> save FTP settings
// POST /api/ftp {feed}   -> send that feed now
const dms = () => getStore({ name: "dms", consistency: "strong" });

export default async (req) => {
  if (!(await checkPassword(req))) return json({ error: "unauthorized" }, 401);
  const cfg = (await dms().get("ftp", { type: "json" })) || {};
  if (req.method === "GET") return json(mask(cfg));
  let b; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  if (req.method === "PUT") { const next = merge(cfg, b); await dms().setJSON("ftp", next); return json(mask(next)); }
  if (req.method === "POST") {
    const name = String(b?.feed || "");
    const data = await getStore({ name: "site", consistency: "strong" }).get("data", { type: "json" });
    if (!data) return json({ error: "Save your inventory once in the dashboard first." }, 400);
    if (!cfg[name]) return json({ error: "Save the FTP details for this feed first." }, 400);
    cfg[name] = await sendFeed(data, name, cfg[name], new URL(req.url).origin);
    await dms().setJSON("ftp", cfg);
    return json(mask(cfg)[name]);
  }
  return json({ error: "method_not_allowed" }, 405);
};

export const config = { path: "/api/ftp" };
