// Captures every scene in all four states (dark/light × en/ar).
// Usage: npm run build && npx vite preview --port 4173 & npm run shots
// Options: --url=http://localhost:4173 --w=1440 --h=1100 --states=dark-en,light-ar --scenes=home,about
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d;
const URL = arg('url', 'http://localhost:4173');
const W = Number(arg('w', 1440)), H = Number(arg('h', 1200));
const OUT = arg('out', 'screenshots');
const STATES = arg('states', 'dark-en,light-en,dark-ar,light-ar').split(',');
const SCENES = arg('scenes', 'home,services,about,process,projects,future,contact,footer').split(',');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
// scroll position inside tall (sticky) sections, as a fraction of their scroll range
const STICKY_AT = { about: 0.75, process: 0.22 };

fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
  protocolTimeout: 240000,
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
});
for (const state of STATES) {
  const [theme, lang] = state.split('-');
  const page = await browser.newPage();
  page.on('console', (m) => m.type() === 'error' && console.log(`[${state}] console:`, m.text()));
  page.on('pageerror', (e) => console.log(`[${state}] pageerror:`, e.message));
  await page.goto(`${URL}/?theme=${theme}&lang=${lang}&quality=high&capture`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 3500));
  for (const id of SCENES) {
    await page.evaluate(
      (id, stickyAt) => {
        document.documentElement.style.scrollBehavior = 'auto';
        if (id === 'footer') return scrollTo(0, document.body.scrollHeight);
        const el = document.getElementById(id);
        const top = el.getBoundingClientRect().top + scrollY;
        const range = Math.max(0, el.offsetHeight - innerHeight);
        scrollTo(0, top + range * (stickyAt[id] ?? 0));
      },
      id,
      STICKY_AT,
    );
    await new Promise((r) => setTimeout(r, 2600));
    const file = path.join(OUT, `${state}-${id}.png`);
    await page.screenshot({ path: file });
    console.log('saved', file);
  }
  await page.close();
}
await browser.close();
