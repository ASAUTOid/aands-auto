// DealerVexa sign-up: 1 dealership · 2 website · 3 plan · 4 pay in crypto
import { TEMPLATES, DEALER_TEMPLATES } from "/t/templates.js";
import { thumb, bindThumbs, openPreview, demoUrl } from "/t/gallery.js";

const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slugify = (t) => String(t || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const F = { template: new URLSearchParams(location.search).get("template") || "classic" };
let CFG = { open: true, plans: [], wallets: {} }, step = 1, signup = null;
try { CFG = await (await fetch("/api/signup")).json(); } catch (_) {}
if (!F.plan) F.plan = (CFG.plans[1] || CFG.plans[0] || {}).id;
const err = (t) => ($("#err").textContent = t || "");
const NAMES = ["Your dealership", "Your website", "Your plan", "Payment"];

function draw() {
  $("#steps").innerHTML = NAMES.map((n, i) => `<span class="${i + 1 === step ? "on" : ""}">${i + 1}. ${n}</span>`).join("");
  err("");
  if (!CFG.open) { $("#step").innerHTML = '<div class="card">Sign-ups are closed right now. Please check back soon.</div>'; return; }
  const S = $("#step");
  if (step === 1) {
    S.innerHTML = `<div class="card"><div class="g">
      <label>Dealership name *<input id="dealer" value="${esc(F.dealer || "")}" autocomplete="organization"></label><label>Your name *<input id="contact" value="${esc(F.contact || "")}" autocomplete="name"></label>
      <label>Email *<input id="email" type="email" value="${esc(F.email || "")}" autocomplete="email"></label><label>Phone *<input id="phone" type="tel" value="${esc(F.phone || "")}" autocomplete="tel"></label>
      <label>City<input id="city" value="${esc(F.city || "")}"></label><label>State<input id="state" value="${esc(F.state || "")}"></label></div></div>
      <div class="row"><span></span><button class="btn" id="next">Next →</button></div>`;
    $("#next").onclick = () => { ["dealer", "contact", "email", "phone", "city", "state"].forEach((k) => (F[k] = $("#" + k).value.trim()));
      if (!F.dealer || !F.contact || !F.email || !F.phone) return err("Please fill in the fields marked *.");
      if (!/^\S+@\S+\.\S+$/.test(F.email)) return err("Please check the email address.");
      if (!F.slug) F.slug = slugify(F.dealer); step = 2; draw(); };
  } else if (step === 2) {
    S.innerHTML = `<div class="card"><div class="g"><label>Website link *<input id="slug" value="${esc(F.slug || "")}"><small id="slugMsg" style="color:var(--muted)">Your website: ${esc(location.host)}/w/<b id="slugShow">${esc(F.slug || "")}</b> (you can add your own domain later)</small></label>
      <label>Password for your panel * (8+ characters)<input id="pw" type="password" value="${esc(F.password || "")}" autocomplete="new-password"></label></div></div>
      <div class="card"><b>Pick a design</b> <small style="color:var(--muted)">(click a picture to see it full size; you can change it any time)</small>
      <div class="tpls" style="margin-top:12px">${DEALER_TEMPLATES.map((k) => `<button type="button" class="tp ${k === F.template ? "on" : ""}" data-t="${k}">${thumb(demoUrl(k), "Preview " + TEMPLATES[k].name)}<b>${esc(TEMPLATES[k].name)}</b><small>${esc(TEMPLATES[k].desc)}</small></button>`).join("")}</div></div>
      <div class="row"><button class="btn ghost" id="back">← Back</button><button class="btn" id="next">Next →</button></div>`;
    let timer;
    const check = async () => { const s = slugify($("#slug").value); $("#slugShow").textContent = s; if (!s) return;
      try { const r = await (await fetch("/api/signup/check?slug=" + encodeURIComponent(s))).json(); $("#slugMsg").className = r.ok ? "ok" : "err"; $("#slugMsg").innerHTML = r.ok ? `✓ ${esc(location.host)}/w/${esc(s)} is free` : "✕ That link is taken, try another one"; } catch (_) {} };
    $("#slug").oninput = () => { clearTimeout(timer); timer = setTimeout(check, 400); }; check();
    $$("[data-t]").forEach((b) => (b.onclick = (e) => { if (e.target.closest(".gthumb")) return; F.template = b.dataset.t; $$("[data-t]").forEach((x) => x.classList.toggle("on", x === b)); }));
    const big = (k) => { const i = DEALER_TEMPLATES.indexOf(k), n = DEALER_TEMPLATES.length;
      openPreview(demoUrl(k), TEMPLATES[k].name, { onUse: () => { F.template = k; $$("[data-t]").forEach((x) => x.classList.toggle("on", x.dataset.t === k)); }, useLabel: "Choose this design", prev: () => big(DEALER_TEMPLATES[(i - 1 + n) % n]), next: () => big(DEALER_TEMPLATES[(i + 1) % n]) }); };
    bindThumbs($("#step"), (url) => big(new URLSearchParams(url.split("?")[1]).get("template")));
    $("#back").onclick = () => { step = 1; draw(); };
    $("#next").onclick = () => { F.slug = slugify($("#slug").value); F.password = $("#pw").value;
      if (!F.slug || F.slug.length < 2) return err("Pick a website link."); if (F.password.length < 8) return err("The password needs at least 8 characters."); step = 3; draw(); };
  } else if (step === 3) {
    S.innerHTML = `<div class="plans">${CFG.plans.map((p) => `<button type="button" class="plan ${p.id === F.plan ? "on" : ""}" data-p="${esc(p.id)}"><b style="font-size:20px">${esc(p.name)}</b><div class="pr">$${esc(p.price)}<small> / month</small></div><p>${esc(p.desc)}</p></button>`).join("")}</div>
      <p style="color:var(--muted);font-size:14px">Paid monthly in crypto. No contract: stop any time.</p>
      <div class="row"><button class="btn ghost" id="back">← Back</button><button class="btn" id="next">Continue to payment →</button></div>`;
    $$("[data-p]").forEach((b) => (b.onclick = () => { F.plan = b.dataset.p; $$("[data-p]").forEach((x) => x.classList.toggle("on", x === b)); }));
    $("#back").onclick = () => { step = 2; draw(); };
    $("#next").onclick = async () => { $("#next").disabled = true;
      try { const r = await fetch("/api/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(F) }); const b = await r.json();
        if (!r.ok) { $("#next").disabled = false; if (/link/i.test(b.error || "")) { step = 2; draw(); } return err(b.error || "Something went wrong. Try again."); }
        signup = b; step = 4; draw(); } catch (_) { $("#next").disabled = false; err("Could not reach the server. Try again."); } };
  } else if (step === 4) {
    const w = Object.entries(signup.wallets || {});
    S.innerHTML = `<div class="card"><p style="margin:0 0 6px">Your plan: <b>${esc(signup.plan)}</b></p><p style="font-size:30px;font-weight:800;margin:0 0 10px">$${esc(signup.amount)} <small style="font-size:15px;color:var(--muted);font-weight:500">for the first month, in USD</small></p>
      ${signup.payUrl ? `<p style="margin:0 0 14px"><a class="btn" href="${esc(signup.payUrl)}" target="_blank" rel="noopener">Pay with crypto now →</a><br><small style="color:var(--muted)">Pick your coin on the secure payment page. Your account turns on by itself as soon as the payment is confirmed, and we e-mail you the links.</small></p><p style="color:var(--muted);margin:0 0 6px"><b>Or pay by hand:</b></p>` : ""}
      <p style="color:var(--muted);margin:0 0 10px">Send the same value in one of these coins. Copy the address carefully and make sure the network is right.</p>
      ${w.length ? w.map(([c, a]) => `<div class="wal"><b>${esc(c)}</b><code>${esc(a)}</code><button class="btn ghost" type="button" data-copy="${esc(a)}" style="padding:8px 12px;font-size:14px">Copy</button></div>`).join("") : "<p>Payment addresses are being set up. We'll contact you with the payment details.</p>"}</div>
      ${w.length ? `<div class="card"><b>After you pay</b><div class="g" style="margin-top:10px"><label>I paid with<select id="coin">${w.map(([c]) => `<option>${esc(c)}</option>`).join("")}</select></label><label style="grid-column:span 2">Transaction ID (hash) from your wallet<input id="tx"></label></div>
        <div class="row"><span></span><button class="btn" id="paid">I've paid ✓</button></div></div>` : ""}`;
    $$("[data-copy]").forEach((b) => (b.onclick = () => navigator.clipboard?.writeText(b.dataset.copy).then(() => (b.textContent = "Copied ✓"))));
    if ($("#paid")) $("#paid").onclick = async () => { const tx = $("#tx").value.trim(); if (!tx) return err("Paste the transaction ID so we can find your payment.");
      $("#paid").disabled = true;
      try { const r = await fetch("/api/signup/" + signup.id, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ coin: $("#coin").value, txHash: tx }) }); if (!r.ok) throw 0;
        $("#steps").innerHTML = ""; S.innerHTML = `<div class="card done"><div class="big">🎉</div><h2>Thank you, ${esc(F.contact.split(" ")[0])}!</h2><p>We're checking your payment. As soon as it's confirmed, your website goes live at<br><b>${esc(location.host)}/w/${esc(F.slug)}</b><br>and your panel at <b>${esc(location.host)}/w/${esc(F.slug)}/admin</b> (log in with the password you just chose).</p><p style="color:var(--muted)">We'll contact you at ${esc(F.email)}.</p></div>`;
      } catch (_) { $("#paid").disabled = false; err("Could not send. Try again."); } };
  }
}
draw();
