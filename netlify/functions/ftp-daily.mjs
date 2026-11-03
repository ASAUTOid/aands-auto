import { getStore } from "@netlify/blobs";
import { sendFeed } from "../lib/ftp.mjs";

// Every day: send each feed that has "send automatically every day" ticked, for A & S and for every dealer website.
const BASE = process.env.URL || "https://aands-auto.com";

export default async () => {
  const dms = getStore({ name: "dms", consistency: "strong" }), tenants = getStore({ name: "tenants", consistency: "strong" });
  // A & S
  const cfg = (await dms.get("ftp", { type: "json" })) || {};
  const data = await getStore({ name: "site", consistency: "strong" }).get("data", { type: "json" });
  if (data) {
    for (const [name, c] of Object.entries(cfg)) if (c.auto) cfg[name] = await sendFeed(data, name, c, BASE);
    await dms.setJSON("ftp", cfg);
  }
  // dealer websites
  const { blobs } = await tenants.list({ prefix: "ftp/" });
  for (const { key } of blobs) {
    const slug = key.slice(4), tc = (await tenants.get(key, { type: "json" })) || {};
    const td = await tenants.get("site/" + slug, { type: "json" });
    if (!td || !Object.values(tc).some((c) => c.auto)) continue;
    for (const [name, c] of Object.entries(tc)) if (c.auto) tc[name] = await sendFeed(td, name, c, BASE + "/w/" + slug);
    await tenants.setJSON(key, tc);
  }
};

export const config = { schedule: "@daily" };
