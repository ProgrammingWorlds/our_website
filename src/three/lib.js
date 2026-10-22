import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/* ======================================================================
   Shared uniforms + theme binding
   Every themed value is registered once with its dark and light value and
   lerped from a single 0 (dark) → 1 (light) mix, so both themes always share
   identical geometry, layout and motion.
   ====================================================================== */
export const GLOBAL = {
  uTheme: { value: 0 },
  uTime: { value: 0 },
  uPR: { value: 1 },
};

const binds = [];
const blendSwitch = new Set();

export function col(hex) {
  return new THREE.Color(hex);
}
export function bindColor(target, key, dark, light) {
  const d = col(dark), l = col(light);
  if (!(target[key] instanceof THREE.Color)) target[key] = new THREE.Color();
  binds.push({ kind: 'c', target, key, d, l });
  target[key].copy(d).lerp(l, GLOBAL.uTheme.value);
}
export function bindNum(target, key, dark, light) {
  binds.push({ kind: 'n', target, key, d: dark, l: light });
  target[key] = dark + (light - dark) * GLOBAL.uTheme.value;
}
/** Additive glows vanish on a light sky, so glow materials swap to normal blending in light mode. */
export function themeBlend(material) {
  blendSwitch.add(material);
  return material;
}
export function applyTheme(mix) {
  GLOBAL.uTheme.value = mix;
  for (const b of binds) {
    if (b.kind === 'c') b.target[b.key].copy(b.d).lerp(b.l, mix);
    else b.target[b.key] = b.d + (b.l - b.d) * mix;
  }
  const blending = mix > 0.5 ? THREE.NormalBlending : THREE.AdditiveBlending;
  for (const m of blendSwitch) {
    if (m.blending !== blending) {
      m.blending = blending;
      m.needsUpdate = true;
    }
  }
}

/* ======================================================================
   GLSL helpers
   ====================================================================== */
export const NOISE = /* glsl */ `
float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  float n000 = hash13(i), n100 = hash13(i+vec3(1,0,0)), n010 = hash13(i+vec3(0,1,0)), n110 = hash13(i+vec3(1,1,0));
  float n001 = hash13(i+vec3(0,0,1)), n101 = hash13(i+vec3(1,0,1)), n011 = hash13(i+vec3(0,1,1)), n111 = hash13(i+vec3(1,1,1));
  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y), mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
}
float fbm(vec3 p){ float a = 0.5, s = 0.0; for(int i=0;i<5;i++){ s += a*vnoise(p); p = p*2.03 + vec3(1.7,9.2,3.1); a *= 0.5; } return s; }
`;

/* ======================================================================
   Section background (full-screen, clipped to its section by the engine)
   glows: [{ x, y, r, i, dark, light }] in section UV (0..1, y from top)
   ====================================================================== */
