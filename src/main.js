import './styles.css';
import { gsap } from 'gsap';
import { applyLang, setupTheme, setupLang, setupNav, setupCursor, setupTilt, createLoader } from './ui.js';
import { createScroll } from './scroll.js';
import { createChapters } from './chapters.js';
import { CHAPTERS, arriveAt } from './story.js';

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

applyLang(lang);
const loader = createLoader({ reduced: reduced || capture });
const scroll = createScroll({ reduced: reduced || capture });
const chapters = createChapters({ scroll, reduced });
chapters.build(lang);
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
      const [{ World }, lib, ...mods] = await Promise.all([
        import('./three/world.js'),
        import('./three/lib.js'),
        import('./three/stations/hero.js'),
        import('./three/stations/services.js'),
        import('./three/stations/about.js'),
        import('./three/stations/process.js'),
        import('./three/stations/portfolio.js'),
        import('./three/stations/future.js'),
        import('./three/stations/contact.js'),
      ]);
      loader.progress(45);
      world = new World(document.getElementById('gl'), { reduced, quality: params.get('quality'), capture });
      world.ctx.lang = lang;
      world.ctx.dir = root.dir === 'rtl' ? -1 : 1;
      world.navigate = (u) => scroll.toU(u);
      const factories = [mods[0].createHero, mods[1].createServices, mods[2].createAbout, mods[3].createProcess, (w) => mods[4].createPortfolio(w, { onThumbs: chapters.setThumbs }), mods[5].createFuture, mods[6].createContact];
      factories.forEach((fn, i) => world.add(fn(world), i));
      world.seal();
      hero = world.stations[0];
      setupTheme((mix) => lib.applyTheme(mix), { reduced, onKick });
      loader.progress(70);
      await document.fonts?.ready;
      world.stations.forEach((s) => s.onLang?.(lang));
      // compile every station's shaders up front so the first flight doesn't hitch
      world.stations.forEach((s) => (s.group.visible = true));
      await world.renderer.compileAsync?.(world.scene, world.camera);
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
    chapters.replay();
    if (world) {
      world.ctx.lang = l;
      world.setDir(l === 'ar' ? -1 : 1);
      world.stations.forEach((s) => s.onLang?.(l));
    }
  }, { reduced, onKick });

  // land on a deep link (#services …) without the fly-through
  const ci = CHAPTERS.findIndex((c) => '#' + c.id === location.hash);
  if (ci > 0) scroll.toU(ci + arriveAt(CHAPTERS[ci]), { immediate: true });
  else scrollTo(0, 0);

  if (capture) window.__pw = { toU: (u) => scroll.toU(u, { immediate: true }) };

  let last = performance.now();
  gsap.ticker.add((time) => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const st = scroll.update(time * 1000);
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
