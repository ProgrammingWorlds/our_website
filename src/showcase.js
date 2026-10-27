import { gsap } from 'gsap';
import { PROJECTS } from './config.js';
import { t } from './i18n.js';
import { svg } from './icons.js';

// CSS viewport of each device frame; screenshots in public/projects/ are captured at these sizes.
export const DEVICES = {
  laptop: { w: 1440, h: 900, icon: 'web' },
  tablet: { w: 820, h: 1180, icon: 'tablet' },
  phone: { w: 390, h: 844, icon: 'mobile' },
};
const pad = (n) => String(n + 1).padStart(2, '0');
const shot = (p, device) => `/projects/${p.id}-${device}.webp`;
const $ = (id) => document.getElementById(id);

/**
 * The projects chapter: real screenshots of each site in a laptop, tablet or
 * phone frame, an optional live preview (an iframe that is created once per
 * project and never reloaded), and a link to the real website.
 * Nothing heavy loads until the chapter is close (`wake`).
 */
export function createShowcase({ reduced }) {
  const tabs = $('workTabs'), detail = $('workDetail'), deviceTabs = $('deviceTabs');
  const device = $('device'), screen = $('deviceScreen'), count = $('workCount');
  const S = { k: 0, device: 'laptop', live: false, lang: 'en', awake: false, frames: new Map() };

  // screenshot layer (live frames are appended next to it once and kept)
  const shotEl = document.createElement('div');
  shotEl.className = 'device__shot';
  screen.appendChild(shotEl);
  new ResizeObserver(() => screen.style.setProperty('--s', String(screen.clientWidth / DEVICES[S.device].w))).observe(screen);

  function build(lang) {
    S.lang = lang;
    tabs.innerHTML = PROJECTS.map(
      (p, k) =>
        `<button type="button" role="tab" class="work__tab" id="work-tab-${k}" aria-selected="false" aria-controls="workDetail" tabindex="-1">` +
        `<span class="work__thumb"><img ${S.awake ? 'src' : 'data-src'}="/projects/${p.id}-thumb.webp" width="160" height="100" alt="" decoding="async" /></span>` +
        `<span class="work__tab-text"><strong>${p.name[lang]}</strong><span lang="ar">${p.tagline[lang]}</span></span></button>`,
    ).join('');
    deviceTabs.innerHTML = Object.entries(DEVICES)
      .map(([d, v]) => `<button type="button" role="radio" data-device="${d}" aria-checked="${d === S.device}" tabindex="${d === S.device ? 0 : -1}">${svg(v.icon)}<span>${t(lang, `portfolio.devices.${d}`)}</span></button>`)
      .join('');
    const radios = [...deviceTabs.children];
    radios.forEach((b) => b.addEventListener('click', () => setDevice(b.dataset.device)));
    deviceTabs.onkeydown = (e) => {
      const i = radios.indexOf(document.activeElement);
      const rtl = document.documentElement.dir === 'rtl';
      const step = { ArrowRight: rtl ? -1 : 1, ArrowDown: 1, ArrowLeft: rtl ? 1 : -1, ArrowUp: -1 }[e.key];
      if (i < 0 || !step) return;
      e.preventDefault();
      const b = radios[(i + step + radios.length) % radios.length];
      b.focus();
      setDevice(b.dataset.device);
    };
    if (S.rendered) setProject(S.k, false);
  }

  /** Called when the chapter comes near: load the thumbnails and the active screen. */
  function wake() {
    if (S.awake) return;
    S.awake = true;
    tabs.querySelectorAll('img[data-src]').forEach((img) => (img.src = img.dataset.src));
    renderScreen(false);
    // warm the cache for the other devices of the first project, when idle
    (window.requestIdleCallback || setTimeout)(() => Object.keys(DEVICES).forEach((d) => (new Image().src = shot(PROJECTS[S.k], d))));
  }

  function setProject(k, animate = true) {
    S.k = k;
    S.rendered = true;
    const p = PROJECTS[k], lang = S.lang;
    detail.setAttribute('aria-labelledby', `work-tab-${k}`);
    detail.innerHTML =
      `<p class="work__cat">${p.category[lang]}</p>` +
      `<h3 class="work__name"><bdi>${p.name[lang]}</bdi> <span class="work__dash" aria-hidden="true">—</span> <bdi class="work__tagline" lang="ar">${p.tagline[lang]}</bdi></h3>` +
      `<p class="work__desc">${p.desc[lang]}</p>` +
      `<div class="work__actions">` +
      `<a class="btn btn--gold btn--sm" href="${p.url}" target="_blank" rel="noopener noreferrer"><span>${t(lang, 'portfolio.open')}</span><span class="sr-only">${t(lang, 'a11y.newTab')}</span>${svg('external')}</a>` +
      (p.embeddable ? `<button type="button" class="chip" id="workLive" aria-pressed="${S.live}"><i aria-hidden="true"></i><span>${t(lang, 'portfolio.live')}</span></button>` : '') +
      `</div>`;
    detail.querySelector('#workLive')?.addEventListener('click', toggleLive);
    count.textContent = `${pad(k)} / ${pad(PROJECTS.length - 1)}`;
    if (S.awake) renderScreen(animate);
    if (animate && !reduced) gsap.fromTo(detail.children, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.05 });
  }

  function setDevice(d) {
    if (d === S.device) return;
    S.device = d;
    [...deviceTabs.children].forEach((b) => {
      const on = b.dataset.device === d;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    renderScreen(true);
  }

  function toggleLive() {
    S.live = !S.live;
    detail.querySelector('#workLive')?.setAttribute('aria-pressed', String(S.live));
    renderScreen(false);
  }

  /** The live site, sized to the device's CSS viewport and scaled into the screen. */
  function liveFrame(p) {
    let f = S.frames.get(p.id);
    if (f) return f;
    f = document.createElement('div');
    f.className = 'device__live';
    f.innerHTML = `<p class="device__status" role="status"></p>`;
    const status = f.firstChild;
    status.textContent = t(S.lang, 'portfolio.loading');
    const frame = document.createElement('iframe');
    frame.title = `${p.name.en} — live preview`;
    frame.loading = 'lazy';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    // no top-navigation: the embedded site can never navigate this page
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');
    frame.src = p.url;
    let loaded = false;
    frame.addEventListener('load', () => {
      loaded = true;
      f.classList.add('is-loaded');
    });
    // a site that refuses to be framed never gets here in time: fall back to the screenshot
    setTimeout(() => {
      if (loaded) return;
      f.classList.add('is-failed');
      status.textContent = t(S.lang, 'portfolio.blocked');
    }, 15000);
    f.appendChild(frame);
    screen.appendChild(f);
    S.frames.set(p.id, f);
    return f;
  }

  function renderScreen(animate) {
    const p = PROJECTS[S.k], d = S.device, v = DEVICES[d];
    device.className = `device device--${d}`;
    screen.style.setProperty('--vw', v.w);
    screen.style.setProperty('--vh', v.h);
    screen.style.setProperty('--s', String(screen.clientWidth / v.w || 0.3));
    // screenshot: swap only once the new image is decoded, so the screen never flashes empty
    const img = new Image(v.w, v.h);
    img.alt = t(S.lang, 'portfolio.alt').replace('{name}', p.name[S.lang]).replace('{device}', t(S.lang, `portfolio.devices.${d}`));
    img.decoding = 'async';
    img.src = shot(p, d);
    const swap = () => shotEl.replaceChildren(img);
    img.decode().then(swap, swap);
    // live layer
    const live = S.live && p.embeddable;
    S.frames.forEach((f, id) => f.classList.toggle('is-on', live && id === p.id));
    if (live) liveFrame(p).classList.add('is-on');
    screen.classList.toggle('is-live', live);
    if (animate && !reduced) gsap.fromTo(device, { opacity: 0.25, y: 14, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out', clearProps: 'transform' });
  }

  return { build, setProject, wake, state: S };
}
