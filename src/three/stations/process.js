import * as THREE from 'three';
import { makeAstronaut, makeGlow, bindColor, bindNum, themeBlend, canvasTexture, damp, smooth, GLOBAL } from '../lib.js';
import { drawIcon } from '../../icons.js';
import { t } from '../../i18n.js';
import { CHAPTERS, stepAt, stepF } from '../../story.js';

const Z = -205;
const RH = 4.6; // hexagon radius
const FLOOR = -RH * Math.sin(Math.PI / 3);
const T0 = Z + 12, T1 = Z - 100; // tunnel extent
const CH = CHAPTERS[3];
const ICONS = ['bulb', 'strategy', 'design', 'dev', 'test', 'rocket'];
// camera keys (see below) travel linearly from K0 to K1 between local 0.1 and 0.9
const K0 = Z + 6, K1 = Z - 84;
const camZ = (local) => K0 + ((local - 0.1) / 0.8) * (K1 - K0);
const GATES = ICONS.map((_, k) => camZ(stepAt(CH, k)) - 7.5);

function hex(z, r = RH) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2, a1 = ((i + 1) / 6) * Math.PI * 2;
    pts.push(Math.cos(a0) * r, Math.sin(a0) * r, z, Math.cos(a1) * r, Math.sin(a1) * r, z);
  }
  return pts;
}

function drawBoard(k, title, desc, label, rtl) {
  const W = 640, H = 380;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, 'rgba(14,32,110,0.92)');
  grd.addColorStop(1, 'rgba(32,70,220,0.86)');
  g.fillStyle = grd;
  g.beginPath();
  g.roundRect(4, 4, W - 8, H - 8, 26);
  g.fill();
  g.strokeStyle = 'rgba(140,170,255,0.8)';
  g.lineWidth = 3;
  g.stroke();
  const font = (w, s) => `${w} ${s}px ${rtl ? '"IBM Plex Sans Arabic",' : ''} Sora, sans-serif`;
  g.direction = rtl ? 'rtl' : 'ltr';
  g.textAlign = rtl ? 'right' : 'left';
  const x0 = rtl ? W - 44 : 44;
  g.fillStyle = '#ffb545';
  g.font = font(700, 96);
  g.fillText(String(k + 1).padStart(2, '0'), x0, 128);
  drawIcon(g, ICONS[k], rtl ? 44 : W - 44 - 84, 44, 84, '#ffffff', 1.5);
  g.fillStyle = 'rgba(255,255,255,0.65)';
  g.font = font(600, 22);
  g.fillText(label, x0, 178);
  g.fillStyle = '#ffffff';
  g.font = font(700, 50);
  g.fillText(title, x0, 238);
  g.fillStyle = 'rgba(220,230,255,0.85)';
  g.font = font(400, 25);
  // wrap description
  const words = desc.split(' ');
  let line = '', y = 292;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > W - 88 && line) {
      g.fillText(line, x0, y);
      line = w;
      y += 36;
    } else line = test;
  }
  g.fillText(line, x0, y);
  return c;
}

