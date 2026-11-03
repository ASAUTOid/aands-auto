import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import { checkPassword, json } from "../lib/auth.mjs";

const TYPES = { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg", "application/pdf": "pdf" };

// POST /api/upload (raw image body, admin password required) -> { url: "/photo/<id>" }
export default async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!(await checkPassword(req))) return json({ error: "unauthorized" }, 401);
  const type = (req.headers.get("content-type") || "").split(";")[0].trim();
  if (!TYPES[type]) return json({ error: "unsupported_type" }, 415);
  const buf = await req.arrayBuffer();
  if (!buf.byteLength) return json({ error: "empty" }, 400);
  if (buf.byteLength > 8_000_000) return json({ error: "too_large" }, 413);
  const id = randomUUID().replace(/-/g, "") + "." + TYPES[type];
  await getStore("photos").set(id, buf, { metadata: { contentType: type } });
  return json({ url: "/photo/" + id });
};

export const config = { path: "/api/upload" };
