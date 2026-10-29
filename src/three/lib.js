import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
  renderer: null, // set by the World; procedural textures are baked with it
  bakeScale: 1, // texture size multiplier (phones bake at half size)
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
// 3 octaves: for full-screen surfaces (sky, ground) where 5 would cost too much per pixel
float fbm3(vec3 p){ float a = 0.5, s = 0.0; for(int i=0;i<3;i++){ s += a*vnoise(p); p = p*2.03 + vec3(1.7,9.2,3.1); a *= 0.5; } return s * 1.14; }
`;

// Bake-time only noise: many octaves, ridges and craters. These run once into
// a cube texture, never per frame, so they can afford what realism needs.
const BAKE_NOISE = /* glsl */ `
${NOISE}
float fbmN(vec3 p, int oct){ float a = 0.5, s = 0.0, n = 0.0; for(int i=0;i<9;i++){ if(i>=oct) break; s += a*vnoise(p); n += a; p = p*2.03 + vec3(1.7,9.2,3.1); a *= 0.5; } return s/n; }
float ridged(vec3 p, int oct){ float a = 0.5, s = 0.0, n = 0.0; for(int i=0;i<8;i++){ if(i>=oct) break; float r = 1.0 - abs(vnoise(p)*2.0 - 1.0); s += a*r*r; n += a; p = p*2.07 + vec3(4.1,1.3,7.7); a *= 0.5; } return s/n; }
vec3 hash33(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p, p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
// impact craters on a 3D cell grid: bowl, raised rim, faint ejecta; returns a height offset
float craters(vec3 p, float density){
  vec3 i = floor(p), f = fract(p); float h = 0.0;
  for (int x=-1; x<=1; x++) for (int y=-1; y<=1; y++) for (int z=-1; z<=1; z++){
    vec3 c = vec3(float(x), float(y), float(z));
    vec3 o = hash33(i + c);
    if (o.z > density) continue;
    float r = 0.18 + 0.32*o.x*o.x;
    float d = length(c + o - f) / r;
    h += d < 1.0 ? (d*d - 1.0)*0.55 + smoothstep(0.55, 1.0, d)*0.32 : smoothstep(1.6, 1.0, d)*0.22*(1.0 - smoothstep(1.0, 1.05, d)*0.4);
  }
  return h;
}
`;

/**
 * Renders a procedural function of direction into a cube texture once.
 * `body` is GLSL that reads `vec3 d` (unit direction) and writes `gl_FragColor`.
 */
export function bakeCube(size, uniforms, body) {
  const renderer = GLOBAL.renderer;
  const res = Math.max(64, Math.round(size * GLOBAL.bakeScale));
  const target = new THREE.WebGLCubeRenderTarget(res, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  const scene = new THREE.Scene();
  scene.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.ShaderMaterial({
        uniforms,
        side: THREE.BackSide,
        depthTest: false,
        depthWrite: false,
        vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `varying vec3 vDir; ${Object.keys(uniforms).map((k) => `uniform ${uniforms[k].type} ${k};`).join(' ')}
          ${BAKE_NOISE}
          void main(){ vec3 d = normalize(vDir); ${body} }`,
      }),
    ),
  );
  const cam = new THREE.CubeCamera(0.1, 10, target);
  const prev = { tm: renderer.toneMapping, rt: renderer.getRenderTarget() };
  renderer.toneMapping = THREE.NoToneMapping;
  cam.update(renderer, scene);
  renderer.toneMapping = prev.tm;
  renderer.setRenderTarget(prev.rt);
  scene.children[0].geometry.dispose();
  scene.children[0].material.dispose();
  // the bake shader programs are never needed again
  return target.texture;
}

/* ======================================================================
   Planets: themed (dark cosmic / icy day). The surface — domain-warped
   continents, ridges, impact craters, city lights and clouds — is baked once
   into a cube texture; per pixel the shader only reads it and lights it, with
   relief from the height map, a soft terminator, cloud shadows, a specular
   glint on low "seas", limb darkening and an atmospheric rim.
   ====================================================================== */
function bakePlanet(o) {
  const size = o.res ?? (o.seg >= 120 ? 1024 : 512);
  return bakeCube(
    size,
    {
      uScale: { value: o.scale ?? 2.2, type: 'float' },
      uSeed: { value: o.seed ?? 1, type: 'float' },
      uCrater: { value: o.crater ?? 0, type: 'float' },
    },
    /* glsl */ `
      vec3 q = d*uScale + uSeed*7.3;
      vec3 w = vec3(fbmN(q, 4), fbmN(q + vec3(5.2,1.3,2.8), 4), fbmN(q + vec3(2.1,7.7,4.4), 4));
      vec3 qw = q + (w - 0.5)*1.4;
      float h = fbmN(qw, 7);
      h += (ridged(qw*1.7 + 3.0, 5) - 0.5)*0.22*smoothstep(0.45, 0.7, h);
      if (uCrater > 0.0) {
        // airless moons: gentle maria and highlands, saturated with craters at three sizes
        h = mix(h, 0.55 + (h - 0.5)*0.55, uCrater);
        h += craters(d*6.0 + uSeed, 0.5)*0.2*uCrater;
        h += craters(d*14.0 + uSeed*2.0, 0.5)*0.11*uCrater;
        h += craters(d*34.0 + uSeed*3.0, 0.45)*0.05*uCrater;
      }
      float n2 = fbmN(q*3.1 + 11.0, 5);
      float city = fbmN(q*6.0, 5) * smoothstep(0.42, 0.55, h);
      vec3 cq = d*uScale*1.6 + uSeed*3.1;
      float cl = fbmN(cq + (vec3(fbmN(cq*0.8, 3), fbmN(cq*0.8 + 4.0, 3), 0.0) - 0.5)*2.2, 6);
      gl_FragColor = vec4(clamp(h, 0.0, 1.0), n2, city, cl);`,
  );
}

export function makePlanet(radius, o = {}) {
  const map = bakePlanet(o);
  const uniforms = {
    uTheme: GLOBAL.uTheme,
    uTime: GLOBAL.uTime,
    uMap: { value: map },
    uTexel: { value: 1.5 / map.image.width },
    uDetail: { value: o.seg >= 120 ? 1 : 0 },
    uLight: { value: new THREE.Vector3(...(o.light || [1, 0.6, 0.8])).normalize() },
    uRimPow: { value: o.rimPow ?? 2.6 },
    uRimStr: { value: o.rimStr ?? 1.4 },
    uCity: { value: o.city ?? 0 },
    uCrater: { value: o.crater ?? 0 },
    uBump: { value: o.bump ?? (o.crater ? 4 : 1.4) },
    uSpin: { value: o.spin ?? 0.02 },
    uCloudAmt: { value: o.clouds ?? (o.crater ? 0 : 0.8) },
  };
  const c = o.colors || {};
  bindColor((uniforms.uA = { value: null }), 'value', c.a?.[0] ?? '#0a1a4d', c.a?.[1] ?? '#cfdcf5');
  bindColor((uniforms.uB = { value: null }), 'value', c.b?.[0] ?? '#1f4fe0', c.b?.[1] ?? '#ffffff');
  bindColor((uniforms.uRim = { value: null }), 'value', c.rim?.[0] ?? '#ff9f3a', c.rim?.[1] ?? '#9ec0ff');
  bindColor((uniforms.uAmb = { value: null }), 'value', c.amb?.[0] ?? '#050a1c', c.amb?.[1] ?? '#9fb3dd');
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vW; varying vec3 vO; varying vec3 vMX; varying vec3 vMY; varying vec3 vMZ;
      void main(){
        vO = normalize(position); vN = normalize(mat3(modelMatrix)*normal);
        vMX = normalize(modelMatrix[0].xyz); vMY = normalize(modelMatrix[1].xyz); vMZ = normalize(modelMatrix[2].xyz);
        vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */ `
      uniform samplerCube uMap; uniform vec3 uA, uB, uRim, uAmb, uLight;
      uniform float uTheme, uTime, uTexel, uDetail, uRimPow, uRimStr, uCity, uCrater, uBump, uSpin, uCloudAmt;
      varying vec3 vN; varying vec3 vW; varying vec3 vO; varying vec3 vMX; varying vec3 vMY; varying vec3 vMZ;
      ${NOISE}
      void main(){
        // the surface turns slowly: rotate the lookup, and rotate the relief back
        float a = uTime*uSpin; float ca = cos(a), sa = sin(a);
        mat2 rot = mat2(ca, -sa, sa, ca);
        vec3 o = normalize(vO); o.xz = rot*o.xz;
        vec4 s = textureCube(uMap, o);
        float h = s.r;
        vec3 T = normalize(cross(abs(o.y) < 0.99 ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0), o)), B = cross(o, T);
        float hx = textureCube(uMap, normalize(o + T*uTexel)).r, hy = textureCube(uMap, normalize(o + B*uTexel)).r;
        vec3 nb = normalize(o - (T*(hx - h) + B*(hy - h)) * uBump / uTexel * 0.012);
        nb.xz = nb.xz*rot; // back to object space
        vec3 Ng = normalize(vN);
        // relief normal in world space: tilt the geometric normal by the object-space perturbation
        vec3 dn = nb - normalize(vO);
        vec3 N = normalize(Ng + vMX*dn.x + vMY*dn.y + vMZ*dn.z);
        vec3 V = normalize(cameraPosition - vW), L = normalize(uLight);
        float ndl = dot(N, L), gdl = dot(Ng, L);
        // soft terminator from the sphere, relief light inside it
        float day = smoothstep(-0.18, 0.35, gdl);
        float diff = max(ndl, 0.0)*0.9 + 0.1*day;
        // albedo: lowlands to highlands, with fine tint variation and darker crater floors
        float land = smoothstep(0.38, 0.66, h);
        vec3 base = mix(uA, uB, land) * (0.72 + 0.56*s.g);
        if (uDetail > 0.0) base *= 0.9 + 0.2*vnoise(o*180.0);
        base *= mix(1.0, 0.25 + 1.5*h, uCrater);
        vec3 col = base*(diff*day*1.1 + 0.05) + uAmb*0.3*(1.0 - 0.75*day);
        // a soft specular glint on the low, smooth "seas" (not on cratered moons)
        float sea = (1.0 - smoothstep(0.3, 0.42, h)) * (1.0 - uCrater);
        col += vec3(1.0, 0.92, 0.8) * pow(max(dot(reflect(-L, N), V), 0.0), 28.0) * 0.35 * sea * day;
        // clouds, with their shadow cast a little away from the light
        float cl = smoothstep(0.52, 0.74, s.a) * uCloudAmt;
        vec3 lo = L; lo.xz = rot*lo.xz;
        float shadow = smoothstep(0.52, 0.74, textureCube(uMap, normalize(o - lo*0.02)).a) * uCloudAmt;
        col *= 1.0 - shadow*0.35*day;
        col = mix(col, vec3(0.92, 0.95, 1.0)*(0.08 + 0.95*max(gdl, 0.0)), cl*mix(0.22, 0.95, uTheme));
        // night side: warm city lights (dark theme only)
        float city = smoothstep(0.66, 0.74, s.b) * (1.0 - day) * uCity * (1.0 - uTheme) * (1.0 - cl);
        col += vec3(1.0, 0.62, 0.25) * city * 1.1;
        // the atmospheric rim, brightest on the sun side; airless moons darken toward the limb instead
        float ndv = max(dot(Ng, V), 0.0);
        col *= mix(1.0, mix(0.6, 1.0, pow(ndv, 0.4)), uCrater);
        // atmospheric haze: the surface fades into the rim colour toward the limb (lit side brighter)
        float fres = pow(1.0 - ndv, uRimPow), lit = smoothstep(-0.4, 0.6, gdl);
        col = mix(col, uRim*(0.35 + 0.75*lit), clamp(fres*uRimStr*(0.2 + lit)*0.42, 0.0, 0.8));
        col += uRim * fres * uRimStr * 0.22 * lit;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, o.seg ?? 96, Math.round((o.seg ?? 96) * 0.66)), mat);
  const group = new THREE.Group();
  group.add(mesh);
  if (o.atmo !== false) group.add(makeAtmosphere(radius * (o.atmoScale ?? 1.12), o.atmoColor || ['#3d6bff', '#bcd3ff'], o.atmoStr ?? 1, uniforms.uLight));
  group.userData.material = mat;
  return group;
}

