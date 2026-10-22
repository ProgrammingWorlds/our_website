import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DICT, t } from './i18n.js';
import { svg } from './icons.js';
import { SITE } from './config.js';

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const store = {
  get(k) {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set(k, v) {
    try { localStorage.setItem(k, v); } catch { /* storage unavailable */ }
  },
};

/* ------------------------------------------------------------- text split */
function splitWords(el) {
  const text = el.textContent;
  el.textContent = '';
  text.split(/(\s+)/).forEach((part) => {
    if (!part) return;
    if (/^\s+$/.test(part)) return el.appendChild(document.createTextNode(' '));
    const m = document.createElement('span');
    m.className = 'mask';
    const w = document.createElement('span');
    w.className = 'word';
    w.textContent = part;
    m.appendChild(w);
    el.appendChild(m);
  });
}

function renderHeading(el, lang) {
  const [a, b] = t(lang, el.dataset.heading);
  el.innerHTML = '';
  const l1 = document.createElement('span');
  l1.className = 'line';
  l1.textContent = a;
  const l2 = document.createElement('span');
  l2.className = 'line accent';
  l2.textContent = b;
  el.append(l1, ' ', l2);
  splitWords(l1);
  splitWords(l2);
}

export function applyLang(lang) {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const v = t(lang, el.dataset.i18n);
    if (typeof v === 'string') el.textContent = v;
  });
  document.querySelectorAll('[data-heading]').forEach((el) => renderHeading(el, lang));
  document.querySelectorAll('.content .desc').forEach(splitWords);
  document.title = t(lang, 'meta.title');
  document.querySelector('meta[name="description"]').setAttribute('content', t(lang, 'meta.description'));
  root.lang = lang;
  root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  // a11y labels
  document.querySelector('#langBtn').setAttribute('aria-label', t(lang, 'a11y.lang'));
  document.querySelector('.lang__code').textContent = lang.toUpperCase();
  document.querySelectorAll('#langMenu li').forEach((li) => li.setAttribute('aria-selected', String(li.dataset.lang === lang)));
  document.querySelector('#rail').setAttribute('aria-label', t(lang, 'a11y.rail'));
  updateThemeLabel(lang);
  updateMenuLabel(lang);
  buildRail(lang);
  buildSocial(lang);
}

/* ------------------------------------------------------------- reveals */
// Each scene gets its own entrance so sections never repeat the same fade.
const REVEALS = {
  hero: (w) => gsap.fromTo(w, { yPercent: 115, rotate: 7, opacity: 0 }, { yPercent: 0, rotate: 0, opacity: 1, duration: 1.3, ease: 'expo.out', stagger: 0.05 }),
  services: (w) => gsap.fromTo(w, { xPercent: -40 * dirSign(), skewX: -14, opacity: 0 }, { xPercent: 0, skewX: 0, opacity: 1, duration: 1.1, ease: 'power4.out', stagger: 0.035 }),
  about: (w) => gsap.fromTo(w, { clipPath: 'inset(0 0 100% 0)', y: 20, opacity: 1 }, { clipPath: 'inset(0 0 0% 0)', y: 0, opacity: 1, duration: 1.1, ease: 'power3.out', stagger: 0.04 }),
  process: (w) => gsap.fromTo(w, { rotateX: -90, transformOrigin: '50% 100% -20px', opacity: 0 }, { rotateX: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.04 }),
  portfolio: (w) => gsap.fromTo(w, { scale: 1.6, filter: 'blur(10px)', opacity: 0 }, { scale: 1, filter: 'blur(0px)', opacity: 1, duration: 1.1, ease: 'power3.out', stagger: 0.03 }),
  future: (w) => gsap.fromTo(w, { y: (i) => (i % 2 ? -60 : 60), opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: { each: 0.03, from: 'center' } }),
  contact: (w) => gsap.fromTo(w, { yPercent: 100, opacity: 0, textShadow: '0 0 30px rgba(255,181,69,1)' }, { yPercent: 0, opacity: 1, textShadow: '0 0 0px rgba(255,181,69,0)', duration: 1.2, ease: 'power4.out', stagger: 0.04 }),
};
const dirSign = () => (root.dir === 'rtl' ? -1 : 1);

