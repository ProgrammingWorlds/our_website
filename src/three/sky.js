import * as THREE from 'three';
import { GLOBAL, bindColor, bindNum, bakeCube, themeBlend, makePoints, rnd, col } from './lib.js';
import { CHAPTERS } from '../story.js';

// Sky palette per scene: [zenith, horizon, nebula, warm] for dark and light.
// The sky drifts between them as the camera travels, so every chapter has its
// own atmosphere while the journey stays one continuous space.
const SCENE_PALETTE = {
  hero: { d: ['#020817', '#0b2163', '#2a4cd6', '#ff9a3c'], l: ['#cddcf7', '#f6f9ff', '#ffffff', '#ffd59a'] },
  services: { d: ['#020a1e', '#0a2470', '#3d5bff', '#ffb545'], l: ['#d3e1fb', '#f7faff', '#ffffff', '#ffe0a8'] },
  about: { d: ['#05061e', '#1a1566', '#5b3dff', '#ffb545'], l: ['#d9dcfa', '#f8f8ff', '#ffffff', '#ffd9b8'] },
  process: { d: ['#010616', '#06235a', '#1f8bff', '#3d6bff'], l: ['#cfe3fb', '#f4f9ff', '#ffffff', '#cfe0ff'] },
  portfolio: { d: ['#030b20', '#0a2366', '#315cff', '#ffb545'], l: ['#d3e0f7', '#f6f9ff', '#ffffff', '#ffe0a8'] },
  future: { d: ['#06071a', '#2a1440', '#ff6a3d', '#ff9a3c'], l: ['#e3dcf3', '#fff7f0', '#ffffff', '#ffc89a'] },
  contact: { d: ['#08081a', '#3a1c10', '#ffb545', '#ff8a3d'], l: ['#f0e2d0', '#fff8ee', '#ffffff', '#ffc070'] },
};
// in story order (a one-chapter story repeats its palette so there is always a pair to blend)
const PALETTE = [...CHAPTERS, CHAPTERS[CHAPTERS.length - 1]].map((c) => SCENE_PALETTE[c.scene]).map((p) => ({ d: p.d.map(col), l: p.l.map(col) }));

// Milky Way plane and the one large spiral galaxy, as world directions.
const MW_NORMAL = new THREE.Vector3(0.42, 0.78, 0.46).normalize();
const MW_CORE = new THREE.Vector3(0.62, -0.12, -1).normalize();
// (placed where the opening view has open sky: between the mark and the moon)
const GALAXY = { dir: new THREE.Vector3(0.155, 0.214, -0.965).normalize(), size: 0.07, tilt: 0.55, turn: 0.5 };
const GALAXY_FAR = new THREE.Vector3(-0.34, 0.1, -0.94).normalize();

/**
 * Bakes the sky once. Palette-independent fields go into `fields`
 * (nebula density, warm band, day clouds); real emission — the Milky Way
 * with its dust lanes and star clouds, a spiral galaxy, a smaller distant
 * one and soft reflection nebulae — goes into `light` as linear colour.
 */
