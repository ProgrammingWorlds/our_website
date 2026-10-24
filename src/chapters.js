import { gsap } from 'gsap';
import { CHAPTERS, WINDOW, stepF, stepAt, arriveAt } from './story.js';
import { t } from './i18n.js';
import { svg } from './icons.js';

const root = document.documentElement;
const dirSign = () => (root.dir === 'rtl' ? -1 : 1);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const pad = (n) => String(n + 1).padStart(2, '0');

const SVC_ICONS = ['web', 'code', 'mobile', 'nfc', 'training'];
const STAGE_ICONS = ['bulb', 'strategy', 'design', 'dev', 'test', 'rocket'];
const PILLAR_ICONS = ['creative', 'practical', 'modern', 'partner'];
const FUTURE_ICONS = ['ai', 'globe', 'test', 'cloud'];

// Each chapter's words enter differently, so the journey never repeats a beat.
const REVEALS = [
  (w) => gsap.fromTo(w, { yPercent: 115, rotate: 7, opacity: 0 }, { yPercent: 0, rotate: 0, opacity: 1, duration: 1.3, ease: 'expo.out', stagger: 0.05 }),
  (w) => gsap.fromTo(w, { xPercent: -40 * dirSign(), skewX: -14, opacity: 0 }, { xPercent: 0, skewX: 0, opacity: 1, duration: 1.1, ease: 'power4.out', stagger: 0.035 }),
  (w) => gsap.fromTo(w, { clipPath: 'inset(0 0 100% 0)', y: 20, opacity: 1 }, { clipPath: 'inset(0 0 0% 0)', y: 0, opacity: 1, duration: 1.1, ease: 'power3.out', stagger: 0.04 }),
  (w) => gsap.fromTo(w, { rotateX: -90, transformOrigin: '50% 100% -20px', opacity: 0 }, { rotateX: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.04 }),
  (w) => gsap.fromTo(w, { scale: 1.6, filter: 'blur(10px)', opacity: 0 }, { scale: 1, filter: 'blur(0px)', opacity: 1, duration: 1.1, ease: 'power3.out', stagger: 0.03 }),
  (w) => gsap.fromTo(w, { y: (i) => (i % 2 ? -60 : 60), opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: { each: 0.03, from: 'center' } }),
  (w) => gsap.fromTo(w, { yPercent: 100, opacity: 0, textShadow: '0 0 30px rgba(255,181,69,1)' }, { yPercent: 0, opacity: 1, textShadow: '0 0 0px rgba(255,181,69,0)', duration: 1.2, ease: 'power4.out', stagger: 0.04 }),
];

/**
 * Drives the DOM side of the story from the scroll position: which chapter
 * panel is on stage (with a depth fly-through), the active step inside a
 * chapter, the HUD, rail and nav state.
 */
