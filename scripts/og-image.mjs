// Renders public/og-image.jpg (1200×630, the social-sharing preview) from the
// real hero of a running build. Usage: npm run build && npx vite preview --port 4173 &  then  npm run og
import puppeteer from 'puppeteer-core';

const URL = process.argv.find((a) => a.startsWith('--url='))?.split('=')[1] || 'http://localhost:4173';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars'], protocolTimeout: 240000 });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.goto(`${URL}/?theme=dark&lang=en&quality=high&capture`, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => !document.documentElement.classList.contains('is-loading'), { timeout: 120000 });
// a clean card: no scroll cue, HUD or rail
await page.addStyleTag({ content: '.scroll-cue, .hud, .rail { display: none !important; }' });
await new Promise((r) => setTimeout(r, 4000));
await page.screenshot({ path: 'public/og-image.jpg', type: 'jpeg', quality: 84 });
await browser.close();
console.log('saved public/og-image.jpg');