function bakeSky() {
  const v3 = (v) => ({ value: v, type: 'vec3' });
  const fields = bakeCube(512, {}, /* glsl */ `
    float n = fbmN(d*2.4 + (vec3(fbmN(d*1.2, 3), fbmN(d*1.2 + 3.0, 3), fbmN(d*1.2 + 6.0, 3)) - 0.5)*1.6, 6);
    float n2 = fbmN(d*6.0 + 7.0, 5);
    float neb = smoothstep(0.42, 0.8, n) * (0.45 + 0.65*n2);
    float band = pow(max(0.0, 1.0 - abs(d.y + 0.12)*2.6), 3.0) * (0.6 + 0.5*n2);
    float cl = smoothstep(0.45, 0.85, fbmN(d*3.2 + vec3(0.0, 0.0, 2.0), 6));
    gl_FragColor = vec4(neb, band, cl, 1.0);`);
  const light = bakeCube(
    1024,
    { uMW: v3(MW_NORMAL), uCore: v3(MW_CORE), uGal: v3(GALAXY.dir), uGal2: v3(GALAXY_FAR) },
    /* glsl */ `
      vec3 col = vec3(0.0);
      // Milky Way: a soft band around a great circle, brightest toward the core,
      // broken by dark, filamentary dust lanes and clumpy star clouds
      float lat = dot(d, uMW);
      float width = 0.16 + 0.06*fbmN(d*3.0, 3);
      float core = pow(max(dot(d, uCore), 0.0), 3.0);
      float bandMW = exp(-lat*lat/(width*width)) * (0.35 + 0.9*core);
      float clouds = fbmN(d*9.0 + 2.0, 6);
      float stars = pow(fbmN(d*60.0, 3), 3.0)*2.2;
      float dust = smoothstep(0.35, 0.75, ridged(d*5.0 + vec3(1.3, 0.0, 4.2), 6)) * exp(-lat*lat/(width*width*0.25));
      float mw = bandMW * (0.45 + 0.9*clouds + stars) * (1.0 - 0.85*dust);
      col += mix(vec3(0.5, 0.6, 0.95), vec3(1.0, 0.84, 0.66), core*0.7) * mw * 0.085;
      // reflection nebulae: faint blue-violet and rose veils
      float veil = smoothstep(0.55, 0.85, fbmN(d*4.0 + 9.0, 6));
      col += mix(vec3(0.25, 0.35, 0.9), vec3(0.85, 0.3, 0.5), fbmN(d*2.0 + 1.0, 3)) * veil * 0.035;
      // the spiral galaxy: projected onto its own tilted disc
      vec3 c = uGal, T = normalize(cross(vec3(0.0, 1.0, 0.0), c)), B = cross(c, T);
      float cd = dot(d, c);
      if (cd > 0.9) {
        vec2 p = vec2(dot(d, T), dot(d, B)) / cd / ${GALAXY.size.toFixed(3)};
        float ct = cos(${GALAXY.turn.toFixed(3)}), st = sin(${GALAXY.turn.toFixed(3)});
        p = mat2(ct, -st, st, ct)*p;
        p.y /= ${GALAXY.tilt.toFixed(3)};
        float r = length(p), th = atan(p.y, p.x);
        float arm = 0.5 + 0.5*cos(2.0*(th - log(max(r, 0.02))*2.6));
        float knots = fbmN(vec3(p*7.0, 3.0), 5);
        float disc = exp(-r*3.2);
        float arms = pow(arm, 2.5) * disc * (0.55 + 0.9*knots);
        float lane = pow(0.5 + 0.5*cos(2.0*(th - log(max(r, 0.02))*2.6) - 0.9), 6.0) * disc;
        float bulge = exp(-r*r*55.0);
        vec3 g = vec3(0.62, 0.72, 1.0)*arms*0.9 + vec3(1.0, 0.86, 0.66)*(bulge*1.6 + disc*0.18);
        g *= 1.0 - 0.6*lane*smoothstep(0.05, 0.3, r);
        col += g * smoothstep(0.9, 0.93, cd) * 0.42;
      }
      // a small, distant edge-on galaxy
      vec3 c2 = uGal2, T2 = normalize(cross(vec3(0.0, 1.0, 0.0), c2)), B2 = cross(c2, T2);
      float cd2 = dot(d, c2);
      if (cd2 > 0.99) {
        vec2 p2 = vec2(dot(d, T2), dot(d, B2)) / cd2 / 0.022;
        p2 = mat2(0.86, -0.5, 0.5, 0.86)*p2;
        float e = exp(-abs(p2.y)*7.0 - abs(p2.x)*1.6);
        col += vec3(1.0, 0.9, 0.78) * (e*0.5 + exp(-dot(p2, p2)*6.0)*0.6) * (1.0 - 0.7*exp(-p2.y*p2.y*120.0)*step(abs(p2.x), 0.8));
      }
      gl_FragColor = vec4(col, 1.0);`,
  );
  return { fields, light };
}

