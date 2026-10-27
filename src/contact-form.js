import { t } from './i18n.js';
import { SITE } from './config.js';

// Stable values sent to the server (labels are translated, values are not).
export const SERVICE_KEYS = ['web', 'software', 'mobile', 'nfc', 'training', 'other'];
export const SCOPE_KEYS = ['unsure', 'small', 'medium', 'large'];
export const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const REQUIRED = ['name', 'email', 'service', 'message'];

/** Returns an error key for a field value, or '' when it is valid. */
export function fieldError(name, value) {
  const v = String(value ?? '').trim();
  if (REQUIRED.includes(name) && !v) return 'required';
  if (name === 'email' && !EMAIL_RE.test(v)) return 'email';
  if (name === 'message' && v.length < 10) return 'short';
  if (name === 'message' && v.length > 3000) return 'long';
  return '';
}

/**
 * The contact form posts JSON to /api/contact (a serverless function that
 * sends the inquiry by email). Success is only shown when the server confirms
 * the email provider accepted the message.
 */
export function createContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return { build() {} };
  const f = (n) => form.elements[n];
  const submit = document.getElementById('cfSubmit');
  const submitLabel = document.getElementById('cfSubmitLabel');
  const status = document.getElementById('cfStatus');
  let lang = 'en', started = Date.now(), busy = false, state = 'idle';
  const touched = new Set();

  function build(l) {
    lang = l;
    const keep = { service: f('service').value, scope: f('scope').value };
    f('service').innerHTML =
      `<option value="">${t(l, 'contact.form.servicePick')}</option>` +
      t(l, 'services.items').map((it, k) => `<option value="${SERVICE_KEYS[k]}">${it.title}</option>`).join('') +
      `<option value="other">${t(l, 'contact.form.serviceOther')}</option>`;
    f('scope').innerHTML = t(l, 'contact.form.scopes').map((s, k) => `<option value="${SCOPE_KEYS[k]}">${s}</option>`).join('');
    f('service').value = keep.service;
    f('scope').value = keep.scope || 'unsure';
    f('message').placeholder = t(l, 'contact.form.messageHint');
    touched.forEach(check); // re-word visible errors in the new language
    setState(state);
  }

  function check(name) {
    const el = f(name);
    const err = fieldError(name, el.value);
    el.setAttribute('aria-invalid', String(!!err));
    const msg = document.getElementById(`cf-${name}-err`);
    if (msg) msg.textContent = err ? t(lang, `contact.form.errors.${err}`) : '';
    return !err;
  }
  REQUIRED.forEach((n) => {
    f(n).addEventListener('blur', () => {
      touched.add(n);
      check(n);
    });
    f(n).addEventListener('input', () => touched.has(n) && check(n));
  });

  function setState(s) {
    state = s;
    const sending = s === 'sending';
    submit.disabled = sending;
    form.setAttribute('aria-busy', String(sending));
    submitLabel.textContent = t(lang, sending ? 'contact.form.sending' : 'contact.form.send');
    status.className = `cform__status is-${s}`;
    if (s === 'success') status.textContent = t(lang, 'contact.form.success');
    else if (s === 'rate') status.textContent = t(lang, 'contact.form.rate');
    else if (s === 'failure') status.innerHTML = `${t(lang, 'contact.form.failure')} <a href="mailto:${SITE.email}">${SITE.email}</a>`;
    else status.textContent = '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    REQUIRED.forEach((n) => touched.add(n));
    const valid = REQUIRED.map(check).every(Boolean);
    if (!valid) {
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    busy = true;
    setState('sending');
    const data = Object.fromEntries(['name', 'email', 'company', 'service', 'scope', 'message', 'website'].map((n) => [n, f(n).value]));
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, elapsed: Date.now() - started, lang }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        form.reset();
        f('scope').value = 'unsure';
        touched.clear();
        REQUIRED.forEach((n) => f(n).removeAttribute('aria-invalid'));
        started = Date.now();
        setState('success');
      } else setState(res.status === 429 ? 'rate' : 'failure');
    } catch {
      setState('failure');
    }
    busy = false;
  });

  return { build };
}
