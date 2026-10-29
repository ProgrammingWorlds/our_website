import { gsap } from 'gsap';
import { t } from './i18n.js';
import { svg } from './icons.js';
import { SITE } from './config.js';
import { CHAPTERS, STORY } from './story.js';

const root = document.documentElement;
export const store = {
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
  document.querySelectorAll('.panel .desc').forEach(splitWords);
  document.querySelectorAll('[data-i18n-label]').forEach((el) => el.setAttribute('aria-label', t(lang, el.dataset.i18nLabel)));
  const meta = STORY === 'universal' ? 'meta.universal' : 'meta';
  document.title = t(lang, `${meta}.title`);
  document.querySelector('meta[name="description"]').setAttribute('content', t(lang, `${meta}.description`));
  root.lang = lang;
  root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  // the toggle names the language it switches to
  const toggle = document.querySelector('#langToggle');
  toggle.setAttribute('aria-label', t(lang, 'a11y.lang'));
  toggle.title = t(lang, 'a11y.lang');
  const code = document.querySelector('#langCode');
  code.textContent = t(lang, 'a11y.langShort');
  code.lang = lang === 'ar' ? 'en' : 'ar';
  document.querySelector('#rail').setAttribute('aria-label', t(lang, 'a11y.rail'));
  document.querySelector('#hudRoll').innerHTML = CHAPTERS.map((_, i) => `<span>${String(i + 1).padStart(2, '0')}</span>`).join('');
  document.querySelector('#hudTotal').textContent = `/ ${String(CHAPTERS.length).padStart(2, '0')}`;
  document.querySelector('#scrollCue').setAttribute('aria-label', t(lang, 'a11y.scroll'));
  updateThemeLabel(lang);
  updateMenuLabel(lang);
  buildSocial(lang);
}

/* ------------------------------------------------------------- theme */
// The button is named by what it does ("Switch to light mode"); the icon shows the current theme.
function updateThemeLabel(lang = root.lang) {
  const btn = document.querySelector('#themeToggle');
  const label = t(lang, root.dataset.theme === 'light' ? 'a11y.themeToDark' : 'a11y.themeToLight');
  btn.setAttribute('aria-label', label);
  btn.title = label;
}

