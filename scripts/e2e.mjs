// End-to-end checks against a running build: real clicks, keys and viewports.
// Usage: npm run build && npx vite preview --port 4173 &  then  npm run test:e2e
// Options: --url=http://localhost:4173   (CHROME_PATH overrides the Chrome location)
import puppeteer from 'puppeteer-core';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d;
const URL = arg('url', 'http://localhost:4173');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(name, ok, info = '') {
  results.push({ name, ok: !!ok, info });
  console.log(`${ok ? '  ✔' : '  ✖'} ${name}${info ? ` — ${info}` : ''}`);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
  protocolTimeout: 240000,
});
await browser.defaultBrowserContext().overridePermissions(URL, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);

/** Opens a page and records console errors, page errors and failed same-origin requests. */
async function open(path, { w = 1440, h = 900, reduced = false } = {}) {
  const page = await browser.newPage();
  page.problems = [];
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  // the contact API answers 503 until an email key is configured; that response is checked explicitly below
  page.on('console', (m) => m.type() === 'error' && (m.location()?.url || '').startsWith(URL) && !(m.location()?.url || '').includes('/api/contact') && page.problems.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => page.problems.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    const u = r.url();
    if (u.startsWith(URL) && r.status() >= 400 && !u.includes('/api/contact')) page.problems.push(`HTTP ${r.status()} ${u}`);
  });
  page.on('requestfailed', (r) => r.url().startsWith(URL) && page.problems.push(`failed: ${r.url()}`));
  // interactions are what's tested here, so render at low quality: results don't depend on GPU speed
  const sep = path.includes('?') ? '&' : '?';
  await page.goto(`${URL}${path}${sep}quality=low`, { waitUntil: 'networkidle0', timeout: 120000 });
  await page.waitForFunction(() => !document.documentElement.classList.contains('is-loading') && window.__pw, { timeout: 120000 });
  // software WebGL renders slowly here, so wait for the intro to finish rather than a fixed time
  await page.waitForFunction(() => !document.getElementById('loader'), { timeout: 60000 });
  await wait(400);
  return page;
}
const st = (page) => page.evaluate(() => ({ active: __pw.chapters.state.active, steps: [...__pw.chapters.state.steps], u: __pw.scroll.state.u, over: [...__pw.chapters.state.over] }));
async function until(page, fn, arg, timeout = 15000) {
  try {
    await page.waitForFunction(fn, { timeout, polling: 100 }, arg);
    return true;
  } catch {
    return false;
  }
}
// the visible panel sits between the header and the bottom of the window (unless it is taller and travels)
const panelInView = (page, id) =>
  page.evaluate((id) => {
    const p = document.querySelector(`#${id} .panel`);
    const r = p.getBoundingClientRect();
    const navH = document.getElementById('nav').getBoundingClientRect().height;
    const i = __pw.chapters.state.active;
    const fits = __pw.chapters.state.over[i] === 0;
    return { ok: Number(getComputedStyle(p).opacity) > 0.95 && (!fits || (r.top >= navH - 1 && r.bottom <= innerHeight + 1)), top: Math.round(r.top), bottom: Math.round(r.bottom), fits };
  }, id);
const goto = async (page, id) => {
  await page.click(`.nav__links a[href="#${id}"]`);
  return until(page, (id) => document.querySelector(`#${id}`).classList.contains('is-active') && Math.abs(__pw.scroll.state.u - __pw.arrive(id)) < 0.004, id);
};

/* ------------------------------------------------------------------ homepage, desktop */
console.log('\nHomepage — desktop 1440×900');
let page = await open('/?test&lang=en&theme=dark');
const order = await page.evaluate(() => [...document.querySelectorAll('main > section')].map((s) => s.id));
check('section order: Hero, About, Services, Process, Projects, Contact', order.join() === 'home,about,services,process,projects,contact', order.join());
check('hero shows the new slogan', (await page.$eval('#h-hero', (e) => e.textContent.replace(/\s+/g, ' ').trim())) === 'Digital worlds, crafted with precision.');
check('scroll cue visible on the hero', await until(page, () => { const e = document.getElementById('scrollCue'); return !e.classList.contains('is-hidden') && Number(getComputedStyle(e).opacity) > 0.9; }));
const header = await page.evaluate(() => {
  const b = document.querySelector('.nav > .brand').getBoundingClientRect(), l = document.querySelector('.nav__links').getBoundingClientRect(), t = document.querySelector('.nav__tools').getBoundingClientRect();
  return { ordered: b.right < l.left && l.right < t.left, centre: Math.abs((l.left + l.right) / 2 - innerWidth / 2) };
});
check('header: logo · centred links · controls, no overlap', header.ordered && header.centre < 4, `links off-centre by ${header.centre.toFixed(1)}px`);

