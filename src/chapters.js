import { gsap } from 'gsap';
import { CHAPTERS, WINDOW, stepF, stepAt, arriveAt, chapterIndex } from './story.js';
import { t } from './i18n.js';
import { svg } from './icons.js';
import { createShowcase } from './showcase.js';

const root = document.documentElement;
const dirSign = () => (root.dir === 'rtl' ? -1 : 1);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const pad = (n) => String(n + 1).padStart(2, '0');
const $ = (id) => document.getElementById(id);

const SVC_ICONS = ['web', 'code', 'mobile', 'nfc', 'training'];
const STAGE_ICONS = ['bulb', 'strategy', 'design', 'dev', 'test', 'rocket'];
const PILLAR_ICONS = ['creative', 'practical', 'modern', 'partner'];
const VALUE_ICONS = ['test', 'target', 'spark', 'layers', 'refresh'];
const FUTURE_ICONS = ['ai', 'globe', 'test', 'cloud'];

// Each chapter's words enter differently, so the journey never repeats a beat.
// Transform + opacity only, so reveals stay cheap.
const REVEALS = {
  home: (w) => gsap.fromTo(w, { yPercent: 115, rotate: 7, opacity: 0 }, { yPercent: 0, rotate: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.05 }),
  about: (w) => gsap.fromTo(w, { clipPath: 'inset(0 0 100% 0)', y: 20, opacity: 1 }, { clipPath: 'inset(0 0 0% 0)', y: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: 0.035 }),
  services: (w) => gsap.fromTo(w, { xPercent: -40 * dirSign(), skewX: -14, opacity: 0 }, { xPercent: 0, skewX: 0, opacity: 1, duration: 1, ease: 'power4.out', stagger: 0.03 }),
  process: (w) => gsap.fromTo(w, { rotateX: -90, transformOrigin: '50% 100% -20px', opacity: 0 }, { rotateX: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.035 }),
  projects: (w) => gsap.fromTo(w, { scale: 1.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 1, ease: 'power3.out', stagger: 0.03 }),
  future: (w) => gsap.fromTo(w, { y: (i) => (i % 2 ? -60 : 60), opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: { each: 0.03, from: 'center' } }),
  contact: (w) => gsap.fromTo(w, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.1, ease: 'power4.out', stagger: 0.035 }),
};

// arrow keys move along a tab list (reading direction aware), Home/End jump to the ends
function roving(e, items, go) {
  const i = items.indexOf(document.activeElement);
  if (i < 0) return;
  const rtl = root.dir === 'rtl';
  const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1, ArrowDown: 1, ArrowUp: -1 }[e.key];
  let k;
  if (step) k = (i + step + items.length) % items.length;
  else if (e.key === 'Home') k = 0;
  else if (e.key === 'End') k = items.length - 1;
  else return;
  e.preventDefault();
  items[k].focus();
  go(k);
}
// sum of offsetTop up to an ancestor: the element's layout position inside it, ignoring transforms
function offsetIn(el, ancestor) {
  let y = 0;
  while (el && el !== ancestor) {
    y += el.offsetTop;
    el = el.offsetParent;
  }
  return y;
}

/**
 * Drives the DOM side of the story from the scroll position: which chapter
 * panel is on stage (with a depth fly-through), the active step inside a
 * chapter, the HUD, rail and nav state.
 */