export function makeBackground(opts) {
  const g = opts.glows || [];
  const uniforms = {
    uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uDir: { value: 1 },
    uTheme: GLOBAL.uTheme,
    uTime: GLOBAL.uTime,
    uPR: GLOBAL.uPR,
    uStars: { value: opts.stars ?? 1 },
    uNebula: { value: opts.nebula ?? 0.6 },
    uClouds: { value: opts.clouds ?? 0.7 },
    uParallax: { value: 0 },
  };
  bindColor((uniforms.uTop = { value: null }), 'value', opts.top[0], opts.top[1]);
  bindColor((uniforms.uBot = { value: null }), 'value', opts.bottom[0], opts.bottom[1]);
  bindColor((uniforms.uNeb = { value: null }), 'value', opts.neb?.[0] ?? '#1a3a9a', opts.neb?.[1] ?? '#ffffff');
  for (let i = 0; i < 4; i++) {
    const gl = g[i] || { x: 0, y: 0, r: 0.01, i: 0, dark: '#000', light: '#000' };
    uniforms['uG' + i] = { value: new THREE.Vector4(gl.x, gl.y, gl.r, gl.i) };
    bindColor((uniforms['uC' + i] = { value: null }), 'value', gl.dark, gl.light);
    if (gl.il != null) bindNum(uniforms['uG' + i].value, 'w', gl.i, gl.il);
  }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `void main(){ gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec4 uRect; uniform float uDir, uTheme, uTime, uPR, uStars, uNebula, uClouds, uParallax;
      uniform vec3 uTop, uBot, uNeb, uC0, uC1, uC2, uC3;
      uniform vec4 uG0, uG1, uG2, uG3;
      ${NOISE}
      float glow(vec2 p, vec4 g, float aspect){ vec2 d = p - vec2(g.x*aspect, g.y); return g.w * exp(-dot(d,d)/(g.z*g.z)); }
      float stars(vec2 px, float cell, float seed, float thr){
        vec2 c = floor(px/cell); vec2 f = fract(px/cell);
        vec2 r = hash22(c + seed)*0.8 + 0.1;
        float on = step(thr, hash12(c*1.7 + seed));
        float d = length((f - r)*cell);
        float tw = 0.65 + 0.35*sin(uTime*(1.0+hash12(c)*2.0) + hash12(c+3.1)*6.28);
        float size = mix(0.6, 1.6, hash12(c+7.7));
        return on * tw * smoothstep(size, 0.0, d);
      }
      void main(){
        vec2 uv = (gl_FragCoord.xy - uRect.xy) / uRect.zw; uv.y = 1.0 - uv.y;
        vec2 guv = uv; if (uDir < 0.0) guv.x = 1.0 - guv.x;
        float aspect = uRect.z / uRect.w;
        vec2 p = vec2(guv.x*aspect, guv.y);
        vec3 col = mix(uTop, uBot, smoothstep(0.0, 1.0, uv.y));
        col += uC0*glow(p,uG0,aspect) + uC1*glow(p,uG1,aspect) + uC2*glow(p,uG2,aspect) + uC3*glow(p,uG3,aspect);
        float n = fbm(vec3(p*1.6 + vec2(0.0, uParallax*0.3), uTime*0.015));
        float n2 = fbm(vec3(p*4.0 - 3.0, uTime*0.02 + 4.0));
        // dark: nebula + stars
        float neb = smoothstep(0.45, 0.85, n) * (0.55 + 0.45*n2);
        vec3 darkAdd = uNeb * neb * uNebula;
        vec2 px = (gl_FragCoord.xy - uRect.xy) / uPR + vec2(0.0, uParallax*40.0);
        float s = stars(px, 46.0, 1.0, 0.86) + 0.7*stars(px, 23.0, 5.0, 0.93) + 0.5*stars(px*0.5, 61.0, 9.0, 0.8);
        darkAdd += vec3(0.85, 0.9, 1.0) * s * uStars;
        // light: drifting icy clouds
        float cl = smoothstep(0.48, 0.9, fbm(vec3(p*2.2 + vec2(uTime*0.006, 0.0), 2.0)));
        vec3 lightAdd = vec3(1.0) * cl * uClouds * 0.55;
        col += mix(darkAdd, lightAdd, uTheme);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return mesh;
}

/* ======================================================================
   Planets: procedural surface + fresnel rim, themed (dark cosmic / icy day)
   ====================================================================== */
export function makePlanet(radius, o = {}) {
  const uniforms = {
    uTheme: GLOBAL.uTheme,
    uTime: GLOBAL.uTime,
    uScale: { value: o.scale ?? 2.2 },
    uSeed: { value: o.seed ?? 1 },
    uRadius: { value: radius },
    uLight: { value: new THREE.Vector3(...(o.light || [1, 0.6, 0.8])).normalize() },
    uRimPow: { value: o.rimPow ?? 2.6 },
    uRimStr: { value: o.rimStr ?? 1.4 },
    uCity: { value: o.city ?? 0 },
    uCrater: { value: o.crater ?? 0 },
    uSpin: { value: o.spin ?? 0.02 },
    uCloudAmt: { value: o.clouds ?? 0.8 },
  };
  const c = o.colors || {};
  bindColor((uniforms.uA = { value: null }), 'value', c.a?.[0] ?? '#0a1a4d', c.a?.[1] ?? '#cfdcf5');
  bindColor((uniforms.uB = { value: null }), 'value', c.b?.[0] ?? '#1f4fe0', c.b?.[1] ?? '#ffffff');
  bindColor((uniforms.uRim = { value: null }), 'value', c.rim?.[0] ?? '#ff9f3a', c.rim?.[1] ?? '#9ec0ff');
  bindColor((uniforms.uAmb = { value: null }), 'value', c.amb?.[0] ?? '#050a1c', c.amb?.[1] ?? '#9fb3dd');
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vW; varying vec3 vO;
      void main(){ vO = position; vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uA, uB, uRim, uAmb, uLight; uniform float uTheme, uTime, uScale, uSeed, uRadius, uRimPow, uRimStr, uCity, uCrater, uSpin, uCloudAmt;
      varying vec3 vN; varying vec3 vW; varying vec3 vO;
      ${NOISE}
      void main(){
        float a = uTime*uSpin; mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
        vec3 o = vO / uRadius; o.xz = rot*o.xz;
        vec3 q = o*uScale + uSeed*7.3;
        float n = fbm(q);
        float n2 = fbm(q*3.1 + 11.0);
        vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW); vec3 L = normalize(uLight);
        float diff = smoothstep(-0.25, 1.0, dot(N, L));
        vec3 base = mix(uA, uB, smoothstep(0.35, 0.7, n));
        base *= 0.75 + 0.5*n2;
        if (uCrater > 0.0) { float cr = smoothstep(0.62, 0.66, vnoise(q*4.0)) * (1.0 - smoothstep(0.66, 0.74, vnoise(q*4.0))); base *= 1.0 - cr*0.35*uCrater; }
        float fres = pow(1.0 - max(dot(N, V), 0.0), uRimPow);
        vec3 col = base*(diff*1.05 + 0.08) + uAmb*0.35;
        float rimLit = smoothstep(-0.4, 0.6, dot(N, L));
        col += uRim * fres * uRimStr * (0.25 + rimLit);
        // dark: warm sparkle (cities / volcanic) on the shadow side
        float city = smoothstep(0.72, 0.78, fbm(q*6.0)) * (1.0 - diff) * uCity * (1.0 - uTheme);
        col += vec3(1.0, 0.62, 0.25) * city * 0.9;
        // light: high bright cloud cover
        float cl = smoothstep(0.5, 0.75, fbm(q*1.6 + vec3(uTime*0.01, 0.0, 0.0)));
        col = mix(col, vec3(1.0)*(0.75 + 0.35*diff), cl * uTheme * uCloudAmt);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, o.seg ?? 96, Math.round((o.seg ?? 96) * 0.66)), mat);
  const group = new THREE.Group();
  group.add(mesh);
  if (o.atmo !== false) group.add(makeAtmosphere(radius * (o.atmoScale ?? 1.12), o.atmoColor || ['#3d6bff', '#bcd3ff'], o.atmoStr ?? 1));
  group.userData.material = mat;
  return group;
}

export function makeAtmosphere(radius, color, strength = 1) {
  const uniforms = { uStr: { value: strength } };
  bindColor((uniforms.uColor = { value: null }), 'value', color[0], color[1]);
  const mat = themeBlend(
    new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uStr; varying vec3 vN; varying vec3 vV;
        void main(){ float i = pow(clamp(0.78 + dot(vN, vV), 0.0, 1.0), 3.5) * uStr; gl_FragColor = vec4(uColor, clamp(i,0.0,1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
    }),
  );
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 40), mat);
}

/* ======================================================================
   Glow sprites
   ====================================================================== */
let glowTex;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.16)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
export function makeGlow(size, dark, light, opacity = 1, lightOpacity = opacity * 0.6) {
  const mat = themeBlend(
    new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  bindColor(mat, 'color', dark, light);
  bindNum(mat, 'opacity', opacity, lightOpacity);
  const s = new THREE.Sprite(mat);
  s.scale.set(size, size, 1);
  return s;
}

/* ======================================================================
   Particles (soft round points; size in world units)
   ====================================================================== */
export function makePoints(positions, colors, sizes, o = {}) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
  const uniforms = { uPR: GLOBAL.uPR, uOpacity: { value: o.opacity ?? 1 }, uScale: { value: o.scale ?? 1100 }, uTime: GLOBAL.uTime };
  if (o.lightOpacity != null) bindNum(uniforms.uOpacity, 'value', o.opacity ?? 1, o.lightOpacity);
  const mat = themeBlend(
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      vertexShader: /* glsl */ `attribute float aSize; uniform float uPR, uScale, uTime; varying vec3 vC; varying float vT;
        void main(){ vC = color; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv;
        vT = 0.7 + 0.3*sin(uTime*2.0 + position.x*13.0 + position.y*7.0);
        gl_PointSize = aSize*uPR*uScale/max(-mv.z, 0.5); }`,
      fragmentShader: /* glsl */ `uniform float uOpacity; varying vec3 vC; varying float vT;
        void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5, 0.0, d); a *= a; gl_FragColor = vec4(vC, a*uOpacity*vT);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
    }),
  );
  return new THREE.Points(geo, mat);
}

