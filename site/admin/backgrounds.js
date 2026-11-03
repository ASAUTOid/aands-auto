// Background library for the AI photo studio (images made by tools/make_backgrounds.py).
// floor = where the tyres stand (0 = top, 1 = bottom); reflect = glossy floor that mirrors the car.
export const BACKGROUNDS = [
  { id: "lux-showroom", name: "Luxury showroom", cat: "Inside", floor: 0.84, reflect: true },
  { id: "classic-dealer", name: "Classic dealer", cat: "Inside", floor: 0.86, reflect: true },
  { id: "garage", name: "Modern garage", cat: "Inside", floor: 0.86, reflect: false },
  { id: "brand-night", name: "Red night studio", cat: "Studio", floor: 0.84, reflect: true },
  { id: "white-studio", name: "White studio", cat: "Studio", floor: 0.83, reflect: true },
  { id: "grey-studio", name: "Grey studio", cat: "Studio", floor: 0.83, reflect: true },
  { id: "sunny-lot", name: "Sunny lot", cat: "Outside", floor: 0.86, reflect: false },
  { id: "sunset", name: "Sunset", cat: "Outside", floor: 0.86, reflect: false },
  { id: "mountain-road", name: "Mountain road", cat: "Outside", floor: 0.88, reflect: false },
  { id: "city-night", name: "City at night", cat: "Outside", floor: 0.88, reflect: true },
].map((b) => ({ ...b, url: `/bg/${b.id}.webp`, thumb: `/bg/${b.id}-thumb.webp` }));
