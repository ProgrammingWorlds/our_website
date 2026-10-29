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
const host = (url) => new URL(url).host;

// Safari / status bar glyphs, drawn as plain shapes (decorative, aria-hidden)
const G = {
  signal: '<svg viewBox="0 0 18 12" fill="currentColor"><rect y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" width="3" height="12" rx="1"/></svg>',
  wifi: '<svg viewBox="0 0 16 12" fill="currentColor"><path d="M8 11.5l2.4-2.9a3.6 3.6 0 0 0-4.8 0zM3.4 6.3l1.4 1.7a5 5 0 0 1 6.4 0l1.4-1.7a7.3 7.3 0 0 0-9.2 0zM.7 3.1l1.4 1.7a9.2 9.2 0 0 1 11.8 0l1.4-1.7a11.5 11.5 0 0 0-14.6 0z"/></svg>',
  battery: '<svg viewBox="0 0 27 12" fill="currentColor"><rect x=".5" y=".5" width="23" height="11" rx="3" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="20" height="8" rx="1.8"/><path d="M25 4v4a2 2 0 0 0 0-4z" opacity=".5"/></svg>',
  lock: '<svg viewBox="0 0 10 12" fill="currentColor"><path d="M2 5V3.5a3 3 0 0 1 6 0V5" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x=".8" y="5" width="8.4" height="6.5" rx="1.4"/></svg>',
  sidebar: '<svg viewBox="0 0 16 13" fill="none" stroke="currentColor" stroke-width="1.2"><rect x=".6" y=".6" width="14.8" height="11.8" rx="2.5"/><path d="M5.5 1v11"/></svg>',
  back: '<svg viewBox="0 0 8 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 1.5l-5 5 5 5"/></svg>',
  fwd: '<svg viewBox="0 0 8 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity=".35"><path d="M1.5 1.5l5 5-5 5"/></svg>',
  share: '<svg viewBox="0 0 12 15" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 1v9M3 3.8L6 1l3 2.8M3.5 6h-2v8h9V6h-2"/></svg>',
  plus: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M6 1v10M1 6h10"/></svg>',
  tabs: '<svg viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.2"><rect x=".6" y="3.6" width="10.8" height="10.8" rx="2"/><path d="M3.6 3.5v-.9a2 2 0 0 1 2-2h6.8a2 2 0 0 1 2 2v6.8a2 2 0 0 1-2 2h-.9"/></svg>',
};
// the status bar (iPad, iPhone) and the Safari bar with the project's real address
function chrome(device, url) {
  const address = `<span class="device__url">${G.lock}<span>${host(url)}</span></span>`;
  const status = `<span>9:41</span><span class="device__icons">${G.signal}${G.wifi}${G.battery}</span>`;
  return {
    top: device === 'laptop' ? '' : status,
    bar: device === 'phone' ? address : `${G.sidebar}${G.back}${G.fwd}${address}${G.share}${G.plus}${G.tabs}`,
  };
}

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

  // The screen is the device's Safari: status bar / notch strip, address bar, and
  // the page view. The view holds the screenshot, and the live frames, which
  // are appended once and kept (never reloaded).
  const el = (cls) => Object.assign(document.createElement('div'), { className: cls });
  const top = el('device__top'), bar = el('device__bar'), view = el('device__view'), shotEl = el('device__shot');
  top.setAttribute('aria-hidden', 'true');
  bar.setAttribute('aria-hidden', 'true');
  view.appendChild(shotEl);
  screen.append(top, bar, view);
  const fit = () => screen.style.setProperty('--s', String(view.clientWidth / DEVICES[S.device].w || 0.3));
  new ResizeObserver(fit).observe(view);

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
    view.appendChild(f);
    S.frames.set(p.id, f);
    return f;
  }

  function renderScreen(animate) {
    const p = PROJECTS[S.k], d = S.device, v = DEVICES[d];
    device.className = `device device--${d}`;
    const c = chrome(d, p.url);
    top.innerHTML = c.top;
    bar.innerHTML = c.bar;
    screen.style.setProperty('--vw', v.w);
    screen.style.setProperty('--vh', v.h);
    fit();
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
