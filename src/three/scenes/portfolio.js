import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makeBackground, makeGlow, makeRocks, scatter, bindColor, bindNum, canvasTexture, damp, smooth, logoImage, makePlanet } from '../lib.js';
import { svg } from '../../icons.js';
import { t } from '../../i18n.js';

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

export function createPortfolio(engine, section) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  const bg = makeBackground({
    top: ['#030b20', '#eef4fe'],
    bottom: ['#040c26', '#d3e0f7'],
    glows: [
      { x: 0.62, y: 0.55, r: 0.4, i: 0.55, dark: '#1f44c8', light: '#ffffff' },
      { x: 0.62, y: 0.82, r: 0.2, i: 0.5, dark: '#3d6bff', light: '#cfdcfa' },
    ],
    nebula: 0.55,
  });
  scene.add(bg);
  const hemi = new THREE.HemisphereLight();
  bindColor(hemi, 'color', '#7d9bff', '#ffffff');
  bindColor(hemi, 'groundColor', '#060a1c', '#c5d4f1');
  bindNum(hemi, 'intensity', 0.68, 1.08);
  const key = new THREE.DirectionalLight('#ffffff', 2);
  key.position.set(-3, 6, 7);
  bindNum(key, 'intensity', 1.3, 1.5);
  const under = new THREE.PointLight('#3d6bff', 50, 12, 1.4);
  under.position.set(0, -1, 3);
  bindNum(under, 'intensity', 50, 15);
  scene.add(hemi, key, under);
  bindNum(scene, 'environmentIntensity', 0.4, 0.63);

  const vis = new THREE.Group();
  root.add(vis);

  // platform
  const platMat = new THREE.MeshPhysicalMaterial({ roughness: 0.15, metalness: 0.5, clearcoat: 1 });
  bindColor(platMat, 'color', '#0b1433', '#f3f6fd');
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 4.1, 0.32, 96), platMat);
  plat.position.y = -0.2;
  vis.add(plat);
  const edgeMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  bindColor(edgeMat, 'color', '#6d90ff', '#5a7dff');
  const edge = new THREE.Mesh(new THREE.TorusGeometry(3.95, 0.03, 8, 160), edgeMat);
  edge.rotation.x = Math.PI / 2;
  edge.position.y = -0.04;
  const edge2 = edge.clone();
  edge2.scale.setScalar(0.78);
  edge2.position.y = -0.03;
  vis.add(edge, edge2);
  const platGlow = makeGlow(11, '#3d6bff', '#a9c0ff', 0.55, 0.4);
  platGlow.position.set(0, -0.6, 0);
  platGlow.scale.y = 3;
  vis.add(platGlow);

  // ring of devices
  const ring = new THREE.Group();
  vis.add(ring);
  const devices = TYPES.map((type) => {
    const d = device(type);
    ring.add(d);
    return d;
  });

  const rocks = makeRocks([...scatter(16, 41, (r) => ({ p: [(r() - 0.5) * 24, -4.4 - r() * 1.2, -2 + r() * 3], s: 0.3 + r() * r() * 1.2 })), { p: [-9.5, -2.6, 0], s: 1.4 }, { p: [9.2, 3.4, -3], s: 0.4 }], 19);
  root.add(rocks);
  const moon = makePlanet(0.45, { seed: 14, colors: { a: ['#0c1d55', '#d3def4'], b: ['#3d6bff', '#ffffff'], rim: ['#6d90ff', '#bcd3ff'] }, seg: 40 });
  root.add(moon);

  // ----- carousel DOM --------------------------------------------------
  const track = section.querySelector('#carouselTrack');
  const arrows = section.querySelectorAll('.carousel__arrow');
  arrows.forEach((a) => (a.innerHTML = svg('arrow')));
  track.innerHTML = TYPES.map((_, i) => `<button role="tab" type="button" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"><img alt="" /></button>`).join('');
  const thumbs = [...track.children];
  let active = 0;
  const rot = { v: 0, target: 0 };
  function select(i, focus = false) {
    const n = TYPES.length;
    const next = ((i % n) + n) % n;
    // shortest path around the ring
    let delta = next - active;
    if (delta > n / 2) delta -= n;
    if (delta < -n / 2) delta += n;
    rot.target += delta;
    active = next;
    thumbs.forEach((b, j) => {
      b.setAttribute('aria-selected', String(j === active));
      b.tabIndex = j === active ? 0 : -1;
    });
    if (focus) thumbs[active].focus();
  }
  thumbs.forEach((b, i) => b.addEventListener('click', () => select(i)));
  arrows.forEach((a) => a.addEventListener('click', () => select(active + Number(a.dataset.dir) * engine.ctx.dir)));
  track.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (d) {
      e.preventDefault();
      select(active + d * engine.ctx.dir, true);
    }
  });
  // swipe / drag
  const stage = section.querySelector('.stage');
  let dragX = null;
  stage.style.touchAction = 'pan-y';
  stage.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('button, a')) dragX = e.clientX;
  });
  addEventListener('pointerup', (e) => {
    if (dragX == null) return;
    const dx = e.clientX - dragX;
    dragX = null;
    if (Math.abs(dx) > 40) select(active + (dx < 0 ? 1 : -1) * engine.ctx.dir);
  });

  function onLang(lang) {
    const titles = t(lang, 'portfolio.screens');
    const cta = t(lang, 'portfolio.screenCta');
    const rtl = lang === 'ar';
    const el = section.querySelector('#carousel');
    el.setAttribute('aria-label', t(lang, 'portfolio.eyebrow'));
    arrows[0].setAttribute('aria-label', t(lang, 'a11y.prev'));
    arrows[1].setAttribute('aria-label', t(lang, 'a11y.next'));
    devices.forEach((d, i) => {
      const canvas = drawScreen(i, TYPES[i], titles[i], cta, rtl);
      const old = d.userData.screenMat.map;
      d.userData.screenMat.map = canvasTexture(canvas);
      d.userData.screenMat.needsUpdate = true;
      old?.dispose();
      const thumb = document.createElement('canvas');
      thumb.width = 192;
      thumb.height = 120;
      const tg = thumb.getContext('2d');
      const s = Math.max(192 / canvas.width, 120 / canvas.height);
      tg.drawImage(canvas, (192 - canvas.width * s) / 2, (120 - canvas.height * s) / 2, canvas.width * s, canvas.height * s);
      const im = thumbs[i].querySelector('img');
      im.src = thumb.toDataURL('image/jpeg', 0.8);
      thumbs[i].setAttribute('aria-label', titles[i]);
    });
  }
  // redraw once the logo bitmap is ready
  logoImage().addEventListener('load', () => onLang(engine.ctx.lang), { once: true });

  let base = { x: 0, y: 0, s: 1 };
  function layout(ctx) {
    const m = ctx.mode;
    const [x, y] = engine.frac(m === 'mobile' ? 0.5 : m === 'tablet' ? 0.55 : 0.635, m === 'mobile' ? 0.66 : m === 'tablet' ? 0.6 : 0.53);
    base = { x, y, s: m === 'mobile' ? Math.min(0.55, ctx.viewW / 9) : m === 'tablet' ? 0.85 : 1.22 };
    vis.position.set(x, y - 0.6 * base.s, 0);
    vis.scale.setScalar(base.s);
    const [mx, my] = engine.frac(0.94, 0.12);
    moon.position.set(mx, my, -3);
    rocks.scale.x = ctx.dir;
  }

  const RX = 3.3, RZ = 2.0;
  function update(ctx, st) {
    const tm = ctx.time;
    rot.v = engine.reduced ? rot.target : damp(rot.v, rot.target, 5, ctx.dt);
    const enter = smooth(0, 1, st.enter);
    devices.forEach((d, i) => {
      const a = ((i - rot.v) / TYPES.length) * Math.PI * 2;
      const front = Math.cos(a); // 1 = front
      d.position.set(Math.sin(a) * RX * ctx.dir, 0.05 + Math.sin(tm * 0.9 + i * 1.3) * 0.06 + (1 - enter) * (2 + i * 0.3), Math.cos(a) * RZ);
      d.rotation.y = Math.sin(a) * 0.55 * ctx.dir;
      const sc = 0.62 + 0.38 * ((front + 1) / 2);
      d.scale.setScalar(sc * (d.userData.type === 'laptop' ? 0.95 : 1));
    });
    vis.rotation.x = 0.1 + ctx.pointer.y * 0.04;
    vis.rotation.y = ctx.pointer.x * 0.12;
    vis.position.y = base.y - 0.6 * base.s + Math.sin(tm * 0.5) * 0.05;
  }

  return { id: 'portfolio', section, scene, root, bg, update, layout, onLang };
}
