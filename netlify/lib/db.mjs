import { getStore } from "@netlify/blobs";

// Private dealer data (never shown on the public website). One JSON document per collection.
export const COLLECTIONS = ["leads", "customers", "deals", "costs", "payments", "tasks", "appts", "recon", "templates", "expenses"];
const store = () => getStore({ name: "dms", consistency: "strong" });

export async function readAll(col) {
  return (await store().get(col, { type: "json" })) || {};
}
export async function writeAll(col, map) {
  await store().setJSON(col, map);
}
export const newId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