export function setupReveals({ reduced, onHero }) {
  const revealed = new Set();
  document.querySelectorAll('.scene').forEach((sec) => {
    const id = sec.dataset.scene;
    const content = sec.querySelector('.content');
    const play = () => {
      if (revealed.has(id)) return;
      revealed.add(id);
      if (reduced) return;
      const words = content.querySelectorAll('.word');
      const extras = content.querySelectorAll('.eyebrow, .btn, .stage-meter');
      gsap.set(content, { opacity: 1 });
      REVEALS[id]?.(words);
      gsap.fromTo(extras, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: 0.12, delay: 0.25 });
      if (id === 'hero') onHero?.();
    };
    if (id === 'hero') return requestAnimationFrame(play);
    if (!reduced) gsap.set(content.querySelectorAll('.word, .eyebrow, .btn'), { opacity: 0 });
    ScrollTrigger.create({ trigger: sec, start: 'top 70%', once: true, onEnter: play });
  });
  return revealed;
}

/* ------------------------------------------------------------- theme */
function updateThemeLabel(lang = root.lang) {
  const btn = document.querySelector('#themeToggle');
  const light = root.dataset.theme === 'light';
  btn.setAttribute('aria-label', t(lang, light ? 'a11y.themeToDark' : 'a11y.themeToLight'));
  btn.setAttribute('aria-pressed', String(light));
}
export function setupTheme(onMix, { reduced }) {
  const btn = document.querySelector('#themeToggle');
  const state = { mix: root.dataset.theme === 'light' ? 1 : 0 };
  onMix(state.mix);
  const set = (theme, persist = true, origin) => {
    const target = theme === 'light' ? 1 : 0;
    const commit = () => {
      root.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'light' ? '#eef3fc' : '#030b20');
      updateThemeLabel();
    };
    if (persist) store.set('pw-theme', theme);
    if (document.startViewTransition && !reduced) {
      const vt = document.startViewTransition(() => {
        commit();
        state.mix = target;
        onMix(target);
      });
      const [x, y] = origin || [innerWidth - 120, 40];
      const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      vt.ready.then(() => {
        root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { duration: 900, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' });
      });
    } else {
      commit();
      gsap.to(state, { mix: target, duration: reduced ? 0 : 1.1, ease: 'power2.inOut', onUpdate: () => onMix(state.mix) });
    }
  };
  btn.addEventListener('click', () => {
    const r = btn.getBoundingClientRect();
    set(root.dataset.theme === 'light' ? 'dark' : 'light', true, [r.left + r.width / 2, r.top + r.height / 2]);
  });
  // follow the OS only until the visitor picks a theme
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    if (!store.get('pw-theme')) set(e.matches ? 'light' : 'dark', false);
  });
  return { set };
}

/* ------------------------------------------------------------- language */
export function setupLang(onChange) {
  const btn = document.querySelector('#langBtn');
  const menu = document.querySelector('#langMenu');
  const opts = [...menu.querySelectorAll('li')];
  const open = (v) => {
    menu.hidden = !v;
    btn.setAttribute('aria-expanded', String(v));
    if (v) (opts.find((o) => o.dataset.lang === root.lang) || opts[0]).focus();
  };
  btn.addEventListener('click', () => open(menu.hidden));
  const choose = (lang) => {
    open(false);
    btn.focus();
    if (lang === root.lang) return;
    store.set('pw-lang', lang);
    const contents = document.querySelectorAll('.content, .hud, .pillars, .carousel, .nav__links, .footer');
    gsap.to(contents, {
      opacity: 0, filter: 'blur(6px)', duration: 0.25, ease: 'power1.in',
      onComplete: () => {
        onChange(lang);
        gsap.set(document.querySelectorAll('.content .word, .content .eyebrow, .content .btn'), { clearProps: 'all' });
        gsap.to(contents, { opacity: 1, filter: 'blur(0px)', duration: 0.5, ease: 'power2.out', clearProps: 'filter' });
      },
    });
  };
  opts.forEach((o) => {
    o.addEventListener('click', () => choose(o.dataset.lang));
    o.addEventListener('keydown', (e) => {
      const i = opts.indexOf(o);
      if (e.key === 'ArrowDown') opts[(i + 1) % opts.length].focus();
      else if (e.key === 'ArrowUp') opts[(i - 1 + opts.length) % opts.length].focus();
      else if (e.key === 'Enter' || e.key === ' ') choose(o.dataset.lang);
      else if (e.key === 'Escape') { open(false); btn.focus(); }
      else return;
      e.preventDefault();
    });
  });
  document.addEventListener('click', (e) => !e.target.closest('#lang') && !menu.hidden && open(false));
}

