import * as THREE from 'three';
import { makeAstronaut, makeOrbit, makeGlow, makeRocks, makePlanet, scatter, bindColor, bindNum, themeBlend, smooth, NOISE, GLOBAL } from '../lib.js';

const Z = -505;
const RING = 3.8;
const GROUND = -3.4;

// Station 07 — the portal. It opens as you arrive; the journey ends looking
// into it, where the next project begins.
export function createContact(world) {
  const group = new THREE.Group();
  const portal = new THREE.Group();
  portal.position.set(0, 0.6, Z);
  group.add(portal);

  const ringMat = new THREE.MeshStandardMaterial({ color: '#ffb545', roughness: 0.3, metalness: 0.6, emissive: '#ff9a2e' });
  bindNum(ringMat, 'emissiveIntensity', 0.9, 0.6);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(RING, 0.14, 24, 200), ringMat);
  portal.add(ring);
  const thinMat = themeBlend(new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, toneMapped: false, depthWrite: false }));
  bindColor(thinMat, 'color', '#ffcf8a', '#ff9a2e');
  bindNum(thinMat, 'opacity', 0.7, 0.8);
  const thins = [1.12, 1.26, 1.45].map((s) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(RING * s, 0.02, 6, 200), thinMat);
    portal.add(m);
    return m;
  });

  // swirling event horizon
  const du = { uTime: GLOBAL.uTime, uTheme: GLOBAL.uTheme, uOpen: { value: 0 } };
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(RING, 128),
    themeBlend(
      new THREE.ShaderMaterial({
        uniforms: du,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime, uTheme, uOpen; varying vec2 vUv;
          ${NOISE}
          void main(){
            vec2 p = vUv*2.0 - 1.0;
            float r = length(p), a = atan(p.y, p.x);
            float sw = a + r*4.0 - uTime*0.9;
            float n = fbm(vec3(cos(sw)*r*2.0, sin(sw)*r*2.0, uTime*0.15));
            float core = smoothstep(0.55, 0.0, r);
            float rim = smoothstep(0.6, 1.0, r) * (1.0 - smoothstep(0.96, 1.0, r));
            vec3 gold = vec3(1.0, 0.68, 0.27), blue = vec3(0.16, 0.3, 1.0), white = vec3(1.0, 0.92, 0.8);
            // a deep tunnel: dark blue centre, gold spiral arms toward the rim, a bright pin of light far inside
            float arms = smoothstep(0.45, 0.8, n) * smoothstep(0.1, 0.7, r);
            vec3 col = mix(blue*0.6, gold, arms);
            col += white * smoothstep(0.12, 0.0, r) * 0.9;
            float alpha = (0.18 + arms*0.75 + rim*0.6 + smoothstep(0.15, 0.0, r)) * uOpen * (1.0 - smoothstep(0.97, 1.0, r));
            gl_FragColor = vec4(col*mix(1.0, 0.85, uTheme), clamp(alpha, 0.0, 1.0));
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    ),
  );
  portal.add(disc);
  const flare = makeGlow(14, '#ffb545', '#ffcf8a', 0.3, 0.3);
  flare.position.z = -0.5;
  portal.add(flare);
  const swirl = makeOrbit(RING * 1.6, RING * 1.6, { count: 800, spread: 0.3, size: 0.04, thick: 0.6, colorA: '#ffb545', colorB: '#ff8a3d', mix: 0.4, line: false });
  swirl.rotation.x = Math.PI / 2;
  portal.add(swirl);
  const light = new THREE.PointLight('#ffb545', 40, 40, 1.3);
  light.position.set(0, 0, 3);
  bindNum(light, 'intensity', 40, 14);
  portal.add(light);

  // reflective ground with a streak of portal light
  const gu = { uTime: GLOBAL.uTime, uTheme: GLOBAL.uTheme, uOpen: du.uOpen };
  bindColor((gu.uBase = { value: null }), 'value', '#05081a', '#e9eefb');
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 80),
    new THREE.ShaderMaterial({
      uniforms: gu,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uTheme, uOpen; uniform vec3 uBase; varying vec3 vW;
        ${NOISE}
        void main(){
          vec2 q = vW.xz - vec2(0.0, ${Z.toFixed(1)});
          float ripple = fbm(vec3(q.x*0.6, q.y*1.6 - uTime*0.6, uTime*0.1));
          float streak = exp(-q.x*q.x/(1.5 + max(q.y, 0.0)*0.25)) * smoothstep(40.0, 0.0, q.y) * step(-1.0, q.y);
          vec3 glow = vec3(1.0, 0.62, 0.25) * streak * (0.15 + ripple*0.6) * uOpen;
          float fade = smoothstep(60.0, 10.0, length(q));
          vec3 col = uBase + glow*mix(1.2, 0.8, uTheme);
          gl_FragColor = vec4(col, fade);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, GROUND, Z + 20);
  group.add(ground);

  const astro = makeAstronaut();
  astro.group.position.set(-6.2, GROUND + 0.55, Z + 3);
  astro.group.rotation.y = 0.7;
  group.add(astro.group);
  const astro2 = makeAstronaut();
  astro2.group.position.set(6.8, GROUND + 0.35, Z - 1);
  astro2.group.rotation.y = -0.9;
  astro2.group.scale.setScalar(0.85);
  group.add(astro2.group);
  const rocks = makeRocks(
    [
      { p: [-6.2, GROUND + 0.1, Z + 3], s: [1.6, 0.6, 1.4] },
      { p: [6.8, GROUND, Z - 1], s: [1.3, 0.5, 1.1] },
      ...scatter(8, 71, (r) => ({ p: [(r() < 0.5 ? -1 : 1) * (7 + r() * 12), GROUND + 0.2, Z - r() * 14 + 6], s: 0.4 + r() * r() * 1.4 })),
    ],
    29,
  );
  group.add(rocks);
  const moon = makePlanet(1.4, { seed: 41, crater: 1, seg: 48, colors: { a: ['#2b1a12', '#efe2d2'], b: ['#ffb545', '#ffffff'], rim: ['#ffcf8a', '#ffd9a8'] }, atmoColor: ['#ff9a3c', '#ffd9a8'] });
  moon.position.set(-11, 7, Z - 16);
  group.add(moon);

  function layout(ctx) {
    astro.group.position.x = -6.2 * ctx.dir;
    astro.group.rotation.y = 0.7 * ctx.dir;
    astro2.group.position.x = 6.8 * ctx.dir;
    astro2.group.rotation.y = -0.9 * ctx.dir;
    rocks.scale.x = ctx.dir;
    moon.position.x = -11 * ctx.dir;
  }

  function update(ctx, local) {
    const tm = ctx.time;
    const open = smooth(0.0, 0.45, local);
    du.uOpen.value = open;
    ring.scale.setScalar(0.4 + open * 0.6);
    ring.rotation.z = tm * 0.1;
    thins.forEach((m, i) => {
      m.scale.setScalar(0.5 + open * 0.5 + Math.sin(tm * 1.4 + i) * 0.01);
      m.rotation.z = tm * (i % 2 ? -0.2 : 0.15);
    });
    disc.scale.setScalar(0.4 + open * 0.6);
    flare.material.opacity = (0.08 + open * 0.2) * (1 - GLOBAL.uTheme.value * 0.3);
    swirl.rotation.z = tm * 0.25;
    swirl.scale.setScalar(0.6 + open * 0.4);
    // one astronaut waves at the visitor
    astro.pose(0, 0);
    astro.armR.pivot.rotation.z = 2.4 + Math.sin(tm * 3) * 0.35;
    astro.armR.knee.rotation.x = -0.3;
    astro2.group.position.y = GROUND + 0.35 + Math.sin(tm * 0.8) * 0.02;
    moon.rotation.y = tm * 0.08;
  }

  return {
    id: 'contact',
    group,
    update,
    layout,
    keys: [
      { at: 0, pos: [0, 4, Z + 36], look: [0, 0, Z], f: 0.3 },
      { at: 0.22, pos: [0, 1.8, Z + 23], look: [0, 0.2, Z], f: 1 },
      { at: 1, pos: [0, 1.2, Z + 19], look: [0, 0.3, Z], f: 1 },
    ],
  };
}
