// Background library for the AI photo studio.
// Real photos from Pexels (free for commercial use under the Pexels license, no attribution required; credits kept below),
// plus three clean studio backdrops drawn by tools/make_backgrounds.py.
// floor = where the tyres stand (0 = top, 1 = bottom); reflect = glossy floor that mirrors the car.
export const BACKGROUNDS = [
  { id: "photo-as-lot", name: "Brick dealer lot", cat: "Outside", floor: 0.91, reflect: false, credit: "DealerVexa" },
  { id: "photo-modern-showroom", name: "Modern showroom", cat: "Inside", floor: 0.88, reflect: true, credit: "Pexels #36217325" },
  { id: "photo-glass-lobby", name: "Glass lobby", cat: "Inside", floor: 0.9, reflect: true, credit: "Pexels #32674962" },
  { id: "photo-steel-garage", name: "Steel garage", cat: "Inside", floor: 0.9, reflect: false, credit: "Kevin Chuang · Pexels #12771407" },
  { id: "photo-warehouse", name: "Warehouse", cat: "Inside", floor: 0.9, reflect: false, credit: "Wenxin Dong · Pexels #16924265" },
  { id: "photo-parking-garage", name: "Parking garage", cat: "Urban", floor: 0.9, reflect: false, credit: "Pexels #35548884" },
  { id: "photo-white-tunnel", name: "White tunnel", cat: "Urban", floor: 0.9, reflect: false, credit: "Daniel Frese · Pexels #2983092" },
  { id: "photo-night-street", name: "Foggy night street", cat: "Urban", floor: 0.9, reflect: true, credit: "Yura Forrat · Pexels #10550881" },
  { id: "photo-mountain-road", name: "Mountain road", cat: "Outside", floor: 0.9, reflect: false, credit: "Sebastian Palomino · Pexels #2658459" },
  { id: "photo-misty-road", name: "Misty hills road", cat: "Outside", floor: 0.9, reflect: false, credit: "Pexels #2739013" },
  { id: "photo-desert-sunset", name: "Desert sunset", cat: "Outside", floor: 0.9, reflect: false, credit: "Johannes Plenio · Pexels #2044443" },
  { id: "white-studio", name: "White studio", cat: "Studio", floor: 0.83, reflect: true },
  { id: "grey-studio", name: "Grey studio", cat: "Studio", floor: 0.83, reflect: true },
  { id: "brand-night", name: "Red night studio", cat: "Studio", floor: 0.84, reflect: true },
].map((b) => ({ ...b, url: `/bg/${b.id}.webp`, thumb: `/bg/${b.id}-thumb.webp` }));
export const BG_CATS = ["Inside", "Urban", "Outside", "Studio", "Yours"];