export function setupTheme(onMix, { reduced, onKick = () => {} }) {
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
    if (!reduced && origin) onKick(0.25); // a breath of warp in the 3D scene, nothing more
    // One coherent change: the new theme opens as a circle from the button, the
    // page and the 3D scene together (the scene's new colours are in that snapshot).
    if (document.startViewTransition && !reduced) {
      const vt = document.startViewTransition(() => {
        commit();
        state.mix = target;
        onMix(target);
      });
      const [x, y] = origin || [innerWidth - 120, 40];
      const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      vt.ready.then(() => {
        root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { duration: 680, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)' });
      }, () => {});
    } else {
      // no view transitions: colours cross-fade while the scene blends over the same time
      if (!reduced) {
        root.classList.add('theme-fade');
        setTimeout(() => root.classList.remove('theme-fade'), 520);
      }
      commit();
      gsap.to(state, { mix: target, duration: reduced ? 0 : 0.5, ease: 'power2.inOut', onUpdate: () => onMix(state.mix) });
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
// A quick curtain: bars sweep across in the new reading direction, the page
// swaps underneath while covered, then the bars open again (~0.7 s in total).
function curtain(lang, swap, onKick) {
  const el = document.createElement('div');
  el.className = 'curtain';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<i></i>'.repeat(8);
  document.body.appendChild(el);
  const bars = el.querySelectorAll('i');
  const from = lang === 'ar' ? 'end' : 'start';
  onKick(0.8);
  // the swap never waits on animation timing: on a struggling device the timer does it
  let swapped = false;
  const once = () => !swapped && ((swapped = true), swap());
  setTimeout(once, 600);
  gsap.timeline({ onComplete: () => el.remove() })
    .fromTo(bars, { yPercent: 101 }, { yPercent: 0, duration: 0.3, ease: 'power3.in', stagger: { each: 0.02, from } })
    .add(once)
    .to(bars, { yPercent: -101, duration: 0.4, ease: 'power3.out', stagger: { each: 0.02, from } }, '+=0.02');
}

/** One button switches straight to the other language — no menu. */
export function setupLang(onChange, { reduced, onKick = () => {} } = {}) {
  const btn = document.querySelector('#langToggle');
  let busy = false;
  btn.addEventListener('click', () => {
    if (busy) return;
    const lang = root.lang === 'ar' ? 'en' : 'ar';
    store.set('pw-lang', lang);
    if (reduced) return onChange(lang);
    busy = true;
    curtain(lang, () => {
      onChange(lang);
      busy = false;
    }, onKick);
  });
}

/* ------------------------------------------------------------- nav */
function updateMenuLabel(lang = root.lang) {
  const b = document.querySelector('#menuBtn');
  b.setAttribute('aria-label', t(lang, b.getAttribute('aria-expanded') === 'true' ? 'a11y.close' : 'a11y.menu'));
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

export function setupNav({ lockScroll }) {
  const menuBtn = document.querySelector('#menuBtn');
  const menu = document.querySelector('#mobileMenu');
  const setMenu = (v) => {
    menu.hidden = !v;
    menuBtn.setAttribute('aria-expanded', String(v));
    lockScroll(v);
    updateMenuLabel();
    if (v) {
      gsap.fromTo(menu.querySelectorAll('a'), { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.05, duration: 0.6, ease: 'power3.out' });
      menu.querySelector('a').focus();
    }
  };
  menuBtn.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', (e) => e.target.closest('a') && setMenu(false));
  addEventListener('keydown', (e) => e.key === 'Escape' && !menu.hidden && (setMenu(false), menuBtn.focus()));

  document.querySelector('#year').textContent = new Date().getFullYear();
}

/* ------------------------------------------------------------- cursor */
// A trailing ring + dot on fine pointers; interactive elements pull the
// ring around them and buttons lean magnetically toward the pointer.
export function setupCursor({ reduced }) {
  const el = document.querySelector('#cursor');
  if (reduced || !matchMedia('(hover: hover) and (pointer: fine)').matches) return el.remove();
  root.classList.add('has-cursor');
  const p = { x: innerWidth / 2, y: innerHeight / 2 }, r = { x: p.x, y: p.y };
  let magnet = null;
  addEventListener('pointermove', (e) => {
    p.x = e.clientX;
    p.y = e.clientY;
    // text fields keep the native caret cursor; the ring steps aside
    el.classList.toggle('is-out', !!e.target.closest?.('input, textarea, .device__live'));
    const hit = e.target.closest?.('a, button, label, select');
    el.classList.toggle('is-hover', !!hit);
    const b = e.target.closest?.('.btn');
    if (b) {
      const br = b.getBoundingClientRect();
      b.style.setProperty('--mx', `${e.clientX - br.left}px`);
      b.style.setProperty('--my', `${e.clientY - br.top}px`);
      gsap.to(b, { x: (e.clientX - br.left - br.width / 2) * 0.18, y: (e.clientY - br.top - br.height / 2) * 0.28, duration: 0.5, ease: 'power3.out' });
    }
    if (magnet && magnet !== b) gsap.to(magnet, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    magnet = b;
  }, { passive: true });
  document.addEventListener('pointerleave', () => el.classList.add('is-out'));
  addEventListener('pointerdown', () => el.classList.add('is-down'));
  addEventListener('pointerup', () => el.classList.remove('is-down'));
  gsap.ticker.add(() => {
    r.x += (p.x - r.x) * 0.2;
    r.y += (p.y - r.y) * 0.2;
    el.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`;
    el.style.setProperty('--dx', `${p.x - r.x}px`);
    el.style.setProperty('--dy', `${p.y - r.y}px`);
  });
}

/* ------------------------------------------------------------- tilt */
export function setupTilt({ reduced }) {
  if (reduced || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.('.focus');
    document.querySelectorAll('.is-tilting').forEach((c) => c !== card && c.classList.remove('is-tilting'));
    if (!card) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    card.classList.add('is-tilting');
    card.style.setProperty('--ry', `${(px - 0.5) * 10}deg`);
    card.style.setProperty('--rx', `${(0.5 - py) * 8}deg`);
    card.style.setProperty('--gx', `${px * 100}%`);
    card.style.setProperty('--gy', `${py * 100}%`);
  }, { passive: true });
}

/* ------------------------------------------------------------- loader */
// Splash: a starfield flying at the viewer, the mark inside a progress ring,
// and a welcome line. It holds just long enough to be read, then an iris opens
// from the centre into the 3D world while the stars jump to warp. The full
// welcome plays once per session; later page loads only fade the splash out.
const HOLD = 0.25; // seconds the finished welcome stays readable

function starfield(canvas) {
  const g = canvas.getContext('2d');
  const stars = Array.from({ length: 320 }, () => ({ x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: Math.random() }));
  const s = { speed: 0.12, on: true };
  let w = 0, h = 0, last = performance.now();
  const size = () => {
    const pr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.width = innerWidth * pr;
    h = canvas.height = innerHeight * pr;
  };
  size();
  addEventListener('resize', size);
  const loop = (now) => {
    if (!s.on) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const light = root.dataset.theme === 'light';
    g.clearRect(0, 0, w, h);
    g.lineCap = 'round';
    const f = Math.max(w, h) * 0.5;
    for (const st of stars) {
      const z0 = st.z;
      st.z -= s.speed * dt;
      if (st.z <= 0.02) {
        st.x = (Math.random() - 0.5) * 2;
        st.y = (Math.random() - 0.5) * 2;
        st.z = 1;
        continue;
      }
      const x0 = w / 2 + (st.x / z0) * f * 0.5, y0 = h / 2 + (st.y / z0) * f * 0.5;
      const x1 = w / 2 + (st.x / st.z) * f * 0.5, y1 = h / 2 + (st.y / st.z) * f * 0.5;
      const a = Math.min(1, (1 - st.z) * 1.4);
      g.strokeStyle = light ? `rgba(36,70,255,${a * 0.55})` : `rgba(${st.x > 0.6 ? '255,200,130' : '190,210,255'},${a})`;
      g.lineWidth = (1 - st.z) * 2.4 + 0.3;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return s;
}

/** Letters for Latin, whole words for Arabic (its letters join). */
function splitChars(el) {
  const text = el.textContent;
  const joined = /[\u0600-\u06FF]/.test(text);
  el.textContent = '';
  (joined ? text.split(/(\s+)/) : [...text]).forEach((c) => {
    if (!c) return;
    const sp = document.createElement('span');
    sp.className = 'ch';
    sp.textContent = c === ' ' || /^\s+$/.test(c) ? '\u00a0' : c;
    el.appendChild(sp);
  });
  return el.querySelectorAll('.ch');
}

export function createLoader({ reduced, quick } = {}) {
  const el = document.querySelector('#loader');
  const ring = document.querySelector('#loaderRing');
  const count = document.querySelector('#loaderCount');
  const s = { v: 0 };
  let welcomed = Promise.resolve();
  const render = () => {
    ring.style.strokeDashoffset = String(100 - s.v);
    count.textContent = String(Math.round(s.v)).padStart(3, '0');
  };
  const full = !reduced && !quick;
  const stars = full ? starfield(document.querySelector('#loaderStars')) : null;
  if (quick) el.classList.add('loader--quick');
  if (full) {
    const title = splitChars(el.querySelector('.loader__title'));
    const hello = splitChars(el.querySelector('.loader__hello'));
    const intro = gsap.timeline({ delay: 0.05 });
    welcomed = new Promise((r) => intro.eventCallback('onComplete', r));
    intro
      .fromTo('.loader__mark', { scale: 0.6, opacity: 0, rotate: -40 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.9, ease: 'expo.out' })
      .fromTo(hello, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.02 }, 0.2)
      .fromTo(title, { opacity: 0, yPercent: 60, rotateX: -80 }, { opacity: 1, yPercent: 0, rotateX: 0, duration: 0.8, ease: 'expo.out', stagger: 0.03 }, 0.3)
      .fromTo('.loader__sub', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out' }, 0.7)
      .fromTo('.loader__foot', { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0.7);
  }
  return {
    progress(v) {
      gsap.to(s, { v: Math.max(s.v, v), duration: 0.6, ease: 'power2.out', onUpdate: render });
    },
    async done(skip, onOpen = () => {}) {
      if (!skip) await welcomed;
      return new Promise((resolve) => {
        const finish = () => {
          if (stars) stars.on = false;
          el.remove();
        };
        if (skip || quick) {
          s.v = 100;
          render();
          root.classList.remove('is-loading');
          onOpen();
          if (skip) finish();
          else gsap.to(el, { opacity: 0, duration: 0.45, ease: 'power2.out', onComplete: finish });
          return resolve();
        }
        gsap.to(s, {
          v: 100, duration: 0.5, delay: HOLD, ease: 'power2.out', onUpdate: render,
          onComplete: () => {
            root.classList.remove('is-loading');
            const iris = { r: 0 };
            gsap.timeline({ onComplete: finish })
              .to(stars || {}, { speed: 2.6, duration: 0.8, ease: 'power3.in' })
              .to('.loader__core', { scale: 1.12, opacity: 0, duration: 0.5, ease: 'power3.in' }, 0.05)
              .to('.loader__foot', { opacity: 0, duration: 0.3 }, 0)
              .add(onOpen, 0.35)
              .to(iris, {
                r: Math.hypot(innerWidth, innerHeight) * 0.6, duration: 1, ease: 'expo.inOut',
                onUpdate: () => el.style.setProperty('--iris', `${iris.r}px`),
              }, 0.3)
              .add(resolve, 0.8);
          },
        });
      });
    },
  };
}
