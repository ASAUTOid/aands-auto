// Website templates. "night" is the original animated A & S site; the others are drawn by /t/site.js.
export const TEMPLATES = {
  night: { name: "Night Lot", desc: "The original A & S site: dark, animated, with the particle car and the rev button.", swatch: ["#0d0b0b", "#d2161e", "#f4a43a", "#efebe7"], original: true },
  classic: {
    name: "Classic Dealer", desc: "Light and trustworthy. Big search bar, clean car cards. Works for any lot.",
    swatch: ["#ffffff", "#1e3a8a", "#f2f4f8", "#111827"],
    vars: { bg: "#f2f4f8", panel: "#ffffff", text: "#111827", muted: "#5b6474", line: "#dfe3ea", accent: "#1e3a8a", accentInk: "#ffffff", hero: "#0f1f4d", heroInk: "#ffffff", price: "#b42318" },
    fonts: ["Libre Franklin:wght@400;600;800", "Libre Franklin"], head: "'Libre Franklin',Arial,sans-serif", body: "'Libre Franklin',Arial,sans-serif", radius: "10px", heroStyle: "search",
  },
  bold: {
    name: "Bold Yellow", desc: "Black and yellow, loud headlines. Great for trucks and budget cars.",
    swatch: ["#111111", "#ffd400", "#1d1d1d", "#ffffff"],
    vars: { bg: "#111111", panel: "#1b1b1b", text: "#ffffff", muted: "#b5b5b5", line: "#2c2c2c", accent: "#ffd400", accentInk: "#111111", hero: "#ffd400", heroInk: "#111111", price: "#ffd400" },
    fonts: ["Anton", "Anton"], head: "'Anton',Impact,sans-serif", body: "Arial,Helvetica,sans-serif", radius: "0px", heroStyle: "split", upper: true,
  },
  minimal: {
    name: "Minimal", desc: "White space and big photos. Calm and premium.",
    swatch: ["#ffffff", "#111111", "#f5f5f4", "#8a8a8a"],
    vars: { bg: "#ffffff", panel: "#ffffff", text: "#111111", muted: "#76716b", line: "#ebe8e4", accent: "#111111", accentInk: "#ffffff", hero: "#f5f4f2", heroInk: "#111111", price: "#111111" },
    fonts: ["Inter:wght@400;500;700", "Inter"], head: "'Inter',Arial,sans-serif", body: "'Inter',Arial,sans-serif", radius: "4px", heroStyle: "photo",
  },
  sport: {
    name: "Sport Red", desc: "Dark with red accents, a simpler cousin of the Night Lot. Fast on old phones.",
    swatch: ["#0e0e10", "#e11d2a", "#18181b", "#fafafa"],
    vars: { bg: "#0e0e10", panel: "#18181b", text: "#fafafa", muted: "#a1a1aa", line: "#27272a", accent: "#e11d2a", accentInk: "#ffffff", hero: "#0e0e10", heroInk: "#fafafa", price: "#fbbf24" },
    fonts: ["Oswald:wght@500;700", "Oswald"], head: "'Oswald',Impact,sans-serif", body: "Arial,Helvetica,sans-serif", radius: "6px", heroStyle: "photo", upper: true,
  },
  country: {
    name: "Country Trucks", desc: "Warm, outdoorsy and friendly. Made for trucks, SUVs and rural buyers.",
    swatch: ["#f6f1e7", "#2f5d3a", "#8b5e34", "#2b2620"],
    vars: { bg: "#f6f1e7", panel: "#fffdf8", text: "#2b2620", muted: "#6e6457", line: "#e4dccb", accent: "#2f5d3a", accentInk: "#ffffff", hero: "#2f5d3a", heroInk: "#fffdf8", price: "#8b5e34" },
    fonts: ["Bitter:wght@500;700;800", "Bitter"], head: "'Bitter',Georgia,serif", body: "Arial,Helvetica,sans-serif", radius: "8px", heroStyle: "split",
  },
};
