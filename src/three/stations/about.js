import * as THREE from 'three';
import { makeLogo, makeGlow, logoMaterials, bindNum, smooth, rnd } from '../lib.js';
import { chapter, stepF } from '../../story.js';

const Z = -64; // first stop after the hero
const S = 2.4; // logo radius
const CH = chapter('about');

// Station 03 — "we turn ideas into digital reality": a storm of fragments
// condenses into the PW mark as you scroll; four pillar lights join its orbit.
export function createAbout(world) {
  const group = new THREE.Group();
  group.position.z = Z;
  const r = rnd(301);

  const logo = makeLogo(S);
  logo.group.rotation.set(-0.08, 0.5, -0.04);
  group.add(logo.group);
  const glow = makeGlow(12, '#5b3dff', '#ffffff', 0.3, 0.5);
  glow.position.z = -3;
  group.add(glow);
  const light = new THREE.PointLight('#8a6bff', 14, 30, 1.4);
  light.position.set(-5, 4, 6);
  bindNum(light, 'intensity', 14, 5);
  group.add(light);

  // fragments: targets sampled on the logo surface, homes scattered in a shell
  const { blue, gold } = logoMaterials();
  function cloud(count, mat, geo, target) {
    // the shared logo materials use vertex colours (darker cut faces)
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(1), 3));
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const data = Array.from({ length: count }, () => {
      const tgt = target();
      const d = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
      const home = d.multiplyScalar(6 + r() * 9).add(new THREE.Vector3(0, 0, -2));
      return { tgt, home, delay: r() * 0.4, spin: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(6), size: 0.6 + r() * 0.8 };
    });
    mesh.userData.data = data;
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  }
  const gap = 0.055 * S;
  const blueCloud = cloud(520, blue, new THREE.IcosahedronGeometry(0.11, 0), () => {
    let v;
    do v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    while (v.x > 0 && v.y > 0);
    v.multiplyScalar(S);
    if (Math.abs(v.x) < gap) v.x = Math.sign(v.x || 1) * gap;
    if (Math.abs(v.y) < gap) v.y = Math.sign(v.y || 1) * gap;
    return v;
  });
  const goldCloud = cloud(110, gold, new THREE.BoxGeometry(0.13, 0.13, 0.13), () => {
    const c = new THREE.Vector3(0.42, 0.42, 0.22).multiplyScalar(S), h = 0.3 * S;
    const v = new THREE.Vector3((r() - 0.5) * 2, (r() - 0.5) * 2, (r() - 0.5) * 2);
    const ax = Math.floor(r() * 3);
    v.setComponent(ax, Math.sign(v.getComponent(ax)) || 1);
    return v.multiplyScalar(h).add(c);
  });

  // pillar lights
  const pillars = [0, 1, 2, 3].map((k) => {
    const g = new THREE.Group();
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), new THREE.MeshBasicMaterial({ color: k % 2 ? '#7d9bff' : '#ffb545', toneMapped: false }));
    g.add(orb, makeGlow(1.6, k % 2 ? '#5d86ff' : '#ffb545', k % 2 ? '#315cff' : '#ffb545', 0.8, 0.6));
    group.add(g);
    return g;
  });

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  function place(mesh, a, t, out) {
    for (const [i, d] of mesh.userData.data.entries()) {
      const k = smooth(d.delay, d.delay + 0.6, a);
      const ease = 1 - Math.pow(1 - k, 3);
      p.copy(d.home).lerp(d.tgt, ease);
      p.y += Math.sin(t * 0.6 + i) * 0.25 * (1 - ease);
      const sp = (1 - ease) + 0.02;
      e.set(d.spin.x * sp + t * 0.2 * (1 - ease), d.spin.y * sp, d.spin.z * sp);
      q.setFromEuler(e);
      sc.setScalar(d.size * (1 - out));
      m.compose(p, q, sc);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  function update(ctx, local) {
    const t = ctx.time;
    const a = smooth(0.04, 0.62, local);
    const solid = smooth(0.58, 0.7, local);
    place(blueCloud, a, t, solid);
    place(goldCloud, a, t, solid);
    // the solid mark takes over once the fragments have landed
    logo.group.visible = solid > 0.001;
    logo.group.scale.setScalar(0.92 + solid * 0.08);
    logo.setGap(0.4 * (1 - solid) + Math.sin(t * 1.1) * 0.02);
    logo.group.rotation.y = 0.5 + Math.sin(t * 0.25) * 0.15;
    for (const c of [blueCloud, goldCloud]) c.rotation.copy(logo.group.rotation);
    const f = stepF(CH, local);
    pillars.forEach((g, k) => {
      const on = smooth(k - 0.6, k + 0.1, f) * smooth(0.18, 0.3, local);
      const ang = t * 0.35 + (k / 4) * Math.PI * 2;
      g.position.set(Math.cos(ang) * 4.2, Math.sin(ang * 2) * 0.6 + 0.3, Math.sin(ang) * 4.2);
      g.scale.setScalar(on);
    });
  }

  return {
    id: 'about',
    group,
    update,
    keys: [
      { at: 0, pos: [-10, 5, Z + 28], look: [0, 0, Z], f: 0.3 },
      { at: 0.14, pos: [-8, 2.2, Z + 14], look: [0, 0, Z], f: 1 },
      { at: 0.5, pos: [0, 1.8, Z + 16], look: [0, 0, Z], f: 1 },
      { at: 0.86, pos: [7.5, 1.2, Z + 14], look: [0, 0, Z], f: 1 },
    ],
  };
}
