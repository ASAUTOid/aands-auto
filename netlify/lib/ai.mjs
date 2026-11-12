// AI scene photos (Google Gemini image model): the dealer's real car, placed on the dealer's own lot.
// Turned on by GEMINI_API_KEY in Netlify. Model: GEMINI_IMAGE_MODEL (default gemini-2.5-flash-image).
import { createHash, timingSafeEqual, scryptSync, randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { checkPassword } from "./auth.mjs";
import { tenants, getConfig, statusOf, setStatus } from "./hq.mjs";

export const hasAI = () => !!process.env.GEMINI_API_KEY;
export const MODEL = () => process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
export const jobs = () => getStore({ name: "aijobs", consistency: "strong" });
export const month = () => new Date().toISOString().slice(0, 7);
export const DEFAULT_LIMITS = { starter: 20, pro: 100, "dealer-plus": 300 };

const same = (a, b) => timingSafeEqual(createHash("sha256").update(String(a)).digest(), createHash("sha256").update(String(b)).digest());
// "" = the main site (HQ password); a slug = that dealer (their password or the HQ password)
export async function who(req, slug) {
  if (await checkPassword(req)) return "owner";
  if (!slug) return null;
  const pw = req.headers.get("x-admin-password") || "";
  const auth = pw && (await tenants().get("auth/" + slug, { type: "json" }));
  return auth && same(scryptSync(pw, Buffer.from(auth.salt, "hex"), 32).toString("hex"), auth.hash) ? "dealer" : null;
}
export async function usage(slug) {
  if (!slug) return { used: 0, limit: null };
  const cfg = await getConfig(), st = await statusOf(slug), u = st.aiUsage && st.aiUsage.month === month() ? st.aiUsage.n : 0;
  const limits = { ...DEFAULT_LIMITS, ...(cfg.aiLimits || {}) };
  return { used: u, limit: (limits[st.plan] ?? limits.starter) + (+st.aiExtra || 0) };
}
export async function countOne(slug) { if (!slug) return; const u = await usage(slug); await setStatus(slug, { aiUsage: { month: month(), n: u.used + 1 } }); }

// only pictures that live on this site: /photo/<id>, /bg/…, /img/… (no outside addresses)
const SAFE = /^\/?(photo\/[a-f0-9]{32}\.(webp|png|jpg)|(bg|img|demo\/[a-z]+)\/[\w.-]+\.(webp|png|jpe?g))$/i;
export const safePath = (u) => { const p = String(u || "").replace(/^https?:\/\/[^/]+/i, "").split("?")[0]; return SAFE.test(p) ? "/" + p.replace(/^\//, "") : null; };
export async function loadImage(path, origin) {
  const m = path.match(/^\/photo\/(.+)$/);
  if (m) { const r = await getStore("photos").getWithMetadata(m[1], { type: "arrayBuffer" }); if (!r) throw new Error("photo not found"); return { mime: r.metadata?.contentType || "image/webp", data: Buffer.from(r.data).toString("base64") }; }
  const r = await fetch(origin + path); if (!r.ok) throw new Error("picture not found");
  return { mime: (r.headers.get("content-type") || "image/webp").split(";")[0], data: Buffer.from(await r.arrayBuffer()).toString("base64") };
}

export const PRESETS = {
  showroom: "a bright modern car dealership showroom with a polished light floor and large windows",
  lot: "a clean, well-kept outdoor used-car dealership lot on a sunny day with a blue sky",
  studio: "a professional photo studio with a seamless light grey backdrop and a soft floor reflection",
  street: "a quiet, clean suburban street with trees on a bright day",
};
export function prompt(hasScene, preset, hint) {
  return [
    hasScene ? "Image 1 is a photo of a real vehicle for sale. Image 2 is the dealership's own location. Create one photorealistic dealership photo that shows the vehicle from image 1 parked in the location of image 2."
      : `Image 1 is a photo of a real vehicle for sale. Create one photorealistic dealership photo that shows this vehicle parked in ${PRESETS[preset] || PRESETS.lot}.`,
    "Keep the vehicle EXACTLY as it is: same make, model, year, body, colour, wheels, trim, badges, and any visible wear or damage. Do not improve, repair, restyle or change the vehicle in any way.",
    hasScene ? "Keep the location recognisable and unchanged: the building, signs, text on signs and surroundings must stay as they are. Remove any other vehicle standing in the centre foreground so the spot is free." : "",
    "Place the vehicle in the centre foreground in a front three-quarter view at eye level, at a natural size for the scene, with all four tyres on the ground.",
    "Match the light of the scene: direction, colour and softness, realistic contact shadows under the tyres and body, and reflections of the surroundings in the paint and glass.",
    "Make the licence plate blank. No added text, logos, watermarks, people or borders. Landscape 3:2, sharp, natural colours.",
    hint ? "Extra request from the dealer: " + String(hint).slice(0, 200) : "",
  ].filter(Boolean).join(" ");
}

export async function generate({ car, scene, preset, hint }) {
  const parts = [{ text: prompt(!!scene, preset, hint) }, { inline_data: { mime_type: car.mime, data: car.data } }];
  if (scene) parts.push({ inline_data: { mime_type: scene.mime, data: scene.data } });
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`, {
    method: "POST", headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["IMAGE"] } }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || "The AI service answered " + r.status);
  const img = (j.candidates?.[0]?.content?.parts || []).map((p) => p.inlineData || p.inline_data).find(Boolean);
  if (!img) throw new Error(j.promptFeedback?.blockReason ? "The AI refused this photo (" + j.promptFeedback.blockReason + ")." : "The AI did not return a picture. Try again.");
  const mime = img.mimeType || img.mime_type || "image/png", ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
  const id = randomUUID().replace(/-/g, "") + "." + ext;
  await getStore("photos").set(id, Buffer.from(img.data, "base64"), { metadata: { contentType: mime } });
  return "/photo/" + id;
}
