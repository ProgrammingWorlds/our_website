import * as THREE from 'three';
import { gsap } from 'gsap';
import { makeBackground, makeLogo, makePlanet, makeOrbit, makeGlow, makeRocks, scatter, makePoints, bindColor, bindNum, damp, smooth, col } from '../lib.js';

export function createHero(engine, section) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);

  const bg = makeBackground({
    top: ['#030b20', '#eef4fe'],
    bottom: ['#06163d', '#cddcf6'],
    glows: [
      { x: 0.43, y: 0.5, r: 0.36, i: 0.4, dark: '#1c3fb8', light: '#ffffff' },
      { x: 0.95, y: 1.0, r: 0.3, i: 0.45, dark: '#ff8a2a', light: '#ffd9a0', il: 0.3 },
      { x: 0.12, y: 0.15, r: 0.35, i: 0.25, dark: '#2a4cd6', light: '#c9dafc' },
    ],
    neb: ['#1b3c9e', '#ffffff'],
    nebula: 0.5,
  });
  scene.add(bg);

  // lights
  const hemi = new THREE.HemisphereLight();
  bindColor(hemi, 'color', '#5a7dff', '#ffffff');
  bindColor(hemi, 'groundColor', '#0a0f25', '#b7c8ee');
  bindNum(hemi, 'intensity', 0.52, 0.96);
  const key = new THREE.DirectionalLight();
  bindColor(key, 'color', '#bcd0ff', '#ffffff');
  bindNum(key, 'intensity', 1.32, 1.92);
  key.position.set(-3, 5, 6);
  const warm = new THREE.PointLight('#ff9b3d', 40, 30, 1.6);
  bindNum(warm, 'intensity', 60, 18);
  warm.position.set(5, -3, 3);
  const rim = new THREE.PointLight('#3d6bff', 60, 20, 1.6);
  bindNum(rim, 'intensity', 60, 12);
  rim.position.set(-5, 2, -3);
  scene.add(hemi, key, warm, rim);
  scene.environmentIntensity = 1;
  bindNum(scene, 'environmentIntensity', 0.45, 0.63);

  // --- composition group (positioned by layout) -----------------------
  const vis = new THREE.Group();
  root.add(vis);

  const logo = makeLogo(1);
  vis.add(logo.group);
  logo.group.rotation.set(-0.04, 0.16, -0.02);

  const glowBack = makeGlow(5.5, '#2f5bff', '#ffffff', 0.35, 0.6);
  glowBack.position.z = -1.5;
  vis.add(glowBack);

  // orbital ring around the logo (tilted, warm + blue particles)
  const ringTilt = new THREE.Group();
  ringTilt.rotation.set(0.32, 0, -0.32);
  vis.add(ringTilt);
  const ring1 = makeOrbit(1.75, 1.75, { count: 1400, spread: 0.16, size: 0.035, colorA: '#ffb545', colorB: '#6d90ff', mix: 0.35, lineOpacity: 0.7, lineDark: '#ffb545', lineLight: '#ffb545', lineOpacityLight: 0.8 });
  const ring2 = makeOrbit(2.15, 2.15, { count: 900, spread: 0.06, size: 0.028, colorA: '#ffd28a', colorB: '#3d6bff', mix: 0.6, lineOpacity: 0.35, lineDark: '#6d90ff', lineLight: '#315cff' });
  const ring3 = makeOrbit(1.45, 1.45, { count: 500, spread: 0.04, size: 0.022, line: false, colorA: '#ffffff', colorB: '#9bb4ff' });
  ringTilt.add(ring1, ring2, ring3);

  // small moons
  const moonA = makePlanet(0.22, { seed: 4, colors: { a: ['#1a2c6a', '#c9d7f3'], b: ['#3d6bff', '#ffffff'], rim: ['#9ab3ff', '#8fb2ff'] }, atmo: false, seg: 48 });
  const moonB = makePlanet(0.12, { seed: 8, colors: { a: ['#3a2b20', '#e2e8f5'], b: ['#ffb545', '#ffffff'], rim: ['#ffb545', '#ffffff'] }, atmo: false, seg: 32 });
  vis.add(moonA, moonB);

  // --- environment (planet horizon, distant planet, rocks) ------------
  const env = new THREE.Group();
  root.add(env);
  const horizon = makePlanet(14, {
    seed: 2, scale: 1.6, city: 1, rimStr: 1.8, rimPow: 9, light: [0.7, 0.3, 0.6],
    colors: { a: ['#040b24', '#dbe5f7'], b: ['#1a4ac0', '#ffffff'], rim: ['#8fb0ff', '#a9c6ff'], amb: ['#030817', '#c3d3f0'] },
    atmoColor: ['#5d86ff', '#d4e3ff'], atmoScale: 1.018, atmoStr: 0.7, seg: 160,
  });
  env.add(horizon);
  const farPlanet = makePlanet(0.55, { seed: 6, colors: { a: ['#0c1d55', '#d3def4'], b: ['#2f5bff', '#ffffff'], rim: ['#6d90ff', '#bcd3ff'] }, atmoStr: 0.7, seg: 48 });
  env.add(farPlanet);
  const horizonGlow = makeGlow(12, '#ff8a2a', '#ffd9a8', 0.22, 0.25);
  env.add(horizonGlow);

  const rocks = makeRocks(
    [
      { p: [-7.6, 0.9, -1], s: 0.65 }, { p: [-7.2, -1.6, 0.4], s: 0.35 }, { p: [-6.4, 2.6, -2], s: 0.25 },
      { p: [-8.2, -3.6, 0.5], s: 0.9 }, { p: [-3.8, -4.4, 1.2], s: 0.22 }, { p: [7.6, 3.6, -2], s: 0.18 },
      { p: [-5.2, 3.9, -3], s: 0.14 }, { p: [3.8, -3.9, 1.5], s: 0.16 }, { p: [-2.6, 3.6, -1], s: 0.1 },
      ...scatter(16, 77, (r) => ({ p: [-9 + r() * 9, -3.9 - r() * 1.2, -1 + r() * 3], s: [0.4 + r() * 1.1, 0.3 + r() * 0.9, 0.4 + r() * 0.9] })),
    ],
    3,
  );
  env.add(rocks);

  // drifting dust
  const dustPos = [], dustCol = [], dustSize = [];
  const cBlue = col('#7d9bff'), cGold = col('#ffcf7a');
  scatter(380, 21, (r) => {
    dustPos.push((r() - 0.5) * 22, (r() - 0.5) * 12, (r() - 0.5) * 8 - 2);
    const c = r() > 0.75 ? cGold : cBlue;
    dustCol.push(c.r, c.g, c.b);
    dustSize.push(0.015 + r() * 0.035);
  });
  const dust = makePoints(dustPos, dustCol, dustSize, { opacity: 0.8, lightOpacity: 0.5 });
  root.add(dust);

  // --- intro: logo assembles from scattered fragments -----------------
  const skip = engine.reduced || engine.capture;
  const intro = { split: skip ? 0 : 1, ring: skip ? 1 : 0 };
  logo.setSplit(intro.split);
  const playIntro = () => {
    if (skip) return;
    gsap.to(intro, { split: 0, duration: 2.4, ease: 'expo.out', delay: 0.15 });
    gsap.to(intro, { ring: 1, duration: 2.8, ease: 'power3.out', delay: 0.3 });
  };

  let base = { x: 0, y: 0, s: 1 };
  function layout(ctx) {
    const m = ctx.mode;
    if (m === 'mobile') {
      const [x, y] = engine.frac(0.5, 0.3);
      base = { x, y, s: Math.min(1.25, ctx.viewW / 4.8) };
      horizon.position.set(ctx.viewW * 0.1 * ctx.dir, -17.5, -6);
    } else if (m === 'tablet') {
      const [x, y] = engine.frac(0.3, 0.48);
      base = { x, y, s: 1.55 };
      horizon.position.set(4 * ctx.dir, -17.6, -6);
    } else {
      const [x, y] = engine.frac(0.45, 0.53);
      base = { x, y, s: 2.45 };
      horizon.position.set((ctx.viewW * 0.18) * ctx.dir, -18.2, -6);
    }
    vis.position.set(base.x, base.y, 0);
    vis.scale.setScalar(base.s);
    const [fx, fy] = engine.frac(m === 'mobile' ? 0.86 : 0.08, m === 'mobile' ? 0.12 : 0.14);
    farPlanet.position.set(fx, fy, -3);
    horizonGlow.position.set(horizon.position.x + 6 * ctx.dir, horizon.position.y + 13.5, -5);
    rocks.scale.x = ctx.dir;
    ringTilt.rotation.z = -0.32 * ctx.dir;
    logo.group.rotation.y = 0.16 * ctx.dir;
  }

  const tmp = { spin: 0 };
  function update(ctx, st) {
    const t = ctx.time;
    const leave = smooth(0.0, 1.0, st.leave);
    // disassembly as the hero scrolls away (and assembly intro)
    logo.setSplit(Math.max(intro.split, leave * 0.55), 1);
    const p = ctx.pointer;
    tmp.spin = damp(tmp.spin, p.x * 0.35, 2, ctx.dt);
    logo.inner.rotation.y = tmp.spin + Math.sin(t * 0.35) * 0.08 + leave * 0.6;
    logo.inner.rotation.x = p.y * 0.18 + Math.sin(t * 0.5) * 0.04;
    vis.position.y = base.y + Math.sin(t * 0.8) * 0.06 + leave * 2.2;
    vis.position.z = leave * -2;
    ringTilt.scale.setScalar(0.6 + intro.ring * 0.4 + leave * 0.4);
    ring1.rotation.y = t * 0.12;
    ring2.rotation.y = -t * 0.07;
    ring3.rotation.y = t * 0.2;
    ring1.userData.points.material.uniforms.uOpacity.value = intro.ring * (1 - leave);
    moonA.position.set(Math.cos(t * 0.25) * 2.1, 1.25 + Math.sin(t * 0.25) * 0.2, Math.sin(t * 0.25) * 1.2);
    moonB.position.set(Math.cos(-t * 0.4 + 2) * 1.7, -0.9, Math.sin(-t * 0.4 + 2) * 1.7);
    horizon.children[0].rotation.y = t * 0.01;
    env.position.y = leave * -1.5;
    dust.rotation.y = t * 0.01;
    dust.position.y = st.leave * 2;
    farPlanet.position.x += Math.sin(t * 0.2) * 0.0008;
  }

  return { id: 'hero', section, scene, root, bg, update, layout, playIntro };
}
