import * as THREE from 'three';
import { GLOBAL, NOISE, bindColor, bindNum, themeBlend, makePoints, rnd, col } from './lib.js';

// Sky palette per chapter: [zenith, horizon, nebula, warm] for dark and light.
// The sky drifts between them as the camera travels, so every chapter has its
// own atmosphere while the journey stays one continuous space.
const PALETTE = [
  { d: ['#020817', '#0b2163', '#2a4cd6', '#ff9a3c'], l: ['#cddcf7', '#f6f9ff', '#ffffff', '#ffd59a'] }, // hero
  { d: ['#020a1e', '#0a2470', '#3d5bff', '#ffb545'], l: ['#d3e1fb', '#f7faff', '#ffffff', '#ffe0a8'] }, // services
  { d: ['#05061e', '#1a1566', '#5b3dff', '#ffb545'], l: ['#d9dcfa', '#f8f8ff', '#ffffff', '#ffd9b8'] }, // about
  { d: ['#010616', '#06235a', '#1f8bff', '#3d6bff'], l: ['#cfe3fb', '#f4f9ff', '#ffffff', '#cfe0ff'] }, // process
  { d: ['#030b20', '#0a2366', '#315cff', '#ffb545'], l: ['#d3e0f7', '#f6f9ff', '#ffffff', '#ffe0a8'] }, // portfolio
  { d: ['#06071a', '#2a1440', '#ff6a3d', '#ff9a3c'], l: ['#e3dcf3', '#fff7f0', '#ffffff', '#ffc89a'] }, // future
  { d: ['#08081a', '#3a1c10', '#ffb545', '#ff8a3d'], l: ['#f0e2d0', '#fff8ee', '#ffffff', '#ffc070'] }, // contact
].map((p) => ({ d: p.d.map(col), l: p.l.map(col) }));

export function createSky(world) {
  const group = new THREE.Group();
  const uniforms = { uTheme: GLOBAL.uTheme, uTime: GLOBAL.uTime, uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uNeb: { value: new THREE.Color() }, uWarm: { value: new THREE.Color() } };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(900, 48, 32),
    new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uZen, uHor, uNeb, uWarm; uniform float uTheme, uTime; varying vec3 vDir;
        ${NOISE}
        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(uHor, uZen, smoothstep(-0.25, 0.75, h));
          float n = fbm(d*2.4 + vec3(0.0, 0.0, uTime*0.008));
          float n2 = fbm(d*6.0 + 7.0);
          float neb = smoothstep(0.42, 0.86, n) * (0.45 + 0.65*n2);
          float band = pow(max(0.0, 1.0 - abs(h + 0.12)*2.6), 3.0);
          vec3 darkAdd = uNeb*neb*0.2 + uWarm*band*0.1*(0.6 + 0.5*n2);
          float cl = smoothstep(0.45, 0.85, fbm(d*3.2 + vec3(uTime*0.004, 0.0, 2.0)));
          vec3 lightAdd = vec3(1.0)*cl*0.18 + uWarm*band*0.08;
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
  const cA = col('#ffffff'), cB = col('#9fb8ff'), cC = col('#ffcf8a');
  for (let i = 0; i < 2400; i++) {
    const a = r() * Math.PI * 2, rad = 26 + Math.pow(r(), 0.6) * 160;
    pos.push(Math.cos(a) * rad, Math.sin(a) * rad * 0.8, 80 - r() * 700);
    const c = r() < 0.12 ? cC : cA.clone().lerp(cB, r());
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
