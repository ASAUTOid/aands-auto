// Online credit application. /apply = main site (Atlantic Auto Sales); /apply?d=<slug> = a dealer website made in the dashboard.
const q = new URLSearchParams(location.search), dealer = (q.get("d") || "").replace(/[^a-z0-9-]/g, "");
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let S = {}, cars = [];
try {
  if (dealer) { const d = await (await fetch(`/api/t/${dealer}/data`)).json(); S = d.settings || {}; cars = d.cars || []; $("#back").href = `/w/${dealer}`; }
  else { const r = await fetch("/api/data"); const d = r.status === 200 ? await r.json() : JSON.parse(new DOMParser().parseFromString(await (await fetch("/index.html")).text(), "text/html").getElementById("site-data").textContent); S = { name: "Atlantic Auto Sales", logo: "/img/logo.png", ...d.settings }; cars = d.cars || []; }
} catch (_) {}
$("#dn").textContent = S.name || "Dealer"; document.title = "Get pre-approved · " + (S.name || "");
if (S.logo) { $("#logo").src = S.logo; $("#logo").hidden = false; }
if (S.accent) document.documentElement.style.setProperty("--accent", S.accent);
const pre = q.get("car");
$("#car").innerHTML += cars.filter((c) => c.status === "lot").map((c) => `<option value="${esc(c.id)}" ${c.id === pre ? "selected" : ""}>${esc(c.year + " " + c.name)}${c.price ? " · $" + Number(c.price).toLocaleString("en-US") : ""}</option>`).join("");

$("#f").onsubmit = async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  if (!f.first.trim() || !f.last.trim() || !f.phone.trim()) { $("#err").textContent = "Please fill in your name and phone number."; return; }
  if (!f.consent) { $("#err").textContent = "Please tick the box to confirm."; return; }
  $("#err").textContent = ""; $("#go").disabled = true; $("#go").textContent = "Sending…";
  const car = cars.find((c) => c.id === f.carId);
  const lines = [
    "ONLINE CREDIT APPLICATION", "",
    `Name: ${f.first} ${f.last}`, `Phone: ${f.phone}`, `Email: ${f.email || "—"}`, `Date of birth: ${f.dob || "—"}`, "",
    `Address: ${[f.street, f.city, f.state, f.zip].filter(Boolean).join(", ") || "—"}`, `Housing: ${f.housing || "—"} · ${f.housingPay ? "$" + f.housingPay + "/mo" : "—"} · ${f.timeAddr || "—"}`, "",
    `Employer: ${f.employer || "—"} · ${f.job || "—"} · ${f.timeJob || "—"}`, `Monthly income: ${f.income ? "$" + f.income : "—"}${f.otherIncome ? " + other $" + f.otherIncome : ""}`, "",
    `Car: ${car ? car.year + " " + car.name : "not sure yet"}`, `Down payment: ${f.down ? "$" + f.down : "—"}`, `Trade-in: ${f.trade || "—"}`, "", f.notes || "",
  ];
  try {
    const r = await fetch("/api/lead", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      type: "credit", name: `${f.first} ${f.last}`.trim(), phone: f.phone, email: f.email, carId: f.carId, message: lines.join("\n"), tenant: dealer, website: f.website,
      credit: { first: f.first, last: f.last, dob: f.dob, street: f.street, city: f.city, state: f.state, zip: f.zip, housing: f.housing, housingPay: f.housingPay, timeAddr: f.timeAddr, employer: f.employer, job: f.job, timeJob: f.timeJob, income: f.income, otherIncome: f.otherIncome, down: f.down, trade: f.trade } }) });
    if (!r.ok) throw 0;
    $("#main").innerHTML = `<div class="done"><b>Thank you, ${esc(f.first)}!</b><br>We got your application and will call you shortly${S.phone ? `. Questions? Call <a href="tel:${esc(String(S.phone).replace(/[^\d+]/g, ""))}">${esc(S.phone)}</a>` : ""}.<br><br><a href="${dealer ? "/w/" + dealer : "/"}">← Back to the cars</a></div>`;
  } catch (_) { $("#go").disabled = false; $("#go").textContent = "Send my application"; $("#err").textContent = "Couldn't send right now. Please try again or call us."; }
};
