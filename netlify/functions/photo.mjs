import { getStore } from "@netlify/blobs";

// GET /photo/<id> -> an uploaded car photo
export default async (req, context) => {
  const id = context.params.id;
  if (!/^[a-f0-9]{32}\.(webp|png|jpg|pdf)$/.test(id || "")) return new Response("Not found", { status: 404 });
  const res = await getStore("photos").getWithMetadata(id, { type: "arrayBuffer" });
  if (!res) return new Response("Not found", { status: 404 });
  return new Response(res.data, {
    headers: {
      "content-type": res.metadata?.contentType || "image/webp",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
};

export const config = { path: "/photo/:id" };
