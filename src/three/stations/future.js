import * as THREE from 'three';
import { makePlanet, makeOrbit, makeGlow, makeRocks, scatter, bindNum, damp, smooth } from '../lib.js';
import { t } from '../../i18n.js';
import { chapter, stepF, stepAt } from '../../story.js';

const Z = -420;
const CH = chapter('future');
const D = 12;
// four planned worlds on an arc; the camera turns to face each in turn
const WORLDS = [
  { a: -0.95, y: 1.2, r: 2.1, seed: 31, colors: { a: ['#3a0d06', '#f3d9cc'], b: ['#ff6a3d', '#ffffff'], rim: ['#ffb545', '#ffc89a'] }, city: 1, atmo: ['#ff7a3d', '#ffc8a0'] },
  { a: -0.32, y: -0.9, r: 1.6, seed: 32, colors: { a: ['#06204a', '#d3e3f7'], b: ['#2fa8ff', '#ffffff'], rim: ['#7dd3ff', '#9ec0ff'] }, atmo: ['#3db0ff', '#bcdcff'], ring: true },
  { a: 0.32, y: 1, r: 2.3, seed: 33, colors: { a: ['#14063a', '#ded6f5'], b: ['#7a4dff', '#ffffff'], rim: ['#ff9f3a', '#b8a0ff'] }, crater: 1, atmo: ['#7a4dff', '#cbbcff'] },
  { a: 0.95, y: -0.7, r: 1.8, seed: 34, colors: { a: ['#0a2a2a', '#d0eeea'], b: ['#2fd6b5', '#ffffff'], rim: ['#ffb545', '#9ee8d8'] }, atmo: ['#2fd6b5', '#b4f0e4'] },
];
const at = (w) => [Math.sin(w.a) * D, w.y, Z - Math.cos(w.a) * D];

// Station 06 — planned horizons, presented honestly as "Coming Soon".
export function createFuture(world) {
  const group = new THREE.Group();
  const warm = new THREE.PointLight('#ff9a3c', 60, 40, 1.3);
  warm.position.set(0, 4, Z + 2);
  bindNum(warm, 'intensity', 60, 15);
  group.add(warm);

  const planets = WORLDS.map((w) => {
    const g = new THREE.Group();
    const p = makePlanet(w.r, { seed: w.seed, colors: w.colors, city: w.city ?? 0, crater: w.crater ?? 0, atmoColor: w.atmo, atmoStr: 1.2, seg: 96, light: [-0.4, 0.5, 1] });
    g.add(p);
    if (w.ring) {
      const ring = makeOrbit(w.r * 1.9, w.r * 1.9, { count: 900, spread: 0.12, size: 0.04, colorA: '#9fd8ff', colorB: '#ffffff', mix: 0.5, line: false });
      ring.rotation.set(0.4, 0, 0.3);
      g.add(ring);
    }
    const halo = makeGlow(w.r * 6, w.atmo[0], w.atmo[1], 0.3, 0.3);
    halo.position.z = -1;
    g.add(halo);
    g.position.set(...at(w));
    g.userData = { planet: p, s: 1 };
    group.add(g);
    return g;
  });

  const rocks = makeRocks(scatter(14, 61, (r) => ({ p: [(r() - 0.5) * 40, (r() - 0.5) * 16, Z - 4 - r() * 20], s: 0.08 + r() * r() * 0.5 })), 23);
  group.add(rocks);

  const labels = WORLDS.map((_, k) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.tabIndex = -1;
    el.className = 'label label--planet';
    el.addEventListener('click', () => world.select('future', k));
    return { el, anchor: planets[k], offset: new THREE.Vector3(0, -WORLDS[k].r - 0.9, 0), alpha: 0 };
  });
  function onLang(lang) {
    const items = t(lang, 'future.items');
    labels.forEach((L, k) => (L.el.innerHTML = `<strong>${items[k].title}</strong><span class="badge">${t(lang, 'future.badge')}</span>`));
  }
  function layout(ctx) {
    planets.forEach((g, k) => {
      const [x, y, z] = at(WORLDS[k]);
      g.position.set(x * ctx.dir, y, z);
    });
  }

  function update(ctx, local) {
    const tm = ctx.time;
    const active = Math.round(stepF(CH, local));
    const show = smooth(0.08, 0.18, local) * (1 - smooth(0.88, 0.97, local));
    planets.forEach((g, k) => {
      const u = g.userData;
      u.s = damp(u.s, k === active ? 1.08 : 0.92, 4, ctx.dt);
      g.scale.setScalar(u.s);
      u.planet.rotation.y = tm * 0.05 * (k % 2 ? -1 : 1);
      labels[k].alpha = show * (k === active ? 1 : 0.3);
      labels[k].el.classList.toggle('is-active', k === active);
    });
    rocks.rotation.y = tm * 0.008;
  }

  // camera looks at each world in turn from near the arc's centre
  const look = (k) => {
    const [x, y, z] = at(WORLDS[k]);
    return [x * world.ctx.dir, y, z];
  };
  return {
    id: 'future',
    group,
    labels,
    update,
    onLang,
    layout,
    get keys() {
      return [
        { at: 0, pos: [0, 5, Z + 28], look: [0, 0, Z - 10], f: 0.3 },
        ...WORLDS.map((w, k) => ({ at: stepAt(CH, k), pos: [Math.sin(w.a) * 3 * world.ctx.dir, 0.8, Z + 11], look: look(k), f: 0.75 })),
      ];
    },
  };
}
