// DealerVexa e-mails through Resend (https://resend.com).
// Turned on by the Netlify environment variable RESEND_API_KEY. Without it nothing is sent and nothing breaks.
// Sender: MAIL_FROM (default "DealerVexa <hello@dealervexa.com>"; the domain must be verified in Resend).
// Owner notifications go to HQ → Plans & wallets → "Your e-mail for notifications" (config.ownerEmail).
import { getConfig, tenants } from "./hq.mjs";

export const hasMail = () => !!process.env.RESEND_API_KEY;
const SITE = () => (process.env.DVX_URL || "https://dealervexa.com").replace(/\/$/, "");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (n) => "$" + (+n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function layout(title, body, cta) {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f6;font-family:Arial,Helvetica,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:#0a0a0c;padding:20px 28px"><span style="font:800 22px Arial,sans-serif;color:#e5e7eb">Dealer</span><span style="font:800 22px Arial,sans-serif;color:#e11d2a">Vexa</span></td></tr>
<tr><td style="padding:28px"><h1 style="font-size:22px;margin:0 0 14px">${esc(title)}</h1>${body}
${cta ? `<p style="margin:26px 0 6px"><a href="${esc(cta.url)}" style="background:#e11d2a;color:#fff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:8px;display:inline-block">${esc(cta.label)}</a></p>` : ""}</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #eee;color:#777;font-size:12px">DealerVexa · Dealership Management Platform · <a href="${SITE()}/contact" style="color:#777">Contact us</a></td></tr>
</table></td></tr></table></body></html>`;
}
const p = (t) => `<p style="margin:0 0 12px;line-height:1.55">${t}</p>`;
const rows = (r) => `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0 14px">${r.map(([k, v]) => `<tr><td style="padding:7px 0;color:#666;border-bottom:1px solid #eee;width:40%">${esc(k)}</td><td style="padding:7px 0;border-bottom:1px solid #eee;font-weight:600;overflow-wrap:anywhere">${v}</td></tr>`).join("")}</table>`;

export async function sendMail({ to, subject, html, replyTo }) {
  const list = [].concat(to || []).map((x) => String(x || "").trim()).filter((x) => /^\S+@\S+\.\S+$/.test(x));
  if (!hasMail() || !list.length) return { skipped: true };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { authorization: "Bearer " + process.env.RESEND_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM || "DealerVexa <hello@dealervexa.com>", to: list, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    if (!r.ok) console.error("mail failed", r.status, (await r.text()).slice(0, 300));
    return { ok: r.ok };
  } catch (e) { console.error("mail error", e.message); return { ok: false }; }
}
const owner = async () => (await getConfig()).ownerEmail || process.env.OWNER_EMAIL || "";
export async function dealerEmail(slug) { const d = await tenants().get("site/" + slug, { type: "json" }); return d?.settings?.email || ""; }
const wallets = (cfg) => rows(Object.entries(cfg.wallets || {}).filter(([, v]) => v).map(([k, v]) => [k, `<code>${esc(v)}</code>`]));

// ---- the messages ----
export const mail = {
  async signupReceived(s) {
    const cfg = await getConfig();
    await sendMail({ to: s.email, subject: "We got your DealerVexa sign-up", html: layout(`Thanks, ${s.contact}!`,
      p(`We received the sign-up for <b>${esc(s.dealer)}</b>. To start, send <b>${money(s.amount)}</b> for the first month to one of these wallets, then press <b>"I've paid"</b> on the sign-up page (or reply with the transaction ID):`) + wallets(cfg)
      + p(`As soon as the payment arrives, we turn on your panel and website and send you the links.`)) });
    await sendMail({ to: await owner(), subject: `New sign-up: ${s.dealer}`, replyTo: s.email, html: layout("New dealer sign-up",
      rows([["Dealer", esc(s.dealer)], ["Contact", esc(s.contact)], ["Email", esc(s.email)], ["Phone", esc(s.phone)], ["Link", esc(s.slug)], ["Plan", `${esc(s.plan)} · ${money(s.amount)}`]]), { url: SITE() + "/admin/#/signups", label: "Open sign-ups in HQ" }) });
  },
  async paymentSubmitted(s) {
    await sendMail({ to: await owner(), subject: `Payment sent: ${s.dealer}`, html: layout("A dealer says they paid",
      rows([["Dealer", esc(s.dealer)], ["Coin", esc(s.coin)], ["Transaction", esc(s.txHash)], ["Amount due", money(s.amount)]]) + p("Check the wallet, then approve the sign-up."), { url: SITE() + "/admin/#/signups", label: "Approve in HQ" }) });
  },
  async approved(s) {
    const site = `${SITE()}/w/${s.slug}`;
    await sendMail({ to: s.email, subject: "Your DealerVexa account is live", html: layout(`Welcome to DealerVexa, ${s.contact}!`,
      p(`Your payment is confirmed and <b>${esc(s.dealer)}</b> is live.`) + rows([["Your website", `<a href="${site}">${site}</a>`], ["Your panel", `<a href="${site}/admin">${site}/admin</a>`], ["Log in with", `the link name <b>${esc(s.slug)}</b> and the password you chose`]])
      + p(`Start by adding your logo and phone in <b>Settings</b>, then add your cars. Need help? Press <b>Help</b> in the panel.`), { url: `${site}/admin`, label: "Open my panel" }) });
  },
  async invoice(i) {
    const cfg = await getConfig(), to = await dealerEmail(i.slug);
    await sendMail({ to, subject: `DealerVexa invoice: ${money(i.amount)}`, html: layout("New invoice",
      rows([["Amount", money(i.amount)], ["For", esc(i.period || i.plan || "DealerVexa")], ...(i.note ? [["Note", esc(i.note)]] : [])]) + p("Pay in crypto to one of these wallets, then mark it paid in your panel (Billing) with the transaction ID:") + wallets(cfg),
      { url: `${SITE()}/w/${i.slug}/admin#/billing`, label: "Open Billing" }) });
  },
  async paid(i, paidUntil) {
    const to = await dealerEmail(i.slug);
    await sendMail({ to, subject: "Payment received, thank you", html: layout("Payment received",
      rows([["Amount", money(i.amount)], ["For", esc(i.period || i.plan || "DealerVexa")], ...(paidUntil ? [["Paid until", esc(paidUntil)]] : [])]) + p("Thank you for using DealerVexa.")) });
  },
  async ticketAnswered(t, text) {
    const to = await dealerEmail(t.slug);
    await sendMail({ to, subject: `Re: ${t.subject}`, html: layout("We answered your question",
      `<div style="border-left:3px solid #e11d2a;padding:4px 0 4px 12px;margin:0 0 14px;white-space:pre-wrap">${esc(text)}</div>` + p("Reply in your panel under Help."), { url: `${SITE()}/w/${t.slug}/admin#/help`, label: "Open Help" }) });
  },
  async newTicket(t, text, fromWebsite) {
    await sendMail({ to: await owner(), subject: fromWebsite ? t.subject : `Help request: ${t.subject}`, replyTo: t.contact?.email,
      html: layout(fromWebsite ? "New message from the contact page" : `Help request from ${t.slug}`,
        (t.contact ? rows([["Name", esc(t.contact.name)], ["Dealership", esc(t.contact.dealer)], ["Email", esc(t.contact.email)], ["Phone", esc(t.contact.phone)]]) : "")
        + `<div style="white-space:pre-wrap;background:#f6f6f7;border-radius:8px;padding:12px">${esc(text)}</div>`, { url: SITE() + "/admin/#/support", label: "Open Support in HQ" }) });
  },
};
