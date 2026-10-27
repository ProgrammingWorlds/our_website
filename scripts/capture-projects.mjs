// Captures real screenshots of every project in src/config.js on a laptop,
// tablet and phone viewport, and writes them as WebP to public/projects/.
// Usage: npm run capture:projects   (needs Chrome; set CHROME_PATH if it isn't in the default location)
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS } from '../src/config.js';

const OUT = 'public/projects';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
// CSS viewport + pixel ratio per device. The ratio keeps screens crisp at the size they are shown.
const DEVICES = {
  laptop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  tablet: { width: 820, height: 1180, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  phone: { width: 390, height: 844, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true },
};
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars'] });
for (const p of PROJECTS) {
  for (const [device, viewport] of Object.entries(DEVICES)) {
    const page = await browser.newPage();
    if (viewport.isMobile) await page.setUserAgent(MOBILE_UA);
    await page.setViewport(viewport);
    await page.goto(p.url, { waitUntil: 'networkidle0', timeout: 90000 });
    await wait(5000); // let intro animations settle
    const file = path.join(OUT, `${p.id}-${device}.webp`);
    await page.screenshot({ path: file, type: 'webp', quality: 78 });
    if (device === 'laptop') {
      // small card thumbnail
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 / 3 });
      await wait(800);
      await page.screenshot({ path: path.join(OUT, `${p.id}-thumb.webp`), type: 'webp', quality: 72 });
    }
    console.log('saved', file);
    await page.close();
  }
}
await browser.close();
