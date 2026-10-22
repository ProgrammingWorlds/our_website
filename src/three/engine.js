import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLOBAL, bindNum, damp } from './lib.js';

/** Visible height of the z=0 plane in world units. One section stage = VIEW_H. */
export const VIEW_H = 10;
const FOV = 35;

// Adaptive quality ladder; the engine steps down when frames run long.
const TIERS = [
  { pr: 2, bloom: true },
  { pr: 1.5, bloom: true },
  { pr: 1.25, bloom: false },
  { pr: 1, bloom: false },
  { pr: 0.75, bloom: false },
];



class MultiScenePass extends Pass {
  constructor(engine) {
    super();
    this.engine = engine;
    this.needsSwap = false;
  }
  render(renderer, writeBuffer, readBuffer) {
    this.engine.renderScenes(this.renderToScreen ? null : readBuffer);
  }
}

export class Engine {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.reduced = !!opts.reduced;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.capture });
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.autoClear = false;
    this.renderer = renderer;

    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);
    this.camDist = VIEW_H / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    this.camera.position.z = this.camDist;

    const pm = new THREE.PMREMGenerator(renderer);
    this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();

    this.scenes = [];
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    this.ctx = { time: 0, dt: 0, dir: 1, mode: 'desktop', viewH: VIEW_H, viewW: VIEW_H, aspect: 1, reduced: this.reduced, pointer: this.pointer, lang: 'en' };

    const isMobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
    const forced = opts.quality;
    this.tier = forced === 'high' ? 0 : forced === 'low' ? 3 : isMobile ? 2 : devicePixelRatio > 2 ? 1 : 0;
    this.adaptive = !forced;
    this.capture = !!opts.capture;
    this.frameTimes = [];

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new MultiScenePass(this));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 0.72);
    bindNum(this.bloom, 'strength', 0.5, 0.14);
    bindNum(this.bloom, 'threshold', 0.72, 0.96);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this._v = new THREE.Vector3();
    this.resize = this.resize.bind(this);
    addEventListener('resize', this.resize);
    addEventListener('pointermove', (e) => {
      this.pointer.tx = (e.clientX / innerWidth) * 2 - 1;
      this.pointer.ty = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
    this.resize();
  }

  get quality() {
    return TIERS[this.tier];
  }

  add(def) {
    def.scene.environment = this.env;
    def.stage = def.section.querySelector('.stage');
    def.hud = def.section.querySelector('[data-hud]');
    def.state = { visible: false, progress: 0, sticky: 0, rect: null, stageRect: null };
    def.layout?.(this.ctx);
    this.scenes.push(def);
    return def;
  }

  setDir(dir) {
    this.ctx.dir = dir;
    for (const s of this.scenes) s.layout?.(this.ctx);
  }

  applyQuality() {
    const pr = Math.min(devicePixelRatio || 1, this.quality.pr);
    this.pr = pr;
    GLOBAL.uPR.value = pr;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(innerWidth, innerHeight);
    this.bloom.setSize(Math.round((innerWidth * pr) / 2), Math.round((innerHeight * pr) / 2));
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    Object.assign(this.ctx, {
      aspect: w / h,
      viewW: VIEW_H * (w / h),
      width: w,
      height: h,
      mode: w <= 760 ? 'mobile' : w <= 1024 ? 'tablet' : 'desktop',
    });
    this.applyQuality();
    for (const s of this.scenes) s.layout?.(this.ctx);
  }

  /** World (z=0 plane) coordinates from a stage-relative fraction. Mirrors x in RTL. */
  frac(x, y) {
    return [(x - 0.5) * this.ctx.viewW * this.ctx.dir, (0.5 - y) * VIEW_H];
  }

  /** Project a world point to CSS px relative to the given stage rect. */
  project(obj, stageRect, out = {}) {
    const v = obj.isVector3 ? this._v.copy(obj) : obj.getWorldPosition(this._v);
    v.project(this.camera);
    out.x = (v.x * 0.5 + 0.5) * innerWidth - stageRect.left;
    out.y = (-v.y * 0.5 + 0.5) * innerHeight - stageRect.top;
    out.z = v.z;
    return out;
  }
  /** On-screen radius in px of a sphere of world radius r at obj's position. */
  screenRadius(obj, r) {
    const p = obj.getWorldPosition(new THREE.Vector3());
    const dist = this.camera.position.distanceTo(p);
    return (r / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * dist)) * innerHeight;
  }

  start() {
    this.clock = new THREE.Clock();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.frame();
    };
    loop();
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const ctx = this.ctx;
    ctx.dt = dt;
    ctx.time += this.reduced ? dt * 0.25 : dt;
    GLOBAL.uTime.value = ctx.time;

    const p = this.pointer;
    const k = this.reduced ? 0 : 1;
    p.x = damp(p.x, p.tx * k, 3, dt);
    p.y = damp(p.y, p.ty * k, 3, dt);
    this.camera.position.x = p.x * 0.32;
    this.camera.position.y = -p.y * 0.2;
    this.camera.lookAt(p.x * 0.08, -p.y * 0.05, 0);

    const vh = innerHeight;
    // Reads first, then writes (keeps layout thrash out of the loop).
    for (const s of this.scenes) {
      const r = s.section.getBoundingClientRect();
      const sr = s.stage.getBoundingClientRect();
      const st = s.state;
      st.rect = r;
      st.stageRect = sr;
      st.visible = r.bottom > -2 && r.top < vh + 2;
      st.progress = Math.min(1, Math.max(0, (vh - r.top) / (r.height + vh)));
      st.sticky = r.height > vh ? Math.min(1, Math.max(0, -r.top / (r.height - vh))) : st.progress;
      st.enter = Math.min(1, Math.max(0, (vh - r.top) / vh)); // 0 → 1 while scrolling in
      st.leave = Math.min(1, Math.max(0, -(r.bottom - vh) / vh)); // 0 → 1 while scrolling out
    }
    for (const s of this.scenes) {
      const st = s.state;
      if (!st.visible) continue;
      s.root.position.y = -((st.stageRect.top + st.stageRect.height / 2 - vh / 2) * VIEW_H) / vh;
      s.update?.(ctx, st);
    }

    if (this.quality.bloom) this.composer.render(dt);
    else this.renderScenes(null);

    this.monitor(dt);
  }


  renderScenes(target) {
    const r = this.renderer;
    const W = innerWidth, H = innerHeight;
    r.setRenderTarget(target);
    r.setClearColor(0x030b20, 1);
    r.clear();
    for (const s of this.scenes) {
      const st = s.state;
      if (!st.visible) continue;
      const top = Math.max(0, st.rect.top), bottom = Math.min(H, st.rect.bottom);
      if (bottom - top < 1) continue;
      const x = 0, y = H - bottom, w = W, h = bottom - top;
      if (target) {
        const pr = this.pr;
        target.scissor.set(Math.floor(x * pr), Math.floor(y * pr), Math.ceil(w * pr), Math.ceil(h * pr));
        target.scissorTest = true;
        r.setRenderTarget(target);
      } else {
        r.setScissor(x, y, w, h);
        r.setScissorTest(true);
      }
      // per-scene projection shift (e.g. tunnel vanishing point)
      const sx = (s.viewShift?.x || 0) * this.ctx.dir, sy = s.viewShift?.y || 0;
      if (sx || sy) this.camera.setViewOffset(W, H, -sx * W, -sy * H, W, H);
      else if (this.camera.view?.enabled) this.camera.clearViewOffset();
      const pr = this.pr;
      s.bg?.material.uniforms.uRect.value.set(0, (H - st.rect.bottom) * pr, W * pr, st.rect.height * pr);
      if (s.bg && s.bgStage) s.bg.material.uniforms.uRect.value.set(0, (H - st.stageRect.bottom) * pr, W * pr, st.stageRect.height * pr);
      r.clearDepth();
      r.render(s.scene, this.camera);
    }
    if (target) {
      target.scissorTest = false;
      r.setRenderTarget(target);
    }
    r.setScissorTest(false);
  }

  monitor(dt) {
    if (!this.adaptive || document.hidden) return;
    const f = this.frameTimes;
    f.push(dt);
    if (f.length < 120) return;
    const avg = f.reduce((a, b) => a + b, 0) / f.length;
    f.length = 0;
    if (avg > 1 / 42 && this.tier < TIERS.length - 1) {
      this.tier++;
      this.applyQuality();
    }
  }
}
