import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeBackground, makeLogo, makeGlow, makeAstronaut, bindColor, bindNum, canvasTexture, smooth, damp } from '../lib.js';
import { drawIcon } from '../../icons.js';
import { t } from '../../i18n.js';

const STAGE_ICONS = ['bulb', 'strategy', 'design', 'dev', 'test', 'rocket'];
const HW = 4.6, HH = 3.5; // tunnel inner half-extents
const SPACING = 3.4, NF = 30, NEAR_Z = 13, LEN = SPACING * NF;
const CARD_GAP = 9.5, CARD_Z0 = -8;
export const TRAVEL = CARD_GAP * 5 + 22;

function octShape(w, h, c) {
  const s = new THREE.Shape();
  s.moveTo(-w + c, -h);
  s.lineTo(w - c, -h);
  s.lineTo(w, -h + c);
  s.lineTo(w, h - c);
  s.lineTo(w - c, h);
  s.lineTo(-w + c, h);
  s.lineTo(-w, h - c);
  s.lineTo(-w, -h + c);
  s.closePath();
  return s;
}

function gridCanvas(lines = '#5d86ff', bg = 'rgba(0,0,0,0)') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = lines;
  g.lineWidth = 2;
  g.strokeRect(8, 8, 240, 240);
  g.globalAlpha = 0.4;
  g.strokeRect(40, 40, 176, 176);
  g.globalAlpha = 1;
  g.fillStyle = lines;
  g.fillRect(118, 0, 20, 6);
  return c;
}

function cardCanvas(i, label, stageWord) {
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 440;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 320, 440);
  grd.addColorStop(0, 'rgba(70,110,255,0.95)');
  grd.addColorStop(1, 'rgba(20,45,170,0.92)');
  g.fillStyle = grd;
  g.beginPath();
  g.roundRect(6, 6, 308, 428, 22);
  g.fill();
  g.strokeStyle = 'rgba(190,210,255,0.9)';
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = '#ffffff';
  const rtl = /[؀-ۿ]/.test(label);
  g.direction = rtl ? 'rtl' : 'ltr';
  g.textAlign = rtl ? 'right' : 'left';
  const x0 = rtl ? 290 : 30;
  g.font = '600 64px Sora, sans-serif';
  g.fillText(String(i + 1).padStart(2, '0'), x0, 92);
  g.font = rtl ? '600 30px "IBM Plex Sans Arabic", sans-serif' : '600 28px Sora, sans-serif';
  g.fillText(label, x0, 140);
  g.globalAlpha = 0.65;
  g.font = rtl ? '400 20px "IBM Plex Sans Arabic", sans-serif' : '400 18px Sora, sans-serif';
  g.fillText(stageWord, x0, 172);
  g.globalAlpha = 1;
  drawIcon(g, STAGE_ICONS[i], 90, 220, 140, '#ffffff', 1.3);
  return c;
}

