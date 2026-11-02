import { checkPassword, json } from "../lib/auth.mjs";

// POST /api/login -> 200 if the admin password is right, 401 otherwise
export default async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!process.env.ADMIN_PASSWORD) return json({ error: "no_password_set" }, 500);
  return checkPassword(req) ? json({ ok: true }) : json({ error: "unauthorized" }, 401);
};

export const config = { path: "/api/login" };
