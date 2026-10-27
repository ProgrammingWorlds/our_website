import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLOBAL, bindColor, bindNum, damp, clamp01, smooth } from './lib.js';
import { createSky } from './sky.js';
import { createGates } from './gates.js';

const FOV = 38;

// Adaptive quality ladder; the world steps down when frames run long.
const TIERS = [
  { pr: 2, bloom: true },
  { pr: 1.5, bloom: true },
  { pr: 1.25, bloom: true },
  { pr: 1, bloom: false },
  { pr: 0.75, bloom: false },
];

// Final lens: chromatic fringing + radial zoom blur that grow with scroll
// speed (the "warp" feel), vignette and film grain.
const LensShader = {
  uniforms: { tDiffuse: { value: null }, uVel: { value: 0 }, uTime: GLOBAL.uTime, uTheme: GLOBAL.uTheme, uAspect: { value: 1 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uVel, uTime, uTheme, uAspect; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float r2 = dot(c*vec2(uAspect,1.0), c*vec2(uAspect,1.0));
      vec2 off = c * (0.0016 + uVel*0.014) * (0.3 + r2*2.4);
      vec3 col = vec3(texture2D(tDiffuse, vUv - off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + off).b);
      float zb = smoothstep(0.04, 0.6, uVel);
      if (zb > 0.0) {
        vec3 acc = col;
        for (int i = 1; i < 8; i++) acc += texture2D(tDiffuse, vUv - c*(float(i)/8.0)*uVel*0.075).rgb;
        col = mix(col, acc/8.0, zb);
      }
      float vig = smoothstep(0.95, 0.15, length(c*vec2(1.0, 0.9)));
      col *= mix(0.5 + 0.5*vig, 0.86 + 0.14*vig, uTheme);
      col += (hash(vUv*vec2(1731.0, 977.0) + fract(uTime*7.3)) - 0.5) * mix(0.018, 0.012, uTheme);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

/**
 * One continuous world. Stations sit along -Z; the camera follows a spline
 * through every station's keyframes, parameterised by the story position u
 * (chapter index + local progress).
 */
export class World {
  constructor(canvas, opts = {}) {
    this.reduced = !!opts.reduced;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.capture });
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    bindNum(scene, 'environmentIntensity', 0.42, 0.62);

    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 1400);
    this.camera = camera;
    scene.add(camera);

    // lights travel with the camera so every station is lit the same way
    const hemi = new THREE.HemisphereLight();
    bindColor(hemi, 'color', '#7d9bff', '#ffffff');
    bindColor(hemi, 'groundColor', '#060a1c', '#c5d4f1');
    bindNum(hemi, 'intensity', 0.62, 1.05);
    scene.add(hemi);
    const key = new THREE.DirectionalLight('#ffffff', 1.4);
    key.position.set(-6, 7, 6);
    key.target.position.set(0, 0, -12);
    bindNum(key, 'intensity', 1.35, 1.6);
    const rim = new THREE.DirectionalLight('#ffb36b', 1);
    rim.position.set(7, 2, -14);
    rim.target.position.set(0, 0, -10);
    bindNum(rim, 'intensity', 1.2, 0.5);
    camera.add(key, key.target, rim, rim.target);

    this.sky = createSky(this);
    scene.add(this.sky.group);
    this.gates = createGates(this);
    scene.add(this.gates.group);

    this.stations = [];
    this.keys = [];
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    this.ctx = { time: 0, dt: 0, u: 0, vel: 0, dir: 1, mode: 'desktop', reduced: this.reduced, pointer: this.pointer, lang: 'en', world: this };
    this.u = null;
    this.vel = 0;
    this.boost = 0; // extra "warp" from theme / language switches
    this.avoid = null; // screen rect labels must stay out of (the text panel)
    this.select = () => {}; // (chapter id, step) — set by the page

    // Start at a pixel ratio the GPU can hold at 60 fps: retina laptops render
    // at 1.5× (sharp enough under bloom + grain), phones at 1.25×.
    const isMobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
    const forced = opts.quality;
    this.tier = forced === 'high' ? 0 : forced === 'low' ? 3 : isMobile ? 2 : devicePixelRatio > 1.25 ? 1 : 0;
    this.adaptive = !forced;
    this.frameTimes = [];

    // MSAA matters at 1×; at higher ratios 2 samples look the same and cost half
    const samples = Math.min(devicePixelRatio || 1, TIERS[this.tier].pr) > 1.2 ? 2 : 4;
    const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples }));
    composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 0.7);
    bindNum(this.bloom, 'strength', 0.62, 0.16);
    bindNum(this.bloom, 'threshold', 0.7, 0.95);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.lens = new ShaderPass(LensShader);
    composer.addPass(this.lens);
    this.composer = composer;

    this.labelLayer = document.getElementById('labels');
    this._v = new THREE.Vector3();
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    addEventListener('resize', () => this.resize());
    addEventListener('pointermove', (e) => {
      this.pointer.tx = (e.clientX / innerWidth) * 2 - 1;
      this.pointer.ty = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
    this.resize();
  }

  get quality() {
    return TIERS[this.tier];
  }

  /** Register a station at story index i. Its keyframes join the camera path. */
  add(station, i) {
    station.index = i;
    station.labels ||= [];
    for (const L of station.labels) this.labelLayer.appendChild(L.el);
    this.scene.add(station.group);
    this.stations.push(station);
    station.layout?.(this.ctx);
    this.buildPath();
    return station;
  }

  buildPath() {
    this.keys = this.stations
      .flatMap((s) => s.keys.map((k) => ({ u: s.index + k.at, pos: new THREE.Vector3(...k.pos), look: new THREE.Vector3(...k.look), f: k.f ?? 1 })))
      .sort((a, b) => a.u - b.u);
    this.posCurve = new THREE.CatmullRomCurve3(this.keys.map((k) => k.pos), false, 'centripetal');
    this.lookCurve = new THREE.CatmullRomCurve3(this.keys.map((k) => k.look), false, 'centripetal');
    if (this.sealed) this.gates.build();
  }

  /** Call once every station is added: hangs the gates between them. */
  seal() {
    this.sealed = true;
    this.gates.build();
  }

  /** Camera-path position at story position u. */
  pointAt(u, out) {
    this.sample(u);
    return out.copy(this._pos);
  }

  /** A burst of warp: streaks, lens fringing and a FOV punch that settle back. */
  kick(amount = 1) {
    if (!this.reduced) this.boost = Math.max(this.boost, amount);
  }

  setDir(dir) {
    this.ctx.dir = dir;
    for (const s of this.stations) s.layout?.(this.ctx);
    this.buildPath();
  }

  applyQuality() {
    const pr = Math.min(devicePixelRatio || 1, this.quality.pr);
    this.pr = pr;
    GLOBAL.uPR.value = pr;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(innerWidth, innerHeight);
    this.bloom.enabled = this.quality.bloom;
    this.bloom.setSize(Math.round((innerWidth * pr) / 2), Math.round((innerHeight * pr) / 2));
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    Object.assign(this.ctx, { aspect: w / h, width: w, height: h, mode: w <= 760 ? 'mobile' : w <= 1100 ? 'tablet' : 'desktop' });
    this.lens.uniforms.uAspect.value = w / h;
    this.applyQuality();
    for (const s of this.stations) s.layout?.(this.ctx);
  }

  /** Camera pose at story position u. */
  sample(u) {
    const K = this.keys;
    let k = 0;
    while (k < K.length - 2 && u >= K[k + 1].u) k++;
    const a = K[k], b = K[k + 1];
    const t = clamp01((u - a.u) / (b.u - a.u));
    const p = (k + t) / (K.length - 1);
    this.posCurve.getPoint(p, this._pos);
    this.lookCurve.getPoint(p, this._look);
    // `f` = how much the station frames itself beside the text panel
    return a.f + (b.f - a.f) * t;
  }

  frame(dt, scroll) {
    const ctx = this.ctx;
    ctx.dt = dt;
    ctx.time += this.reduced ? dt * 0.25 : dt;
    GLOBAL.uTime.value = ctx.time;

    if (this.u == null || this.reduced) this.u = scroll.u;
    else this.u = damp(this.u, scroll.u, 9, dt);
    ctx.u = this.u;
    this.boost = damp(this.boost, 0, 2.2, dt);
    this.vel = this.reduced ? 0 : Math.max(this.boost, damp(this.vel, Math.min(1, Math.abs(scroll.velocity) / 55), 5, dt));
    ctx.vel = this.vel;

    // camera
    const f = this.sample(this.u);
    const cam = this.camera, pos = this._pos, look = this._look;
    const m = ctx.mode;
    // narrow screens pull the camera back so stations fit — except inside stations that opt out
    if (m !== 'desktop') {
      let hold = 0;
      for (const s of this.stations) if (s.noPush) hold = Math.max(hold, smooth(-0.12, 0.1, this.u - s.index) * (1 - smooth(0.9, 1.12, this.u - s.index)));
      const push = m === 'mobile' ? 1.5 + (1 - ctx.aspect) * 0.4 : 1.18;
      pos.sub(look).multiplyScalar(push + (1 - push) * hold).add(look);
    }
    const pt = this.pointer, k = this.reduced ? 0 : 1;
    pt.x = damp(pt.x, pt.tx * k, 2.6, dt);
    pt.y = damp(pt.y, pt.ty * k, 2.6, dt);
    cam.position.copy(pos);
    cam.lookAt(look);
    this._right.setFromMatrixColumn(cam.matrix, 0);
    this._up.setFromMatrixColumn(cam.matrix, 1);
    cam.position.addScaledVector(this._right, pt.x * 0.45).addScaledVector(this._up, -pt.y * 0.28);
    cam.lookAt(look);
    cam.rotateZ(-pt.x * 0.012 - this.vel * 0.02 * Math.sin(ctx.time * 0.7));
    // shift the projection so stations sit beside the text panel
    const W = innerWidth, H = innerHeight;
    const sx = m === 'desktop' ? 0.17 * f * ctx.dir : m === 'tablet' ? 0.1 * f * ctx.dir : 0;
    const sy = m === 'mobile' ? 0.2 * f : m === 'tablet' ? 0.06 * f : 0;
    cam.setViewOffset(W, H, -sx * W, -sy * H, W, H);
    const fov = FOV + this.vel * 9;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();

    for (const s of this.stations) {
      const local = this.u - s.index;
      const on = local > -0.3 && local < 1.35;
      s.group.visible = on;
      s.weight = on ? clamp01(1 - Math.max(-local, local - 1) / 0.6) : 0;
      if (on) s.update(ctx, clamp01(local), local);
    }
    this.sky.update(ctx);
    this.gates.update(ctx);
    this.placeLabels();
    this.lens.uniforms.uVel.value = this.vel;
    this.composer.render(dt);
    this.monitor(dt);
  }

  /** DOM labels follow their 3D anchors. */
  placeLabels() {
    const v = this._v, W = innerWidth, H = innerHeight;
    for (const s of this.stations) {
      for (const L of s.labels) {
        const a = s.group.visible ? (L.alpha ?? 0) : 0;
        if (a < 0.01) {
          if (L.shown) {
            L.el.style.opacity = '0';
            L.el.style.visibility = 'hidden';
            L.shown = false;
          }
          continue;
        }
        L.anchor.getWorldPosition(v);
        if (L.offset) v.add(L.offset);
        v.project(this.camera);
        if (v.z > 1) continue;
        const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
        // Labels fade out rather than sit on top of the text panel. The test uses
        // the label's whole box (centred on x, hanging below y), so no part of
        // it can ever cover — or take clicks from — the panel's controls.
        const r = this.avoid, hw = W <= 760 ? 75 : 120;
        const hit = r && x + hw > r.left - 16 && x - hw < r.right + 16 && y + 56 > r.top - 16 && y < r.bottom + 16;
        L.fade = damp(L.fade ?? 1, hit ? 0 : 1, 10, this.ctx.dt);
        if (!L.shown) {
          L.el.style.visibility = 'visible';
          L.shown = true;
        }
        L.el.style.opacity = (a * L.fade).toFixed(3);
        L.el.style.pointerEvents = hit || L.fade < 0.5 ? 'none' : '';
        L.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      }
    }
  }

  monitor(dt) {
    if (!this.adaptive || document.hidden || this.ctx.time < 3) return;
    const f = this.frameTimes;
    f.push(dt);
    if (f.length < 90) return;
    // the median ignores one-off hitches (tab switches, GC); step down below ~48 fps
    const med = f.sort((a, b) => a - b)[f.length >> 1];
    f.length = 0;
    if (med > 1 / 48 && this.tier < TIERS.length - 1) {
      this.tier++;
      this.applyQuality();
    }
  }
}