// Station 04 — a hexagonal tunnel. The camera travels it, passing one gate
// per stage of the process, while an astronaut walks the journey ahead.
export function createProcess(world) {
  const group = new THREE.Group();

  // tunnel lines, faded by distance to the camera
  const pos = [];
  for (let z = T0; z >= T1; z -= 4) pos.push(...hex(z));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    pos.push(Math.cos(a) * RH, Math.sin(a) * RH, T0, Math.cos(a) * RH, Math.sin(a) * RH, T1);
  }
  for (const x of [-1.4, 1.4]) pos.push(x, FLOOR + 0.01, T0, x, FLOOR + 0.01, T1);
  const lu = { uCam: { value: new THREE.Vector3() }, uOpacity: { value: 1 }, uTheme: GLOBAL.uTheme };
  bindColor((lu.uColor = { value: null }), 'value', '#5d86ff', '#2446ff');
  bindNum(lu.uOpacity, 'value', 0.9, 0.55);
  const lineMat = themeBlend(
    new THREE.ShaderMaterial({
      uniforms: lu,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `uniform vec3 uCam; varying float vA; void main(){ vec4 w = modelMatrix*vec4(position,1.0); float d = distance(w.xyz, uCam); vA = smoothstep(70.0, 6.0, d); gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA*uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
    }),
  );
  const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)), lineMat);
  lines.frustumCulled = false;
  group.add(lines);

  // glossy floor
  const floorMat = new THREE.MeshPhysicalMaterial({ roughness: 0.2, metalness: 0.6, clearcoat: 1, transparent: true });
  bindColor(floorMat, 'color', '#0a1236', '#e8eefc');
  bindNum(floorMat, 'opacity', 0.85, 0.7);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RH, T0 - T1), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, FLOOR, (T0 + T1) / 2);
  group.add(floor);

  // gates + stage boards
  const gateGeo = new THREE.TorusGeometry(RH, 0.07, 6, 6);
  const gates = GATES.map((z, k) => {
    const g = new THREE.Group();
    g.position.z = z;
    const mat = new THREE.MeshBasicMaterial({ color: '#5d86ff', toneMapped: false, transparent: true });
    const ring = new THREE.Mesh(gateGeo, mat);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(RH * 0.93, 0.025, 4, 6), mat);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.9), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, depthWrite: false }));
    board.position.set((k % 2 ? 1 : -1) * 2.25, 0.5, -1);
    board.rotation.y = (k % 2 ? -1 : 1) * 0.42;
    const glow = makeGlow(3.4, '#3d6bff', '#7d9bff', 0.5, 0.3);
    glow.position.copy(board.position).z -= 0.4;
    g.add(ring, inner, glow, board);
    g.userData = { mat, board, glow, on: 0, t: 9 };
    group.add(g);
    return g;
  });

  const astro = makeAstronaut();
  astro.group.scale.setScalar(1.05);
  astro.group.rotation.y = Math.PI;
  group.add(astro.group);
  const lamp = new THREE.PointLight('#5d86ff', 30, 18, 1.4);
  bindNum(lamp, 'intensity', 30, 10);
  group.add(lamp);
  const end = makeGlow(14, '#ffffff', '#ffffff', 0.5, 0.6);
  end.position.set(0, 0, T1 - 4);
  group.add(end);

  function onLang(lang) {
    const rtl = lang === 'ar';
    const titles = t(lang, 'process.stages'), descs = t(lang, 'process.stageDesc'), label = t(lang, 'process.stage');
    gates.forEach((g, k) => {
      const m = g.userData.board.material;
      m.map?.dispose();
      m.map = canvasTexture(drawBoard(k, titles[k], descs[k], label, rtl));
      m.needsUpdate = true;
    });
  }
  function layout(ctx) {
    gates.forEach((g, k) => {
      const b = g.userData.board;
      b.position.x = (k % 2 ? 1 : -1) * 2.25 * ctx.dir;
      b.rotation.y = (k % 2 ? -1 : 1) * 0.42 * ctx.dir;
      g.userData.glow.position.x = b.position.x;
    });
  }

  const gold = new THREE.Color('#ffb545'), blue = new THREE.Color('#5d86ff');
  let walk = 0, lastZ = null, lastActive = -1;
  function update(ctx, local) {
    const cz = world.camera.position.z;
    lu.uCam.value.copy(world.camera.position);
    const active = Math.round(stepF(CH, local));
    if (active !== lastActive) {
      if (lastActive >= 0) gates[active].userData.t = 0;
      lastActive = active;
    }
    gates.forEach((g, k) => {
      const u = g.userData;
      u.t += ctx.dt;
      const flash = Math.max(0, 1 - u.t / 0.8);
      g.scale.setScalar(1 + Math.sin(Math.min(1, u.t / 0.8) * Math.PI) * 0.08);
      u.glow.material.opacity = 0.3 + flash * 0.9;
      u.on = damp(u.on, k === active ? 1 : k < active ? 0.35 : 0, 5, ctx.dt);
      u.mat.color.copy(blue).lerp(gold, u.on);
      u.mat.opacity = 0.55 + u.on * 0.45;
      u.board.material.opacity = 0.35 + u.on * 0.65;
      g.rotation.z = (1 - u.on) * 0.08 * Math.sin(ctx.time + k);
    });
    // astronaut keeps a few steps ahead and walks with the scroll
    const az = Math.max(T1 + 6, Math.min(T0 - 4, cz - 11));
    if (lastZ != null) walk += Math.abs(az - lastZ) * 1.6;
    lastZ = az;
    astro.group.position.set((0.9 + Math.sin(walk * 0.05) * 0.2) * ctx.dir, FLOOR, az);
    astro.pose(walk, smooth(0.0, 0.08, Math.abs(ctx.vel) + 0.02));
    lamp.position.set(0, 1.5, cz - 10);
  }

  return {
    id: 'process',
    group,
    update,
    onLang,
    layout,
    keys: [
      { at: 0, pos: [0, 2.2, Z + 30], look: [0, 0, Z - 8], f: 0.2 },
      { at: 0.1, pos: [0, -0.5, K0], look: [0, -0.7, K0 - 30], f: 0.55 },
      { at: 0.9, pos: [0, -0.5, K1], look: [0, -0.7, K1 - 30], f: 0.55 },
    ],
  };
}
