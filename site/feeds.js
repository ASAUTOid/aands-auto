// Inventory export feeds (CSV) for listing sites.
// Shared by the admin page (download buttons) and the server (/feeds/<name>.csv).
// Each listing site confirms its exact column format when you sign up as a dealer;
// if one asks for different columns, use the custom export to match it.

export const SITE_URL = "https://aands-auto.com";

// Every value a column can take. key -> [label, getter(car, settings, siteUrl)]
const abs = (u, base) => (!u ? "" : /^https?:\/\//.test(u) ? u : base + "/" + String(u).replace(/^\//, ""));
const modelOf = (c) => (c.name && c.make && c.name.startsWith(c.make + " ") ? c.name.slice(c.make.length + 1) : c.name || "");
export const FIELDS = {
  vin: ["VIN", (c) => c.vin || ""],
  stock: ["Stock number", (c) => c.stock || c.id || ""],
  year: ["Year", (c) => c.year ?? ""],
  make: ["Make", (c) => c.make || ""],
  model: ["Model", (c) => modelOf(c)],
  trim: ["Trim", (c) => c.trim || ""],
  body: ["Body style", (c) => c.body || ""],
  condition: ["Condition (Used)", () => "Used"],
  miles: ["Mileage", (c) => c.miles ?? ""],
  price: ["Price", (c) => c.price ?? ""],
  ext: ["Exterior colour", (c) => c.ext || ""],
  int: ["Interior", (c) => c.int || ""],
  trans: ["Transmission", (c) => c.trans || ""],
  engine: ["Engine", (c) => c.engine || ""],
  drive: ["Drivetrain", (c) => c.drive || ""],
  fuel: ["Fuel", (c) => c.fuel || ""],
  mpgCity: ["MPG city", (c) => String(c.mpg || "").split("/")[0].trim()],
  mpgHwy: ["MPG highway", (c) => (String(c.mpg || "").split("/")[1] || "").trim()],
  hp: ["Horsepower", (c) => c.hp ?? ""],
  desc: ["Description", (c) => c.desc || ""],
  equip: ["Equipment (separated by |)", (c) => (c.equip || []).join("|")],
  photo: ["Photo URL", (c, s, base) => abs(c.img, base)],
  url: ["Car page URL", (c, s, base) => base + "/#car-" + c.id],
  status: ["Status (lot / sold)", (c) => c.status || "lot"],
  dealerName: ["Dealer name", (c, s) => s.name || ""],
  dealerPhone: ["Dealer phone", (c, s) => s.phone || ""],
  dealerEmail: ["Dealer email", (c, s) => s.email || ""],
  dealerStreet: ["Dealer street", (c, s) => s.street || ""],
  dealerCity: ["Dealer city", (c, s) => s.city || ""],
  dealerState: ["Dealer state", (c, s) => s.state || ""],
  dealerZip: ["Dealer ZIP", (c, s) => s.zip || ""],
};

// Ready-made exports. "dealerId" is the account number each site gives you.
const P = (h, src) => ({ h, src });
const D = (h) => ({ h, src: "dealerId" });
export const PRESETS = {
  carfax: {
    label: "CARFAX",
    cols: [D("DealerID"), P("VIN", "vin"), P("StockNumber", "stock"), P("Year", "year"), P("Make", "make"), P("Model", "model"),
      P("Trim", "trim"), P("BodyStyle", "body"), P("Condition", "condition"), P("Mileage", "miles"), P("Price", "price"),
      P("ExteriorColor", "ext"), P("InteriorColor", "int"), P("Transmission", "trans"), P("Engine", "engine"),
      P("Drivetrain", "drive"), P("FuelType", "fuel"), P("Description", "desc"), P("Options", "equip"), P("ImageURLs", "photo"), P("VehicleURL", "url")],
  },
  autotrader: {
    label: "Autotrader",
    cols: [D("dealer_id"), P("vin", "vin"), P("stock_number", "stock"), P("year", "year"), P("make", "make"), P("model", "model"),
      P("trim", "trim"), P("body_style", "body"), P("condition", "condition"), P("mileage", "miles"), P("price", "price"),
      P("exterior_color", "ext"), P("interior_color", "int"), P("transmission", "trans"), P("engine", "engine"),
      P("drivetrain", "drive"), P("fuel_type", "fuel"), P("city_mpg", "mpgCity"), P("highway_mpg", "mpgHwy"),
      P("comments", "desc"), P("options", "equip"), P("photo_urls", "photo"), P("vdp_url", "url")],
  },
  carscom: {
    label: "Cars.com",
    cols: [D("DealerID"), P("Type", "condition"), P("VIN", "vin"), P("Stock", "stock"), P("Year", "year"), P("Make", "make"),
      P("Model", "model"), P("Trim", "trim"), P("Body", "body"), P("Miles", "miles"), P("SellingPrice", "price"),
      P("ExteriorColor", "ext"), P("InteriorColor", "int"), P("Transmission", "trans"), P("EngineDescription", "engine"),
      P("Drivetrain", "drive"), P("Fuel", "fuel"), P("CityMPG", "mpgCity"), P("HighwayMPG", "mpgHwy"),
      P("Description", "desc"), P("Features", "equip"), P("PhotoURLs", "photo"), P("VehicleDetailURL", "url")],
  },
  edmunds: {
    label: "Edmunds",
    cols: [D("dealer_id"), P("new_used", "condition"), P("vin", "vin"), P("stock", "stock"), P("year", "year"), P("make", "make"),
      P("model", "model"), P("trim", "trim"), P("body_type", "body"), P("mileage", "miles"), P("price", "price"),
      P("exterior_color", "ext"), P("interior_color", "int"), P("transmission", "trans"), P("engine", "engine"),
      P("drivetrain", "drive"), P("fuel_type", "fuel"), P("description", "desc"), P("options", "equip"),
      P("image_urls", "photo"), P("vdp_url", "url")],
  },
};

export const FEED_NAMES = [...Object.keys(PRESETS), "custom"];

export const DEFAULT_CUSTOM = {
  title: "My export",
  delimiter: ",",
  onlyLot: true,
  cols: [P("VIN", "vin"), P("Year", "year"), P("Make", "make"), P("Model", "model"), P("Price", "price"), P("Mileage", "miles"), { h: "Location", src: "fixed", val: "Burley, ID" }],
};

const cell = (v, delim) => {
  const s = String(v ?? "").replace(/\r?\n/g, " ");
  return s.includes(delim) || s.includes('"') || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

// Returns { filename, csv, count } for one feed.
export function buildFeed(data, name, base = SITE_URL) {
  const s = data.settings || {};
  const fs = (s.feeds && s.feeds[name]) || {};
  let cols, delim = ",", onlyLot = true, title;
  if (name === "custom") {
    const c = { ...DEFAULT_CUSTOM, ...fs };
    cols = c.cols; delim = c.delimiter === "tab" ? "\t" : c.delimiter || ","; onlyLot = c.onlyLot !== false; title = c.title;
  } else if (PRESETS[name]) {
    cols = PRESETS[name].cols; title = PRESETS[name].label; onlyLot = fs.includeSold ? false : true;
  } else return null;
  const cars = (data.cars || []).filter((c) => c.status !== "hidden" && (!onlyLot || c.status === "lot"));
  const val = (col, car) =>
    col.src === "fixed" ? col.val ?? "" : col.src === "dealerId" ? fs.dealerId || "" : FIELDS[col.src] ? FIELDS[col.src][1](car, s, base) : "";
  const rows = [cols.map((c) => cell(c.h, delim)).join(delim), ...cars.map((car) => cols.map((c) => cell(val(c, car), delim)).join(delim))];
  const slug = String(title || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || name;
  return { filename: "aands-auto-" + slug + ".csv", csv: rows.join("\r\n") + "\r\n", count: cars.length };
}