/** Ellipse of particles + optional line (orbital ring). */
export function makeOrbit(rx, rz, o = {}) {
  const group = new THREE.Group();
  const n = o.count ?? 600;
  const pos = [], cols = [], sizes = [];
  const cA = col(o.colorA || '#ffb545'), cB = col(o.colorB || '#5d86ff');
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const spread = o.spread ?? 0.08;
    const r = 1 + (Math.random() - 0.5) * spread * 2;
    pos.push(Math.cos(a) * rx * r, (Math.random() - 0.5) * (o.thick ?? 0.04), Math.sin(a) * rz * r);
    const c = cA.clone().lerp(cB, Math.random() < (o.mix ?? 0.5) ? 1 : Math.random() * 0.3);
    cols.push(c.r, c.g, c.b);
    sizes.push((o.size ?? 0.05) * (0.4 + Math.random() * Math.random() * 2.2));
  }
  const pts = makePoints(pos, cols, sizes, { opacity: o.opacity ?? 1, lightOpacity: o.lightOpacity ?? 0.7 });
  group.add(pts);
  if (o.line !== false) {
    const curve = new THREE.EllipseCurve(0, 0, rx, rz, 0, Math.PI * 2);
    const p2 = curve.getPoints(200).map((p) => new THREE.Vector3(p.x, 0, p.y));
    const lmat = themeBlend(new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    bindColor(lmat, 'color', o.lineDark || '#ffb545', o.lineLight || '#5a7dff');
    bindNum(lmat, 'opacity', o.lineOpacity ?? 0.5, o.lineOpacityLight ?? 0.55);
    group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(p2), lmat));
  }
  group.userData.points = pts;
  return group;
}

