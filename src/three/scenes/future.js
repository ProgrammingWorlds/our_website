import * as THREE from 'three';
import { makeBackground, makePlanet, makeGlow, makeRocks, scatter, bindColor, bindNum, damp, smooth } from '../lib.js';
import { t } from '../../i18n.js';

// [fx, fy, radius, palette]
const DESK = [
  [0.56, 0.44, 0.92, 'ember'],
  [0.865, 0.43, 0.62, 'ocean'],
  [0.565, 0.73, 0.98, 'earth'],
  [0.84, 0.8, 0.72, 'ice'],
];
const MOB = [
  [0.27, 0.58, 0.55, 'ember'],
  [0.75, 0.56, 0.45, 'ocean'],
  [0.3, 0.8, 0.6, 'earth'],
  [0.75, 0.82, 0.5, 'ice'],
];
const PAL = {
  ember: { a: ['#1a1220', '#d6dcea'], b: ['#3a3d6a', '#f2f5fb'], rim: ['#ff9a3c', '#ffc27a'], crater: 1, city: 0.6 },
  ocean: { a: ['#06205e', '#c6d8f8'], b: ['#2f6bff', '#ffffff'], rim: ['#6da0ff', '#9ec0ff'] },
  earth: { a: ['#071f66', '#cbdaf6'], b: ['#3a86ff', '#ffffff'], rim: ['#7fb0ff', '#a6c4ff'], city: 0.5 },
  ice: { a: ['#0f2c6a', '#d9e5f7'], b: ['#8fb5ff', '#ffffff'], rim: ['#ffb545', '#c2d6ff'] },
};

