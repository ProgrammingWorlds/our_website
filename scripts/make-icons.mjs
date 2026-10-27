// Renders public/favicon.svg into the PNG icon set (favicon, apple-touch,
// PWA / maskable) with headless Chrome. Usage: npm run icons
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const svg = fs.readFileSync('public/favicon.svg', 'utf8');
// [file, size, padding ratio, background]
const ICONS = [
  ['public/icons/favicon-32.png', 32, 0, null],
  ['public/icons/apple-touch-icon.png', 180, 0.16, '#030b20'],
  ['public/icons/icon-192.png', 192, 0.12, '#030b20'],
  ['public/icons/icon-512.png', 512, 0.12, '#030b20'],
  ['public/icons/maskable-512.png', 512, 0.22, '#030b20'],
];

fs.mkdirSync('public/icons', { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
const page = await browser.newPage();
for (const [file, size, pad, bg] of ICONS) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  const inner = Math.round(size * (1 - pad * 2));
  await page.setContent(
    `<style>html,body{margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${bg || 'transparent'}}svg{width:${inner}px;height:${inner}px}</style>${svg}`,
  );
  await page.screenshot({ path: file, omitBackground: !bg });
  console.log('saved', file);
}
await browser.close();
