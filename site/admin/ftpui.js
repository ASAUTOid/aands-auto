// FTP delivery panel, used by the main dashboard and by every dealer admin.
// api: { get() -> cfg, put(cfg) -> cfg, send(feed) -> entry }
import { PRESETS } from "../feeds.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const when = (s) => (s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");

export async function ftpPanel(el, api, toast) {
  const names = [...Object.entries(PRESETS).map(([k, p]) => [k, p.label]), ["custom", "Custom export"]];
  let cfg = {}, open = null;
  el.innerHTML = '<p style="color:var(--muted)">Loading FTP settings…</p>';
  try { cfg = await api.get(); } catch (_) { el.innerHTML = '<p style="color:var(--bad)">Could not load the FTP settings.</p>'; return; }
  const status = (c) => !c?.host ? '<span style="color:var(--dim)">Not set up</span>'
    : c.lastError ? `<span style="color:var(--bad)">Failed${c.lastErrorAt ? " " + when(c.lastErrorAt) : ""}: ${esc(c.lastError)}</span>`
    : c.lastSent ? `<span style="color:var(--ok)">Sent ${when(c.lastSent)} · ${c.lastCount ?? "?"} cars</span>` : '<span style="color:var(--muted)">Ready, not sent yet</span>';
  const inp = (k, l, v, t = "text", ph = "") => `<div class="f"><label>${l}</label><input data-k="${k}" type="${t}" value="${esc(v ?? "")}" placeholder="${esc(ph)}" autocomplete="off"></div>`;
  const draw = () => {
    el.innerHTML = `<div class="tw"><table class="t"><thead><tr><th>Feed</th><th>FTP server</th><th>Daily</th><th>Last delivery</th><th></th></tr></thead><tbody>
      ${names.map(([k, l]) => { const c = cfg[k] || {}; return `<tr><td><b>${esc(l)}</b></td><td style="font-family:var(--mono);font-size:12px">${esc(c.host || "—")}</td><td>${c.auto ? "✓" : "—"}</td><td style="font-size:13px">${status(c)}</td>
        <td style="white-space:nowrap"><button class="b sm" type="button" data-open="${k}">${open === k ? "Close" : c.host ? "Edit" : "Set up"}</button>${c.host ? ` <button class="b sm primary" type="button" data-send="${k}">Send now</button>` : ""}</td></tr>
        ${open === k ? `<tr><td colspan="5" style="background:var(--panel-2)"><div class="fg">
          ${inp("host", "FTP server", c.host, "text", "ftp.example.com")}${inp("port", "Port", c.port || 21, "number")}${inp("user", "User", c.user)}
          ${inp("password", "Password", "", "password", c.hasPassword ? "saved, leave empty to keep" : "")}${inp("dir", "Folder (optional)", c.dir, "text", "/inventory")}${inp("filename", "File name (optional)", c.filename, "text", "inventory.csv")}</div>
          <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px"><label class="chk"><input type="checkbox" data-k="secure" ${c.secure ? "checked" : ""}> Secure FTP (FTPS)</label><label class="chk"><input type="checkbox" data-k="auto" ${c.auto ? "checked" : ""}> Send automatically every day</label></div>
          <div class="formft"><button class="b primary" type="button" data-save="${k}">Save FTP details</button></div></td></tr>` : ""}`; }).join("")}
      </tbody></table></div>`;
    el.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => { open = open === b.dataset.open ? null : b.dataset.open; draw(); }));
    el.querySelectorAll("[data-save]").forEach((b) => (b.onclick = async () => {
      const k = b.dataset.save, f = {}; el.querySelectorAll("[data-k]").forEach((i) => (f[i.dataset.k] = i.type === "checkbox" ? i.checked : i.value));
      if (!f.host || !f.user) return toast("Fill in the FTP server and the user.", 1);
      b.disabled = true;
      try { cfg = await api.put({ [k]: f }); open = null; toast("FTP details saved"); draw(); } catch (_) { b.disabled = false; toast("Could not save the FTP details.", 1); }
    }));
    el.querySelectorAll("[data-send]").forEach((b) => (b.onclick = async () => {
      const k = b.dataset.send; b.disabled = true; b.textContent = "Sending…";
      try { cfg[k] = await api.send(k); toast(cfg[k].lastError ? "Sending failed: " + cfg[k].lastError : "Sent!", !!cfg[k].lastError); }
      catch (x) { toast("Sending failed" + (x && x.code ? ": " + x.code : ""), 1); }
      draw();
    }));
  };
  draw();
}