for (const id of ['about', 'services', 'process', 'projects', 'contact', 'about']) {
  const arrived = await goto(page, id);
  await until(page, (id) => Number(getComputedStyle(document.querySelector(`#${id} .panel`)).opacity) > 0.95, id, 4000);
  const v = await panelInView(page, id);
  check(`nav → #${id} lands and the panel is readable below the header`, arrived && v.ok, `top ${v.top}, bottom ${v.bottom}`);
}
// about: seven sections, each reachable from its number; the card never changes size
await goto(page, 'about');
await wait(400);
let aboutOk = true, aboutInfo = '';
const cardH = await page.$eval('#aboutFocus', (e) => e.offsetHeight);
for (const k of [0, 3, 6, 1, 5, 2, 4]) {
  await page.click(`#aboutSteps [role="tab"]:nth-child(${k + 1})`);
  await page.waitForFunction(() => !__pw.chapters.state.lock, { timeout: 8000 }).catch(() => {});
  await wait(500);
  const a = await page.evaluate((k) => {
    const secs = [...document.querySelectorAll('#aboutFocus .about-sec')];
    const on = secs.filter((s) => s.classList.contains('is-on'));
    const r = document.getElementById('aboutFocus').getBoundingClientRect();
    return {
      step: __pw.chapters.state.steps[1], on: on.map((s) => secs.indexOf(s)), inert: secs.filter((s, j) => j !== k).every((s) => s.inert && s.getAttribute('aria-hidden') === 'true'),
      sel: document.querySelector('#aboutSteps [aria-selected="true"]').id, h: document.getElementById('aboutFocus').offsetHeight,
      inView: r.top >= document.getElementById('nav').getBoundingClientRect().bottom && r.bottom <= innerHeight,
    };
  }, k);
  if (a.step !== k || a.on.join() !== String(k) || !a.inert || a.sel !== `about-tab-${k}` || a.h !== cardH || !a.inView) (aboutOk = false), (aboutInfo += ` ${k}: ${JSON.stringify(a)}`);
}
check('about: every section number shows its section (others inert), card size constant and in view', aboutOk, aboutInfo);
await page.click('#aboutSteps [role="tab"]:nth-child(7)');
await wait(1600);
check('about: the last section offers "Start Your Project" → Contact', (await page.$eval('#about-sec-6 a[href="#contact"]', (a) => a.textContent.trim())) === 'Start Your Project');
await page.click('#about a.btn[href="#services"]');
check('About CTA "Explore Our Services" → Services', await until(page, () => document.querySelector('#services').classList.contains('is-active') && !__pw.scroll.lenis.isScrolling));
await wait(300);
await page.click('#services a[href="#process"]');
check('Services CTA "Discover Our Story" → Process', await until(page, () => document.querySelector('#process').classList.contains('is-active') && !__pw.scroll.lenis.isScrolling));