export function createChapters({ scroll, reduced }) {
  const sections = CHAPTERS.map((ch) => document.getElementById(ch.id));
  const panels = sections.map((s) => s.querySelector('.panel'));
  const navLinks = [...document.querySelectorAll('.nav__links a')];
  const rail = document.getElementById('rail');
  const nav = document.getElementById('nav');
  const hud = { roll: document.getElementById('hudRoll'), name: document.getElementById('hudName'), bar: document.getElementById('hudBar') };
  const cue = document.getElementById('scrollCue');
  const S = { active: -1, steps: CHAPTERS.map(() => -1), vis: CHAPTERS.map(() => 0), entered: CHAPTERS.map(() => false), lang: root.lang, ready: false, skew: 0 };
  let thumbImages = [];

  const goStep = (ci, k) => scroll.toU(ci + stepAt(CHAPTERS[ci], k));
  const goChapter = (ci, opts) => scroll.toU(ci + arriveAt(CHAPTERS[ci]), opts);

  /* ------------------------------------------------------------ content */
  function stepButtons(el, ci, labels) {
    el.innerHTML = labels.map((l, k) => `<button type="button" role="tab" aria-selected="false" aria-label="${l}"><span>${pad(k)}</span></button>`).join('');
    [...el.children].forEach((b, k) => b.addEventListener('click', () => goStep(ci, k)));
  }

  function build(lang) {
    S.lang = lang;
    stepButtons(document.getElementById('svcSteps'), 1, t(lang, 'services.items').map((it) => it.title));
    stepButtons(document.getElementById('stageSteps'), 3, t(lang, 'process.stages'));
    stepButtons(document.getElementById('futureSteps'), 5, t(lang, 'future.items').map((it) => it.title));
    document.getElementById('pillars').innerHTML = t(lang, 'about.pillars').map((p, k) => `<li>${svg(PILLAR_ICONS[k])}<span>${p}</span></li>`).join('');
    const thumbs = document.getElementById('thumbs');
    thumbs.innerHTML = t(lang, 'portfolio.screens')
      .map((s, k) => `<button type="button" role="tab" aria-selected="false" aria-label="${s}"><span class="thumbs__img"${thumbImages[k] ? ` style="background-image:url(${thumbImages[k]})"` : ''}></span><span class="thumbs__n">${pad(k)}</span></button>`)
      .join('');
    [...thumbs.children].forEach((b, k) => b.addEventListener('click', () => goStep(4, k)));
    buildRail(lang);
    S.steps = S.steps.map(() => -1); // force focus cards to re-render
    S.active = -1;
  }

  function buildRail(lang) {
    rail.innerHTML = CHAPTERS.map((ch, i) => `<a href="#${ch.id}"><span class="rail__n">${pad(i)}</span><span class="rail__label">${t(lang, 'nav.' + ch.nav)}</span><i></i></a>`).join('');
  }

  function setThumbs(urls) {
    thumbImages = urls;
    document.querySelectorAll('#thumbs .thumbs__img').forEach((el, k) => urls[k] && (el.style.backgroundImage = `url(${urls[k]})`));
  }

  function focusCard(ci, k) {
    const lang = S.lang;
    let el, html;
    if (ci === 1) {
      const it = t(lang, 'services.items')[k];
      el = document.getElementById('svcFocus');
      html = `<span class="focus__icon">${svg(SVC_ICONS[k])}</span><div class="focus__body"><p class="focus__kicker"><b>${pad(k)}</b> / 05 · ${it.sub}</p><h3>${it.title}</h3><p>${it.detail}</p></div>`;
    } else if (ci === 3) {
      el = document.getElementById('stageFocus');
      html = `<span class="focus__icon">${svg(STAGE_ICONS[k])}</span><div class="focus__body"><p class="focus__kicker">${t(lang, 'process.stage')} <b>${pad(k)}</b> / 06</p><h3>${t(lang, 'process.stages')[k]}</h3><p>${t(lang, 'process.stageDesc')[k]}</p></div>`;
    } else if (ci === 4) {
      el = document.getElementById('workFocus');
      html = `<span class="focus__num">${pad(k)}</span><div class="focus__body"><h3>${t(lang, 'portfolio.screens')[k]}</h3></div>`;
    } else if (ci === 5) {
      const it = t(lang, 'future.items')[k];
      el = document.getElementById('futureFocus');
      html = `<span class="focus__icon">${svg(FUTURE_ICONS[k])}</span><div class="focus__body"><p class="focus__kicker"><b>${pad(k)}</b> / 04 <span class="badge">${t(lang, 'future.badge')}</span></p><h3>${it.title}</h3><p>${it.detail}</p></div>`;
    }
    if (!el) return;
    el.innerHTML = html;
    el.classList.remove('is-shine');
    void el.offsetWidth; // restart the sweep
    el.classList.add('is-shine');
    if (!reduced) gsap.fromTo(el.children, { y: 16, opacity: 0, filter: 'blur(6px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.7, ease: 'power3.out', stagger: 0.06, clearProps: 'filter' });
  }

  function setStep(ci, k) {
    S.steps[ci] = k;
    const sec = sections[ci];
    sec.querySelectorAll('[role="tab"]').forEach((b, j) => {
      b.setAttribute('aria-selected', String(j === k));
      b.tabIndex = j === k ? 0 : -1;
    });
    if (ci === 2) sec.querySelectorAll('.pillars li').forEach((li, j) => li.classList.toggle('is-on', j <= k));
    focusCard(ci, k);
  }

  /* ------------------------------------------------------------ reveals */
  function hideWords(ci) {
    if (reduced) return;
    gsap.set(panels[ci].querySelectorAll('.word'), { opacity: 0 });
    gsap.set(panels[ci].querySelectorAll('.eyebrow, .actions'), { opacity: 0, y: 24 });
  }
  // eyebrows decode from scrambled glyphs of their own text (works for Latin and Arabic)
  function scramble(el) {
    const text = el.dataset.text || el.textContent;
    el.dataset.text = text;
    const pool = text.replace(/\s/g, '') || text;
    const o = { p: 0 };
    gsap.to(o, {
      p: 1, duration: 0.9, ease: 'power2.out',
      onUpdate: () => {
        const n = Math.floor(o.p * text.length);
        el.textContent = text.slice(0, n) + [...text.slice(n)].map((c) => (c === ' ' ? ' ' : pool[(Math.random() * pool.length) | 0])).join('');
      },
      onComplete: () => (el.textContent = text),
    });
  }
  function reveal(ci) {
    if (reduced) return;
    const p = panels[ci];
    p.querySelectorAll('.eyebrow').forEach((e) => (e.children.length ? [...e.children] : [e]).forEach(scramble));
    REVEALS[ci](p.querySelectorAll('.heading .word, .desc .word'));
    gsap.to(p.querySelectorAll('.eyebrow, .actions'), { y: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: 0.14, delay: 0.2 });
  }

  /* ------------------------------------------------------------ frame */
  function setActive(i) {
    S.active = i;
    sections.forEach((s, j) => s.classList.toggle('is-active', j === i));
    navLinks.forEach((a, j) => {
      a.classList.toggle('is-active', j === i);
      if (j === i) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    [...rail.children].forEach((a, j) => a.classList.toggle('is-active', j === i));
    hud.roll.style.setProperty('--i', i);
    hud.name.textContent = t(S.lang, 'nav.' + CHAPTERS[i].nav);
    if (!reduced) gsap.fromTo(hud.name, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' });
  }

  function update(st) {
    const { u, y, total } = st;
    const footerIn = clamp01((y - total) / (innerHeight * 0.55));
    // panels lean with scroll speed and settle when it stops
    const skew = reduced ? 0 : Math.max(-4, Math.min(4, (st.velocity || 0) * -0.06));
    const nextSkew = S.skew + (skew - S.skew) * 0.12;
    const skewChanged = Math.abs(nextSkew - S.skew) > 0.005;
    S.skew = Math.abs(nextSkew) < 0.005 ? 0 : nextSkew;
    let best = 0, bestVis = -1;
    CHAPTERS.forEach((ch, i) => {
      const raw = u - i;
      const w = ch.win || WINDOW;
      const inn = w[0] < 0 ? 1 : smooth(w[0], w[1], raw);
      let out = 1 - smooth(w[2], w[3], raw);
      if (i === CHAPTERS.length - 1) out *= 1 - footerIn;
      const vis = raw < -0.2 || raw > 1.2 ? 0 : inn * out;
      if (vis > bestVis) (best = i), (bestVis = vis);
      if (ch.steps && raw > -0.2 && raw < 1.2) {
        const k = Math.round(stepF(ch, clamp01(raw)));
        if (k !== S.steps[i]) setStep(i, k);
      }
      const prev = S.vis[i];
      S.vis[i] = vis;
      if (vis !== prev || skewChanged) {
        const p = panels[i];
        const a = 1 - inn, b = 1 - out;
        const ds = dirSign();
        p.style.opacity = vis.toFixed(3);
        p.style.transform = reduced
          ? 'none'
          : `translate3d(${(-a * 60 + b * 40) * ds}px, ${a * 50 - b * 40}px, ${-a * 520 + b * 300}px) rotateY(${(a * 16 - b * 10) * ds}deg) rotateX(${a * 6}deg) skewY(${S.skew.toFixed(2)}deg)`;
        sections[i].classList.toggle('is-on', vis > 0.01);
      }
      // replay each chapter's entrance every time it comes back on stage
      if (!S.ready) return;
      if (!S.entered[i] && vis > 0.35) {
        S.entered[i] = true;
        reveal(i);
      } else if (S.entered[i] && vis < 0.01) {
        S.entered[i] = false;
        hideWords(i);
      }
    });
    // mid-flight no panel is on stage: the chapter we're travelling through wins
    if (bestVis < 0.02) best = Math.min(CHAPTERS.length - 1, Math.round(u));
    if (best !== S.active) setActive(best);
    hud.bar.style.transform = `scaleX(${clamp01(u / CHAPTERS.length).toFixed(4)})`;
    cue.classList.toggle('is-hidden', u > 0.08);
    nav.classList.toggle('is-scrolled', y > 30);
    root.classList.toggle('in-footer', footerIn > 0.5);
  }

  /* ------------------------------------------------------------ navigation */
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const ci = CHAPTERS.findIndex((c) => c.id === id);
    if (ci < 0) return;
    e.preventDefault();
    goChapter(ci);
    history.replaceState(null, '', `#${id}`);
  });
  // keyboard users tabbing into a chapter that isn't on stage are flown to it
  document.getElementById('main').addEventListener('focusin', (e) => {
    const sec = e.target.closest('.chapter');
    const ci = sections.indexOf(sec);
    if (ci >= 0 && ci !== S.active) goChapter(ci, { immediate: true });
  });
  const nextStep = (ci) => () => {
    const ch = CHAPTERS[ci];
    const k = S.steps[ci];
    if (k >= ch.steps - 1) goChapter(ci + 1);
    else goStep(ci, k + 1);
  };
  document.getElementById('exploreServices').addEventListener('click', nextStep(1));
  document.getElementById('howWeWork').addEventListener('click', nextStep(3));

  sections.forEach((_, i) => i && hideWords(i));
  /** Replay the on-stage chapter's entrance (after a language swap). */
  function replay() {
    S.entered = S.entered.map(() => false);
    sections.forEach((_, i) => hideWords(i));
  }

  /** Screen rect of the panel on stage, so 3D labels can keep clear of it. */
  function activeRect() {
    const i = S.active;
    return i >= 0 && S.vis[i] > 0.3 ? panels[i].getBoundingClientRect() : null;
  }

  return { build, update, setThumbs, activeRect, replay, goChapter, goStep, revealHero: () => {
      S.ready = true;
      S.entered[0] = true;
      reveal(0);
    }, hideHero: () => hideWords(0), state: S };
}
