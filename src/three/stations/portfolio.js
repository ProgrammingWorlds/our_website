import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makeGlow, makeRocks, makePlanet, scatter, bindColor, bindNum, canvasTexture, damp, smooth, logoImage } from '../lib.js';
import { t } from '../../i18n.js';
import { CHAPTERS, stepF } from '../../story.js';

const TYPES = ['laptop', 'tablet', 'phone', 'laptop', 'phone', 'tablet'];
const SIZE = { laptop: [1024, 630], tablet: [600, 820], phone: [420, 880] };

/* ---------------------------------------------------------------- screens */
function drawScreen(kind, type, title, cta, rtl) {
  const [W, H] = SIZE[type];
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, '#071a52');
  grd.addColorStop(0.6, '#0b2a8a');
  grd.addColorStop(1, '#1a46e0');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  // stars
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(255,255,255,${0.2 + ((i * 37) % 60) / 100})`;
    g.fillRect((i * 151) % W, (i * 89) % H, 1.6, 1.6);
  }
  const u = Math.min(W, H) / 420;
  const font = (w, s) => `${w} ${s * u}px ${rtl ? '"IBM Plex Sans Arabic",' : ''} Sora, sans-serif`;
  g.direction = rtl ? 'rtl' : 'ltr';
  // top bar
  const img = logoImage();
  const pad = 22 * u;
  if (img.complete && img.naturalWidth) g.drawImage(img, rtl ? W - pad - 26 * u : pad, pad, 26 * u, 26 * u);
  g.fillStyle = '#fff';
  g.textAlign = rtl ? 'right' : 'left';
  g.font = font(600, 11);
  g.fillText('Programming Worlds', rtl ? W - pad - 34 * u : pad + 34 * u, pad + 18 * u);
  if (type === 'laptop') {
    g.globalAlpha = 0.5;
    for (let i = 0; i < 4; i++) g.fillRect(rtl ? pad + i * 56 * u : W - pad - (i + 1) * 56 * u, pad + 10 * u, 38 * u, 4 * u);
    g.globalAlpha = 1;
  }
  // visual
  const portrait = H > W;
  const vx = portrait ? W / 2 : rtl ? W * 0.3 : W * 0.7;
  const vy = portrait ? H * 0.3 : H * 0.52;
  const vr = portrait ? W * 0.3 : H * 0.3;
  const planet = g.createRadialGradient(vx - vr * 0.3, vy - vr * 0.3, vr * 0.1, vx, vy, vr);
  planet.addColorStop(0, '#7aa0ff');
  planet.addColorStop(0.6, '#2f52ff');
  planet.addColorStop(1, '#0a1a6a');
  const box = (x, y, w, h, r, fill) => {
    g.fillStyle = fill;
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.fill();
  };
  if (kind === 0 || kind === 3) {
    g.fillStyle = planet;
    g.beginPath();
    g.arc(vx, vy, vr, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,181,69,0.8)';
    g.lineWidth = 2 * u;
    g.beginPath();
    g.ellipse(vx, vy, vr * 1.5, vr * 0.35, -0.3, 0, Math.PI * 2);
    g.stroke();
    if (kind === 0) box(vx + vr * 0.1, vy - vr * 0.75, vr * 0.5, vr * 0.5, 4 * u, '#ffb545');
    else for (let i = 0; i < 3; i++) box(vx - vr * 0.9 + i * vr * 0.65, vy + vr * 1.05, vr * 0.55, vr * 0.35, 6 * u, 'rgba(255,255,255,0.18)');
  } else if (kind === 1) {
    const x0 = vx - vr * 1.2, y0 = vy + vr * 0.9;
    box(x0 - 10 * u, vy - vr * 1.1, vr * 2.6, vr * 2.2, 10 * u, 'rgba(255,255,255,0.08)');
    for (let i = 0; i < 7; i++) {
      const h = vr * (0.4 + ((i * 47) % 10) / 9);
      box(x0 + i * vr * 0.33, y0 - h, vr * 0.2, h, 3 * u, i === 4 ? '#ffb545' : '#5d86ff');
    }
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2 * u;
    g.beginPath();
    for (let i = 0; i < 8; i++) g.lineTo(x0 + i * vr * 0.32, vy - vr * 0.2 - Math.sin(i * 1.3) * vr * 0.3);
    g.stroke();
  } else if (kind === 2 || kind === 4) {
    const pw = vr * 1.1, ph = vr * 2;
    box(vx - pw / 2, vy - ph / 2, pw, ph, 14 * u, 'rgba(255,255,255,0.12)');
    for (let i = 0; i < 4; i++) box(vx - pw / 2 + 10 * u, vy - ph / 2 + 18 * u + i * ph * 0.22, pw - 20 * u, ph * 0.16, 6 * u, i === 0 ? '#ffb545' : 'rgba(255,255,255,0.22)');
    if (kind === 4) {
      g.strokeStyle = '#fff';
      g.lineWidth = 2.5 * u;
      for (let k = 1; k <= 3; k++) {
        g.beginPath();
        g.arc(vx + pw * 0.9, vy, k * 12 * u, -0.8, 0.8);
        g.stroke();
      }
    }
  } else {
    for (let i = 0; i < 3; i++) {
      box(vx - vr * 1.3, vy - vr + i * vr * 0.72, vr * 2.6, vr * 0.6, 8 * u, 'rgba(255,255,255,0.12)');
      box(vx - vr * 1.2, vy - vr + i * vr * 0.72 + vr * 0.38, vr * 2.4 * (0.4 + i * 0.25), 5 * u, 3 * u, '#ffb545');
    }
  }
  // headline
  g.fillStyle = '#fff';
  const words = title.split(' ');
  const mid = Math.ceil(words.length / 2);
  const lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  const tx = portrait ? (rtl ? W - pad : pad) : rtl ? W - pad * 2 : pad * 2;
  const ty = portrait ? H * 0.62 : H * 0.38;
  g.font = font(700, portrait ? 26 : 30);
  lines.forEach((l, i) => g.fillText(l, tx, ty + i * (portrait ? 32 : 38) * u));
  g.globalAlpha = 0.7;
  g.font = font(400, 11);
  g.fillText(rtl ? 'حلول رقمية مبتكرة' : 'Creative digital solutions', tx, ty + (portrait ? 82 : 96) * u);
  g.globalAlpha = 1;
  const bw = 92 * u, bh = 28 * u, bx = rtl ? tx - bw : tx, by = ty + (portrait ? 102 : 118) * u;
  box(bx, by, bw, bh, 6 * u, '#ffb545');
  g.fillStyle = '#2a1800';
  g.font = font(600, 11);
  g.textAlign = 'center';
  g.fillText(cta, bx + bw / 2, by + bh * 0.66);
  return c;
}

/* ---------------------------------------------------------------- devices */
const bodyMat = new THREE.MeshPhysicalMaterial({ color: '#0d1226', roughness: 0.3, metalness: 0.7, clearcoat: 0.6 });
function device(type) {
  const g = new THREE.Group();
  const screenMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  let w, h;
  if (type === 'laptop') {
    w = 3.1; h = 1.92;
    const lid = new THREE.Group();
    lid.add(new THREE.Mesh(new RoundedBoxGeometry(w + 0.16, h + 0.16, 0.07, 3, 0.04), bodyMat));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat);
    scr.position.z = 0.04;
    lid.add(scr);
    lid.position.y = h / 2 + 0.08;
    const hinge = new THREE.Group();
    hinge.add(lid);
    hinge.rotation.x = -0.12;
    g.add(hinge);
    const base = new THREE.Mesh(new RoundedBoxGeometry(w + 0.3, 0.08, 2.0, 3, 0.04), bodyMat);
    base.position.set(0, 0, 1.0);
    g.add(base);
    g.position.y = 0;
  } else {
    [w, h] = type === 'tablet' ? [1.55, 2.12] : [0.84, 1.78];
    const body = new THREE.Mesh(new RoundedBoxGeometry(w + 0.12, h + 0.12, 0.08, 4, type === 'phone' ? 0.06 : 0.05), bodyMat);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat);
    scr.position.z = 0.045;
    const holder = new THREE.Group();
    holder.add(body, scr);
    holder.position.y = h / 2 + 0.06;
    holder.rotation.x = -0.06;
    g.add(holder);
  }
  g.userData = { screenMat, type };
  return g;
}

const Z = -340;
const CH = CHAPTERS[4];
const RX = 3.4, RZ = 2.1;

// Station 05 — a turntable of devices. Each scroll step turns the ring to
// bring the next capability showcase to the front.
export function createPortfolio(world, { onThumbs } = {}) {
  const group = new THREE.Group();
  group.position.z = Z;
  const vis = new THREE.Group();
  vis.scale.setScalar(1.25);
  vis.position.y = -0.9;
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
  const spot = new THREE.PointLight('#5d86ff', 45, 14, 1.4);
  spot.position.set(0, 1, 4);
  bindNum(spot, 'intensity', 45, 14);
  vis.add(spot);

  const ring = new THREE.Group();
  vis.add(ring);
  const devices = TYPES.map((type) => {
    const d = device(type);
    ring.add(d);
    return d;
  });

  const rocks = makeRocks([...scatter(12, 41, (r) => ({ p: [(r() - 0.5) * 30, -4.5 - r() * 2, (r() - 0.5) * 14], s: 0.25 + r() * r() * 1.1 })), ...scatter(5, 42, (r) => ({ p: [(r() - 0.5) * 30, (r() - 0.2) * 12, -6 - r() * 10], s: 0.06 + r() * 0.2 }))], 19);
  group.add(rocks);
  const moon = makePlanet(0.6, { seed: 14, colors: { a: ['#0c1d55', '#d3def4'], b: ['#3d6bff', '#ffffff'], rim: ['#6d90ff', '#bcd3ff'] }, seg: 40 });
  moon.position.set(9, 4.5, -6);
  group.add(moon);

  function onLang(lang) {
    const titles = t(lang, 'portfolio.screens');
    const cta = t(lang, 'portfolio.screenCta');
    const rtl = lang === 'ar';
    const thumbs = devices.map((d, i) => {
      const canvas = drawScreen(i, TYPES[i], titles[i], cta, rtl);
      const old = d.userData.screenMat.map;
      d.userData.screenMat.map = canvasTexture(canvas);
      d.userData.screenMat.needsUpdate = true;
      old?.dispose();
      const th = document.createElement('canvas');
      th.width = 192;
      th.height = 120;
      const s = Math.max(192 / canvas.width, 120 / canvas.height);
      th.getContext('2d').drawImage(canvas, (192 - canvas.width * s) / 2, (120 - canvas.height * s) / 2, canvas.width * s, canvas.height * s);
      return th.toDataURL('image/jpeg', 0.8);
    });
    onThumbs?.(thumbs);
  }
  // redraw once the logo bitmap is ready
  logoImage().addEventListener('load', () => onLang(world.ctx.lang), { once: true });

  const rot = { v: 0 };
  function update(ctx, local) {
    const tm = ctx.time;
    rot.v = world.reduced ? stepF(CH, local) : damp(rot.v, stepF(CH, local), 5, ctx.dt);
    const enter = smooth(0, 0.14, local);
    devices.forEach((d, i) => {
      const a = ((i - rot.v) / TYPES.length) * Math.PI * 2;
      const front = (Math.cos(a) + 1) / 2;
      d.position.set(Math.sin(a) * RX * ctx.dir, 0.05 + Math.sin(tm * 0.9 + i * 1.3) * 0.06 + (1 - enter) * (2.5 + i * 0.4), Math.cos(a) * RZ);
      d.rotation.y = Math.sin(a) * 0.55 * ctx.dir;
      d.scale.setScalar((0.6 + 0.4 * front) * (d.userData.type === 'laptop' ? 0.95 : 1));
    });
    edges.forEach((e, i) => (e.rotation.z = tm * (i % 2 ? -0.1 : 0.06)));
    vis.rotation.x = 0.06;
    vis.position.y = -0.9 + Math.sin(tm * 0.5) * 0.05;
    moon.rotation.y = tm * 0.1;
  }

  return {
    id: 'portfolio',
    group,
    update,
    onLang,
    keys: [
      { at: 0, pos: [0, 6, Z + 30], look: [0, 0, Z], f: 0.3 },
      { at: 0.14, pos: [0, 3.2, Z + 14.5], look: [0, 0.2, Z], f: 1 },
      { at: 0.86, pos: [0.7, 2.8, Z + 14], look: [0, 0.2, Z], f: 1 },
    ],
  };
}