/* ------------------------------------------------------------- nav */
function updateMenuLabel(lang = root.lang) {
  const b = document.querySelector('#menuBtn');
  b.setAttribute('aria-label', t(lang, b.getAttribute('aria-expanded') === 'true' ? 'a11y.close' : 'a11y.menu'));
}
const IDS = ['home', 'services', 'about', 'process', 'projects', 'future', 'contact'];
const NAVKEYS = ['home', 'services', 'about', 'process', 'projects', 'future', 'contact'];
function buildRail(lang) {
  const rail = document.querySelector('#rail');
  rail.innerHTML = IDS.map((id, i) => `<a href="#${id}" aria-label="${t(lang, 'nav.' + NAVKEYS[i])}"><span>${String(i + 1).padStart(2, '0')}</span><i></i></a>`).join('');
}
function buildSocial(lang) {
  const el = document.querySelector('#social');
  const names = { instagram: 'Instagram', x: 'X', youtube: 'YouTube', linkedin: 'LinkedIn' };
  el.innerHTML = Object.entries(SITE.socials)
    .map(([k, url]) =>
      url
        ? `<a href="${url}" target="_blank" rel="noopener" aria-label="${names[k]}">${svg(k)}</a>`
        : `<span title="${names[k]} — ${t(lang, 'footer.soon')}" aria-label="${names[k]} — ${t(lang, 'footer.soon')}" role="img">${svg(k)}</span>`,
    )
    .join('');
}

export function setupNav() {
  const nav = document.querySelector('#nav');
  const menuBtn = document.querySelector('#menuBtn');
  const menu = document.querySelector('#mobileMenu');
  const setMenu = (v) => {
    menu.hidden = !v;
    menuBtn.setAttribute('aria-expanded', String(v));
    document.body.style.overflow = v ? 'hidden' : '';
    updateMenuLabel();
    if (v) {
      gsap.fromTo(menu.querySelectorAll('a'), { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.05, duration: 0.6, ease: 'power3.out' });
      menu.querySelector('a').focus();
    }
  };
  menuBtn.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', (e) => e.target.closest('a') && setMenu(false));
  addEventListener('keydown', (e) => e.key === 'Escape' && !menu.hidden && (setMenu(false), menuBtn.focus()));

  const sections = IDS.map((id) => document.getElementById(id));
  const links = [...document.querySelectorAll('.nav__links a')];
  const rail = document.querySelector('#rail');
  let last = -1;
  const tick = () => {
    nav.classList.toggle('is-scrolled', scrollY > 30);
    const mid = innerHeight * 0.5;
    let idx = 0;
    sections.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      if (r.top <= mid) idx = i;
    });
    if (idx !== last) {
      last = idx;
      links.forEach((a, i) => (i === idx ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
      links.forEach((a, i) => a.classList.toggle('is-active', i === idx));
    }
    [...rail.children].forEach((a, i) => a.classList.toggle('is-active', i === idx));
    rail.classList.toggle('is-hidden', scrollY > innerHeight * 0.55);
  };
  addEventListener('scroll', tick, { passive: true });
  tick();

  // light that follows the cursor on buttons
  document.addEventListener('pointermove', (e) => {
    const b = e.target.closest?.('.btn');
    if (!b) return;
    const r = b.getBoundingClientRect();
    b.style.setProperty('--mx', `${e.clientX - r.left}px`);
    b.style.setProperty('--my', `${e.clientY - r.top}px`);
  });

  const cta = document.querySelector('#contactCta');
  if (SITE.email) cta.href = `mailto:${SITE.email}`;
  document.querySelector('#year').textContent = new Date().getFullYear();
}

export { DICT, store };