export function createChapters({ scroll, reduced }) {
  const sections = CHAPTERS.map((ch) => $(ch.id));
  const panels = sections.map((s) => s.querySelector('.panel'));
  const navLinks = [...document.querySelectorAll('.nav__links a[href^="#"], .mobile-menu a[href^="#"]')];
  const rail = $('rail');
  const nav = $('nav');
  const hud = { roll: $('hudRoll'), name: $('hudName'), bar: $('hudBar') };
  const cue = $('scrollCue');
  const N = CHAPTERS.length;
  const S = {
    active: -1, lang: root.lang, ready: false, skew: 0, lock: null, pin: null,
    steps: CHAPTERS.map(() => -1), vis: CHAPTERS.map(() => 0), entered: CHAPTERS.map(() => false),
    // overflow handling: how far a too-tall panel must travel, the current offset, a focus override
    over: CHAPTERS.map(() => 0), avail: CHAPTERS.map(() => 0), shift: CHAPTERS.map(() => 0), manual: CHAPTERS.map(() => null),
    box: CHAPTERS.map(() => null),
  };
  const idx = { about: chapterIndex('about'), services: chapterIndex('services'), process: chapterIndex('process'), projects: chapterIndex('projects'), future: chapterIndex('future') };
  if (N < 2) root.classList.add('single-chapter');

  const goChapter = (ci, opts) => scroll.toU(ci + arriveAt(CHAPTERS[ci]), opts);
  /**
   * Select step k of chapter ci: flies there, and holds the selection while
   * the flight passes the steps in between so the UI never flickers back.
   */
  function select(ci, k) {
    if (ci < 0) return;
    const ch = CHAPTERS[ci];
    k = Math.max(0, Math.min(ch.steps - 1, k));
    // the hold ends when the flight lands (on a slow device that can be later
    // than planned); the timer is only a safety net
    const lock = { ci };
    S.lock = lock;
    const dur = scroll.toU(ci + stepAt(ch, k), { onDone: () => S.lock === lock && (S.lock = null) });
    lock.until = performance.now() + dur * 3000 + 1500;
    S.manual[ci] = null;
    if (k !== S.steps[ci]) setStep(ci, k);
  }
  const showcase = idx.projects >= 0 ? createShowcase({ reduced }) : null;

  /* ------------------------------------------------------------ content */
  function tablist(el, ci, html) {
    el.innerHTML = html;
    const tabs = [...el.querySelectorAll('[role="tab"]')];
    tabs.forEach((b, k) => b.addEventListener('click', () => select(ci, k)));
    el.onkeydown = (e) => roving(e, tabs, (k) => select(ci, k));
  }

  function build(lang) {
    S.lang = lang;
    if (idx.services >= 0) {
      tablist($('svcSteps'), idx.services, t(lang, 'services.items').map((it, k) =>
        `<button type="button" role="tab" id="svc-tab-${k}" aria-selected="false" aria-controls="svcFocus" tabindex="-1"><span class="svc__orb">${svg(SVC_ICONS[k])}</span><span class="svc__label">${it.title}</span></button>`).join(''));
    }
    if (idx.process >= 0) {
      tablist($('stageSteps'), idx.process, t(lang, 'process.stages').map((s, k) =>
        `<button type="button" role="tab" id="stage-tab-${k}" aria-selected="false" aria-controls="stageFocus" tabindex="-1"><span class="stages__n">${pad(k)}</span><span class="stages__label">${s}</span></button>`).join(''));
    }
    if (idx.future >= 0) {
      tablist($('futureSteps'), idx.future, t(lang, 'future.items').map((it, k) =>
        `<button type="button" role="tab" aria-selected="false" aria-label="${it.title}" tabindex="-1"><span>${pad(k)}</span></button>`).join(''));
    }
    if (idx.about >= 0) {
      const secs = t(lang, 'about.sections');
      tablist($('aboutSteps'), idx.about, secs.map((s, k) =>
        `<button type="button" role="tab" id="about-tab-${k}" aria-selected="false" aria-controls="about-sec-${k}" tabindex="-1"><span class="about-nav__n">${pad(k)}</span><span class="about-nav__label">${s.short}</span></button>`).join(''));
      $('aboutFocus').innerHTML = secs.map((s, k) => `<section class="about-sec" id="about-sec-${k}" role="tabpanel" aria-labelledby="about-tab-${k}" inert aria-hidden="true">${aboutSection(lang, k)}</section>`).join('');
    }
    if (showcase) {
      showcase.build(lang);
      const tabs = $('workTabs');
      const items = [...tabs.querySelectorAll('[role="tab"]')];
      items.forEach((b, k) => b.addEventListener('click', () => select(idx.projects, k)));
      tabs.onkeydown = (e) => roving(e, items, (k) => select(idx.projects, k));
    }
    buildRail(lang);
    S.steps = S.steps.map(() => -1); // force focus cards to re-render
    S.active = -1;
    measure();
  }

  function buildRail(lang) {
    rail.innerHTML = CHAPTERS.map((ch, i) => `<a href="#${ch.id}"><span class="rail__n">${pad(i)}</span><span class="rail__label">${t(lang, 'nav.' + ch.id)}</span><i></i></a>`).join('');
  }

  /** About: seven short sections that share one card (all stacked in one grid cell, so the card never resizes). */
  function aboutSection(lang, k) {
    const s = t(lang, 'about.sections')[k];
    const head = `<p class="about-sec__kicker"><b>${pad(k)}</b> / ${pad(CHAPTERS[idx.about].steps - 1)} · ${s.label}</p><h3>${s.title}</h3>`;
    const more = (href, label) => `<a class="about-more" href="${href}">${label}<i class="btn__arrow"></i></a>`;
    switch (k) {
      case 0:
        return head + `<p>${s.text}</p><ul class="about-pills">${t(lang, 'about.pillars').map((p, j) => `<li>${svg(PILLAR_ICONS[j])}<span>${p}</span></li>`).join('')}</ul>`;
      case 1:
        return head + `<div class="about-duo">${[['eye', s.vision], ['flag', s.mission]].map(([ic, [h, p]]) => `<div><p class="about-duo__h">${svg(ic)}<span>${h}</span></p><p>${p}</p></div>`).join('')}</div>`;
      case 2:
        return head + `<p>${s.text}</p><ul class="about-chips">${t(lang, 'services.items').map((it, j) => `<li>${svg(SVC_ICONS[j])}<span>${it.title}</span></li>`).join('')}</ul>` + more('#services', s.more);
      case 3:
        return head + `<ol class="about-flow">${s.steps.map(([h, p], j) => `<li><b>${pad(j)}</b><strong>${h}</strong><span>${p}</span></li>`).join('')}</ol>` + more('#process', s.more);
      case 4:
        return head + `<ul class="about-grid">${s.items.map(([h, p], j) => `<li>${svg(VALUE_ICONS[j])}<div><strong>${h}</strong><span>${p}</span></div></li>`).join('')}</ul>`;
      case 5:
        return head + `<ul class="about-grid about-grid--why">${s.items.map(([h, p]) => `<li>${svg('check')}<div><strong>${h}</strong><span>${p}</span></div></li>`).join('')}</ul>`;
      default:
        return head + `<ul class="about-checks">${s.items.map((p) => `<li>${svg('check')}<span>${p}</span></li>`).join('')}</ul>` +
          `<a class="btn btn--gold btn--sm" href="#contact"><span>${s.cta}</span><i class="btn__arrow"></i></a>`;
    }
  }

  function focusCard(ci, k) {
    const lang = S.lang;
    const id = CHAPTERS[ci].id;
    let el, html;
    if (id === 'services') {
      const it = t(lang, 'services.items')[k];
      el = $('svcFocus');
      el.setAttribute('aria-labelledby', `svc-tab-${k}`);
      html = `<span class="focus__icon">${svg(SVC_ICONS[k])}</span><div class="focus__body"><p class="focus__kicker"><b>${pad(k)}</b> / 05 · ${it.sub}</p><h3>${it.title}</h3><p>${it.detail}</p></div>`;
    } else if (id === 'process') {
      el = $('stageFocus');
      el.setAttribute('aria-labelledby', `stage-tab-${k}`);
      html = `<span class="focus__icon">${svg(STAGE_ICONS[k])}</span><div class="focus__body"><p class="focus__kicker">${t(lang, 'process.stage')} <b>${pad(k)}</b> / ${pad(CHAPTERS[ci].steps - 1)}</p><h3>${t(lang, 'process.stages')[k]}</h3><p>${t(lang, 'process.stageDesc')[k]}</p></div>`;
    } else if (id === 'future') {
      const it = t(lang, 'future.items')[k];
      el = $('futureFocus');
      html = `<span class="focus__icon">${svg(FUTURE_ICONS[k])}</span><div class="focus__body"><p class="focus__kicker"><b>${pad(k)}</b> / 04 <span class="badge">${t(lang, 'future.badge')}</span></p><h3>${it.title}</h3><p>${it.detail}</p></div>`;
    } else if (id === 'projects') {
      return showcase.setProject(k);
    } else if (id === 'about') {
      $('aboutFocus').querySelectorAll('.about-sec').forEach((sec, j) => {
        const on = j === k;
        sec.classList.toggle('is-on', on);
        sec.inert = !on;
        sec.setAttribute('aria-hidden', String(!on));
      });
      return;
    }
    if (!el) return;
    el.innerHTML = html;
    el.classList.remove('is-shine');
    void el.offsetWidth; // restart the sweep
    el.classList.add('is-shine');
    if (!reduced) gsap.fromTo(el.children, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.05 });
  }

  function setStep(ci, k) {
    S.steps[ci] = k;
    const sec = sections[ci];
    sec.querySelectorAll('[role="tab"]').forEach((b, j) => {
      b.setAttribute('aria-selected', String(j === k));
      b.tabIndex = j === k ? 0 : -1;
      b.classList.toggle('is-done', j < k);
    });
    if (ci === idx.process) {
      const last = k >= CHAPTERS[ci].steps - 1;
      $('stagePrev').setAttribute('aria-disabled', String(k <= 0));
      $('howWeWorkLabel').textContent = t(S.lang, last ? 'process.last' : 'process.cta');
    }
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
      p: 1, duration: 0.8, ease: 'power2.out',
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
    REVEALS[CHAPTERS[ci].id]?.(p.querySelectorAll('.heading .word, .desc .word'));
    gsap.to(p.querySelectorAll('.eyebrow, .actions'), { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', stagger: 0.12, delay: 0.15 });
  }

  /* ------------------------------------------------------------ layout */
  // Panels taller than the space between the header and the bottom edge are
  // measured here; while on stage they travel up with the scroll (or to the
  // focused control) instead of being clipped.
  function measure() {
    sections.forEach((sec, i) => {
      const cs = getComputedStyle(sec);
      const top = parseFloat(cs.paddingTop), bottom = parseFloat(cs.paddingBottom);
      const avail = sec.clientHeight - top - bottom;
      const p = panels[i];
      S.avail[i] = avail;
      S.over[i] = Math.max(0, Math.ceil(p.offsetHeight - avail));
      S.box[i] = { left: p.offsetLeft, top: p.offsetTop, width: p.offsetWidth, height: p.offsetHeight };
    });
    S.vis = S.vis.map(() => -1); // re-apply transforms
  }
  let measureQueued = false;
  const queueMeasure = () => {
    if (measureQueued) return;
    measureQueued = true;
    requestAnimationFrame(() => {
      measureQueued = false;
      measure();
    });
  };
  const ro = new ResizeObserver(queueMeasure);
  panels.forEach((p) => ro.observe(p));
  addEventListener('resize', queueMeasure);
  document.fonts?.ready.then(queueMeasure);

  /* ------------------------------------------------------------ frame */
  function setActive(i) {
    S.active = i;
    sections.forEach((s, j) => s.classList.toggle('is-active', j === i));
    navLinks.forEach((a) => {
      const on = a.getAttribute('href') === `#${CHAPTERS[i].id}`;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    [...rail.children].forEach((a, j) => a.classList.toggle('is-active', j === i));
    hud.roll.style.setProperty('--i', i);
    hud.name.textContent = t(S.lang, 'nav.' + CHAPTERS[i].id);
    if (!reduced) gsap.fromTo(hud.name, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
  }

  /** The scroll state the scene should show: frozen while a form field is being edited. */
  function view(st) {
    if (!S.pin) return st;
    return { ...st, u: S.pin.u, y: Math.min(st.y, st.total - 1), velocity: 0 };
  }

  let cueHidden = null;
  function update(st) {
    const { u, y, total } = st;
    if (S.lock && performance.now() > S.lock.until) S.lock = null;
    const footerIn = clamp01((y - total) / (innerHeight * 0.55));
    // panels lean slightly with scroll speed and settle when it stops
    const skew = reduced ? 0 : Math.max(-2, Math.min(2, (st.velocity || 0) * -0.03));
    const nextSkew = S.skew + (skew - S.skew) * 0.12;
    const skewChanged = Math.abs(nextSkew - S.skew) > 0.005;
    S.skew = Math.abs(nextSkew) < 0.005 ? 0 : nextSkew;
    let best = 0, bestVis = -1;
    CHAPTERS.forEach((ch, i) => {
      const raw = u - i;
      const w = ch.win || WINDOW;
      const inn = w[0] < 0 ? 1 : smooth(w[0], w[1], raw);
      let out = 1 - smooth(w[2], w[3], raw);
      if (i === N - 1) out *= 1 - footerIn;
      const vis = raw < -0.2 || raw > 1.2 ? 0 : inn * out;
      if (vis > bestVis) (best = i), (bestVis = vis);
      if (ch.steps && raw > -0.2 && raw < 1.2 && S.lock?.ci !== i) {
        const k = Math.round(stepF(ch, clamp01(raw)));
        if (k !== S.steps[i]) setStep(i, k);
      }
      // too-tall panels travel through their content while on stage
      let shift = 0;
      if (S.over[i] > 0) {
        if (S.manual[i] != null) shift = S.manual[i];
        else {
          const a = Math.max(0, w[1]) + 0.02, b = Math.min(1, w[2]) - 0.1;
          shift = Math.round(S.over[i] * clamp01((raw - a) / (b - a)));
        }
      }
      const prev = S.vis[i];
      S.vis[i] = vis;
      if (vis !== prev || skewChanged || shift !== S.shift[i]) {
        S.shift[i] = shift;
        const p = panels[i];
        const a = 1 - inn, b = 1 - out;
        const ds = dirSign();
        p.style.opacity = vis.toFixed(3);
        p.style.transform = reduced
          ? `translate3d(0, ${-shift}px, 0)`
          : `translate3d(${(-a * 40 + b * 30) * ds}px, ${a * 36 - b * 30 - shift}px, ${-a * 320 + b * 120}px) rotateY(${(a * 10 - b * 6) * ds}deg) rotateX(${a * 4}deg) skewY(${S.skew.toFixed(2)}deg)`;
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
    if (bestVis < 0.02) best = Math.min(N - 1, Math.round(u));
    if (best !== S.active) setActive(best);
    if (showcase && Math.abs(u - idx.projects) < 1.3) showcase.wake();
    hud.bar.style.transform = `scaleX(${clamp01(u / N).toFixed(4)})`;
    const hideCue = u > 0.04 || N < 2;
    if (hideCue !== cueHidden) {
      cueHidden = hideCue;
      cue.classList.toggle('is-hidden', hideCue);
      cue.tabIndex = hideCue ? -1 : 0;
      cue.setAttribute('aria-hidden', String(hideCue));
      root.classList.toggle('at-start', !hideCue);
    }
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
    unpin();
    goChapter(ci);
    history.replaceState(null, '', `#${id}`);
  });
  cue.addEventListener('click', () => N > 1 && goChapter(1));

  // a visitor's own scrolling always wins over selections, focus offsets and pins
  const release = () => {
    S.lock = null;
    S.manual = S.manual.map(() => null);
    if (S.pin) unpin(false);
  };
  addEventListener('wheel', release, { passive: true });
  addEventListener('touchmove', release, { passive: true });
  addEventListener('keydown', (e) => {
    if (['PageDown', 'PageUp', ' ', 'End', 'Home'].includes(e.key) && !e.target.closest?.('input, textarea, select, [role="tab"], [role="radio"]')) release();
  });

  // Keyboard users tabbing into a chapter that isn't on stage are flown to it;
  // inside a too-tall panel, the focused control is brought into view.
  $('main').addEventListener('focusin', (e) => {
    const sec = e.target.closest('.chapter');
    const ci = sections.indexOf(sec);
    if (ci < 0) return;
    if (ci !== S.active) goChapter(ci, { immediate: true });
    if (e.target.matches('input, textarea, select')) pin(ci);
    if (S.over[ci] > 0) {
      const top = offsetIn(e.target, panels[ci]);
      const bottom = top + e.target.offsetHeight;
      const cur = S.shift[ci];
      let next = cur;
      if (bottom - cur > S.avail[ci] - 12) next = bottom - S.avail[ci] + 24;
      if (top - next < 12) next = top - 24;
      S.manual[ci] = Math.max(0, Math.min(S.over[ci], Math.round(next)));
    }
  });
  // While someone types, the scene holds still: on phones the on-screen
  // keyboard can scroll the page, which must not fly the story elsewhere.
  function pin(ci) {
    if (!S.pin) S.pin = { ci, u: scroll.state.u };
  }
  function unpin(restore = true) {
    const p = S.pin;
    S.pin = null;
    if (restore && p && Math.abs(scroll.state.u - p.u) > 0.002) scroll.toU(p.u, { immediate: true });
  }
  $('main').addEventListener('focusout', () => {
    setTimeout(() => {
      if (S.pin && !document.activeElement?.matches?.('input, textarea, select')) unpin();
    }, 0);
  });

  if (idx.process >= 0) {
    $('howWeWork').addEventListener('click', () => {
      const ci = idx.process;
      const k = S.steps[ci];
      if (k >= CHAPTERS[ci].steps - 1) goChapter(ci + 1);
      else select(ci, k + 1);
    });
    $('stagePrev').addEventListener('click', () => S.steps[idx.process] > 0 && select(idx.process, S.steps[idx.process] - 1));
  }
  if (showcase) {
    const n = CHAPTERS[idx.projects].steps;
    $('workPrev').addEventListener('click', () => select(idx.projects, (S.steps[idx.projects] - 1 + n) % n));
    $('workNext').addEventListener('click', () => select(idx.projects, (S.steps[idx.projects] + 1) % n));
  }

  sections.forEach((_, i) => i && hideWords(i));
  /** Replay the on-stage chapter's entrance (after a language swap). */
  function replay() {
    S.entered = S.entered.map(() => false);
    sections.forEach((_, i) => hideWords(i));
  }

  /** Screen rect of the panel on stage, so 3D labels keep clear of it (from cached layout, no reflow). */
  function activeRect() {
    const i = S.active;
    const b = S.box[i];
    if (i < 0 || !b || S.vis[i] < 0.3) return null;
    const top = b.top - S.shift[i];
    return { left: b.left, right: b.left + b.width, top, bottom: top + b.height };
  }

  return {
    build, update, view, activeRect, replay, goChapter, measure, state: S,
    select: (id, k) => select(chapterIndex(id), k),
    revealHero: () => {
      S.ready = true;
      S.entered[0] = true;
      reveal(0);
    },
    hideHero: () => hideWords(0),
  };
}