// services selection
await goto(page, 'services');
await wait(400);
const svcTitles = ['Web & Systems', 'Software Solutions', 'Mobile Apps', 'NFC Experiences', 'Training & Courses'];
let svcOk = true, svcInfo = '';
for (const k of [3, 0, 4, 1, 2]) {
  await page.click(`#svcSteps [role="tab"]:nth-child(${k + 1})`);
  await wait(1700);
  const s = await page.evaluate(() => ({ sel: [...document.querySelectorAll('#svcSteps [role="tab"]')].findIndex((b) => b.getAttribute('aria-selected') === 'true'), title: document.querySelector('#svcFocus h3')?.textContent, step: __pw.chapters.state.steps[2] }));
  if (s.sel !== k || s.title !== svcTitles[k] || s.step !== k) (svcOk = false), (svcInfo += ` clicked ${k} → ${JSON.stringify(s)}`);
}
check('services: every click selects and shows that service, and it stays selected', svcOk, svcInfo);
await page.click('#svcSteps [role="tab"]:nth-child(5)');
await wait(120);
await page.click('#svcSteps [role="tab"]:nth-child(1)');
await wait(2400);
check('services: rapid clicks end on the last one clicked', (await st(page)).steps[2] === 0);
await page.focus('#svcSteps [aria-selected="true"]');
await page.keyboard.press('ArrowRight');
await wait(1800);
check('services: ArrowRight moves to the next service', (await st(page)).steps[2] === 1 && (await page.evaluate(() => document.activeElement.id)) === 'svc-tab-1');
const orbGap = await page.evaluate(() => {
  const b = document.querySelector('#svcSteps [aria-selected="true"]');
  const o = b.querySelector('.svc__orb').getBoundingClientRect(), l = b.querySelector('.svc__label').getBoundingClientRect();
  return l.top - (o.bottom + 6); // the ring extends 6px around the orb
});
check('services: selected ring never overlaps its label', orbGap >= 0, `${orbGap.toFixed(1)}px clear`);

// process steps
await goto(page, 'process');
await wait(400);
check('process: "previous" is disabled on the first stage', (await page.$eval('#stagePrev', (b) => b.getAttribute('aria-disabled'))) === 'true');
let procOk = true, procInfo = '';
for (let k = 1; k <= 5; k++) {
  await page.click('#howWeWork');
  await wait(1700);
  const s = await st(page);
  const card = await page.evaluate(() => {
    const r = document.querySelector('#stageFocus').getBoundingClientRect();
    return r.top >= document.getElementById('nav').getBoundingClientRect().height && r.bottom <= innerHeight;
  });
  if (s.steps[3] !== k || !card) (procOk = false), (procInfo += ` step ${k}: got ${s.steps[3]}, card in view ${card}`);
}
check('process: "How We Work" advances one stage at a time, stage card fully visible', procOk, procInfo);
check('process: last stage offers "See Our Projects"', (await page.$eval('#howWeWorkLabel', (e) => e.textContent)) === 'See Our Projects');
await page.click('#stagePrev');
await wait(1700);
check('process: "previous" goes back a stage', (await st(page)).steps[3] === 4);
const boardInView = (page) => page.evaluate(() => {
  const w = __pw.world, stn = w?.stations.find((s) => s.id === 'process');
  const card = document.getElementById('stageFocus').getBoundingClientRect(), nav = document.getElementById('nav').getBoundingClientRect().bottom;
  const out = { step: __pw.chapters.state.steps[3], card: card.top >= nav && card.bottom <= innerHeight };
  const bm = stn?.boards[out.step];
  if (!bm?.visible) return { ...out, board: 'hidden', ok: out.card };
  const V = w.camera.position.constructor, pr = document.querySelector('#process .panel').getBoundingClientRect();
  bm.updateWorldMatrix(true, false);
  const pts = [[-1.6, -0.95], [1.6, -0.95], [-1.6, 0.95], [1.6, 0.95]].map(([x, y]) => new V(x, y, 0).applyMatrix4(bm.matrixWorld).project(w.camera));
  const xs = pts.map((p) => (p.x * 0.5 + 0.5) * innerWidth), ys = pts.map((p) => (-p.y * 0.5 + 0.5) * innerHeight);
  const L = Math.min(...xs), R = Math.max(...xs), T = Math.min(...ys), B = Math.max(...ys);
  const clear = document.documentElement.dir === 'rtl' ? R <= pr.left : L >= pr.right;
  return { ...out, board: [L, R, T, B].map(Math.round), ok: out.card && pts.every((p) => p.z < 1) && L >= 0 && R <= innerWidth && T >= nav && B <= innerHeight && clear };
});
let numOk = true, numInfo = '';
for (const k of [0, 1, 2, 3, 4, 5, 4, 1, 5, 0]) {
  await page.click(`#stageSteps [role="tab"]:nth-child(${k + 1})`);
  await page.waitForFunction(() => !__pw.chapters.state.lock, { timeout: 8000 }).catch(() => {});
  await wait(900); // the camera eases onto the stage
  const b = await boardInView(page);
  if (b.step !== k || !b.ok) (numOk = false), (numInfo += ` ${k + 1}: ${JSON.stringify(b)}`);
}
check('process: every stage number shows its whole card and its whole 3D board (incl. 05, first and last, repeated)', numOk, numInfo);
await page.click('#stageSteps [role="tab"]:nth-child(6)');
await wait(1700);
await page.click('#howWeWork');
check('process: from the last stage, the button continues to Projects', await until(page, () => document.querySelector('#projects').classList.contains('is-active') && !__pw.scroll.lenis.isScrolling));

