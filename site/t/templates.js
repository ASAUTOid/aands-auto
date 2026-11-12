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
  luxury: {
    name: "Luxury Black & Gold", desc: "Black, gold and elegant serif type. For premium and exotic cars.",
    swatch: ["#0b0b0b", "#c9a45c", "#161616", "#f5efe4"],
    vars: { bg: "#0b0b0b", panel: "#141414", text: "#f5efe4", muted: "#a59c8c", line: "#2a2622", accent: "#c9a45c", accentInk: "#0b0b0b", hero: "#0b0b0b", heroInk: "#f5efe4", price: "#c9a45c" },
    fonts: ["Playfair Display:wght@500;700", "Playfair Display"], head: "'Playfair Display',Georgia,serif", body: "Georgia,serif", radius: "0px", heroStyle: "photo",
  },
  ocean: {
    name: "Ocean Blue", desc: "Bright, fresh blues and rounded cards. Friendly and modern.",
    swatch: ["#f0f7fb", "#0e7490", "#ffffff", "#0f2a37"],
    vars: { bg: "#f0f7fb", panel: "#ffffff", text: "#0f2a37", muted: "#557482", line: "#d6e7ef", accent: "#0e7490", accentInk: "#ffffff", hero: "#0e7490", heroInk: "#ffffff", price: "#0e7490" },
    fonts: ["Nunito Sans:wght@400;700;900", "Nunito Sans"], head: "'Nunito Sans',Arial,sans-serif", body: "'Nunito Sans',Arial,sans-serif", radius: "14px", heroStyle: "search",
  },
  urban: {
    name: "Urban Orange", desc: "Concrete grey with bright orange. Street style for younger buyers.",
    swatch: ["#1f2326", "#ff6b1a", "#2b3035", "#eef0f2"],
    vars: { bg: "#1f2326", panel: "#2b3035", text: "#eef0f2", muted: "#a3abb3", line: "#3a4046", accent: "#ff6b1a", accentInk: "#111111", hero: "#1f2326", heroInk: "#eef0f2", price: "#ff6b1a" },
    fonts: ["Barlow Condensed:wght@600;800", "Barlow Condensed"], head: "'Barlow Condensed',Arial Narrow,sans-serif", body: "Arial,Helvetica,sans-serif", radius: "3px", heroStyle: "split", upper: true,
  },
  family: {
    name: "Family Friendly", desc: "Soft purple, rounded and warm. Minivans, SUVs and first cars.",
    swatch: ["#faf7ff", "#6d28d9", "#ffffff", "#2e1065"],
    vars: { bg: "#faf7ff", panel: "#ffffff", text: "#2e1065", muted: "#6b5f86", line: "#e9e2f7", accent: "#6d28d9", accentInk: "#ffffff", hero: "#ede5ff", heroInk: "#2e1065", price: "#6d28d9" },
    fonts: ["Quicksand:wght@500;700", "Quicksand"], head: "'Quicksand',Arial,sans-serif", body: "'Quicksand',Arial,sans-serif", radius: "18px", heroStyle: "center",
  },
  budget: {
    name: "Budget Deals", desc: "Red and white, big prices up front. Buy here pay here and cash cars.",
    swatch: ["#ffffff", "#dc2626", "#fef2f2", "#111111"],
    vars: { bg: "#ffffff", panel: "#ffffff", text: "#111111", muted: "#6b6b6b", line: "#ececec", accent: "#dc2626", accentInk: "#ffffff", hero: "#dc2626", heroInk: "#ffffff", price: "#dc2626" },
    fonts: ["Archivo Black", "Archivo Black"], head: "'Archivo Black',Impact,sans-serif", body: "Arial,Helvetica,sans-serif", radius: "6px", heroStyle: "center", upper: true,
  },
};
// options a dealer can change on top of any template (Dashboard → My website → Make it yours)
export const FONT_SETS = {
  modern: { name: "Modern (Inter)", fonts: ["Inter:wght@400;600;800", "Inter"], head: "'Inter',Arial,sans-serif", body: "'Inter',Arial,sans-serif" },
  strong: { name: "Strong (Oswald)", fonts: ["Oswald:wght@500;700", "Oswald"], head: "'Oswald',Impact,sans-serif", body: "Arial,Helvetica,sans-serif", upper: true },
  elegant: { name: "Elegant (Playfair)", fonts: ["Playfair Display:wght@500;700", "Playfair Display"], head: "'Playfair Display',Georgia,serif", body: "Georgia,serif", upper: false },
  friendly: { name: "Friendly (Nunito)", fonts: ["Nunito:wght@400;700;900", "Nunito"], head: "'Nunito',Arial,sans-serif", body: "'Nunito',Arial,sans-serif", upper: false },
  classic: { name: "Classic (Merriweather)", fonts: ["Merriweather:wght@400;700;900", "Merriweather"], head: "'Merriweather',Georgia,serif", body: "Arial,Helvetica,sans-serif", upper: false },
  poster: { name: "Poster (Anton)", fonts: ["Anton", "Anton"], head: "'Anton',Impact,sans-serif", body: "Arial,Helvetica,sans-serif", upper: true },
};
export const HERO_STYLES = { search: "Search bar", photo: "Big photo behind the headline", split: "Text left, photo right", center: "Centered, photo below" };
export const CORNERS = { square: ["Square", "0px"], soft: ["Soft", "8px"], round: ["Round", "18px"] };
// the 10 templates any dealer website can use (Night Lot is only for the A & S main site)
export const DEALER_TEMPLATES = Object.keys(TEMPLATES).filter((k) => !TEMPLATES[k].original);
