import * as THREE from 'three';
import { makeOrbit, bindColor, bindNum, themeBlend, smooth } from './lib.js';

// A ring gate hangs on the camera path between every two stations; the camera
// flies straight through it, so each chapter change reads as passing a portal.
export function createGates(world) {
  const group = new THREE.Group();
  // each gate fades on its own, so every gate gets its own themed materials
  const mat = (dark, light) => {
    const m = themeBlend(new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    bindColor(m, 'color', dark, light);
    return m;
  };
  const strength = { v: 1 };
  bindNum(strength, 'v', 1, 0.8);

  const gates = [];
  const pos = new THREE.Vector3(), ahead = new THREE.Vector3();
  function create() {
    for (let i = 1; i < world.stations.length; i++) {
      const g = new THREE.Group();
      const m1 = mat('#ffb545', '#ff9a2e'), m2 = mat('#6d90ff', '#2446ff');
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.035, 8, 160), m1);
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.015, 6, 160), m2);
      const ticks = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.12, 2, 48, Math.PI * 0.35), m1);
      const ticks2 = ticks.clone();
      ticks2.rotation.z = Math.PI;
      const dust = makeOrbit(3.3, 3.3, { count: 260, spread: 0.12, size: 0.03, colorA: '#ffb545', colorB: '#7d9bff', mix: 0.5, line: false });
      dust.rotation.x = Math.PI / 2;
      g.add(ring, ring2, ticks, ticks2, dust);
      g.userData = { mats: [m1, m2], ring2, ticks, ticks2, dust };
      group.add(g);
      gates.push(g);
    }
  }
  /** Re-seat the gates on the camera path (the path changes with direction). */
  function build() {
    if (!gates.length) create();
    gates.forEach((g, k) => {
      // just past the arrival key of station k+1, oriented along the path
      world.pointAt(k + 1.01, pos);
      world.pointAt(k + 1.03, ahead);
      g.position.copy(pos);
      g.lookAt(ahead);
    });
  }

  function update(ctx) {
    const cam = world.camera.position;
    for (const [k, g] of gates.entries()) {
      const d = cam.distanceTo(g.position);
      // once the story has flown through a gate it stays gone, even where the
      // camera is pulled back on small screens and would see it again
      const passed = smooth(k + 1.02, k + 1.12, ctx.u);
      const a = smooth(46, 12, d) * smooth(0.6, 4, d) * strength.v * (1 - passed);
      g.visible = a > 0.005;
      if (!g.visible) continue;
      const u = g.userData;
      u.mats[0].opacity = a;
      u.mats[1].opacity = a * 0.7;
      u.ticks.rotation.z = ctx.time * 0.6;
      u.ticks2.rotation.z = Math.PI + ctx.time * 0.6;
      u.ring2.rotation.z = -ctx.time * 0.2;
      u.dust.rotation.y = ctx.time * 0.3;
      u.dust.userData.points.material.uniforms.uOpacity.value = a;
      g.scale.setScalar(1 + ctx.vel * 0.35);
    }
  }

  return { group, build, update };
}
