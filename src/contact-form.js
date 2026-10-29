import { t } from './i18n.js';
import { SITE } from './config.js';
import { svg } from './icons.js';

// Stable values sent to the server (labels are translated, values are not).
export const SERVICE_KEYS = ['web', 'software', 'mobile', 'nfc', 'training', 'other'];
export const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const REQUIRED = ['name', 'email', 'subject', 'service', 'message'];
const SOCIAL_NAMES = { instagram: 'Instagram', x: 'X', youtube: 'YouTube', linkedin: 'LinkedIn' };

/** Returns an error key for a field value, or '' when it is valid. */
export function fieldError(name, value) {
  const v = String(value ?? '').trim();
  if (REQUIRED.includes(name) && !v) return 'required';
  if (name === 'email' && !EMAIL_RE.test(v)) return 'email';
  if (name === 'message' && v.length < 10) return 'short';
  if (name === 'message' && v.length > 3000) return 'long';
  return '';
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // older browsers / insecure contexts: copy through a temporary field
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand?.('copy');
    ta.remove();
    return !!ok;
  }
}

/**
 * Contact channels: only real, configured ones (src/config.js). A phone or a
 * social profile appears here as soon as it is filled in there.
 */
function buildChannels(lang) {
  const list = document.getElementById('channels');
  if (!list) return;
  const c = (k) => t(lang, `contact.cards.${k}`);
  const card = (icon, title, detail, desc, actions = '') =>
    `<li class="channel"><span class="channel__icon">${svg(icon)}</span><div class="channel__body"><p class="channel__title">${title}</p><p class="channel__detail">${detail}</p><p class="channel__desc">${desc}</p></div>${actions ? `<div class="channel__actions">${actions}</div>` : ''}</li>`;
  const cards = [
    card('mail', c('email').title, `<bdi dir="ltr">${SITE.email}</bdi>`, c('email').desc,
      `<button type="button" class="channel__btn" data-copy="${SITE.email}">${svg('copy')}<span aria-live="polite">${c('email').copy}</span></button>` +
      `<a class="channel__btn" href="mailto:${SITE.email}">${svg('send')}<span>${c('email').open}</span></a>`),
  ];
  if (SITE.phone) {
    cards.push(card('phone', c('phone').title, `<bdi dir="ltr">${SITE.phone}</bdi>`, c('phone').desc,
      `<a class="channel__btn" href="tel:${SITE.phone.replace(/[^\d+]/g, '')}">${svg('phone')}<span>${c('phone').open}</span></a>`));
  }
  cards.push(card('translate', c('languages').title, c('languages').detail, c('languages').desc));
  for (const [k, url] of Object.entries(SITE.socials)) {
    if (!url) continue;
    cards.push(card(k, SOCIAL_NAMES[k], `<bdi dir="ltr">${new URL(url).host}</bdi>`, c('social').desc,
      `<a class="channel__btn" href="${url}" target="_blank" rel="noopener noreferrer">${svg('external')}<span>${c('social').open}</span><span class="sr-only">${t(lang, 'a11y.newTab')}</span></a>`));
  }
  list.innerHTML = cards.join('');
  list.querySelectorAll('[data-copy]').forEach((b) =>
    b.addEventListener('click', async () => {
      const label = b.querySelector('span');
      const ok = await copyText(b.dataset.copy);
      if (!ok) return;
      label.textContent = c('email').copied;
      b.classList.add('is-done');
      clearTimeout(b._t);
      b._t = setTimeout(() => {
        label.textContent = c('email').copy;
        b.classList.remove('is-done');
      }, 1800);
    }),
  );
}

/**
 * The contact form posts JSON to /api/contact (a serverless function that
 * sends the inquiry by email). It never opens the visitor's email app, and
 * success is only shown when the server confirms the email provider accepted
 * the message.
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
    const keep = f('service').value;
    f('service').innerHTML =
      `<option value="">${t(l, 'contact.form.servicePick')}</option>` +
      t(l, 'services.items').map((it, k) => `<option value="${SERVICE_KEYS[k]}">${it.title}</option>`).join('') +
      `<option value="other">${t(l, 'contact.form.serviceOther')}</option>`;
    f('service').value = keep;
    f('subject').placeholder = t(l, 'contact.form.subjectHint');
    f('message').placeholder = t(l, 'contact.form.messageHint');
    buildChannels(l);
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
    else if (s === 'failure' || s === 'unavailable') status.innerHTML = `${t(lang, s === 'failure' ? 'contact.form.failure' : 'contact.form.unavailable')} <a href="mailto:${SITE.email}">${SITE.email}</a>`;
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
    const data = Object.fromEntries(['name', 'email', 'subject', 'service', 'message', 'website'].map((n) => [n, f(n).value]));
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, elapsed: Date.now() - started, lang }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        form.reset();
        touched.clear();
        REQUIRED.forEach((n) => f(n).removeAttribute('aria-invalid'));
        started = Date.now();
        setState('success');
      } else setState(res.status === 429 ? 'rate' : res.status === 503 ? 'unavailable' : 'failure');
    } catch {
      setState('failure');
    }
    busy = false;
  });

  return { build };
}
