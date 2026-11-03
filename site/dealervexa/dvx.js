// DealerVexa landing page: scroll reveal, counters, platform marquee, before/after slider, templates, live pricing.
import { TEMPLATES, DEALER_TEMPLATES } from "/t/templates.js";
import { thumb, bindThumbs, openPreview, demoUrl } from "/t/gallery.js";
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

// nav background after scrolling
const nav = $("#nav"); const onScroll = () => nav.classList.toggle("solid", scrollY > 30); addEventListener("scroll", onScroll, { passive: true }); onScroll();

// listing platforms marquee
const P = ["CARFAX", "Cars.com", "Autotrader", "CarGurus", "TrueCar", "Edmunds", "Facebook", "Instagram", "TikTok", "Google", "KSL Cars", "CarsForSale", "Craigslist", "OfferUp"];
$("#marq").innerHTML = [...P, ...P].map((x) => `<span>${esc(x)}</span>`).join("");

// counters
const count = (el) => { const to = +el.dataset.count, t0 = performance.now(), d = 1400; if (RM) { el.textContent = to; return; }
  const step = (t) => { const k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); };

// reveal on scroll (with a small stagger inside grids)
const io = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; const el = e.target; io.unobserve(el);
  const sib = [...el.parentElement.children].filter((x) => x.classList.contains("rv")); const i = Math.max(0, sib.indexOf(el));
  setTimeout(() => { el.classList.add("in"); el.querySelectorAll("[data-count]").forEach(count); if (el.dataset.count) count(el); }, RM ? 0 : Math.min(i, 8) * 80); }), { threshold: 0.12 });
$$(".rv").forEach((el) => io.observe(el));
$$(".stats [data-count]").forEach((el) => { const o = new IntersectionObserver((es) => { if (es[0].isIntersecting) { o.disconnect(); count(el); } }, { threshold: .5 }); o.observe(el); });
setTimeout(() => $$(".hero [data-count]").forEach(count), 400);
$$(".chart i").forEach((b, i) => b.style.setProperty("--i", (i * 0.08).toFixed(2)));

// before / after slider (moves by itself until touched)
const ba = $("#ba"), range = $("#ba input"); let touched = false;
const setX = (v) => ba.style.setProperty("--x", v + "%");
range.oninput = () => { touched = true; setX(range.value); };
if (!RM) { let t = 0; const auto = () => { if (touched) return; t += 0.012; const v = 50 + Math.sin(t) * 32; range.value = v; setX(v); requestAnimationFrame(auto); };
  new IntersectionObserver((es) => { if (es[0].isIntersecting) requestAnimationFrame(auto); }, { threshold: .4 }).observe(ba); }

// three template examples
const pick = ["classic", "luxury", "country"].filter((k) => DEALER_TEMPLATES.includes(k));
$("#tpls").innerHTML = pick.map((k) => `<div class="tpl rv">${thumb(demoUrl(k), "Preview " + TEMPLATES[k].name)}<b>${esc(TEMPLATES[k].name)}</b><small>${esc(TEMPLATES[k].desc)}</small></div>`).join("");
$$("#tpls .rv").forEach((el) => io.observe(el));
const big = (k) => { const i = DEALER_TEMPLATES.indexOf(k), n = DEALER_TEMPLATES.length; openPreview(demoUrl(k), TEMPLATES[k].name, { onUse: () => (location.href = "/signup?template=" + k), useLabel: "Start with this design", prev: () => big(DEALER_TEMPLATES[(i - 1 + n) % n]), next: () => big(DEALER_TEMPLATES[(i + 1) % n]) }); };
bindThumbs($("#tpls"), (url) => big(new URLSearchParams(url.split("?")[1]).get("template")));

// pricing from the live plans
const FALLBACK = [{ id: "starter", name: "Starter", price: 49, desc: "Website, inventory, leads, AI photo studio, inspections." }, { id: "pro", name: "Pro", price: 99, desc: "Everything in Starter + deals, buy-here-pay-here collections, exports to every listing site, FTP." }, { id: "dealer-plus", name: "Dealer Plus", price: 179, desc: "Everything in Pro + your own domain set up for you, priority help." }];
let plans = FALLBACK; try { const r = await (await fetch("/api/signup")).json(); if (r.plans && r.plans.length) plans = r.plans; } catch (_) {}
$("#prices").innerHTML = plans.map((p, i) => `<div class="price rv ${i === 1 ? "hot" : ""}">${i === 1 ? '<span class="tag">Most popular</span>' : ""}<h3>${esc(p.name)}</h3><div class="amt">$${esc(p.price)}<small> / month</small></div><p>${esc(p.desc)}</p><a class="btn ${i === 1 ? "" : "ghost"}" style="${i === 1 ? "" : "color:var(--ink)"}" href="/signup">Choose ${esc(p.name)}</a></div>`).join("");
$$("#prices .rv").forEach((el) => io.observe(el));
