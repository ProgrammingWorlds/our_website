import * as THREE from 'three';
import { makeLogo, makeOrbit, makeGlow, makeRocks, scatter, bindColor, bindNum, damp, smooth } from '../lib.js';
import { ICONS } from '../../icons.js';
import { t } from '../../i18n.js';
import { chapter, stepF } from '../../story.js';

const Z = -132; // after About on the camera path
const R = 5.4;
const ICON = ['web', 'code', 'mobile', 'nfc', 'training'];
const CH = chapter('services');

function iconTexture(name) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.translate(64, 64);
  g.scale(3.4, 3.4);
  g.translate(-12, -12);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1.5;
  g.lineCap = g.lineJoin = 'round';
  g.shadowColor = 'rgba(160,190,255,0.9)';
  g.shadowBlur = 3;
  g.stroke(new Path2D(ICONS[name]));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Station 02 — a solar system of services. Scrolling turns the system so each
// service planet swings to the front in turn.
export function createServices(world) {
  const group = new THREE.Group();
  group.position.z = Z;

  const core = makeLogo(1.25);
  core.group.rotation.set(-0.05, 0.3, 0);
  group.add(core.group);
  const coreGlow = makeGlow(6.5, '#2f5bff', '#ffffff', 0.28, 0.5);
  coreGlow.position.z = -1;
  group.add(coreGlow);
  const sun = new THREE.PointLight('#ffb545', 16, 20, 1.4);
  sun.position.set(0, 2.5, 3.5);
  bindNum(sun, 'intensity', 16, 6);
  group.add(sun);

  const plane = new THREE.Group();
  plane.rotation.set(0.32, 0, -0.05);
  group.add(plane);
  const orbits = [2.6, R, 8].map((r, i) =>
    makeOrbit(r, r, { count: 140 + i * 110, spread: 0.02, size: 0.03, colorA: '#ffb545', colorB: '#7d9bff', mix: 0.7, lineOpacity: [0.25, 0.45, 0.18][i], lineDark: i === 1 ? '#ffb545' : '#6d90ff', lineLight: '#315cff', lineOpacityLight: 0.35 }),
  );
  plane.add(...orbits);

  const orbMat = new THREE.MeshPhysicalMaterial({ color: '#2448ff', roughness: 0.28, metalness: 0.1, clearcoat: 0.7, clearcoatRoughness: 0.12 });
  bindColor(orbMat, 'emissive', '#1433d0', '#1838d8');
  bindNum(orbMat, 'emissiveIntensity', 0.42, 0.3);
  const orbGeo = new THREE.SphereGeometry(0.8, 48, 32);
  // Selected planet: a hairline ring with one gold spark orbiting it — clear,
  // but light enough never to cover the label beneath.
  const ringMat = () => {
    const m = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
    bindColor(m, 'color', '#c4d4ff', '#315cff');
    return m;
  };
  const sparkMat = new THREE.MeshBasicMaterial({ color: '#ffb545', transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
  const planets = ICON.map((name) => {
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(orbGeo, orbMat);
    const glow = makeGlow(3, '#3d6bff', '#7d9bff', 0.6, 0.35);
    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(name), transparent: true, depthWrite: false, toneMapped: false }));
    icon.scale.setScalar(0.85);
    const halo = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.008, 6, 96), ringMat());
    const spark = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.024, 6, 24, 0.55), sparkMat.clone());
    halo.add(ring, spark);
    const pulse = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.01, 6, 96), ringMat());
    pulse.material.blending = THREE.AdditiveBlending;
    g.add(glow, mesh, icon, halo, pulse);
    g.userData = { mesh, icon, halo, ring, spark, pulse, s: 1, t: 9 };
    plane.add(g);
    return g;
  });

  const rocks = makeRocks(scatter(12, 5, (r) => ({ p: [(r() - 0.5) * 30, (r() - 0.5) * 14, (r() - 0.5) * 22 - 4], s: 0.06 + r() * r() * 0.4 })), 7);
  group.add(rocks);

  // labels
  const labels = ICON.map((_, k) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.tabIndex = -1;
    el.className = 'label label--orb';
    el.addEventListener('click', () => world.select('services', k));
    return { el, anchor: planets[k], offset: new THREE.Vector3(0, -2.05, 0), alpha: 0 };
  });
  function onLang(lang) {
    t(lang, 'services.items').forEach((it, k) => (labels[k].el.innerHTML = `<strong>${it.title}</strong><small>${it.sub}</small>`));
  }

  const spin = { v: 0 };
  let lastActive = -1;
  const tmp = new THREE.Vector3();
  function update(ctx, local) {
    const tm = ctx.time;
    const f = stepF(CH, local);
    spin.v = world.reduced ? f : damp(spin.v, f, 6, ctx.dt);
    const active = Math.round(f);
    const show = smooth(0.06, 0.16, local) * (1 - smooth(0.88, 0.97, local));
    if (active !== lastActive) {
      if (lastActive >= 0) planets[active].userData.t = 0;
      lastActive = active;
    }
    planets.forEach((p, k) => {
      const a = ((k - spin.v) / ICON.length) * Math.PI * 2;
      p.position.set(Math.sin(a) * R * ctx.dir, Math.sin(tm * 0.8 + k) * 0.08, Math.cos(a) * R);
      const on = k === active ? 1 : 0;
      const u = p.userData;
      u.s = damp(u.s, 1 + on * 0.28, 5, ctx.dt);
      p.scale.setScalar(u.s * (0.6 + 0.4 * show));
      u.mesh.rotation.y = tm * 0.3 + k;
      const ha = damp(u.ring.material.opacity, on * 0.75 * show, 5, ctx.dt);
      u.ring.material.opacity = ha;
      u.spark.material.opacity = ha * 1.25;
      u.halo.visible = ha > 0.01;
      u.halo.lookAt(world.camera.position);
      u.spark.rotation.z = tm * 1.6;
      // one soft ripple when a planet takes the stage
      u.t += ctx.dt;
      const w = Math.min(1, u.t / 1.1);
      u.pulse.visible = w < 1;
      u.pulse.scale.setScalar(1 + (1 - Math.pow(1 - w, 3)) * 0.55);
      u.pulse.material.opacity = (1 - w) * 0.5 * show;
      u.pulse.quaternion.copy(u.halo.quaternion);
      // icon floats on the camera-facing side of the planet
      tmp.copy(world.camera.position);
      p.worldToLocal(tmp).normalize().multiplyScalar(0.82);
      u.icon.position.copy(tmp);
      // phones only label the selected planet; the others would be cut by the screen edge
      labels[k].alpha = show * (k === active ? 1 : ctx.mode === 'mobile' ? 0 : 0.5);
      labels[k].el.classList.toggle('is-active', k === active);
    });
    core.setGap(0.05 + Math.sin(tm * 1.2) * 0.03);
    core.group.rotation.y = 0.3 + tm * 0.15;
    orbits.forEach((o, i) => (o.rotation.y = tm * (0.05 - i * 0.012)));
    rocks.rotation.y = tm * 0.01;
  }

  // on wide screens the system sits a little further from the text panel,
  // so the orbit never passes under the service list
  function layout(ctx) {
    const wide = ctx.mode === 'desktop';
    group.position.x = wide ? 0.7 * ctx.dir : 0;
    plane.scale.setScalar(wide ? 0.86 : 1);
  }

  return {
    id: 'services',
    group,
    labels,
    update,
    onLang,
    layout,
    keys: [
      { at: 0, pos: [0, 7, Z + 30], look: [0, 0, Z], f: 0.3 },
      { at: 0.14, pos: [0, 6.2, Z + 19.5], look: [0, -0.8, Z], f: 1 },
      { at: 0.86, pos: [1, 5.4, Z + 18.5], look: [0, -0.8, Z], f: 1 },
    ],
  };
}