export function createSky(world) {
  const group = new THREE.Group();
  const baked = bakeSky();
  const uniforms = { uTheme: GLOBAL.uTheme, uTime: GLOBAL.uTime, uFields: { value: baked.fields }, uLightMap: { value: baked.light }, uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uNeb: { value: new THREE.Color() }, uWarm: { value: new THREE.Color() } };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(900, 48, 32),
    new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: /* glsl */ `
        uniform samplerCube uFields, uLightMap; uniform vec3 uZen, uHor, uNeb, uWarm; uniform float uTheme, uTime; varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          // the whole sky turns very slowly, like a real night sky
          float a = uTime*0.0015; d.xz = mat2(cos(a), -sin(a), sin(a), cos(a))*d.xz;
          vec4 f = textureCube(uFields, d);
          vec3 col = mix(uHor, uZen, smoothstep(-0.25, 0.75, d.y));
          vec3 darkAdd = uNeb*f.r*0.2 + uWarm*f.g*0.1 + textureCube(uLightMap, d).rgb;
          vec3 lightAdd = vec3(1.0)*f.b*0.18 + uWarm*f.g*0.08;
          col += mix(darkAdd, lightAdd, uTheme);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  dome.frustumCulled = false;
  dome.renderOrder = -1000;
  group.add(dome);

  // distant stars along the whole route
  const r = rnd(77);
  const pos = [], cols = [], sizes = [];
  const cA = col('#ffffff'), cB = col('#a9c1ff'), cC = col('#ffd9a0'), cD = col('#ffb27a');
  for (let i = 0; i < 2400; i++) {
    const a = r() * Math.PI * 2, rad = 26 + Math.pow(r(), 0.6) * 160;
    pos.push(Math.cos(a) * rad, Math.sin(a) * rad * 0.8, 80 - r() * 700);
    const k = r();
    const c = k < 0.1 ? cD : k < 0.32 ? cC : cA.clone().lerp(cB, r() * 0.8);
    cols.push(c.r, c.g, c.b);
    sizes.push(0.06 + r() * r() * 0.35);
  }
  const stars = makePoints(pos, cols, sizes, { opacity: 0.7, lightOpacity: 0 });
  stars.frustumCulled = false;
  group.add(stars);

  // warp streaks: always wrapped around the camera, stretched by scroll speed
  const N = 1100;
  const sp = new Float32Array(N * 6), ends = new Float32Array(N * 2), seeds = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const a = r() * Math.PI * 2, rad = 2.5 + Math.pow(r(), 0.7) * 26;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad, z = -r() * 180;
    sp.set([x, y, z, x, y, z], i * 6);
    ends[i * 2 + 1] = 1;
    seeds[i * 2] = seeds[i * 2 + 1] = r();
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  sg.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
  sg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const su = { uVel: { value: 0 }, uCam: { value: new THREE.Vector3() }, uOpacity: { value: 1 } };
  bindColor((su.uColor = { value: null }), 'value', '#a9c0ff', '#2f5bff');
  bindNum(su.uOpacity, 'value', 1, 0.55);
  const streakMat = themeBlend(
    new THREE.ShaderMaterial({
      uniforms: su,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aEnd; attribute float aSeed; uniform float uVel; uniform vec3 uCam; varying float vA;
        void main(){
          vec3 p = position;
          float rel = mod(p.z - uCam.z, 180.0) - 160.0; // keep streaks in [-160, 20] around the camera
          p.z = uCam.z + rel;
          p.xy += uCam.xy * 0.6;
          p.z += aEnd * (0.15 + uVel * (6.0 + aSeed * 22.0));
          float fade = smoothstep(-160.0, -110.0, rel) * smoothstep(20.0, 2.0, rel);
          vA = fade * (0.03 + uVel * 1.2) * (0.4 + aSeed * 0.6) * mix(1.0, 0.25, aEnd);
          gl_Position = projectionMatrix*modelViewMatrix*vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uOpacity; varying float vA;
        void main(){ gl_FragColor = vec4(uColor, clamp(vA, 0.0, 1.0)*uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
    }),
  );
  const streaks = new THREE.LineSegments(sg, streakMat);
  streaks.frustumCulled = false;
  group.add(streaks);

  const tmp = [new THREE.Color(), new THREE.Color()];
  const keys = ['uZen', 'uHor', 'uNeb', 'uWarm'];
  function update(ctx) {
    dome.position.copy(world.camera.position);
    su.uVel.value = ctx.vel;
    su.uCam.value.copy(world.camera.position);
    const u = Math.min(PALETTE.length - 1, Math.max(0, ctx.u - 0.5));
    const i = Math.min(PALETTE.length - 2, Math.floor(u)), f = u - i;
    const e = f * f * (3 - 2 * f);
    const th = GLOBAL.uTheme.value;
    keys.forEach((k, j) => {
      tmp[0].copy(PALETTE[i].d[j]).lerp(PALETTE[i + 1].d[j], e);
      tmp[1].copy(PALETTE[i].l[j]).lerp(PALETTE[i + 1].l[j], e);
      uniforms[k].value.copy(tmp[0]).lerp(tmp[1], th);
    });
  }
  return { group, update };
}