/* ======================================================================
   The PW logo in 3D: three sphere quadrants + gold rounded cube.
   Proportions follow the flat mark (gap = 0.13R per side, cube = 0.52R
   centred at 0.39R,0.39R).
   ====================================================================== */
function quadrantGeometry(R, sx, sy, gap) {
  const g = new THREE.SphereGeometry(R, 160, 112);
  const p = g.attributes.position;
  const orig = p.array.slice();
  const colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x0 = p.getX(i), y0 = p.getY(i);
    const x = sx < 0 ? Math.min(x0, -gap) : Math.max(x0, gap);
    const y = sy < 0 ? Math.min(y0, -gap) : Math.max(y0, gap);
    p.setXY(i, x, y);
    const cut = x !== x0 || y !== y0;
    colors.fill(cut ? 0.38 : 1, i * 3, i * 3 + 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  // vertices collapsed onto the cut edges only touch degenerate triangles and
  // get a zero normal (NaN in lighting, which bloom then smears everywhere)
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) {
    const l = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
    if (!(l > 1e-4)) {
      const ox = orig[i * 3], oy = orig[i * 3 + 1], oz = orig[i * 3 + 2];
      const ol = Math.hypot(ox, oy, oz) || 1;
      n.setXYZ(i, ox / ol, oy / ol, oz / ol);
    }
  }
  return g;
}

let logoMats;
export function logoMaterials(envIntensity = 1) {
  if (logoMats) return logoMats;
  const blue = new THREE.MeshPhysicalMaterial({
    color: '#2440ff', roughness: 0.3, metalness: 0.1, clearcoat: 0.55, clearcoatRoughness: 0.14, vertexColors: true,
  });
  bindColor(blue, 'emissive', '#0c1db0', '#0a1aa0');
  bindNum(blue, 'emissiveIntensity', 0.22, 0.1);
  const gold = new THREE.MeshPhysicalMaterial({
    color: '#ffb545', roughness: 0.3, metalness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.15,
  });
  bindColor(gold, 'emissive', '#a35a00', '#6a3a00');
  bindNum(gold, 'emissiveIntensity', 0.28, 0.1);
  logoMats = { blue, gold };
  return logoMats;
}