// projects showcase
await wait(500);
const shot0 = await page.$eval('#deviceScreen img', (i) => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 }));
check('projects: Oishi Mochi laptop screenshot loaded', shot0.ok && shot0.src.includes('oishi-mochi-laptop.webp'), shot0.src);
await page.click('#workTabs [role="tab"]:nth-child(2)');
await wait(1800);
const d2 = await page.evaluate(() => ({ name: document.querySelector('.work__name').textContent, href: document.querySelector('.work__actions a').href, target: document.querySelector('.work__actions a').target, rel: document.querySelector('.work__actions a').rel }));
check('projects: second project shows Stop Burger with its real link', d2.name.includes('Stop Burger') && d2.name.includes('ستوب برجر') && d2.href === 'https://eatstopjo.vercel.app/' && d2.target === '_blank' && d2.rel.includes('noopener'));
for (const dev of ['phone', 'tablet', 'laptop']) {
  await page.click(`#deviceTabs [data-device="${dev}"]`);
  await wait(900);
  const s = await page.evaluate(() => {
    const img = document.querySelector('#deviceScreen img');
    return { cls: document.getElementById('device').className, src: img.getAttribute('src'), ok: img.naturalWidth > 0, checked: document.querySelector('#deviceTabs [aria-checked="true"]').dataset.device };
  });
  check(`projects: ${dev} frame shows the ${dev} screenshot`, s.cls.includes(`device--${dev}`) && s.src.includes(`stop-burger-${dev}.webp`) && s.ok && s.checked === dev, s.src);
}
await page.click('#workLive');
const liveLoaded = await until(page, () => document.querySelector('.device__live.is-on')?.classList.contains('is-loaded'), null, 20000);
await page.evaluate(() => (document.querySelector('.device__live.is-on iframe').dataset.mark = 'first'));
check('projects: live preview loads the real site in the frame', liveLoaded && (await page.$eval('.device__live.is-on iframe', (f) => f.src)) === 'https://eatstopjo.vercel.app/');
await page.click('#deviceTabs [data-device="phone"]');
await wait(800);
const kept = await page.evaluate(() => ({ n: document.querySelectorAll('.device__live iframe').length, mark: document.querySelector('.device__live.is-on iframe')?.dataset.mark, w: document.querySelector('.device__live.is-on iframe').getBoundingClientRect().width }));
check('projects: the device shows Safari with the site\'s real address', (await page.$eval('.device__url', (e) => e.textContent)) === 'eatstopjo.vercel.app');
check('projects: switching device keeps the same iframe (no reload)', kept.n === 1 && kept.mark === 'first', JSON.stringify(kept));
await page.click('#workLive');
await page.click('#deviceTabs [data-device="laptop"]');

// contact: real channels only, and a working copy button
await goto(page, 'contact');
await wait(500);
const ch = await page.evaluate(() => ({ cards: [...document.querySelectorAll('#channels .channel__title')].map((e) => e.textContent), mail: document.querySelector('#channels a[href^="mailto:"]')?.getAttribute('href') }));
check('contact: info cards show the real email (and no unconfigured channels)', ch.cards.join() === 'Email,Languages' && ch.mail === 'mailto:programmingworld2030@gmail.com', JSON.stringify(ch));
await page.click('#channels [data-copy]');
await wait(300);
const copied = await page.evaluate(async () => ({ label: document.querySelector('#channels [data-copy] span').textContent, clip: await navigator.clipboard.readText().catch(() => null) }));
check('contact: "Copy" copies the address and confirms', copied.label === 'Copied' && copied.clip === 'programmingworld2030@gmail.com', JSON.stringify(copied));

