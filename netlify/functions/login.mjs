import { checkPassword, json } from "../lib/auth.mjs";

// POST /api/login -> 200 if the admin password is right, 401 otherwise
export default async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  return (await checkPassword(req)) ? json({ ok: true }) : json({ error: "unauthorized" }, 401);
};

export const config = { path: "/api/login" };
