import * as THREE from 'three';
import { GLOBAL, makeBackground, makeLogo, makeGlow, logoMaterials, bindColor, bindNum, smooth, rnd, makeRocks, scatter } from '../lib.js';
import { svg } from '../../icons.js';
import { t } from '../../i18n.js';

const PILLAR_ICONS = ['creative', 'practical', 'modern', 'partner'];

export function createAbout(engine, section) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  const bg = makeBackground({
    top: ['#040d28', '#eef4fe'],
    bottom: ['#030a1f', '#d3e0f7'],
    glows: [
      { x: 0.47, y: 0.5, r: 0.36, i: 0.6, dark: '#1f46cf', light: '#ffffff' },
      { x: 0.55, y: 0.35, r: 0.12, i: 0.5, dark: '#ffa84a', light: '#ffe2b5', il: 0.25 },
      { x: 0.25, y: 0.1, r: 0.3, i: 0.25, dark: '#2442b8', light: '#d6e2fb' },
    ],
    nebula: 0.65,
  });
  bg.material.uniforms.uStars.value = 0.8;
  scene.add(bg);

  const hemi = new THREE.HemisphereLight();
  bindColor(hemi, 'color', '#6d8cff', '#ffffff');
  bindColor(hemi, 'groundColor', '#060a1c', '#c5d4f1');
  bindNum(hemi, 'intensity', 0.60, 1.02);
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.position.set(-3, 5, 6);
  bindNum(key, 'intensity', 1.4, 1.6);
  const core = new THREE.PointLight('#ffb545', 40, 12, 1.4);
  bindNum(core, 'intensity', 45, 14);
  core.position.set(0.6, 0.8, 2.5);
  const blue = new THREE.PointLight('#3d6bff', 50, 20, 1.4);
  blue.position.set(-4, -2, 3);
  bindNum(blue, 'intensity', 50, 10);
  scene.add(hemi, key, core, blue);
  bindNum(scene, 'environmentIntensity', 0.45, 0.63);

  const vis = new THREE.Group();
  root.add(vis);
  const logo = makeLogo(1.75);
  logo.group.rotation.set(-0.04, 0.16, -0.02);
  vis.add(logo.group);
  const glow = makeGlow(5.5, '#2f5bff', '#ffffff', 0.35, 0.55);
  glow.position.z = -1.2;
  vis.add(glow);
  const coreGlow = makeGlow(2.2, '#ffb545', '#ffcf7a', 0.5, 0.3);
  coreGlow.position.set(0.6, 0.6, 1);
  vis.add(coreGlow);

  // fragments (instanced polyhedra) — the "explosion"
  const N = engine.quality.pr < 1 ? 110 : 170;
  const { blue: blueMat, gold: goldMat } = logoMaterials();
  const fragBlue = new THREE.MeshPhysicalMaterial({ color: '#2643ff', roughness: 0.3, metalness: 0.2, clearcoat: 0.6, flatShading: true });
  bindColor(fragBlue, 'emissive', '#0b1f9a', '#0a1aa0');
  bindNum(fragBlue, 'emissiveIntensity', 0.25, 0.12);
  const geoms = [new THREE.OctahedronGeometry(1, 0), new THREE.DodecahedronGeometry(1, 0), new THREE.TetrahedronGeometry(1, 0)];
  const r = rnd(77);
  const frags = [];
  const meshes = geoms.map((g) => {
    const im = new THREE.InstancedMesh(g, fragBlue, Math.ceil(N / 3));
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    vis.add(im);
    return im;
  });
  const goldN = 18;
  const goldMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), goldMat, goldN);
  goldMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  vis.add(goldMesh);
  const v = new THREE.Vector3();
  for (let i = 0; i < N + goldN; i++) {
    // direction biased up/out so fragments fill the frame like the reference
    v.set(r() * 2 - 1, r() * 2 - 0.8, r() * 1.6 - 0.5).normalize();
    const far = 1.45 + Math.pow(r(), 0.9) * 2.5;
    frags.push({
      dir: v.clone(),
      home: v.clone().multiplyScalar(0.7 + r() * 0.25),
      far,
      size: (i >= N ? 0.08 : 0.05) + r() * r() * (i >= N ? 0.16 : 0.24),
      rot: new THREE.Euler(r() * 6, r() * 6, r() * 6),
      spin: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(2),
      delay: r() * 0.25,
      gold: i >= N,
    });
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler(), pos = new THREE.Vector3();

  const rocks = makeRocks(scatter(10, 31, (rr) => ({ p: [(rr() - 0.5) * 22, (rr() - 0.5) * 9, -4 - rr() * 3], s: 0.08 + rr() * 0.3 })), 13);
  root.add(rocks);

  // ----- pillars panel (DOM) -----------------------------------------
  const list = section.querySelector('#pillars');
  list.innerHTML = PILLAR_ICONS.map((ic) => `<li>${svg(ic)}<span></span></li>`).join('');
  function onLang(lang) {
    t(lang, 'about.pillars').forEach((txt, i) => (list.children[i].querySelector('span').textContent = txt));
  }

  let base = { x: 0, y: 0, s: 1 };
  function layout(ctx) {
    const m = ctx.mode;
    const [x, y] = engine.frac(m === 'mobile' ? 0.5 : m === 'tablet' ? 0.62 : 0.5, m === 'mobile' ? 0.6 : m === 'tablet' ? 0.45 : 0.55);
    base = { x, y, s: m === 'mobile' ? Math.min(0.62, ctx.viewW / 8) : m === 'tablet' ? 0.85 : 1 };
    vis.position.set(x, y, 0);
    vis.scale.setScalar(base.s);
    logo.group.rotation.y = 0.16 * ctx.dir;
  }

  function update(ctx, st) {
    const tm = ctx.time;
    // explosion envelope across the section: assembled → exploded → reassembled
    const p = st.progress;
    const ex = engine.reduced ? 0.85 : smooth(0.12, 0.42, p) * (1 - smooth(0.68, 0.95, p));
    logo.setGap(0.05 + ex * 0.22);
    logo.inner.rotation.y = Math.sin(tm * 0.3) * 0.12 + ctx.pointer.x * 0.3 + (p - 0.5) * 0.6;
    logo.inner.rotation.x = ctx.pointer.y * 0.15;
    const counts = [0, 0, 0];
    let g = 0;
    for (let i = 0; i < frags.length; i++) {
      const f = frags[i];
      const k = smooth(f.delay, 1, ex);
      pos.copy(f.home).lerp(v.copy(f.dir).multiplyScalar(f.far), k);
      pos.y += Math.sin(tm * 0.7 + i) * 0.05 * k;
      e.set(f.rot.x + f.spin.x * (tm * 0.3 + k * 3), f.rot.y + f.spin.y * (tm * 0.3 + k * 3), f.rot.z);
      q.setFromEuler(e);
      s.setScalar(f.size * (0.2 + 0.8 * k));
      m4.compose(pos, q, s);
      if (f.gold) goldMesh.setMatrixAt(g++, m4);
      else {
        const bi = i % 3;
        meshes[bi].setMatrixAt(counts[bi]++, m4);
      }
    }
    meshes.forEach((im, i) => {
      im.count = counts[i];
      im.instanceMatrix.needsUpdate = true;
    });
    goldMesh.instanceMatrix.needsUpdate = true;
    coreGlow.material.opacity = (0.25 + ex * 0.35) * (1 - 0.5 * GLOBAL.uTheme.value);
    vis.rotation.z = Math.sin(tm * 0.2) * 0.03;
    vis.position.y = base.y + Math.sin(tm * 0.6) * 0.06;
    rocks.position.y = (p - 0.5) * 2;
  }

  return { id: 'about', section, scene, root, bg, update, layout, onLang };
}
