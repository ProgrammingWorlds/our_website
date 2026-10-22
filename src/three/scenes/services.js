import * as THREE from 'three';
import { makeBackground, makeLogo, makeOrbit, makeGlow, makeRocks, scatter, bindColor, bindNum, damp, smooth, makePlanet } from '../lib.js';
import { svg } from '../../icons.js';
import { t } from '../../i18n.js';

const ICON = ['web', 'code', 'mobile', 'nfc', 'training'];
// Composition (stage fractions) measured from the reference at 1440px.
const DESK = { c: [0.545, 0.55], k: 0.42, orbs: [[0.55, 0.2], [0.15, 0.47], [0.87, 0.48], [0.3, 0.74], [0.75, 0.77]] };
const MOB = { c: [0.5, 0.7], k: 0.55, orbs: [[0.5, 0.5], [0.17, 0.62], [0.83, 0.62], [0.27, 0.86], [0.73, 0.88]] };

export function createServices(engine, section) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  const bg = makeBackground({
    top: ['#030b20', '#eef4fe'],
    bottom: ['#050f2c', '#d3e0f7'],
    glows: [
      { x: 0.6, y: 0.5, r: 0.38, i: 0.55, dark: '#1d43c4', light: '#ffffff' },
      { x: 0.1, y: 0.95, r: 0.26, i: 0.14, dark: '#ff9a3c', light: '#e6eefc', il: 0.4 },
      { x: 0.95, y: 0.1, r: 0.25, i: 0.3, dark: '#2a4cd6', light: '#d2e0fb' },
    ],
    nebula: 0.45,
  });
  scene.add(bg);

  const hemi = new THREE.HemisphereLight();
  bindColor(hemi, 'color', '#6d8cff', '#ffffff');
  bindColor(hemi, 'groundColor', '#090e22', '#c2d2f0');
  bindNum(hemi, 'intensity', 0.60, 1.02);
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.position.set(-4, 6, 6);
  bindNum(key, 'intensity', 1.32, 1.80);
  const warm = new THREE.PointLight('#ffa64d', 30, 25, 1.5);
  warm.position.set(4, 3, 3);
  bindNum(warm, 'intensity', 35, 10);
  scene.add(hemi, key, warm);
  bindNum(scene, 'environmentIntensity', 0.45, 0.63);

  const center = new THREE.Group();
  root.add(center);
  const logo = makeLogo(1.75);
  logo.group.rotation.set(-0.04, 0.16, -0.02);
  center.add(logo.group);
  const cGlow = makeGlow(5, '#2f5bff', '#ffffff', 0.35, 0.6);
  cGlow.position.z = -1;
  center.add(cGlow);

  const orbitTilt = new THREE.Group();
  orbitTilt.rotation.set(0.42, 0, -0.06);
  center.add(orbitTilt);
  const orbits = [2.0, 3.2, 4.4].map((r, i) =>
    makeOrbit(r * 1.25, r * 1.25, { count: 380 + i * 220, spread: 0.02, size: 0.03, colorA: '#ffb545', colorB: '#7d9bff', mix: 0.7, lineOpacity: 0.32 - i * 0.06, lineDark: i ? '#6d90ff' : '#ffb545', lineLight: '#315cff', lineOpacityLight: 0.35 }),
  );
  orbitTilt.add(...orbits);

  // service planets
  const orbMat = new THREE.MeshPhysicalMaterial({ color: '#2448ff', roughness: 0.3, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  bindColor(orbMat, 'emissive', '#1433d0', '#1838d8');
  bindNum(orbMat, 'emissiveIntensity', 0.4, 0.3);
  const orbGeo = new THREE.SphereGeometry(1, 48, 32);
  const orbs = ICON.map(() => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(orbGeo, orbMat);
    const glow = makeGlow(3.2, '#3d6bff', '#7d9bff', 0.55, 0.35);
    glow.position.z = -0.3;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.012, 8, 80), new THREE.MeshBasicMaterial({ color: '#9bb4ff', transparent: true, opacity: 0.0 }));
    g.add(glow, m, halo);
    g.userData = { mesh: m, halo, a0: 0, r0: 1, scale: 1, target: 1 };
    root.add(g);
    return g;
  });

  const rocks = makeRocks(
    [
      ...scatter(40, 5, (r) => ({ p: [(r() - 0.5) * 24, -3.9 - r() * 1.4, -1 + r() * 4], s: 0.25 + r() * r() * 1.2 })),
      ...scatter(14, 9, (r) => ({ p: [(r() - 0.5) * 20, (r() - 0.2) * 7, -3 - r() * 3], s: 0.06 + r() * 0.18 })),
      { p: [-9, -3.2, 0.5], s: 1.3 }, { p: [8.6, -3.6, 1], s: 1.1 },
    ],
    7,
  );
  root.add(rocks);
  const planetSmall = makePlanet(0.35, { seed: 12, colors: { a: ['#0c1d55', '#d3def4'], b: ['#3d6bff', '#ffffff'], rim: ['#ffb545', '#bcd3ff'] }, seg: 40 });
  root.add(planetSmall);

  // ----- HUD ---------------------------------------------------------
  const hud = section.querySelector('[data-hud]');
  const items = ICON.map((icon, i) => {
    const el = document.createElement('div');
    el.className = 'hud-item';
    el.innerHTML = `<button class="orb" type="button" aria-expanded="false" aria-describedby="svc-card-${i}">${svg(icon)}</button>
      <span class="orb-label"><strong></strong><small></small></span>
      <div class="orb-card" id="svc-card-${i}" role="tooltip"></div>`;
    hud.appendChild(el);
    return el;
  });
  let active = -1;
  function setActive(i) {
    active = i;
    items.forEach((el, j) => {
      el.classList.toggle('is-active', j === i);
      el.querySelector('.orb').setAttribute('aria-expanded', String(j === i));
      orbs[j].userData.target = j === i ? 1.28 : 1;
    });
    section.querySelector('.explore')?.style.setProperty('--p', i < 0 ? 0.3 : (i + 1) / ICON.length);
  }
  items.forEach((el, i) => {
    const b = el.querySelector('.orb');
    b.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && setActive(i));
    el.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && setActive(-1));
    b.addEventListener('focus', () => setActive(i));
    b.addEventListener('blur', () => setActive(-1));
    b.addEventListener('click', () => setActive(active === i ? -1 : i));
  });
  addEventListener('keydown', (e) => e.key === 'Escape' && active >= 0 && setActive(-1));
  section.querySelector('#exploreServices').addEventListener('click', () => {
    const n = (active + 1) % ICON.length;
    items[n].querySelector('.orb').focus();
  });

  function onLang(lang) {
    const list = t(lang, 'services.items');
    items.forEach((el, i) => {
      el.querySelector('.orb').setAttribute('aria-label', list[i].title);
      el.querySelector('strong').textContent = list[i].title;
      el.querySelector('small').textContent = list[i].sub;
      el.querySelector('.orb-card').textContent = list[i].detail;
    });
  }

  // ----- drag to orbit -------------------------------------------------
  const spin = { theta: 0, vel: 0, dragging: false, lastX: 0, idle: 0 };
  const stage = section.querySelector('.stage');
  stage.style.touchAction = 'pan-y';
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a')) return;
    spin.dragging = true;
    spin.lastX = e.clientX;
  });
  addEventListener('pointermove', (e) => {
    if (!spin.dragging) return;
    const dx = e.clientX - spin.lastX;
    spin.lastX = e.clientX;
    spin.vel = (dx / innerWidth) * 6 * engine.ctx.dir;
    spin.theta += spin.vel;
    spin.idle = 0;
  });
  addEventListener('pointerup', () => (spin.dragging = false));

  // ----- layout ----------------------------------------------------------
  let cfg = DESK;
  let orbR = 0.48;
  function layout(ctx) {
    const mob = ctx.mode === 'mobile';
    cfg = mob ? MOB : DESK;
    const tab = ctx.mode === 'tablet';
    const [cx, cy] = cfg.c;
    const cy2 = tab ? 0.62 : cy;
    const [wx, wy] = engine.frac(cx, cy2);
    center.position.set(wx, wy, 0);
    center.scale.setScalar(mob ? Math.min(0.62, ctx.viewW / 7.5) : tab ? 0.8 : 1);
    orbR = mob ? 0.38 : tab ? 0.5 : 0.66;
    orbs.forEach((o, i) => {
      let [fx, fy] = cfg.orbs[i];
      if (tab) fy = 0.36 + fy * 0.62;
      const dx = (fx - cx) * ctx.viewW * ctx.dir;
      const dy = -(fy - cy2) * 10;
      const ex = dx, ey = dy / cfg.k;
      o.userData.a0 = Math.atan2(ey, ex);
      o.userData.r0 = Math.hypot(ex, ey);
      o.userData.mesh.scale.setScalar(orbR);
      o.userData.halo.scale.setScalar(orbR);
      o.children[0].scale.setScalar(3.2 * orbR * 2);
    });
    items.forEach((el) => el.querySelector('.orb-label').classList.toggle('orb-label--below', mob));
    items.forEach((el) => el.querySelector('.orb-card').classList.toggle('orb-card--below', mob));
    const [px, py] = engine.frac(mob ? 0.88 : 0.93, mob ? 0.08 : 0.08);
    planetSmall.position.set(px, py, -2);
    rocks.scale.x = ctx.dir;
    orbitTilt.rotation.z = -0.06 * ctx.dir;
  }

  const out = {};
  function update(ctx, st) {
    const t = ctx.time;
    const dt = ctx.dt;
    if (!spin.dragging) {
      spin.vel *= Math.pow(0.04, dt);
      spin.theta += spin.vel;
      spin.idle += dt;
      if (spin.idle > 2.5) spin.theta = damp(spin.theta, 0, 0.6, dt); // drift back to the composed layout
    }
    const sway = ctx.reduced ? 0 : Math.sin(t * 0.18) * 0.05;
    const enter = smooth(0, 1, st.enter);
    const leave = st.leave;
    logo.inner.rotation.y = Math.sin(t * 0.3) * 0.15 + ctx.pointer.x * 0.25;
    logo.setGap(0.04 + Math.sin(t * 0.9) * 0.02);
    orbits.forEach((o, i) => (o.rotation.y = t * (0.05 + i * 0.02) * (i % 2 ? -1 : 1)));
    center.rotation.z = (1 - enter) * 0.25;
    const k = cfg.k;
    const sr = st.stageRect;
    orbs.forEach((o, i) => {
      const u = o.userData;
      const paused = i === active;
      const a = u.a0 + spin.theta + (paused ? 0 : sway * (i % 2 ? 1 : -1));
      const rr = u.r0 * (0.55 + 0.45 * enter);
      o.position.set(center.position.x + Math.cos(a) * rr, center.position.y + Math.sin(a) * rr * k + Math.sin(t * 0.9 + i) * 0.06, 0.6 - Math.sin(a) * 0.7 + leave * 1.5);
      u.scale = damp(u.scale, u.target, 8, dt);
      o.scale.setScalar(u.scale * (0.4 + 0.6 * enter));
      u.mesh.rotation.y = t * 0.3 + i;
      u.halo.material.opacity = damp(u.halo.material.opacity, paused ? 0.7 : 0, 8, dt);
      u.halo.rotation.z = t;
      // HUD follow
      engine.project(o, sr, out);
      const d = engine.screenRadius(o, orbR * u.scale) * 2;
      const el = items[i];
      el.style.transform = `translate3d(${out.x.toFixed(1)}px, ${out.y.toFixed(1)}px, 0)`;
      el.style.setProperty('--d', d.toFixed(1) + 'px');
      el.style.opacity = (enter * (1 - leave * 1.4)).toFixed(3);
    });
    rocks.position.y = (1 - enter) * -1.2 + leave * 0.8;
    rocks.rotation.y = ctx.pointer.x * 0.02;
  }

  return { id: 'services', section, scene, root, bg, update, layout, onLang };
}