const geoCache = {};
export function makeLogo(R = 1) {
  const key = 'logo';
  if (!geoCache[key]) {
    const gap = 0.055;
    geoCache[key] = {
      tl: quadrantGeometry(1, -1, 1, gap),
      bl: quadrantGeometry(1, -1, -1, gap),
      br: quadrantGeometry(1, 1, -1, gap),
      cube: new RoundedBoxGeometry(0.6, 0.6, 0.6, 5, 0.08),
    };
  }
  const G = geoCache[key];
  const { blue, gold } = logoMaterials();
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  inner.scale.setScalar(R);
  const mk = (geo, mat, dir, home) => {
    const holder = new THREE.Group();
    const mesh = new THREE.Mesh(geo, mat);
    holder.add(mesh);
    holder.position.copy(home);
    holder.userData = { dir: dir.clone().normalize(), home: home.clone(), spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5) };
    inner.add(holder);
    return holder;
  };
  const pieces = [
    mk(G.tl, blue, new THREE.Vector3(-1, 1, 0.3), new THREE.Vector3()),
    mk(G.bl, blue, new THREE.Vector3(-1, -1, 0.2), new THREE.Vector3()),
    mk(G.br, blue, new THREE.Vector3(1, -1, 0.3), new THREE.Vector3()),
    mk(G.cube, gold, new THREE.Vector3(1, 1, 0.8), new THREE.Vector3(0.42, 0.42, 0.22)),
  ];
  pieces[3].children[0].rotation.set(0.28, -0.38, 0.04);
  /** split: 0 assembled → 1 scattered */
  function setSplit(s, spin = 1) {
    for (const p of pieces) {
      const d = p.userData.dir;
      p.position.copy(p.userData.home).addScaledVector(d, s * 1.6);
      p.rotation.set(p.userData.spin.x * s * 3 * spin, p.userData.spin.y * s * 3 * spin, p.userData.spin.z * s * 3 * spin);
    }
  }
  /** gap: small "breathing" separation of the quadrants, in units of R */
  function setGap(g) {
    for (const p of pieces) p.position.copy(p.userData.home).addScaledVector(p.userData.dir, g);
  }
  return { group, inner, pieces, setSplit, setGap };
}

/* ======================================================================
   Rocks (displaced icosahedra, flat-shaded; dark basalt ↔ snow)
   ====================================================================== */
function rnd(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function rockGeometry(seed, detail = 2) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position;
  const r = rnd(seed);
  const bumps = Array.from({ length: 7 }, () => [new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), 0.15 + r() * 0.3]);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let k = 1;
    for (const [d, a] of bumps) k += a * Math.pow(Math.max(0, v.dot(d)), 3) - a * 0.25;
    k += (r() - 0.5) * 0.08;
    v.multiplyScalar(k);
    v.y *= 0.72;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
let rockMat;
export function rockMaterial() {
  if (rockMat) return rockMat;
  rockMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.85, metalness: 0.08 });
  bindColor(rockMat, 'color', '#1a2140', '#f3f6fc');
  bindColor(rockMat, 'emissive', '#04081a', '#7f97c9');
  bindNum(rockMat, 'emissiveIntensity', 1, 0.12);
  return rockMat;
}
/** items: [{p:[x,y,z], s:number|[x,y,z], r?:[x,y,z]}] */
export function makeRocks(items, seed = 1) {
  const group = new THREE.Group();
  const variants = [rockGeometry(seed * 11 + 1), rockGeometry(seed * 11 + 2), rockGeometry(seed * 11 + 3)];
  const buckets = variants.map(() => []);
  const r = rnd(seed * 97);
  items.forEach((it, i) => buckets[i % 3].push(it));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), pv = new THREE.Vector3();
  buckets.forEach((list, vi) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(variants[vi], rockMaterial(), list.length);
    list.forEach((it, i) => {
      e.set(...(it.r || [r() * 6, r() * 6, r() * 6]));
      q.setFromEuler(e);
      if (Array.isArray(it.s)) s.set(...it.s);
      else s.setScalar(it.s);
      pv.set(...it.p);
      m.compose(pv, q, s);
      im.setMatrixAt(i, m);
    });
    im.userData.items = list;
    group.add(im);
  });
  return group;
}
export function scatter(n, seed, fn) {
  const r = rnd(seed);
  return Array.from({ length: n }, (_, i) => fn(r, i));
}
export { rnd };

