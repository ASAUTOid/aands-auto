import { timingSafeEqual, createHash, randomBytes, scryptSync } from "node:crypto";
import { getStore } from "@netlify/blobs";

const same = (a, b) => {
  const x = createHash("sha256").update(String(a)).digest();
  const y = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(x, y);
};

// The admin password is either the one changed from the admin page (stored hashed),
// or the ADMIN_PASSWORD environment variable in Netlify, which always works as a backup key.
export async function checkPassword(req) {
  const given = req.headers.get("x-admin-password") || "";
  if (!given) return false;
  const env = process.env.ADMIN_PASSWORD || "";
  if (env && same(given, env)) return true;
  const auth = await getStore({ name: "site", consistency: "strong" }).get("auth", { type: "json" });
  if (auth && auth.salt && auth.hash) {
    const h = scryptSync(given, Buffer.from(auth.salt, "hex"), 32).toString("hex");
    return same(h, auth.hash);
  }
  return false;
}

export async function setPassword(pw) {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 32).toString("hex");
  await getStore({ name: "site", consistency: "strong" }).setJSON("auth", { salt: salt.toString("hex"), hash, changed: new Date().toISOString() });
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