// contact form
await page.click('#cfSubmit');
await wait(300);
const empty = await page.evaluate(() => ({
  invalid: ['name', 'email', 'subject', 'service', 'message'].every((n) => document.getElementById(`cf-${n}`).getAttribute('aria-invalid') === 'true'),
  msg: document.getElementById('cf-name-err').textContent,
  focus: document.activeElement.id,
}));
check('form: empty submit flags required fields and focuses the first', empty.invalid && empty.msg && empty.focus === 'cf-name', JSON.stringify(empty));
check('form: pinned while typing — the story stays on Contact', (await st(page)).active === 5);
await page.type('#cf-name', 'End-to-end Test');
await page.type('#cf-email', 'not-an-email');
await page.click('#cfSubmit');
await wait(200);
check('form: malformed email gets a helpful message', (await page.$eval('#cf-email-err', (e) => e.textContent)).includes('valid email'));
await page.click('#cf-email', { clickCount: 3 });
await page.type('#cf-email', 'qa@example.com');
await page.type('#cf-subject', 'Automated check');
await page.select('#cf-service', 'web');
await page.type('#cf-message', 'Automated check of the contact form path.');
await wait(1600);
const apiResponse = page.waitForResponse((r) => r.url().includes('/api/contact'), { timeout: 15000 });
await page.click('#cfSubmit');
const res = await apiResponse;
await until(page, () => /is-(success|failure|rate)/.test(document.getElementById('cfStatus').className));
const status = await page.$eval('#cfStatus', (e) => ({ cls: e.className, text: e.textContent, mail: e.querySelector('a')?.getAttribute('href') }));
const req = JSON.parse(res.request().postData() || '{}');
check('form: posts the fields to /api/contact (no email app involved)', res.request().method() === 'POST' && req.subject === 'Automated check' && req.email === 'qa@example.com' && !('company' in req));
if (res.status() === 200) check('form: delivered (provider confirmed)', status.cls.includes('is-success'));
else check(`form: provider not configured (HTTP ${res.status()}) → honest message with direct email link`, /is-(failure|unavailable)/.test(status.cls) && status.mail === 'mailto:programmingworld2030@gmail.com', status.text);
check('homepage: no console errors or failed requests', page.problems.length === 0, page.problems.join(' | '));

// theme + language
const before = await page.evaluate(() => document.documentElement.dataset.theme);
const name0 = await page.$eval('#themeToggle', (b) => b.getAttribute('aria-label'));
check('theme control is named by what it does', name0 === (before === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'), name0);
await page.click('#themeToggle');
await until(page, (b) => document.documentElement.dataset.theme !== b, before);
// during the theme's view transition the page takes no clicks; wait until the toggle is hittable again
await until(page, () => {
  const r = document.getElementById('langToggle').getBoundingClientRect();
  return !!document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('#langToggle');
}, null, 20000);
const after = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, stored: localStorage.getItem('pw-theme') }));
check('theme toggle switches and remembers', after.theme !== before && after.stored === after.theme);
check('theme control name follows the theme', (await page.$eval('#themeToggle', (b) => b.getAttribute('aria-label'))) === (after.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'));
await page.focus('#themeToggle');
await page.keyboard.press('Enter');
check('theme control works from the keyboard', await until(page, (t) => document.documentElement.dataset.theme !== t, after.theme, 8000));
await until(page, () => { const r = document.getElementById('langToggle').getBoundingClientRect(); return !!document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('#langToggle'); }, null, 20000);
await page.click('#themeToggle');
await until(page, (t) => document.documentElement.dataset.theme === t, after.theme, 8000);
await until(page, () => { const r = document.getElementById('langToggle').getBoundingClientRect(); return !!document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('#langToggle'); }, null, 20000);
await page.click('#langToggle');
await until(page, () => document.documentElement.lang === 'ar', null, 15000);
const ar = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, code: document.getElementById('langCode').textContent, h: document.getElementById('h-about').textContent, menu: !!document.querySelector('[role="listbox"]') }));
check('language toggle switches straight to Arabic (RTL), no dropdown', ar.lang === 'ar' && ar.dir === 'rtl' && ar.code === 'EN' && /نحوّل/.test(ar.h) && !ar.menu, JSON.stringify(ar));
await page.close();
page = await open('/?test');
const kept2 = await page.evaluate(() => ({ lang: document.documentElement.lang, theme: document.documentElement.dataset.theme }));
check('theme and language persist after reload', kept2.lang === 'ar' && kept2.theme === after.theme, JSON.stringify(kept2));
await page.evaluate(() => (localStorage.clear(), sessionStorage.clear()));
await page.close();

