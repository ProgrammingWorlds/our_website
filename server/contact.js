// Contact-form handler, shared by the Vercel function (api/contact.js) and the
// Vite dev/preview server. Validates and sanitizes the inquiry, rate-limits by
// IP, and delivers it by email through the Resend HTTP API.
//
// Environment variables:
//   RESEND_API_KEY  required — API key from https://resend.com
//   CONTACT_FROM    sender, e.g. "Programming Worlds <hello@your-domain.com>"
//                   (a domain verified in Resend; defaults to Resend's test sender)
//   CONTACT_TO      destination, defaults to programmingworld2030@gmail.com

export const DEFAULT_TO = 'programmingworld2030@gmail.com';
export const DEFAULT_FROM = 'Programming Worlds <onboarding@resend.dev>';
export const LIMITS = { name: 100, email: 160, company: 120, message: 3000, body: 16000 };
export const SERVICES = { web: 'Web & Systems', software: 'Software Solutions', mobile: 'Mobile Apps', nfc: 'NFC Experiences', training: 'Training & Courses', other: 'Something else' };
export const SCOPES = { unsure: 'Not sure yet', small: 'Small — a page, an update or a fix', medium: 'Medium — a full website or app', large: 'Large — a custom platform or system' };
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const MIN_FILL_MS = 1500; // faster than any person can fill the form

// strip control and invisible formatting characters (keeps newlines in multi-line text)
const CONTROL = new RegExp('[\u0000-\u0009\u000B-\u001F\u007F\u200B-\u200F\u2028\u2029\uFEFF]', 'g');
const text = (v, max) =>
  String(v ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL, '')
    .trim()
    .slice(0, max);
const line = (v, max) => text(v, max * 2).replace(/\s+/g, ' ').slice(0, max);
export const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Validates and normalizes a submission. Returns { data } or { errors }. */
export function validate(input) {
  const body = input && typeof input === 'object' ? input : {};
  const data = {
    name: line(body.name, LIMITS.name),
    email: line(body.email, LIMITS.email).toLowerCase(),
    company: line(body.company, LIMITS.company),
    service: String(body.service ?? ''),
    scope: String(body.scope ?? 'unsure'),
    message: text(body.message, LIMITS.message + 1),
    lang: body.lang === 'ar' ? 'ar' : 'en',
  };
  const errors = {};
  if (!data.name) errors.name = 'required';
  if (!EMAIL_RE.test(data.email)) errors.email = 'email';
  if (!(data.service in SERVICES)) errors.service = 'required';
  if (!(data.scope in SCOPES)) data.scope = 'unsure';
  if (data.message.length < 10) errors.message = 'short';
  else if (data.message.length > LIMITS.message) errors.message = 'long';
  // spam checks: the hidden honeypot field must stay empty, and the form can't be filled instantly
  const spam = String(body.website ?? '').trim() !== '' || !(Number(body.elapsed) >= MIN_FILL_MS);
  return Object.keys(errors).length || spam ? { errors, spam } : { data };
}

/** Sliding-window limiter, per key (IP). Best effort: it lives in one server instance. */
export function createRateLimiter({ windowMs = 10 * 60 * 1000, max = 5 } = {}) {
  const hits = new Map();
  return (key, now = Date.now()) => {
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) {
      hits.set(key, list);
      return false;
    }
    list.push(now);
    hits.set(key, list);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    return true;
  };
}

export function composeEmail(d) {
  const rows = [
    ['Name', d.name],
    ['Email', d.email],
    ['Company', d.company || '—'],
    ['Service', SERVICES[d.service]],
    ['Scope', SCOPES[d.scope]],
    ['Language', d.lang === 'ar' ? 'Arabic' : 'English'],
  ];
  const subject = `New inquiry — ${SERVICES[d.service]} — ${d.name}`.slice(0, 180);
  const textBody = `${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nMessage:\n${d.message}\n`;
  const html =
    `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#0a1544">` +
    `<h2 style="margin:0 0 12px">New inquiry from the website</h2>` +
    `<table style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#46557f">${k}</td><td style="padding:4px 0"><strong>${escapeHtml(String(v))}</strong></td></tr>`).join('')}</table>` +
    `<p style="margin:16px 0 4px;color:#46557f">Message</p>` +
    `<p style="margin:0;white-space:pre-wrap">${escapeHtml(d.message)}</p></div>`;
  return { subject, text: textBody, html };
}

const hostOf = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

/**
 * Handles one request. Returns { status, body } — never a success unless the
 * email provider accepted the message.
 */
export async function handleContact({ method, body, headers = {}, ip = 'unknown', env = {}, limiter, fetchImpl = fetch }) {
  if (method !== 'POST') return { status: 405, body: { ok: false, error: 'method_not_allowed' } };
  // only accept posts from this site's own pages
  const origin = headers.origin;
  if (origin && hostOf(origin) !== headers.host && !(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).includes(origin)) {
    return { status: 403, body: { ok: false, error: 'forbidden' } };
  }
  let input = body;
  if (typeof input === 'string' || Buffer.isBuffer?.(input)) {
    const raw = String(input);
    if (raw.length > LIMITS.body) return { status: 413, body: { ok: false, error: 'too_large' } };
    try {
      input = JSON.parse(raw);
    } catch {
      return { status: 400, body: { ok: false, error: 'invalid_json' } };
    }
  }
  if (limiter && !limiter(ip)) return { status: 429, body: { ok: false, error: 'rate_limited' } };

  const { data, errors, spam } = validate(input);
  if (spam) return { status: 400, body: { ok: false, error: 'rejected' } };
  if (!data) return { status: 400, body: { ok: false, error: 'invalid', fields: errors } };

  if (!env.RESEND_API_KEY) {
    console.error('[contact] RESEND_API_KEY is not set — the inquiry was NOT delivered.');
    return { status: 503, body: { ok: false, error: 'not_configured' } };
  }
  const mail = composeEmail(data);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.CONTACT_FROM || DEFAULT_FROM,
        to: [env.CONTACT_TO || DEFAULT_TO],
        reply_to: data.email,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
      signal: ctrl.signal,
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.id) {
      console.error('[contact] email provider rejected the message', res.status, out?.message || out?.name || '');
      return { status: 502, body: { ok: false, error: 'delivery_failed' } };
    }
    return { status: 200, body: { ok: true, id: out.id } };
  } catch (err) {
    console.error('[contact] email provider unreachable', err?.name || err);
    return { status: 502, body: { ok: false, error: 'delivery_failed' } };
  } finally {
    clearTimeout(timer);
  }
}