/** Atmospheric halo: thicker toward the limb and brighter on the side facing the light. */
export function makeAtmosphere(radius, color, strength = 1, light = { value: new THREE.Vector3(1, 0.6, 0.8).normalize() }) {
  const uniforms = { uStr: { value: strength }, uLight: light };
  bindColor((uniforms.uColor = { value: null }), 'value', color[0], color[1]);
  const mat = themeBlend(
    new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; varying vec3 vWN;
        void main(){ vN = normalize(normalMatrix*normal); vWN = normalize(mat3(modelMatrix)*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor, uLight; uniform float uStr; varying vec3 vN; varying vec3 vV; varying vec3 vWN;
        void main(){
          float i = pow(clamp(0.78 + dot(vN, vV), 0.0, 1.0), 3.5) * uStr;
          i *= 0.35 + 0.85*smoothstep(-0.55, 0.45, dot(vWN, normalize(uLight)));
          gl_FragColor = vec4(uColor, clamp(i, 0.0, 1.0));
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
   Rocks: asteroids with a lumpy body, layered surface relief and impact
   craters. Smooth-shaded; cavities and crater floors are darkened and ridges
   lightened in the vertex colours, so they read as stone, not plastic.
   ====================================================================== */
function rnd(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
// small deterministic value noise for geometry (runs once per rock variant)
function hash3(x, y, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440662683)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const f = (t) => t * t * (3 - 2 * t);
  const u = f(x - xi), v = f(y - yi), w = f(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
function fbm3d(x, y, z, oct) {
  let a = 0.5, s = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise3(x, y, z);
    n += a;
    x = x * 2.03 + 1.7;
    y = y * 2.03 + 9.2;
    z = z * 2.03 + 3.1;
    a *= 0.5;
  }
  return s / n;
}
function rockGeometry(seed, detail = 12) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g); // shared vertices: smooth normals, and no cracks between faces
  const p = g.attributes.position;
  const r = rnd(seed);
  const o = [r() * 50, r() * 50, r() * 50];
  const dir = () => new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
  const lobes = Array.from({ length: 6 }, () => [dir(), 0.12 + r() * 0.26]);
  const pits = Array.from({ length: 4 + Math.floor(r() * 5) }, () => [dir(), 0.18 + r() * 0.38, 0.05 + r() * 0.1]);
  const squash = 0.62 + r() * 0.22;
  const colors = new Float32Array(p.count * 3);
  const v = new THREE.Vector3();
  const ks = new Float32Array(p.count);
  let mean = 0;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let k = 1;
    for (const [d, a] of lobes) k += a * Math.pow(Math.max(0, v.dot(d)), 3) - a * 0.25;
    k += (fbm3d(v.x * 1.4 + o[0], v.y * 1.4 + o[1], v.z * 1.4 + o[2], 3) - 0.5) * 0.45;
    k += (fbm3d(v.x * 5 + o[1], v.y * 5 + o[2], v.z * 5 + o[0], 3) - 0.5) * 0.12;
    const fine = fbm3d(v.x * 16 + o[2], v.y * 16 + o[0], v.z * 16 + o[1], 2);
    k += (fine - 0.5) * 0.045;
    let floor = 0;
    for (const [d, rad, depth] of pits) {
      const t = Math.acos(Math.min(1, Math.max(-1, v.dot(d)))) / rad;
      if (t < 1) {
        k -= depth * (1 - t * t);
        floor = Math.max(floor, 1 - t);
      } else if (t < 1.35) k += depth * 0.35 * Math.sin(((t - 1) / 0.35) * Math.PI);
    }
    ks[i] = k;
    mean += k / p.count;
    v.multiplyScalar(k);
    v.y *= squash;
    p.setXYZ(i, v.x, v.y, v.z);
    colors[i * 3] = floor;
    colors[i * 3 + 1] = fine;
  }
  for (let i = 0; i < p.count; i++) {
    // ridges catch light, hollows and crater floors stay dark; a little mineral tint variation
    const relief = Math.min(1, Math.max(0, (ks[i] - mean) * 2.4 + 0.55));
    const ao = 0.5 + 0.5 * relief - colors[i * 3] * 0.22;
    const grain = 0.86 + colors[i * 3 + 1] * 0.28;
    const c = Math.max(0.18, ao * grain);
    colors[i * 3] = c * 1.02;
    colors[i * 3 + 1] = c;
    colors[i * 3 + 2] = c * 0.96;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}
let rockMat;
export function rockMaterial() {
  if (rockMat) return rockMat;
  rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0.02 });
  bindColor(rockMat, 'color', '#575c6f', '#e9edf5');
  // a faint fill keeps the shadow side readable against the dark sky
  bindColor(rockMat, 'emissive', '#070b1d', '#7f97c9');
  bindNum(rockMat, 'emissiveIntensity', 0.8, 0.1);
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
   Nova — the Programming Worlds mascot: a friendly hovering assistant
   robot (~1.7 units tall, faces +Z). Rounded primitives that share a few
   materials; the eyes, smile and antenna glow through the bloom pass.
   ====================================================================== */
let novaMats;
function novaMaterials() {
  if (novaMats) return novaMats;
  const shell = new THREE.MeshPhysicalMaterial({ roughness: 0.3, metalness: 0.12, clearcoat: 0.8, clearcoatRoughness: 0.18 });
  bindColor(shell, 'color', '#d9e2ff', '#ffffff');
  const trim = new THREE.MeshPhysicalMaterial({ color: '#3b41e3', roughness: 0.32, metalness: 0.2, clearcoat: 0.6 });
  bindColor(trim, 'emissive', '#1b22a8', '#0d1490');
  bindNum(trim, 'emissiveIntensity', 0.35, 0.12);
  const visor = new THREE.MeshPhysicalMaterial({ color: '#060a22', roughness: 0.1, metalness: 0.5, clearcoat: 1 });
  const glow = new THREE.MeshBasicMaterial({ toneMapped: false });
  bindColor(glow, 'color', '#a8e2ff', '#5fc4ff');
  const gold = new THREE.MeshStandardMaterial({ color: '#ffb545', roughness: 0.35, metalness: 0.4, emissive: '#ff9a2e', emissiveIntensity: 0.6 });
  // chest badge: the </> glyph on brand blue
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#3b41e3';
  g.beginPath();
  g.arc(64, 64, 64, 0, Math.PI * 2);
  g.fill();
  g.translate(24, 24);
  g.scale(80 / 24, 80 / 24);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2.2;
  g.lineCap = g.lineJoin = 'round';
  g.stroke(new Path2D('M8 8l-4 4 4 4 M16 8l4 4-4 4 M13.5 6l-3 12'));
  const badge = new THREE.MeshBasicMaterial({ map: canvasTexture(c), toneMapped: false });
  const shadow = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, depthWrite: false });
  bindNum(shadow, 'opacity', 0.35, 0.12);
  novaMats = { shell, trim, visor, glow, gold, badge, shadow };
  return novaMats;
}

export function makeNova() {
  const M = novaMaterials();
  const group = new THREE.Group(); // floor level
  const body = new THREE.Group(); // hovers above it
  group.add(body);
  const add = (geo, mat, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  // torso: an egg with a blue belt, a chest badge and a hover jet below
  add(new THREE.SphereGeometry(0.36, 32, 24), M.shell, body, 0, 0.62, 0).scale.set(1, 1.08, 0.9);
  add(new THREE.TorusGeometry(0.335, 0.035, 10, 48), M.trim, body, 0, 0.5, 0).rotation.x = Math.PI / 2;
  add(new THREE.CircleGeometry(0.1, 32), M.badge, body, 0, 0.74, 0.322).rotation.x = -0.18;
  const jet = add(new THREE.TorusGeometry(0.15, 0.03, 8, 32), M.gold, body, 0, 0.25, 0);
  jet.rotation.x = Math.PI / 2;
  const flame = makeGlow(1.3, '#ffb545', '#ff9a2e', 0.6, 0.35);
  flame.position.y = 0.14;
  body.add(flame);
  add(new THREE.CylinderGeometry(0.07, 0.09, 0.12, 16), M.trim, body, 0, 1.0, 0);
  // head: rounded shell, dark visor with glowing eyes and smile, headphone ears, antenna
  const head = new THREE.Group();
  head.position.set(0, 1.32, 0);
  body.add(head);
  add(new RoundedBoxGeometry(0.8, 0.6, 0.62, 5, 0.22), M.shell, head);
  add(new RoundedBoxGeometry(0.64, 0.42, 0.1, 4, 0.12), M.visor, head, 0, -0.01, 0.28);
  const eyeGeo = new THREE.CapsuleGeometry(0.045, 0.08, 4, 12);
  const eyes = [-0.13, 0.13].map((x) => add(eyeGeo, M.glow, head, x, 0.035, 0.335));
  const smile = add(new THREE.TorusGeometry(0.075, 0.014, 6, 24, Math.PI), M.glow, head, 0, -0.06, 0.335);
  smile.rotation.z = Math.PI;
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 28), M.trim, head, s * 0.41, 0, 0).rotation.z = Math.PI / 2;
    add(new THREE.TorusGeometry(0.115, 0.02, 8, 32), M.gold, head, s * 0.455, 0, 0).rotation.y = Math.PI / 2;
  }
  add(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 8), M.trim, head, 0, 0.4, 0);
  const tip = add(new THREE.SphereGeometry(0.055, 16, 12), M.gold, head, 0, 0.54, 0);
  const tipGlow = makeGlow(0.6, '#ffb545', '#ff9a2e', 0.7, 0.4);
  tipGlow.position.y = 0.54;
  head.add(tipGlow);
  // arms on shoulder pivots
  const arm = (s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.37, 0.8, 0);
    body.add(pivot);
    add(new THREE.CapsuleGeometry(0.06, 0.2, 4, 12), M.shell, pivot, 0, -0.15, 0);
    add(new THREE.SphereGeometry(0.075, 16, 12), M.trim, pivot, 0, -0.32, 0);
    pivot.rotation.z = s * 0.25;
    return pivot;
  };
  const armL = arm(-1), armR = arm(1);
  const shadow = add(new THREE.CircleGeometry(0.42, 32), M.shadow, group, 0, 0.01, 0);
  shadow.rotation.x = -Math.PI / 2;

  /** tilt: lean (radians), wave: 0..1 raises the right arm, look: head turn (radians) */
  function update(t, { tilt = 0, wave = 0, look = 0 } = {}) {
    const bob = Math.sin(t * 2.1) * 0.05;
    body.position.y = 0.3 + bob;
    body.rotation.x = tilt;
    head.rotation.y = look + Math.sin(t * 0.7) * 0.14;
    head.rotation.z = Math.sin(t * 0.9) * 0.05;
    const blink = t % 3.7 < 0.13 ? 0.15 : 1;
    for (const e of eyes) e.scale.y = blink;
    tip.scale.setScalar(1 + Math.sin(t * 4) * 0.15);
    jet.scale.setScalar(1 + Math.sin(t * 9) * 0.06);
    armL.rotation.x = Math.sin(t * 1.6) * 0.18;
    armR.rotation.x = -Math.sin(t * 1.6) * 0.18 * (1 - wave);
    armR.rotation.z = 0.25 + wave * (2.25 + Math.sin(t * 6) * 0.3);
    shadow.scale.setScalar(1 - bob * 1.6);
  }
  update(0);
  return { group, update };
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
