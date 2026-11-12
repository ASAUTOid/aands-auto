import { jobs, loadImage, generate, countOne } from "../lib/ai.mjs";

// Background worker for AI scene photos (Netlify runs "-background" functions for up to 15 minutes).
// It only works on a job that /api/ai/photo created after checking the password and the monthly limit.
export default async (req) => {
  let id; try { id = (await req.json()).id; } catch { return; }
  if (!/^[a-f0-9]{32}$/.test(id || "")) return;
  const j = await jobs().get(id, { type: "json" });
  if (!j || j.status !== "queued") return;
  await jobs().setJSON(id, { ...j, status: "working" });
  try {
    const origin = process.env.URL || new URL(req.url).origin;
    const car = await loadImage(j.photo, origin), scene = j.scene ? await loadImage(j.scene, origin) : null;
    const url = await generate({ car, scene, preset: j.preset, hint: j.hint });
    await countOne(j.slug);
    await jobs().setJSON(id, { ...j, status: "done", url, doneAt: new Date().toISOString() });
  } catch (e) {
    console.error("ai photo failed", e.message);
    await jobs().setJSON(id, { ...j, status: "error", error: String(e.message || "Something went wrong.").slice(0, 300) });
  }
};
