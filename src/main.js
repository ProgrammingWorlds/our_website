import './styles.css';
import { gsap } from 'gsap';
import { applyLang, setupTheme, setupLang, setupNav, setupCursor, setupTilt, createLoader } from './ui.js';
import { createScroll } from './scroll.js';
import { createChapters } from './chapters.js';
import { createContactForm } from './contact-form.js';
import { CHAPTERS, chapterIndex, arriveAt } from './story.js';

// 3D stations by scene id; each page only downloads the scenes its story uses.
const SCENES = {
  hero: () => import('./three/stations/hero.js').then((m) => m.createHero),
  about: () => import('./three/stations/about.js').then((m) => m.createAbout),
  services: () => import('./three/stations/services.js').then((m) => m.createServices),
  process: () => import('./three/stations/process.js').then((m) => m.createProcess),
  portfolio: () => import('./three/stations/portfolio.js').then((m) => m.createPortfolio),
  future: () => import('./three/stations/future.js').then((m) => m.createFuture),
  contact: () => import('./three/stations/contact.js').then((m) => m.createContact),
};

const root = document.documentElement;
const params = new URLSearchParams(location.search);
// ?theme= / ?lang= preview a state without persisting it (used for screenshots)
if (params.get('theme') === 'light' || params.get('theme') === 'dark') root.dataset.theme = params.get('theme');
if (params.get('lang') === 'ar' || params.get('lang') === 'en') root.lang = params.get('lang');

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('still');
const capture = params.has('capture');
if (reduced) root.classList.add('reduced');
let lang = root.lang === 'ar' ? 'ar' : 'en';
gsap.ticker.lagSmoothing(capture ? 0 : 500, 33);

// the full welcome plays once per session; later page loads skip straight in
let quick = false;
try {
  quick = sessionStorage.getItem('pw-intro') === '1';
  sessionStorage.setItem('pw-intro', '1');
} catch { /* storage unavailable */ }

applyLang(lang);
const loader = createLoader({ reduced: reduced || capture, quick });
const scroll = createScroll({ reduced: reduced || capture });
const chapters = createChapters({ scroll, reduced });
const form = createContactForm();
chapters.build(lang);
form.build(lang);
chapters.hideHero();
setupNav({ lockScroll: (v) => (v ? scroll.lenis?.stop() : scroll.lenis?.start(), (document.body.style.overflow = v ? 'hidden' : '')) });
setupCursor({ reduced: reduced || capture });
setupTilt({ reduced });

function hasWebGL() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

async function boot() {
  let world = null, hero = null;
  const onKick = (k) => world?.kick(k);
  loader.progress(12);
  if (hasWebGL()) {
    try {
      const [{ World }, lib, ...factories] = await Promise.all([import('./three/world.js'), import('./three/lib.js'), ...CHAPTERS.map((c) => SCENES[c.scene]())]);
      loader.progress(45);
      world = new World(document.getElementById('gl'), { reduced, quality: params.get('quality'), capture });
      world.ctx.lang = lang;
      world.ctx.dir = root.dir === 'rtl' ? -1 : 1;
      world.select = (id, k) => chapters.select(id, k);
      factories.forEach((fn, i) => world.add(fn(world), i));
      world.seal();
      hero = world.stations.find((s) => s.id === 'hero');
      setupTheme((mix) => lib.applyTheme(mix), { reduced, onKick });
      loader.progress(70);
      await document.fonts?.ready;
      world.stations.forEach((s) => s.onLang?.(lang));
      // compile every station's shaders up front so the first flight doesn't hitch
      world.stations.forEach((s) => (s.group.visible = true));
      await world.renderer.compileAsync?.(world.scene, world.camera);
      // and upload their textures now, not on the frame a station first comes into view
      world.scene.traverse((o) => {
        const m = o.material;
        if (m?.map) world.renderer.initTexture(m.map);
        for (const u of Object.values(m?.uniforms || {})) if (u.value?.isTexture) world.renderer.initTexture(u.value);
      });
      loader.progress(92);
      root.classList.add('webgl');
    } catch (err) {
      console.error('[PW] WebGL init failed, using static fallback', err);
      world = null;
    }
  }
  if (!world) {
    root.classList.add('no-webgl');
    setupTheme(() => {}, { reduced });
  }

  setupLang((l) => {
    lang = l;
    applyLang(l);
    chapters.build(l);
    form.build(l);
    chapters.replay();
    if (world) {
      world.ctx.lang = l;
      world.setDir(l === 'ar' ? -1 : 1);
      world.stations.forEach((s) => s.onLang?.(l));
    }
  }, { reduced, onKick });

  // land on a deep link (#services …) without the fly-through
  const ci = CHAPTERS.findIndex((c) => '#' + c.id === location.hash);
  if (ci > 0) chapters.goChapter(ci, { immediate: true });
  else scrollTo(0, 0);

  // hooks for the screenshot and end-to-end scripts
  if (capture || params.has('test')) window.__pw = { toU: (u) => scroll.toU(u, { immediate: true }), arrive: (id) => chapterIndex(id) + arriveAt(CHAPTERS[chapterIndex(id)]), chapters, scroll, world };

  let last = performance.now();
  gsap.ticker.add((time) => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const st = chapters.view(scroll.update(time * 1000));
    chapters.update(st);
    if (world) {
      world.avoid = chapters.activeRect();
      world.frame(dt, st);
    }
  });

  await loader.done(reduced || capture, () => {
    onKick(1);
    hero?.playIntro();
  });
  chapters.revealHero();
}

boot();