export function createFuture(engine, section) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  const bg = makeBackground({
    top: ['#030b20', '#eef4fe'],
    bottom: ['#06143a', '#d0def6'],
    glows: [
      { x: 0.72, y: 0.55, r: 0.4, i: 0.45, dark: '#1d3fb8', light: '#ffffff' },
      { x: 0.28, y: 0.86, r: 0.22, i: 0.4, dark: '#ff8a2a', light: '#ffd5a0', il: 0.25 },
    ],
    nebula: 0.6,
  });
  scene.add(bg);
  const hemi = new THREE.HemisphereLight();
  bindColor(hemi, 'color', '#6d8cff', '#ffffff');
  bindColor(hemi, 'groundColor', '#060a1c', '#c5d4f1');
  bindNum(hemi, 'intensity', 0.60, 1.02);
  scene.add(hemi);

  const planets = DESK.map(([, , r, pal], i) => {
    const p = PAL[pal];
    const g = makePlanet(1, { seed: 20 + i * 3, scale: 2.4, colors: { a: p.a, b: p.b, rim: p.rim }, clouds: 0.45, crater: p.crater || 0, city: p.city || 0, light: [-0.6, 0.5, 0.7], rimStr: 1.0, atmoColor: [p.rim[0], p.rim[1]], atmoStr: 0.55, seg: 64, spin: 0.04 + i * 0.01 });
    g.userData = { r, scale: 1, target: 1, ...g.userData };
    root.add(g);
    return g;
  });
  const deco = makePlanet(0.5, { seed: 41, colors: { a: ['#191a2a', '#dfe6f4'], b: ['#4a4e70', '#ffffff'], rim: ['#ff9a3c', '#c2d6ff'] }, crater: 1, seg: 48 });
  root.add(deco);
  const horizon = makePlanet(10, { seed: 51, scale: 1.4, city: 1, rimStr: 1.2, rimPow: 4.5, light: [0.8, 0.5, 0.4], colors: { a: ['#040b24', '#dbe5f7'], b: ['#1a4ac0', '#ffffff'], rim: ['#8fb0ff', '#a9c6ff'], amb: ['#030817', '#c3d3f0'] }, atmoColor: ['#5d86ff', '#d4e3ff'], atmoScale: 1.03, atmoStr: 0.8, seg: 128 });
  root.add(horizon);
  const hGlow = makeGlow(10, '#ff8a2a', '#ffe0b8', 0.22, 0.22);
  root.add(hGlow);
  const rocks = makeRocks([
    ...scatter(14, 61, (r) => ({ p: [(r() - 0.5) * 24, (r() - 0.5) * 9, -3 - r() * 4], s: 0.05 + r() * 0.25 })),
    ...scatter(14, 63, (r) => ({ p: [4 + r() * 8, -4.2 - r() * 1.2, -1 + r() * 3], s: [0.4 + r() * 1, 0.3 + r() * 0.7, 0.4 + r() * 0.8] })),
  ], 23);
  root.add(rocks);

  // ----- HUD ---------------------------------------------------------
  const hud = section.querySelector('[data-hud]');
  const items = planets.map((_, i) => {
    const el = document.createElement('div');
    el.className = 'hud-item';
    el.innerHTML = `<button class="orb" type="button" aria-expanded="false" aria-describedby="fut-card-${i}"></button>
      <span class="orb-label orb-label--below"><strong></strong><span class="badge"></span></span>
      <div class="orb-card orb-card--below" id="fut-card-${i}" role="tooltip"></div>`;
    hud.appendChild(el);
    return el;
  });
  let active = -1;
  const setActive = (i) => {
    active = i;
    items.forEach((el, j) => {
      el.classList.toggle('is-active', j === i);
      el.querySelector('.orb').setAttribute('aria-expanded', String(j === i));
      planets[j].userData.target = j === i ? 1.22 : 1;
    });
  };
  items.forEach((el, i) => {
    const b = el.querySelector('.orb');
    b.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && setActive(i));
    el.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && setActive(-1));
    b.addEventListener('focus', () => setActive(i));
    b.addEventListener('blur', () => setActive(-1));
    b.addEventListener('click', () => setActive(active === i ? -1 : i));
  });
  function onLang(lang) {
    const list = t(lang, 'future.items');
    items.forEach((el, i) => {
      el.querySelector('.orb').setAttribute('aria-label', `${list[i].title} — ${t(lang, 'future.planned')}`);
      el.querySelector('strong').textContent = list[i].title;
      el.querySelector('.badge').textContent = t(lang, 'future.badge');
      el.querySelector('.orb-card').textContent = list[i].detail;
    });
  }

  let cfg = DESK, sc = 1;
  function layout(ctx) {
    const m = ctx.mode;
    cfg = m === 'mobile' ? MOB : DESK;
    sc = m === 'tablet' ? 0.9 : 1.15;
    planets.forEach((p, i) => {
      let [fx, fy, r] = cfg[i];
      if (m === 'tablet') fy = 0.3 + fy * 0.68;
      const [x, y] = engine.frac(fx, fy);
      p.userData.home = [x, y];
      p.userData.r = r * sc;
    });
    const [dx, dy] = engine.frac(m === 'mobile' ? 0.86 : 0.47, m === 'mobile' ? 0.1 : 0.12);
    deco.position.set(dx, dy, -2);
    const [hx] = engine.frac(m === 'mobile' ? 0.3 : 0.13, 0);
    horizon.position.set(hx, m === 'mobile' ? -14.6 : -14.2, -4);
    hGlow.position.set(hx + 4 * ctx.dir, horizon.position.y + 10.5, -3.5);
    horizon.userData.material.uniforms.uLight.value.set(0.8 * ctx.dir, 0.5, 0.4).normalize();
  }

  const out = {};
  function update(ctx, st) {
    const tm = ctx.time;
    const enter = smooth(0, 1, st.enter);
    planets.forEach((p, i) => {
      const u = p.userData;
      u.scale = damp(u.scale, u.target, 7, ctx.dt);
      const [x, y] = u.home;
      // planets drift in from depth as the section arrives
      p.position.set(x + ctx.pointer.x * 0.15 * (i + 1) * 0.3, y + Math.sin(tm * 0.6 + i * 2) * 0.08, (1 - enter) * -8 + st.leave * 3);
      p.scale.setScalar(u.r * u.scale);
      engine.project(p, st.stageRect, out);
      const d = engine.screenRadius(p, u.r * u.scale) * 2;
      const el = items[i];
      el.style.transform = `translate3d(${out.x.toFixed(1)}px, ${out.y.toFixed(1)}px, 0)`;
      el.style.setProperty('--d', d.toFixed(1) + 'px');
      el.style.opacity = enter.toFixed(3);
    });
    deco.position.y += Math.sin(tm) * 0.0006;
    horizon.children[0].rotation.y = tm * 0.008;
  }

  return { id: 'future', section, scene, root, bg, update, layout, onLang };
}
