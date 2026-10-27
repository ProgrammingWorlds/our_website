import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { STORIES } from '../src/story.js';
import { DICT } from '../src/i18n.js';
import { PROJECTS, SITE } from '../src/config.js';
import { fieldError } from '../src/contact-form.js';

const read = (f) => fs.readFileSync(f, 'utf8');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

test('homepage story: About comes before Services, Our Future is not on it', () => {
  const ids = STORIES.home.map((c) => c.id);
  assert.deepEqual(ids, ['home', 'about', 'services', 'process', 'projects', 'contact']);
  for (const ch of STORIES.home) assert.ok(read('index.html').includes(`id="${ch.id}"`), `section #${ch.id} exists`);
  assert.ok(!read('index.html').includes('id="future"'));
});

test('universal.html keeps the Our Future chapter', () => {
  const html = read('universal.html');
  assert.deepEqual(STORIES.universal.map((c) => c.id), ['future']);
  assert.ok(html.includes('data-story="universal"'));
  for (const id of ['id="future"', 'id="futureFocus"', 'id="futureSteps"', 'data-heading="future.heading"', 'data-i18n="future.cta"']) assert.ok(html.includes(id), id);
  assert.ok(fs.existsSync('src/three/stations/future.js'));
  assert.match(read('vite.config.js'), /universal: page\('universal\.html'\)/);
});

test('CTAs: About → Services, Services → Process', () => {
  const html = read('index.html');
  assert.match(html, /href="#services"><span data-i18n="about\.cta">Explore Our Services</);
  assert.match(html, /href="#process"><span data-i18n="services\.cta">Discover Our Story</);
  assert.equal(DICT.en.about.cta, 'Explore Our Services');
  assert.equal(DICT.en.services.cta, 'Discover Our Story');
  assert.ok(!html.includes('Explore Our Projects'));
});

test('every internal anchor points at an existing section', () => {
  const html = read('index.html');
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(id), `#${id}`);
  for (const [, id] of read('universal.html').matchAll(/href="\/#([^"]+)"/g)) assert.ok(ids.has(id), `/#${id}`);
});

test('the old slogan is gone from active content; the new one is in place', () => {
  const files = ['index.html', 'universal.html', 'README.md', ...walk('src'), ...walk('public').filter((f) => /\.(txt|xml|webmanifest|svg)$/.test(f))];
  for (const f of files) assert.ok(!/beyond code|beyond limits|ما وراء الكود/i.test(read(f)), f);
  assert.equal(DICT.en.brand.slogan, 'Digital worlds, crafted with precision.');
  assert.ok(read('index.html').includes('Digital worlds, crafted with precision.'));
});

test('English and Arabic copy have the same shape', () => {
  const shape = (o) => (Array.isArray(o) ? o.map(shape) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, shape(v)])) : typeof o);
  assert.deepEqual(shape(DICT.ar), shape(DICT.en));
});

test('every data-i18n key in the pages exists in both languages', () => {
  const get = (lang, key) => key.split('.').reduce((o, k) => o?.[k], DICT[lang]);
  for (const f of ['index.html', 'universal.html']) {
    for (const [, key] of read(f).matchAll(/data-(?:i18n|heading|i18n-label)="([^"]+)"/g)) {
      for (const lang of ['en', 'ar']) assert.notEqual(get(lang, key), undefined, `${f}: ${lang}.${key}`);
    }
  }
});

test('projects are real, verified sites with screenshots for every device', () => {
  assert.deepEqual(PROJECTS.map((p) => p.url), ['https://oishimochijo.vercel.app/', 'https://eatstopjo.vercel.app/']);
  for (const p of PROJECTS) for (const d of ['laptop', 'tablet', 'phone', 'thumb']) assert.ok(fs.existsSync(`public/projects/${p.id}-${d}.webp`), `${p.id}-${d}`);
});

test('SEO: canonical domain, sitemap, robots', () => {
  assert.equal(SITE.url, 'https://programmingworlds.vercel.app');
  assert.ok(read('index.html').includes('<link rel="canonical" href="https://programmingworlds.vercel.app/" />'));
  assert.ok(read('universal.html').includes('<link rel="canonical" href="https://programmingworlds.vercel.app/universal.html" />'));
  const sitemap = read('public/sitemap.xml');
  assert.ok(sitemap.includes('<loc>https://programmingworlds.vercel.app/</loc>') && sitemap.includes('/universal.html</loc>'));
  assert.match(read('public/robots.txt'), /Disallow: \/api\//);
  for (const f of ['index.html', 'universal.html']) {
    const json = read(f).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
    assert.doesNotThrow(() => JSON.parse(json), f);
  }
});

test('client-side validation', () => {
  assert.equal(fieldError('name', '  '), 'required');
  assert.equal(fieldError('email', 'a@b'), 'email');
  assert.equal(fieldError('email', 'a@b.co'), '');
  assert.equal(fieldError('message', 'too short'), 'short');
  assert.equal(fieldError('message', 'long enough message'), '');
  assert.equal(fieldError('company', ''), '');
});
