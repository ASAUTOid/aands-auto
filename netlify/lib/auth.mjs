import { timingSafeEqual, createHash } from "node:crypto";

// Admin password comes from the ADMIN_PASSWORD environment variable set in Netlify.
export function checkPassword(req) {
  const expected = process.env.ADMIN_PASSWORD || "";
  const given = req.headers.get("x-admin-password") || "";
  if (!expected) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
