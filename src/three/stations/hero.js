import * as THREE from 'three';
import { gsap } from 'gsap';
import { makeLogo, makeOrbit, makeGlow, makePlanet, makeRocks, scatter, bindNum, smooth } from '../lib.js';

// Station 01 — the PW mark assembles out of the dark, then breaks apart as
// you scroll and the camera flies through the gap into the journey.
export function createHero(world) {
  const group = new THREE.Group();

  const core = new THREE.Group();
  group.add(core);
  const logo = makeLogo(2.3);
  logo.group.rotation.set(-0.06, 0.38, -0.03);
  core.add(logo.group);
  const glow = makeGlow(11, '#2f5bff', '#ffffff', 0.5, 0.55);
  glow.position.z = -2.5;
  core.add(glow);
  const goldGlow = makeGlow(4, '#ffb545', '#ffd28a', 0.35, 0.25);
  goldGlow.position.set(1.1, 1.1, 0.6);
  core.add(goldGlow);

  const tilt = new THREE.Group();
  tilt.rotation.set(1.2, 0, -0.32);
  core.add(tilt);
  const rings = [3.6, 4.6].map((rr, i) =>
    makeOrbit(rr, rr, { count: 700 - i * 200, spread: 0.03, size: 0.035, colorA: '#ffb545', colorB: '#7d9bff', mix: 0.6, lineOpacity: 0.35 - i * 0.12, lineDark: i ? '#6d90ff' : '#ffb545', lineLight: '#315cff', lineOpacityLight: 0.35 }),
  );
  tilt.add(...rings);

  const warm = new THREE.PointLight('#ffa64d', 40, 30, 1.4);
  warm.position.set(5, 3, 4);
  bindNum(warm, 'intensity', 40, 12);
  group.add(warm);

  // a planet horizon below, a moon and a far world for depth
  const horizon = makePlanet(60, { seed: 3, city: 1, scale: 1.6, seg: 160, atmoScale: 1.03, atmoStr: 1.4, colors: { a: ['#06123a', '#cbd9f3'], b: ['#1f4fe0', '#ffffff'], rim: ['#ff9f3a', '#9ec0ff'] }, light: [0.2, 1, 0.5] });
  horizon.position.set(0, -68, -38);
  group.add(horizon);
  const moon = makePlanet(1, { seed: 8, crater: 1, seg: 48, colors: { a: ['#2b2412', '#e6dcc8'], b: ['#ffb545', '#fff4de'], rim: ['#ffcf8a', '#ffffff'] }, atmoColor: ['#ffb545', '#ffe2b0'], atmoStr: 0.6 });
  moon.position.set(9, 5, -14);
  group.add(moon);

  const rocks = makeRocks(
    [
      ...scatter(10, 3, (r) => ({ p: [(r() - 0.5) * 34, (r() - 0.5) * 18, -6 - r() * 26], s: 0.08 + r() * r() * 0.5 })),
      ...scatter(6, 4, (r) => ({ p: [(r() < 0.5 ? -1 : 1) * (8 + r() * 6), -4 - r() * 3, -2 - r() * 6], s: 0.4 + r() * 0.9 })),
    ],
    3,
  );
  group.add(rocks);

  const intro = { v: 0 };
  function playIntro() {
    if (world.reduced) return (intro.v = 1);
    gsap.to(intro, { v: 1, duration: 2.4, ease: 'expo.out' });
  }

  function update(ctx, local) {
    const t = ctx.time;
    const leave = smooth(0.32, 0.86, local);
    const assembling = 1 - intro.v;
    logo.setSplit(assembling * 1.6 + leave * 1.5, 1 + assembling);
    const p = ctx.pointer;
    logo.group.rotation.y = 0.38 + Math.sin(t * 0.3) * 0.12 + assembling * 1.4 + leave * 0.9 + p.x * 0.35;
    logo.group.rotation.x = -0.06 + Math.sin(t * 0.4) * 0.04 - leave * 0.3 + p.y * 0.22;
    goldGlow.material.opacity = 0.25 + Math.max(0, p.x) * 0.25;
    core.position.y = Math.sin(t * 0.8) * 0.12;
    core.scale.setScalar(0.6 + intro.v * 0.4);
    tilt.rotation.z = -0.32 + t * 0.04;
    rings.forEach((g, i) => (g.rotation.y = t * (0.08 + i * 0.04)));
    moon.rotation.y = t * 0.1;
    rocks.rotation.y = t * 0.01;
  }

  return {
    id: 'hero',
    group,
    playIntro,
    update,
    keys: [
      // f < 0: the hero keeps the original composition, mark left and copy right
      { at: 0, pos: [0, 0.5, 14.5], look: [0, 0, 0], f: -1 },
      { at: 0.3, pos: [0.7, 0.3, 12], look: [0, 0, 0], f: -1 },
      { at: 0.62, pos: [-0.3, 0.1, 4.6], look: [0, 0, -8], f: -0.3 },
      { at: 0.82, pos: [0, 0.4, -14], look: [0, 0, -44], f: 0 },
    ],
  };
}
