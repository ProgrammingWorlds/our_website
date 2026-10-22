import * as THREE from 'three';
import { NOISE, makeBackground, makeLogo, makeGlow, makePlanet, makeAstronaut, makeRocks, makePoints, scatter, bindColor, bindNum, themeBlend, smooth, GLOBAL, col } from '../lib.js';

export function createContact(engine, section) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  const bg = makeBackground({
    top: ['#030b20', '#eef4fe'],
    bottom: ['#04102e', '#d0def6'],
    glows: [
      { x: 0.65, y: 0.4, r: 0.3, i: 0.4, dark: '#ff8a2a', light: '#ffd9a8', il: 0.4 },
      { x: 0.65, y: 0.4, r: 0.55, i: 0.35, dark: '#1d3fb8', light: '#ffffff' },
      { x: 0.65, y: 0.85, r: 0.3, i: 0.4, dark: '#ff9a3c', light: '#ffe6c4', il: 0.3 },
    ],
    nebula: 0.55,
  });
  scene.add(bg);
  const hemi = new THREE.HemisphereLight();
  bindColor(hemi, 'color', '#6d8cff', '#ffffff');
  bindColor(hemi, 'groundColor', '#060a1c', '#c5d4f1');
  bindNum(hemi, 'intensity', 0.52, 0.96);
  const portalLight = new THREE.PointLight('#ffa040', 120, 30, 1.3);
  bindNum(portalLight, 'intensity', 22, 10);
  scene.add(hemi, portalLight);
  bindNum(scene, 'environmentIntensity', 0.2, 0.56);

  const portal = new THREE.Group();
  root.add(portal);
  // energy disc
  const discMat = themeBlend(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: GLOBAL.uTime, uTheme: GLOBAL.uTheme },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `varying vec2 vUv; uniform float uTime, uTheme;
        void main(){ vec2 p = vUv*2.0-1.0; float r = length(p); float a = atan(p.y,p.x);
          float swirl = pow(0.5+0.5*sin(a*5.0 + r*16.0 - uTime*2.0), 3.0);
          float ring = smoothstep(1.0, 0.9, r) * smoothstep(0.7, 0.97, r);
          float core = pow(smoothstep(0.75, 0.0, r), 2.5);
          float mid = smoothstep(0.15, 0.6, r) * smoothstep(1.0, 0.6, r);
          vec3 warm = vec3(1.0, 0.6, 0.2), cool = vec3(0.25, 0.42, 1.0), white = vec3(1.0, 0.96, 0.88);
          vec3 c = warm*ring*1.5 + mix(cool, warm, r)*swirl*mid*0.55 + white*core*1.1;
          float alpha = clamp(ring*0.9 + swirl*mid*0.35 + core, 0.0, 1.0) * smoothstep(1.0, 0.96, r);
          gl_FragColor = vec4(c, alpha * mix(0.75, 0.85, uTheme));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  const disc = new THREE.Mesh(new THREE.CircleGeometry(3, 96), discMat);
  portal.add(disc);
  const ringMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  bindColor(ringMat, 'color', '#ffb04a', '#ff9f2a');
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.07, 16, 200), ringMat);
  portal.add(ring);
  const arcs = [3.45, 3.85, 4.3].map((r, i) => {
    const m = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true });
    bindColor(m, 'color', i === 1 ? '#5d86ff' : '#ffb545', i === 1 ? '#315cff' : '#ffa53a');
    bindNum(m, 'opacity', 0.75 - i * 0.18, 0.8 - i * 0.18);
    const a = new THREE.Mesh(new THREE.TorusGeometry(r, 0.018 + (i === 0 ? 0.01 : 0), 8, 160, Math.PI * (1.1 + i * 0.25)), m);
    portal.add(a);
    return a;
  });
  const halo = makeGlow(13, '#ff9a3c', '#ffcf8a', 0.4, 0.5);
  halo.position.z = -0.5;
  const halo2 = makeGlow(5, '#ffd9a8', '#ffffff', 0.35, 0.4);
  halo2.position.z = -0.2;
  portal.add(halo, halo2);
  const logo = makeLogo(1.05);
  logo.group.position.z = 0.6;
  logo.group.rotation.set(-0.04, 0.16, 0);
  portal.add(logo.group);
  // swirling particles
  const pos = [], cols = [], sizes = [];
  const cA = col('#ffb545'), cB = col('#7d9bff');
  scatter(700, 71, (r) => {
    const a = r() * Math.PI * 2, rr = 3 + r() * r() * 3.5;
    pos.push(Math.cos(a) * rr, Math.sin(a) * rr, (r() - 0.5) * 0.8);
    const c = r() > 0.4 ? cA : cB;
    cols.push(c.r, c.g, c.b);
    sizes.push(0.02 + r() * 0.05);
  });
  const swirl = makePoints(pos, cols, sizes, { opacity: 0.9, lightOpacity: 0.6 });
  portal.add(swirl);

  // reflective ice / water
  const wU = { uTime: GLOBAL.uTime, uPortal: { value: new THREE.Vector2() }, uDir: { value: 1 } };
  bindColor((wU.uDeep = { value: null }), 'value', '#030a22', '#dfe8f8');
  bindColor((wU.uNear = { value: null }), 'value', '#0a1d4f', '#f6f9ff');
  bindColor((wU.uGlow = { value: null }), 'value', '#ff9a3c', '#ffb866');
  bindColor((wU.uBlue = { value: null }), 'value', '#3d6bff', '#8fb0ff');
  const waterMat = new THREE.ShaderMaterial({
    uniforms: wU,
    vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */ `uniform vec3 uDeep, uNear, uGlow, uBlue; uniform vec2 uPortal; uniform float uTime; varying vec3 vW;
      ${NOISE}
      void main(){
        float depth = smoothstep(-6.0, 8.0, vW.z);
        vec3 col = mix(uDeep, uNear, depth);
        float rip = fbm(vec3(vW.x*0.8, vW.z*3.0 - uTime*0.4, uTime*0.1));
        float dx = vW.x - uPortal.x;
        float w = uPortal.y * (0.35 + depth*0.9);
        float streak = exp(-dx*dx/(w*w)) * (0.55 + 0.6*rip);
        float shimmer = smoothstep(0.55, 0.8, rip) * exp(-dx*dx/(w*w*6.0));
        col += uGlow * (streak*0.9 + shimmer*0.6);
        col += uBlue * exp(-dx*dx/(w*w*18.0)) * 0.12;
        col += vec3(1.0) * smoothstep(0.72, 0.8, rip) * 0.05;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), waterMat);
  water.rotation.x = -Math.PI / 2;
  root.add(water);
  const streak = makeGlow(1, '#ff9a3c', '#ffbf6a', 0.45, 0.4);
  streak.scale.set(2.4, 9, 1);
  root.add(streak);
  const streak2 = makeGlow(1, '#ffffff', '#ffffff', 0.4, 0.3);
  streak2.scale.set(0.8, 6, 1);
  root.add(streak2);

  const moon = makePlanet(0.95, { seed: 81, crater: 1, colors: { a: ['#1d2238', '#d9e1f2'], b: ['#5a6390', '#ffffff'], rim: ['#9ab3ff', '#c2d6ff'] }, light: [-0.4, 0.6, 0.7], seg: 64 });
  root.add(moon);

  const a1 = makeAstronaut();
  const a2 = makeAstronaut();
  root.add(a1.group, a2.group);
  a1.armR.pivot.rotation.z = 1.0; // reaching toward the portal

  const rocks = makeRocks(
    [
      ...scatter(18, 91, (r) => ({ p: [(r() < 0.5 ? -1 : 1) * (6 + r() * 6), -0.1, -3 + r() * 6], s: [0.5 + r() * 1.4, 0.4 + r() * 1.2, 0.5 + r() * 1.2] })),
      { p: [-3.6, -0.2, 2.4], s: [1.3, 0.4, 0.9] }, { p: [4.8, -0.2, 2], s: [1, 0.35, 0.8] },
      { p: [-6.2, 0.2, 4.5], s: [2.6, 1.4, 1.6] }, { p: [-4.4, -0.3, 1.4], s: [1.6, 0.9, 1.1] }, { p: [7.5, 0.4, 3.5], s: [2.2, 1.6, 1.4] },
      ...scatter(10, 93, (r) => ({ p: [-8 + r() * 4, 0.6 + r() * 1.6, -2 - r() * 3], s: [0.8 + r(), 1.2 + r() * 2, 0.8 + r()] })),
    ],
    29,
  );
  root.add(rocks);

  let base = { x: 0, y: 0, s: 1, ground: -3 };
  function layout(ctx) {
    const m = ctx.mode;
    const [x, y] = engine.frac(m === 'mobile' ? 0.5 : m === 'tablet' ? 0.62 : 0.655, m === 'mobile' ? 0.62 : 0.4);
    const s = m === 'mobile' ? Math.min(0.55, ctx.viewW / 9) : m === 'tablet' ? 0.75 : 0.92;
    base = { x, y, s, ground: m === 'mobile' ? -3.6 : -2.6 };
    portal.position.set(x, y, -1);
    portal.scale.setScalar(s);
    portalLight.position.set(x, y, 1.5);
    water.position.set(0, base.ground, 0);
    rocks.position.y = base.ground;
    rocks.scale.x = ctx.dir;
    wU.uPortal.value.set(x, 1.6 * s);
    streak.position.set(x, base.ground + 0.05, 1);
    streak2.position.set(x, base.ground + 0.05, 1.2);
    const [ax] = engine.frac(m === 'mobile' ? 0.22 : 0.27, 0);
    a1.group.position.set(ax, base.ground, 1.6);
    a1.group.rotation.y = 0.9 * ctx.dir;
    a1.group.scale.setScalar(m === 'mobile' ? 0.8 : 1.15);
    const [bx] = engine.frac(m === 'mobile' ? 0.82 : 0.86, 0);
    a2.group.position.set(bx, base.ground, -1);
    a2.group.rotation.y = -0.7 * ctx.dir;
    a2.group.scale.setScalar(m === 'mobile' ? 0.55 : 0.75);
    const [mx, my] = engine.frac(m === 'mobile' ? 0.84 : 0.43, m === 'mobile' ? 0.42 : 0.15);
    moon.position.set(mx, my, -3);
    moon.scale.setScalar(m === 'mobile' ? 0.55 : 0.6);
  }

  function update(ctx, st) {
    const tm = ctx.time;
    const enter = smooth(0, 1, st.enter);
    // the portal opens as the section arrives
    const open = engine.reduced ? 1 : 0.35 + 0.65 * enter;
    portal.scale.setScalar(base.s * open);
    ring.rotation.z = tm * 0.1;
    arcs.forEach((a, i) => (a.rotation.z = tm * (0.15 + i * 0.08) * (i % 2 ? -1 : 1)));
    swirl.rotation.z = -tm * 0.15;
    logo.inner.rotation.y = Math.sin(tm * 0.4) * 0.4 + ctx.pointer.x * 0.3;
    logo.setGap(0.04 + Math.sin(tm * 1.2) * 0.02);
    halo.material.rotation = tm * 0.05;
    const breathe = 1 + Math.sin(tm * 1.5) * 0.04;
    halo.scale.setScalar(13 * breathe);
    a1.pose(0, 0);
    a1.armR.pivot.rotation.x = -0.6 - Math.sin(tm * 0.8) * 0.08;
    a2.pose(0, 0);
    a1.group.position.y = base.ground + Math.sin(tm * 0.7) * 0.01;
  }

  return { id: 'contact', section, scene, root, bg, update, layout };
}