/* ======================================================================
   Astronaut (stylised, ~1.8 units tall, faces +Z)
   ====================================================================== */
let suitMats;
function astronautMaterials() {
  if (suitMats) return suitMats;
  const suit = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 });
  bindColor(suit, 'color', '#8e9ab8', '#eef1f8');
  const dark = new THREE.MeshStandardMaterial({ color: '#2a3350', roughness: 0.6 });
  const visor = new THREE.MeshPhysicalMaterial({ color: '#0d1430', metalness: 0.9, roughness: 0.08, clearcoat: 1, envMapIntensity: 2 });
  bindColor(visor, 'emissive', '#3a2a10', '#1a2a50');
  const accent = new THREE.MeshStandardMaterial({ color: '#ffb545', roughness: 0.4, metalness: 0.3, emissive: '#5a3000', emissiveIntensity: 0.4 });
  suitMats = { suit, dark, visor, accent };
  return suitMats;
}
export function makeAstronaut() {
  const M = astronautMaterials();
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, parent = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 14);
  add(cap(0.27, 0.42), M.suit, 0, 1.08, 0).scale.set(1, 1, 0.82);
  add(new THREE.SphereGeometry(0.22, 20, 14), M.suit, 0, 0.78, 0).scale.set(1.15, 0.8, 0.9);
  add(new RoundedBoxGeometry(0.5, 0.58, 0.24, 3, 0.06), M.suit, 0, 1.12, -0.26);
  add(new RoundedBoxGeometry(0.22, 0.14, 0.05, 2, 0.02), M.dark, 0, 1.12, 0.22);
  add(new THREE.BoxGeometry(0.06, 0.03, 0.02), M.accent, -0.04, 1.14, 0.25);
  add(new THREE.SphereGeometry(0.27, 28, 20), M.suit, 0, 1.6, 0);
  const visor = add(new THREE.SphereGeometry(0.2, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.62), M.visor, 0, 1.6, 0.1);
  visor.rotation.x = Math.PI / 2;
  visor.scale.set(1.05, 0.95, 0.85);
  const limb = (x, y, isLeg) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    g.add(pivot);
    const r = isLeg ? 0.105 : 0.085;
    const l1 = isLeg ? 0.26 : 0.2;
    add(cap(r, l1), M.suit, 0, -(l1 / 2 + r * 0.6), 0, pivot);
    const knee = new THREE.Group();
    knee.position.y = -(l1 + r * 1.2);
    pivot.add(knee);
    add(cap(r * 0.95, l1), M.suit, 0, -(l1 / 2 + r * 0.5), 0, knee);
    if (isLeg) add(new RoundedBoxGeometry(0.2, 0.12, 0.3, 2, 0.04), M.suit, 0, -(l1 + r * 1.3), 0.04, knee);
    else add(new THREE.SphereGeometry(0.075, 12, 10), M.suit, 0, -(l1 + r * 1.2), 0, knee);
    return { pivot, knee };
  };
  const legL = limb(-0.13, 0.72, true), legR = limb(0.13, 0.72, true);
  const armL = limb(-0.36, 1.32, false), armR = limb(0.36, 1.32, false);
  armL.pivot.rotation.z = -0.18;
  armR.pivot.rotation.z = 0.18;
  function pose(phase, amount = 1) {
    const s = Math.sin(phase) * amount;
    legL.pivot.rotation.x = s * 0.45;
    legR.pivot.rotation.x = -s * 0.45;
    legL.knee.rotation.x = Math.max(0, -Math.sin(phase + 0.6)) * 0.6 * amount;
    legR.knee.rotation.x = Math.max(0, Math.sin(phase + 0.6)) * 0.6 * amount;
    armL.pivot.rotation.x = -s * 0.35;
    armR.pivot.rotation.x = s * 0.35;
    armL.knee.rotation.x = -0.25 * amount;
    armR.knee.rotation.x = -0.25 * amount;
  }
  return { group: g, pose, armL, armR };
}

/* ======================================================================
   Misc
   ====================================================================== */
export const damp = (a, b, lambda, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt));
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export function canvasTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
let logoImg;
export function logoImage() {
  if (!logoImg) {
    logoImg = new Image();
    logoImg.src = '/assets/pw-logo.png';
  }
  return logoImg;
}
