import { checkPassword, setPassword, json } from "../lib/auth.mjs";

// POST /api/password { newPassword } -> change the admin password (current password required)
export default async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!(await checkPassword(req))) return json({ error: "unauthorized" }, 401);
  let body;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const pw = String(body?.newPassword || "");
  if (pw.length < 8) return json({ error: "too_short" }, 400);
  await setPassword(pw);
  return json({ ok: true });
};

export const config = { path: "/api/password" };
