/**
 * Envío de emails con Resend (https://resend.com) mediante su API HTTP.
 * Variables: RESEND_API_KEY, EMAIL_FROM ("Dos Studio OS <avisos@tudominio.com>") y APP_URL.
 * Si falta la clave, no se envía nada y el aviso queda solo dentro del panel.
 */

export const appUrl = () => (process.env.APP_URL ?? "").replace(/\/$/, "");

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

type Item = { title: string; detail?: string; link?: string | null };

/** HTML sencillo con la marca: título, párrafo, lista de elementos y botón. */
export function renderEmail({ heading, intro, items = [], cta }: { heading: string; intro?: string; items?: Item[]; cta?: { label: string; href: string } }) {
  const base = appUrl();
  const abs = (l?: string | null) => (l ? (l.startsWith("http") ? l : `${base}${l}`) : null);
  const list = items
    .map((it) => {
      const href = abs(it.link);
      const title = href ? `<a href="${esc(href)}" style="color:#0A0A0B;text-decoration:none;font-weight:600">${esc(it.title)}</a>` : `<strong>${esc(it.title)}</strong>`;
      return `<tr><td style="padding:10px 0;border-top:1px solid #E4E2EC;font-size:14px;line-height:1.45">${title}${it.detail ? `<br><span style="color:#5B5B66;font-size:13px">${esc(it.detail)}</span>` : ""}</td></tr>`;
    })
    .join("");
  const button = cta
    ? `<p style="margin:24px 0 0"><a href="${esc(abs(cta.href)!)}" style="display:inline-block;background:#5430FF;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px">${esc(cta.label)}</a></p>`
    : "";
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#F7F6FB;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0A0A0B">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #E4E2EC;border-radius:14px;padding:28px">
<tr><td style="font-size:13px;font-weight:700;letter-spacing:.02em">Dos Studio<span style="color:#5430FF">.</span> <span style="color:#5B5B66;font-weight:500">OS</span></td></tr>
<tr><td style="padding-top:18px;font-size:20px;font-weight:700;line-height:1.3">${esc(heading)}</td></tr>
${intro ? `<tr><td style="padding-top:8px;font-size:14px;color:#5B5B66;line-height:1.5">${esc(intro)}</td></tr>` : ""}
${list ? `<tr><td style="padding-top:16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${list}</table></td></tr>` : ""}
<tr><td>${button}</td></tr>
</table>
<p style="font-size:11px;color:#5B5B66;margin-top:14px">Puedes cambiar cómo recibes estos avisos en Ajustes del panel.</p>
</td></tr></table></body></html>`;
  const text = [heading, intro, ...items.map((i) => `· ${i.title}${i.detail ? ` — ${i.detail}` : ""}`), cta ? `${cta.label}: ${abs(cta.href)}` : ""]
    .filter(Boolean)
    .join("\n");
  return { html, text };
}

export async function sendEmail(to: string, subject: string, content: { html: string; text: string }): Promise<boolean> {
  if (!emailEnabled()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html: content.html, text: content.text }),
    });
    if (!res.ok) console.error("Resend", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("Resend", e);
    return false;
  }
}
