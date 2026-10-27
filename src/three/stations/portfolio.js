import * as THREE from 'three';
import { makeGlow, makeRocks, makePlanet, scatter, bindColor, bindNum, smooth } from '../lib.js';

const Z = -340;

// Station 05 — a lit pedestal. The projects themselves are real screenshots
// in device frames on the page (src/showcase.js); the scene gives them a stage.
export function createPortfolio() {
  const group = new THREE.Group();
  group.position.z = Z;
  const vis = new THREE.Group();
  vis.scale.setScalar(1.25);
  vis.position.y = -1.6;
  group.add(vis);

  const platMat = new THREE.MeshPhysicalMaterial({ roughness: 0.15, metalness: 0.5, clearcoat: 1 });
  bindColor(platMat, 'color', '#0b1433', '#f3f6fd');
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.2, 0.32, 96), platMat);
  plat.position.y = -0.2;
  vis.add(plat);
  const edgeMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  bindColor(edgeMat, 'color', '#6d90ff', '#5a7dff');
  const edges = [1, 0.78, 0.56].map((s, i) => {
    const e = new THREE.Mesh(new THREE.TorusGeometry(4.05 * s, i ? 0.018 : 0.03, 8, 180), edgeMat);
    e.rotation.x = Math.PI / 2;
    e.position.y = -0.03;
    vis.add(e);
    return e;
  });
  const platGlow = makeGlow(12, '#3d6bff', '#a9c0ff', 0.55, 0.4);
  platGlow.position.set(0, -0.7, 0);
  platGlow.scale.y = 3;
  vis.add(platGlow);
  const beam = makeGlow(9, '#5d86ff', '#c9d6ff', 0.32, 0.22);
  beam.position.set(0, 1.6, -0.5);
  beam.scale.y = 7;
  vis.add(beam);
  const spot = new THREE.PointLight('#5d86ff', 45, 14, 1.4);
  spot.position.set(0, 1, 4);
  bindNum(spot, 'intensity', 45, 14);
  vis.add(spot);

  const rocks = makeRocks([...scatter(12, 41, (r) => ({ p: [(r() - 0.5) * 30, -4.5 - r() * 2, (r() - 0.5) * 14], s: 0.25 + r() * r() * 1.1 })), ...scatter(5, 42, (r) => ({ p: [(r() - 0.5) * 30, (r() - 0.2) * 12, -6 - r() * 10], s: 0.06 + r() * 0.2 }))], 19);
  group.add(rocks);
  const moon = makePlanet(0.6, { seed: 14, colors: { a: ['#0c1d55', '#d3def4'], b: ['#3d6bff', '#ffffff'], rim: ['#6d90ff', '#bcd3ff'] }, seg: 40 });
  moon.position.set(9, 4.5, -6);
  group.add(moon);

  function update(ctx, local) {
    const tm = ctx.time;
    const enter = smooth(0, 0.16, local);
    edges.forEach((e, i) => (e.rotation.z = tm * (i % 2 ? -0.1 : 0.06)));
    vis.rotation.x = 0.06;
    vis.position.y = -1.6 - (1 - enter) * 1.5 + Math.sin(tm * 0.5) * 0.05;
    moon.rotation.y = tm * 0.1;
  }

  return {
    id: 'portfolio',
    group,
    update,
    keys: [
      { at: 0, pos: [0, 6, Z + 30], look: [0, 0, Z], f: 0.3 },
      { at: 0.14, pos: [0, 3.2, Z + 14.5], look: [0, 0.2, Z], f: 1 },
      { at: 0.86, pos: [0.7, 2.8, Z + 14], look: [0, 0.2, Z], f: 1 },
    ],
  };
}
