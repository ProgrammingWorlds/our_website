import './styles.css';
import { applyLang, setupReveals, setupTheme, setupLang, setupNav } from './ui.js';

const root = document.documentElement;
const params = new URLSearchParams(location.search);
// ?theme= / ?lang= preview a state without persisting it (used for screenshots)
if (params.get('theme') === 'light' || params.get('theme') === 'dark') root.dataset.theme = params.get('theme');
if (params.get('lang') === 'ar' || params.get('lang') === 'en') root.lang = params.get('lang');

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('still');
let lang = root.lang === 'ar' ? 'ar' : 'en';
if (params.has('capture')) import('gsap').then(({ gsap }) => gsap.ticker.lagSmoothing(0));
applyLang(lang);
setupNav();

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

async function boot() {
  let engine = null, scenes = [], hero = null;
  if (hasWebGL()) {
    try {
      const [{ Engine }, lib, ...mods] = await Promise.all([
        import('./three/engine.js'),
        import('./three/lib.js'),
        import('./three/scenes/hero.js'),
        import('./three/scenes/services.js'),
        import('./three/scenes/about.js'),
        import('./three/scenes/process.js'),
        import('./three/scenes/portfolio.js'),
        import('./three/scenes/future.js'),
        import('./three/scenes/contact.js'),
      ]);
      engine = new Engine(document.getElementById('gl'), { reduced, quality: params.get('quality'), capture: params.has('capture') });
      engine.ctx.lang = lang;
      engine.ctx.dir = root.dir === 'rtl' ? -1 : 1;
      const factories = [
        [mods[0].createHero, 'home'],
        [mods[1].createServices, 'services'],
        [mods[2].createAbout, 'about'],
        [mods[3].createProcess, 'process'],
        [mods[4].createPortfolio, 'projects'],
        [mods[5].createFuture, 'future'],
        [mods[6].createContact, 'contact'],
      ];
      scenes = factories.map(([fn, id]) => engine.add(fn(engine, document.getElementById(id))));
      hero = scenes[0];
      setupTheme((mix) => lib.applyTheme(mix), { reduced });
      await document.fonts?.ready;
      scenes.forEach((s) => s.onLang?.(lang));
      engine.start();
      root.classList.add('webgl');
    } catch (err) {
      console.error('[PW] WebGL init failed, using static fallback', err);
      root.classList.add('no-webgl');
      engine = null;
    }
  } else {
    root.classList.add('no-webgl');
  }
  if (!engine) setupTheme(() => {}, { reduced });

  setupLang((l) => {
    lang = l;
    applyLang(l);
    if (engine) {
      engine.ctx.lang = l;
      engine.setDir(l === 'ar' ? -1 : 1);
      scenes.forEach((s) => s.onLang?.(l));
    }
  });
  setupReveals({ reduced, onHero: () => hero?.playIntro?.() });
}

boot();
