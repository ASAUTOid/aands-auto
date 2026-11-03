import { getStore } from "@netlify/blobs";
import { buildFeed } from "../../site/feeds.js";

// GET /feeds/<name>.csv -> inventory export for carfax, autotrader, carscom, edmunds or custom.
// Public on purpose: listing sites download it on a schedule. It only contains cars that are already on the website.
export default async (req, context) => {
  const name = String(context.params.name || "").replace(/\.csv$/, "");
  const slug = context.params.slug;
  if (slug && !/^[a-z0-9-]{1,40}$/.test(slug)) return new Response("Not found", { status: 404 });
  const data = slug ? await getStore({ name: "tenants", consistency: "strong" }).get("site/" + slug, { type: "json" })
    : await getStore({ name: "site", consistency: "strong" }).get("data", { type: "json" });
  if (!data) return new Response("No inventory saved yet. Open the admin page and click Save once.", { status: 404 });
  const base = new URL(req.url).origin + (slug ? "/w/" + slug : "");
  const feed = buildFeed(data, name, base);
  if (!feed) return new Response("Unknown feed", { status: 404 });
  return new Response(feed.csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `inline; filename="${feed.filename}"`,
      "cache-control": "public, max-age=300",
    },
  });
};

export const config = { path: ["/feeds/:name", "/feeds/t/:slug/:name"] };
