// Inventory export feeds (CSV) for listing sites.
// Shared by the admin page (download buttons) and the server (/feeds/<name>.csv).
// Each listing site confirms its exact column format when you sign up as a dealer;
// if one asks for different columns, use the custom export to match it.

export const SITE_URL = "https://aands-auto.com";

// Every value a column can take. key -> [label, getter(car, settings, siteUrl)]
const abs = (u, base) => (!u ? "" : /^https?:\/\//.test(u) ? u : new URL("/" + String(u).replace(/^\//, ""), base).href);
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
  priceUSD: ["Price with currency (14495 USD)", (c) => (c.price ? c.price + " USD" : "")],
  milesText: ["Mileage with unit (142300 miles)", (c) => (c.miles != null ? c.miles + " miles" : "")],
  bodyUpper: ["Body style in capitals (TRUCK)", (c) => ({ Truck: "TRUCK", SUV: "SUV", Sedan: "SEDAN", Coupe: "COUPE", "Minivan / Passenger Van": "MINIVAN", Convertible: "CONVERTIBLE", Wagon: "WAGON", Hatchback: "HATCHBACK", Van: "VAN" }[c.body] || "OTHER")],
  title: ["Ad title (2014 Ford F-150 XLT)", (c) => [c.year, c.name, c.trim].filter(Boolean).join(" ")],
  availability: ["Availability (AVAILABLE / SOLD)", (c) => (c.status === "sold" ? "SOLD" : "AVAILABLE")],
  addedAt: ["Date first on the lot (yyyy-mm-dd)", (c) => c.addedAt || ""],
  daysOnLot: ["Days on the lot", (c) => (c.addedAt ? Math.max(0, Math.round((Date.now() - new Date(c.addedAt).getTime()) / 864e5)) : "")],
  driveCode: ["Drivetrain code (4X4, AWD, FWD, RWD)", (c) => ({ "4WD": "4X4", "4x4": "4X4", AWD: "AWD", FWD: "FWD", RWD: "RWD" }[c.drive] || "Other")],
  availLower: ["Availability (available / not available)", (c) => (c.status === "lot" ? "available" : "not available")],
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

const F = (h, val) => ({ h, src: "fixed", val });
Object.assign(PRESETS, {
  cargurus: {
    label: "CarGurus",
    cols: [D("dealer_id"), P("vin", "vin"), P("stock_number", "stock"), P("year", "year"), P("make", "make"), P("model", "model"), P("trim", "trim"),
      P("body_type", "body"), P("condition", "condition"), P("mileage", "miles"), P("price", "price"), P("exterior_color", "ext"), P("interior_color", "int"),
      P("transmission", "trans"), P("engine", "engine"), P("drivetrain", "drive"), P("fuel_type", "fuel"), P("dealer_comments", "desc"), P("options", "equip"),
      P("image_urls", "photo"), P("vdp_url", "url")],
  },
  truecar: {
    label: "TrueCar",
    cols: [D("DealerID"), P("VIN", "vin"), P("StockNumber", "stock"), P("Year", "year"), P("Make", "make"), P("Model", "model"), P("Trim", "trim"),
      P("Body", "body"), P("NewUsed", "condition"), P("Mileage", "miles"), P("Price", "price"), P("ExteriorColor", "ext"), P("InteriorColor", "int"),
      P("Transmission", "trans"), P("Engine", "engine"), P("Drivetrain", "drive"), P("Fuel", "fuel"), P("Comments", "desc"), P("Options", "equip"),
      P("Photos", "photo"), P("VDPURL", "url")],
  },
  facebook: {
    label: "Facebook / Instagram",
    note: "Vehicle catalog for Facebook Marketplace and automotive ads (Meta Commerce Manager).",
    cols: [P("vehicle_id", "stock"), P("title", "title"), P("description", "desc"), P("url", "url"), P("make", "make"), P("model", "model"), P("year", "year"),
      P("mileage.value", "miles"), F("mileage.unit", "MI"), P("image[0].url", "photo"), P("body_style", "bodyUpper"), P("price", "priceUSD"),
      P("exterior_color", "ext"), P("interior_color", "int"), F("state_of_vehicle", "USED"), P("vin", "vin"), P("availability", "availability"),
      P("trim", "trim"), P("transmission", "trans"), P("drivetrain", "drive"), P("fuel_type", "fuel"),
      P("dealer_name", "dealerName"), P("dealer_phone", "dealerPhone"), P("address.addr1", "dealerStreet"), P("address.city", "dealerCity"),
      P("address.region", "dealerState"), P("address.postal_code", "dealerZip"), F("address.country", "US")],
  },
  google: {
    label: "Google Vehicle Listings",
    note: "Product feed for Google Merchant Center (vehicle ads).",
    cols: [P("id", "stock"), P("title", "title"), P("description", "desc"), P("link", "url"), P("image_link", "photo"), P("price", "priceUSD"),
      F("condition", "used"), P("brand", "make"), P("model", "model"), P("year", "year"), P("trim", "trim"), P("mileage", "milesText"), P("vin", "vin"),
      P("color", "ext"), P("body_style", "body"), P("engine", "engine"), P("availability", "availability")],
  },
  tiktok: {
    label: "TikTok",
    note: "Automotive inventory catalog for TikTok Automotive Ads (TikTok Ads Manager → Catalogs).",
    cols: [P("vehicle_id", "stock"), P("title", "title"), P("description", "desc"), P("link", "url"), P("image_link", "photo"), P("make", "make"), P("model", "model"),
      P("year", "year"), P("trim", "trim"), P("mileage.value", "miles"), F("mileage.unit", "MI"), F("state_of_vehicle", "Used"), P("availability", "availLower"),
      P("date_first_on_lot", "addedAt"), P("days_on_lot", "daysOnLot"), P("price", "priceUSD"), P("vin", "vin"), P("stock_number", "stock"),
      P("exterior_color", "ext"), P("interior_color", "int"), P("drivetrain", "driveCode"), P("body_style", "body"), P("fuel_type", "fuel"), P("transmission", "trans"),
      P("dealer_name", "dealerName"), P("dealer_phone", "dealerPhone"), P("address.city", "dealerCity"), P("address.region", "dealerState"), P("address.postal_code", "dealerZip"), F("address.country", "US")],
  },
  ksl: {
    label: "KSL Cars",
    cols: [D("DealerID"), P("VIN", "vin"), P("Stock", "stock"), P("Year", "year"), P("Make", "make"), P("Model", "model"), P("Trim", "trim"), P("Body", "body"),
      P("Mileage", "miles"), P("Price", "price"), P("ExteriorColor", "ext"), P("InteriorColor", "int"), P("Transmission", "trans"), P("Engine", "engine"),
      P("Drive", "drive"), P("Fuel", "fuel"), P("Description", "desc"), P("Photos", "photo")],
  },
  carsforsale: {
    label: "CarsForSale.com",
    cols: [D("DealerID"), P("VIN", "vin"), P("StockNumber", "stock"), P("Year", "year"), P("Make", "make"), P("Model", "model"), P("Trim", "trim"),
      P("BodyStyle", "body"), P("Mileage", "miles"), P("Price", "price"), P("ExteriorColor", "ext"), P("InteriorColor", "int"), P("Transmission", "trans"),
      P("Engine", "engine"), P("Drivetrain", "drive"), P("FuelType", "fuel"), P("Comments", "desc"), P("Options", "equip"), P("ImageURLs", "photo")],
  },
});

// Ready-to-paste ad for classified sites that have no dealer feed (Craigslist, Facebook Marketplace, OfferUp, KSL Classifieds).
export function adText(c, s, base = SITE_URL) {
  const title = [c.year, c.name, c.trim].filter(Boolean).join(" ");
  const L = [`${title} – $${Number(c.price || 0).toLocaleString("en-US")}`, ""];
  if (c.miles != null) L.push(`Mileage: ${Number(c.miles).toLocaleString("en-US")} miles`);
  [["Engine", c.engine], ["Transmission", c.trans], ["Drivetrain", c.drive], ["Fuel", c.fuel], ["MPG", c.mpg], ["Exterior", c.ext], ["Interior", c.int], ["VIN", c.vin], ["Stock #", c.stock]]
    .forEach(([k, v]) => v && L.push(`${k}: ${v}`));
  if ((c.equip || []).length) { L.push("", "Equipment:"); c.equip.forEach((e) => L.push("• " + e)); }
  if (c.desc) L.push("", c.desc);
  L.push("", `${s.name || "A & S Auto"} – ${[s.street, s.city, s.state].filter(Boolean).join(", ")}`);
  if (s.phone) L.push(`Call or text: ${s.phone}`);
  L.push(`More photos and details: ${base}/#car-${c.id}`, "Price excludes tax, title and fees.");
  return { title, price: c.price || 0, text: L.join("\n") };
}

// Classified sites without a dealer feed: [key, label, posting page, how to post]
export const CLASSIFIEDS = [
  ["craigslist", "Craigslist", (s) => `https://${String(s.craigslistCity || "twinfalls").toLowerCase().replace(/[^a-z]/g, "")}.craigslist.org/`, "Click “post”, choose “for sale by dealer”, then “cars & trucks”. Ads expire, so repost every few weeks."],
  ["marketplace", "Facebook Marketplace", () => "https://www.facebook.com/marketplace/create/vehicle", "Create a new listing → Vehicle for sale. For all your cars at once, use the Facebook / Instagram catalog feed above."],
  ["offerup", "OfferUp", () => "https://offerup.com/post", "Post an item → Cars & trucks."],
  ["kslclass", "KSL Classifieds", () => "https://cars.ksl.com/", "Sell your car → dealer listing."],
];

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
