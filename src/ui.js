import { gsap } from 'gsap';
import { t } from './i18n.js';
import { svg } from './icons.js';
import { SITE } from './config.js';

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
  document.title = t(lang, 'meta.title');
  document.querySelector('meta[name="description"]').setAttribute('content', t(lang, 'meta.description'));
  root.lang = lang;
  root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelector('#langBtn').setAttribute('aria-label', t(lang, 'a11y.lang'));
  document.querySelector('.lang__code').textContent = lang.toUpperCase();
  document.querySelectorAll('#langMenu li').forEach((li) => li.setAttribute('aria-selected', String(li.dataset.lang === lang)));
  document.querySelector('#rail').setAttribute('aria-label', t(lang, 'a11y.rail'));
  document.querySelector('#hudRoll').innerHTML = Array.from({ length: 7 }, (_, i) => `<span>${String(i + 1).padStart(2, '0')}</span>`).join('');
  updateThemeLabel(lang);
  updateMenuLabel(lang);
  buildSocial(lang);
}

/* ------------------------------------------------------------- theme */
function updateThemeLabel(lang = root.lang) {
  const btn = document.querySelector('#themeToggle');
  const light = root.dataset.theme === 'light';
  btn.setAttribute('aria-label', t(lang, light ? 'a11y.themeToDark' : 'a11y.themeToLight'));
  btn.setAttribute('aria-pressed', String(light));
}
// Gold shockwave rings that burst from the toggle while the new theme spreads.
function shockwave(x, y, r) {
  const wrap = document.createElement('div');
  wrap.className = 'shock';
  wrap.style.setProperty('--x', `${x}px`);
  wrap.style.setProperty('--y', `${y}px`);
  wrap.innerHTML = '<i></i><i></i><i></i><b></b>';
  document.body.appendChild(wrap);
  const [a, b, c] = wrap.querySelectorAll('i');
  const flash = wrap.querySelector('b');
  const s = r / 50; // rings start 100px wide
  const tl = gsap.timeline({ onComplete: () => wrap.remove() });
  tl.fromTo(a, { scale: 0.05, opacity: 1 }, { scale: s, opacity: 0, duration: 1.3, ease: 'expo.out' }, 0)
    .fromTo(b, { scale: 0.05, opacity: 0.8 }, { scale: s * 0.8, opacity: 0, duration: 1.5, ease: 'expo.out' }, 0.08)
    .fromTo(c, { scale: 0.05, opacity: 0.6 }, { scale: s * 0.55, opacity: 0, duration: 1.7, ease: 'expo.out' }, 0.16)
    .fromTo(flash, { opacity: 0.55, scale: 0.2 }, { opacity: 0, scale: 3, duration: 0.9, ease: 'power2.out' }, 0);
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
    const [ox, oy] = origin || [innerWidth - 120, 40];
    if (!reduced && origin) {
      shockwave(ox, oy, Math.hypot(Math.max(ox, innerWidth - ox), Math.max(oy, innerHeight - oy)));
      onKick(0.9);
      gsap.fromTo('.theme-toggle__knob', { rotate: 0 }, { rotate: 360, duration: 1, ease: 'expo.out', clearProps: 'rotate' });
    }
    if (document.startViewTransition && !reduced) {
      const vt = document.startViewTransition(() => {
        commit();
        state.mix = target;
        onMix(target);
      });
      const [x, y] = origin || [innerWidth - 120, 40];
      const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      vt.ready.then(() => {
        root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { duration: 1250, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' });
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
const LANG_NAME = { en: 'English', ar: 'العربية' };
// Bars sweep across in the new reading direction, the language name decodes in
// the middle, the page swaps underneath, then the bars open again.
function curtain(lang, swap, onKick) {
  const el = document.createElement('div');
  el.className = 'curtain';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `${'<i></i>'.repeat(8)}<div class="curtain__mid"><img src="/assets/pw-logo.png" alt="" width="64" height="64" /><p lang="${lang}"></p><span></span></div>`;
  document.body.appendChild(el);
  const bars = el.querySelectorAll('i');
  const mid = el.querySelector('.curtain__mid');
  const label = mid.querySelector('p');
  const from = lang === 'ar' ? 'end' : 'start';
  const name = LANG_NAME[lang];
  const o = { p: 0 };
  const pool = name + 'PW01<>/{}';
  onKick(1);
  gsap.timeline({ onComplete: () => el.remove() })
    .fromTo(bars, { yPercent: 101 }, { yPercent: 0, duration: 0.55, ease: 'expo.inOut', stagger: { each: 0.045, from } })
    .fromTo(mid, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, '-=0.2')
    .to(o, {
      p: 1, duration: 0.6, ease: 'power2.out',
      onUpdate: () => {
        const n = Math.floor(o.p * name.length);
        label.textContent = name.slice(0, n) + Array.from({ length: name.length - n }, () => pool[(Math.random() * pool.length) | 0]).join('');
      },
    }, '<')
    .fromTo(mid.querySelector('span'), { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: 'expo.out' }, '<')
    .add(swap)
    .to(mid, { opacity: 0, y: -20, duration: 0.3, ease: 'power2.in' }, '+=0.15')
    .add(() => onKick(0.8))
    .to(bars, { yPercent: -101, duration: 0.6, ease: 'expo.inOut', stagger: { each: 0.045, from } }, '-=0.1');
}

export function setupLang(onChange, { reduced, onKick = () => {} } = {}) {
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
    if (reduced) return onChange(lang);
    curtain(lang, () => onChange(lang), onKick);
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

  const cta = document.querySelector('#contactCta');
  if (SITE.email) cta.href = `mailto:${SITE.email}`;
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
    el.classList.remove('is-out');
    const hit = e.target.closest?.('a, button, [role="option"]');
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
    const card = e.target.closest?.('.focus, .pillars');
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
// and a welcome line. It holds long enough to be read, then an iris opens
// from the centre into the 3D world while the stars jump to warp.
const HOLD = 0.8; // seconds the finished welcome stays readable

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

export function createLoader({ reduced } = {}) {
  const el = document.querySelector('#loader');
  const ring = document.querySelector('#loaderRing');
  const count = document.querySelector('#loaderCount');
  const s = { v: 0 };
  let welcomed = Promise.resolve();
  const render = () => {
    ring.style.strokeDashoffset = String(100 - s.v);
    count.textContent = String(Math.round(s.v)).padStart(3, '0');
  };
  const stars = reduced ? null : starfield(document.querySelector('#loaderStars'));
  if (!reduced) {
    const title = splitChars(el.querySelector('.loader__title'));
    const hello = splitChars(el.querySelector('.loader__hello'));
    const intro = gsap.timeline({ delay: 0.15 });
    welcomed = new Promise((r) => intro.eventCallback('onComplete', r));
    intro
      .fromTo('.loader__mark', { scale: 0.6, opacity: 0, rotate: -40 }, { scale: 1, opacity: 1, rotate: 0, duration: 1.2, ease: 'expo.out' })
      .fromTo(hello, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.025 }, 0.35)
      .fromTo(title, { opacity: 0, yPercent: 60, rotateX: -80, filter: 'blur(8px)' }, { opacity: 1, yPercent: 0, rotateX: 0, filter: 'blur(0px)', duration: 1, ease: 'expo.out', stagger: 0.045 }, 0.55)
      .fromTo('.loader__sub', { opacity: 0, y: 14, letterSpacing: '0.3em' }, { opacity: 1, y: 0, letterSpacing: '0.02em', duration: 1.2, ease: 'expo.out' }, 1.15)
      .fromTo('.loader__foot', { opacity: 0 }, { opacity: 1, duration: 0.8 }, 1.2);
  }
  return {
    progress(v) {
      gsap.to(s, { v: Math.max(s.v, v), duration: 0.6, ease: 'power2.out', onUpdate: render });
    },
    async done(skip, onOpen = () => {}) {
      if (!skip) await welcomed;
      return new Promise((resolve) => {
        gsap.to(s, {
          v: 100, duration: skip ? 0 : 0.6, delay: skip ? 0 : HOLD, ease: 'power2.out', onUpdate: render,
          onComplete: () => {
            root.classList.remove('is-loading');
            if (skip) {
              if (stars) stars.on = false;
              el.remove();
              onOpen();
              return resolve();
            }
            const iris = { r: 0 };
            const tl = gsap.timeline({
              onComplete: () => {
                if (stars) stars.on = false;
                el.remove();
              },
            });
            tl.to(stars || {}, { speed: 2.6, duration: 0.9, ease: 'power3.in' })
              .to('.loader__core', { scale: 1.12, opacity: 0, filter: 'blur(10px)', duration: 0.7, ease: 'power3.in' }, 0.1)
              .to('.loader__foot', { opacity: 0, duration: 0.4 }, 0)
              .add(onOpen, 0.6)
              .to(iris, {
                r: Math.hypot(innerWidth, innerHeight) * 0.6, duration: 1.3, ease: 'expo.inOut',
                onUpdate: () => el.style.setProperty('--iris', `${iris.r}px`),
              }, 0.55)
              .add(resolve, 1.2);
          },
        });
      });
    },
  };
}