/* ------------------------------------------------------------------ universal.html */
console.log('\n/universal.html');
page = await open('/universal.html?test&lang=en&theme=dark');
const uni = await page.evaluate(() => ({ title: document.title, h1: document.querySelector('h1')?.textContent.replace(/\s+/g, ' ').trim(), canonical: document.querySelector('link[rel=canonical]').href, cards: document.querySelectorAll('#futureSteps [role=tab]').length }));
check('universal.html serves the Our Future experience', uni.h1 === 'A World of New Opportunities.' && uni.cards === 4 && uni.canonical.endsWith('/universal.html'), JSON.stringify(uni));
await page.click('#futureSteps [role="tab"]:nth-child(3)');
check('universal.html: step buttons work', await until(page, () => document.querySelector('#futureFocus h3')?.textContent === 'Cybersecurity'));
check('universal.html: no console errors or failed requests', page.problems.length === 0, page.problems.join(' | '));
await page.close();

/* ------------------------------------------------------------------ responsive sweep */
console.log('\nResponsive: overflow, clipping, header');
const anchors = { home: 0.02, about: 1.5, services: 2.5, process: 3.5, projects: 4.4, contact: 5.5 };
for (const [w, h, lang] of [[360, 640, 'en'], [390, 844, 'en'], [390, 844, 'ar'], [768, 1024, 'en'], [1024, 768, 'ar'], [1280, 720, 'en'], [1920, 1080, 'en']]) {
  page = await open(`/?test&capture&lang=${lang}`, { w, h });
  const issues = [];
  for (const [id, u] of Object.entries(anchors)) {
    await page.evaluate((u) => __pw.toU(u), u);
    await wait(350);
    await page.evaluate(() => __pw.chapters.measure()); // content may have just grown (images); don't wait a slow frame for the observer
    const r = await page.evaluate((id) => {
      const doc = document.documentElement;
      const nav = document.getElementById('nav').getBoundingClientRect();
      const b = document.querySelector('.nav .brand').getBoundingClientRect(), t = document.querySelector('.nav__tools').getBoundingClientRect();
      const p = document.querySelector(`#${id} .panel`).getBoundingClientRect();
      const i = __pw.chapters.state.active;
      return {
        hscroll: doc.scrollWidth > innerWidth + 1,
        headerOverlap: doc.dir === 'rtl' ? t.right > b.left : b.right > t.left,
        clipped: __pw.chapters.state.over[i] === 0 && (p.top < nav.height - 1 || p.bottom > innerHeight + 1 || p.left < -1 || p.right > innerWidth + 1),
        sideClip: p.left < -1 || p.right > innerWidth + 1,
        over: __pw.chapters.state.over[i],
      };
    }, id);
    if (r.hscroll) issues.push(`${id}: horizontal overflow`);
    if (r.headerOverlap) issues.push(`${id}: header overlap`);
    if (r.clipped || r.sideClip) issues.push(`${id}: panel clipped`);
    if (r.over) issues.push(`${id}: travels ${r.over}px`);
  }
  const hard = issues.filter((s) => !s.includes('travels'));
  check(`${w}×${h} ${lang}: no horizontal overflow, header overlap or clipped panels`, hard.length === 0, issues.join('; '));
  if (page.problems.length) check(`${w}×${h} ${lang}: console clean`, false, page.problems.join(' | '));
  await page.close();
}

/* ------------------------------------------------------------------ reduced motion */
console.log('\nReduced motion');
page = await open('/?test&lang=en', { reduced: true });
check('reduced motion: no smooth-scroll hijacking', !(await page.evaluate(() => document.documentElement.classList.contains('lenis'))));
await page.click('.nav__links a[href="#projects"]');
await until(page, () => __pw.chapters.state.active === 4 && Number(getComputedStyle(document.querySelector('#projects .panel')).opacity) > 0.95);
const rm = await page.evaluate(() => ({ active: __pw.chapters.state.active, op: getComputedStyle(document.querySelector('#projects .panel')).opacity }));
check('reduced motion: navigation jumps straight to the section, content visible', rm.active === 4 && Number(rm.op) > 0.95, JSON.stringify(rm));
check('reduced motion: console clean', page.problems.length === 0, page.problems.join(' | '));
await page.close();

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
