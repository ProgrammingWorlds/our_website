// Captures the story at fixed positions in all four states (dark/light × en/ar).
// Usage: npm run build && npx vite preview --port 4173 & npm run shots
// Options: --url=http://localhost:4173 --w=1440 --h=900 --states=dark-en,light-ar --shots=home,about --out=screenshots
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d;
const URL = arg('url', 'http://localhost:4173');
const W = Number(arg('w', 1440)), H = Number(arg('h', 900));
const OUT = arg('out', 'screenshots');
const STATES = arg('states', 'dark-en,light-en,dark-ar,light-ar').split(',');
// story positions (chapter index + local progress)
const AT = { home: 0.02, warp: 0.9, services: 1.5, about: 2.72, process: 3.5, projects: 4.5, future: 5.6, contact: 6.7, footer: -1 };
const SHOTS = arg('shots', Object.keys(AT).join(',')).split(',');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

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
  await page.waitForFunction(() => !document.documentElement.classList.contains('is-loading'), { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 3000));
  for (const id of SHOTS) {
    await page.evaluate((u) => (u < 0 ? scrollTo(0, document.body.scrollHeight) : window.__pw.toU(u)), AT[id]);
    await new Promise((r) => setTimeout(r, 3500));
    const file = path.join(OUT, `${state}-${id}.png`);
    await page.screenshot({ path: file });
    console.log('saved', file);
  }
  await page.close();
}
await browser.close();