export function createProcess(engine, section) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  const bg = makeBackground({ top: ['#020818', '#eef4ff'], bottom: ['#030b22', '#e2ebfb'], glows: [{ x: 0.66, y: 0.42, r: 0.25, i: 0.8, dark: '#3d6bff', light: '#ffffff' }], nebula: 0.2, stars: 0.4 });
  scene.add(bg);
  scene.fog = new THREE.Fog('#030b22', 20, 95);
  bindColor(scene.fog, 'color', '#030b22', '#e8effc');

  const hemi = new THREE.HemisphereLight();
  bindColor(hemi, 'color', '#5f80ff', '#ffffff');
  bindColor(hemi, 'groundColor', '#05081a', '#c9d6f2');
  bindNum(hemi, 'intensity', 0.68, 2.2);
  const head = new THREE.PointLight('#8fb0ff', 40, 30, 1.2);
  bindNum(head, 'intensity', 14, 12);
  head.position.set(0, 2, 10);
  scene.add(hemi, head);
  bindNum(scene, 'environmentIntensity', 0.25, 1.1);

  const tun = new THREE.Group();
  root.add(tun);

  // frames
  const outer = octShape(HW + 0.9, HH + 0.9, 1.3);
  outer.holes.push(octShape(HW, HH, 1.0));
  const frameGeo = new THREE.ExtrudeGeometry(outer, { depth: 0.45, bevelEnabled: false });
  const frameMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.6 });
  bindColor(frameMat, 'color', '#0d1430', '#f6f8fd');
  bindNum(frameMat, 'metalness', 0.65, 0.15);
  // light strips around the inner opening
  const stripParts = [];
  const ins = 0.12;
  const sw = HW - ins, sh = HH - ins;
  const seg = (x1, y1, x2, y2) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const b = new THREE.BoxGeometry(len, 0.05, 0.05);
    b.rotateZ(Math.atan2(y2 - y1, x2 - x1));
    b.translate((x1 + x2) / 2, (y1 + y2) / 2, 0.47);
    stripParts.push(b);
  };
  const cc = 1.0;
  const pts = [[-sw + cc, -sh], [sw - cc, -sh], [sw, -sh + cc], [sw, sh - cc], [sw - cc, sh], [-sw + cc, sh], [-sw, sh - cc], [-sw, -sh + cc]];
  pts.forEach((p, i) => seg(...p, ...pts[(i + 1) % pts.length]));
  const stripGeo = mergeGeometries(stripParts);
  const stripMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  bindColor(stripMat, 'color', '#5b8cff', '#4f7dff');
  const frames = [];
  for (let i = 0; i < NF; i++) {
    const f = new THREE.Group();
    f.add(new THREE.Mesh(frameGeo, frameMat), new THREE.Mesh(stripGeo, stripMat));
    f.userData.base = NEAR_Z - i * SPACING;
    tun.add(f);
    frames.push(f);
  }

  // floor / ceiling / walls (scrolling textures)
  const mkSurface = (w, color, lines, rotX, rotY, x, y, metal) => {
    const tex = canvasTexture(gridCanvas(lines));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, LEN / SPACING);
    const mat = new THREE.MeshStandardMaterial({ emissiveMap: tex, emissive: '#ffffff', roughness: 0.25, metalness: metal });
    bindColor(mat, 'color', color[0], color[1]);
    bindColor(mat, 'emissive', lines, '#9bb4ff');
    bindNum(mat, 'emissiveIntensity', 0.55, 0.35);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, LEN), mat);
    m.rotation.set(rotX, rotY, 0, 'YXZ');
    m.position.set(x, y, NEAR_Z - LEN / 2);
    tun.add(m);
    return tex;
  };
  const texes = [
    mkSurface(HW * 2, ['#0a1230', '#eef3fd'], '#3d6bff', -Math.PI / 2, 0, 0, -HH, 0.8),
    mkSurface(HW * 2, ['#0a1230', '#f6f8fe'], '#2a4cd6', Math.PI / 2, 0, 0, HH, 0.4),
    mkSurface(HH * 2, ['#0b1434', '#f2f6fd'], '#2a4cd6', 0, Math.PI / 2, -HW, 0, 0.5),
    mkSurface(HH * 2, ['#0b1434', '#f2f6fd'], '#2a4cd6', 0, -Math.PI / 2, HW, 0, 0.5),
  ];
  // centre floor light line
  const lineMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  bindColor(lineMat, 'color', '#7da2ff', '#7d9bff');
  const floorLine = new THREE.Mesh(new THREE.PlaneGeometry(0.08, LEN), lineMat);
  floorLine.rotation.x = -Math.PI / 2;
  floorLine.position.set(0, -HH + 0.01, NEAR_Z - LEN / 2);
  tun.add(floorLine);

  // the destination: logo in a light portal
  const dest = new THREE.Group();
  tun.add(dest);
  const destLogo = makeLogo(1.1);
  destLogo.group.rotation.set(0.1, 0.5, 0);
  dest.add(destLogo.group);
  const destGlow = makeGlow(12, '#ffffff', '#ffffff', 0.9, 0.9);
  destGlow.position.z = -1;
  const destGlow2 = makeGlow(6, '#ffb545', '#ffd08a', 0.6, 0.5);
  destGlow2.position.z = -0.5;
  destGlow.material.fog = destGlow2.material.fog = false;
  dest.add(destGlow, destGlow2);

  // stage cards on alternate walls
  const cards = STAGE_ICONS.map((_, i) => {
    const tex = canvasTexture(document.createElement('canvas'));
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 2.0), mat);
    const side = i % 2 ? 1 : -1;
    m.position.set(side * (HW - 0.55), 0.1, CARD_Z0 - i * CARD_GAP);
    m.rotation.y = -side * 0.95;
    m.userData = { side, tex, z0: m.position.z };
    const g = makeGlow(3, '#3d6bff', '#7d9bff', 0.5, 0.3);
    g.position.copy(m.position);
    g.position.x -= side * 0.2;
    tun.add(g, m);
    m.userData.glow = g;
    return m;
  });

  const astro = makeAstronaut();
  astro.group.rotation.y = Math.PI;
  root.add(astro.group);

  // ----- DOM: stage meter + sr list ------------------------------------
  const meter = section.querySelector('#stageMeter');
  const srList = section.querySelector('#stageList');
  let lang = 'en', current = -1;
  function onLang(l) {
    lang = l;
    const names = t(l, 'process.stages');
    const word = t(l, 'process.stage');
    cards.forEach((m, i) => {
      m.userData.tex.image = cardCanvas(i, names[i], word);
      m.userData.tex.needsUpdate = true;
    });
    srList.innerHTML = names.map((n, i) => `<li>${n} — ${t(l, 'process.stageDesc')[i]}</li>`).join('');
    current = -1;
  }
  function setStage(i, p) {
    meter.style.setProperty('--p', p.toFixed(3));
    if (i === current) return;
    current = i;
    const names = t(lang, 'process.stages');
    const desc = t(lang, 'process.stageDesc');
    meter.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b><div><strong>${names[i]}</strong><span>${desc[i]}</span></div><div class="bar"><i></i></div>`;
  }

  // "How We Work": glide to the next stage
  section.querySelector('#howWeWork').addEventListener('click', () => {
    const r = section.getBoundingClientRect();
    const range = r.height - innerHeight;
    const next = Math.min(5, current + 1);
    const travel = -(CARD_Z0 - next * CARD_GAP) + 6;
    const p = Math.min(1, travel / TRAVEL);
    scrollTo({ top: scrollY + r.top + p * range, behavior: engine.reduced ? 'auto' : 'smooth' });
  });

  const view = { x: 0.16, y: -0.07 };
  const def = { id: 'process', section, scene, root, bg, update, layout, onLang, viewShift: view, bgStage: true };
  function layout(ctx) {
    const m = ctx.mode;
    view.x = m === 'mobile' ? 0 : m === 'tablet' ? 0.1 : 0.16;
    view.y = m === 'mobile' ? 0.12 : -0.07;
    const s = m === 'mobile' ? 0.95 : 1.15;
    astro.group.scale.setScalar(s);
    astro.group.position.set(m === 'mobile' ? 0 : -0.2 * ctx.dir, -HH, 3.2);
    tun.scale.set(m === 'mobile' ? 0.62 : 1, m === 'mobile' ? 1.1 : 1, 1);
  }

  let travelS = 0, walk = 0, lastTravel = 0;
  function update(ctx, st) {
    const target = st.sticky * TRAVEL;
    travelS = engine.reduced ? target : damp(travelS, target, 6, ctx.dt);
    const tr = travelS;
    for (const f of frames) {
      let z = f.userData.base + tr;
      z = NEAR_Z - ((((NEAR_Z - z) % LEN) + LEN) % LEN);
      f.position.z = z;
    }
    texes.forEach((tx) => (tx.offset.y = -tr / SPACING));
    dest.position.set(0, 0.2, -88 + tr * 0.55);
    destLogo.inner.rotation.y = ctx.time * 0.3;
    let best = 0;
    cards.forEach((m, i) => {
      const z = m.userData.z0 + tr;
      m.position.z = z;
      m.userData.glow.position.z = z;
      const hover = Math.sin(ctx.time * 1.2 + i) * 0.05;
      m.position.y = 0.1 + hover;
      if (z > -7) best = i; // the latest card to have reached the traveller
      // fade cards before they get huge beside the camera (keeps copy readable)
      const fade = 1 - smooth(4, 8.5, z);
      m.material.opacity = fade;
      m.userData.glow.material.opacity = 0.5 * fade;
      m.visible = fade > 0.01;
    });
    // active stage = the furthest card that has come close
    const zb = cards[best].userData.z0 + tr;
    const localP = smooth(-7, -7 + CARD_GAP, zb);
    setStage(best, (best + localP) / 6);
    // walking astronaut — stride follows scroll speed, idles otherwise
    const speed = Math.abs(tr - lastTravel) / Math.max(ctx.dt, 1e-3);
    lastTravel = tr;
    walk += ctx.dt * (1.5 + Math.min(speed, 20) * 0.5);
    const amt = Math.min(1, 0.25 + speed * 0.15);
    astro.pose(walk, engine.reduced ? 0 : amt);
    astro.group.position.y = -HH + Math.abs(Math.sin(walk)) * 0.03;
    root.rotation.y = ctx.pointer.x * -0.03;
  }

  return def;
}
