// The world inside the page. Each showcased chapter is a built place (see
// worlds/); the camera glides through it along a curve, holding at each of the
// chapter's moments while the book's passage for that moment is on screen.
import * as THREE from 'three';
import { EffectComposer } from '../vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/addons/postprocessing/OutputPass.js';
import { ShaderPass } from '../vendor/addons/postprocessing/ShaderPass.js';
import { WORLDS } from './worlds/index.js';
import { disposeScene } from './worlds/kit.js';
import { makeAO, aimAO } from './ao.js';
import { onModelLoaded } from './assets.js';
import { DESKTOP_CLASS } from './device.js';

const whenIdle = window.requestIdleCallback
  ? (fn) => window.requestIdleCallback(fn, { timeout: 400 })
  : (fn) => window.setTimeout(fn, 40);
const KEEP = DESKTOP_CLASS ? 3 : 2; // worlds kept built at once: the last, the current and the next (no rebuilding going forward)
const TEX_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'clearcoatNormalMap', 'sheenColorMap'];

// The last pass: a light film grade over the tone-mapped picture, so the eight worlds
// share one finish. Cool shadows and warm light (split toning), a little contrast with
// lifted blacks, a vignette, and a fine moving grain. A world can tune it with `grade`.
const GRADE = { shadow: [0.9, 0.95, 1.06], high: [1.05, 1.0, 0.93], contrast: 1.06, lift: 0.014, sat: 1.05, vignette: 0.34, grain: 0.03 };
const GradeShader = {
  name: 'InsideGrade',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uShadow: { value: new THREE.Color() },
    uHigh: { value: new THREE.Color() },
    uContrast: { value: 1 },
    uLift: { value: 0 },
    uSat: { value: 1 },
    uVignette: { value: 0 },
    uGrain: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uContrast, uLift, uSat, uVignette, uGrain; uniform vec3 uShadow, uHigh; uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c *= mix(uShadow, uHigh, smoothstep(0.04, 0.7, l));
      c = (c - 0.45) * uContrast + 0.45;
      c = c * (1.0 - uLift) + uLift * uShadow * 0.8;
      c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, uSat);
      vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
      c *= 1.0 - uVignette * smoothstep(0.32, 1.0, length(q));
      c += (hash(floor(vUv * uRes) + fract(uTime * 7.31) * 113.0) - 0.5) * uGrain;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

// The dive through the page: the world streams out from the portal's centre (a zoom blur),
// its colours part at the edges (red outward, blue inward) and the Mirror's green glass
// glows at the heart of it. Only switched on while the reader is crossing.
const WarpShader = {
  name: 'InsideWarp',
  uniforms: {
    tDiffuse: { value: null },
    uAmount: { value: 0 },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uAspect: { value: 1 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uAmount, uAspect; uniform vec2 uCenter;
    varying vec2 vUv;
    void main() {
      vec2 d = vUv - uCenter;
      vec3 acc = vec3(0.0);
      float tot = 0.0;
      for (int i = 0; i < 10; i++) {
        float f = float(i) / 9.0;
        float s = 1.0 - uAmount * 0.17 * f;
        float w = 1.0 - f * 0.55;
        float ca = uAmount * 0.022 * (0.35 + f);
        acc.r += texture2D(tDiffuse, uCenter + d * s * (1.0 + ca)).r * w;
        acc.g += texture2D(tDiffuse, uCenter + d * s).g * w;
        acc.b += texture2D(tDiffuse, uCenter + d * s * (1.0 - ca)).b * w;
        tot += w;
      }
      vec3 c = acc / tot;
      float r = length(d * vec2(uAspect, 1.0));
      c += vec3(0.32, 0.94, 0.76) * uAmount * 0.22 * (1.0 - smoothstep(0.0, 0.42, r));
      gl_FragColor = vec4(c, 1.0);
    }`,
};

// Textures uploaded a few per frame, within a small time budget, ahead of first sight. Images
// are decoded off the main thread first (img.decode), so each upload is quick.
export class Uploader {
  constructor(renderer) {
    this.renderer = renderer;
    this.list = [];
    this.seen = new WeakSet();
  }

  queue(root) {
    root.traverse((o) => {
      if (!o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        const list = TEX_KEYS.map((key) => m[key]).concat(m.userData?.textures || []);
        if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u && u.value && u.value.isTexture) list.push(u.value);
        for (const t of list) {
          if (!t || !t.isTexture || t.isRenderTargetTexture || this.seen.has(t)) continue;
          this.seen.add(t);
          this.list.push(t);
        }
      }
    });
  }

  tick() {
    const t0 = performance.now();
    let n = 0;
    while (this.list.length && n < 16 && performance.now() - t0 < 6) {
      const t = this.list.shift();
      n++;
      const img = t.image;
      t.userData.tries = (t.userData.tries || 0) + 1;
      if (t.userData.tries > 900) continue; // never loaded: give up on it
      if (!img) { this.list.push(t); continue; }
      if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
        if (!img.complete || !img.naturalWidth) { this.list.push(t); continue; }
        if (!img.dataset.decoded) {
          if (!img.dataset.decoding) {
            img.dataset.decoding = '1';
            img.decode().then(() => { img.dataset.decoded = '1'; }, () => { img.dataset.decoded = '1'; });
          }
          this.list.push(t);
          continue;
        }
      }
      this.renderer.initTexture(t);
    }
  }
}

export class Inside {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 2500);
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(new THREE.Scene(), this.camera);
    this.composer.addPass(this.renderPass);
    this.ao = makeAO(this.renderPass.scene, this.camera, 256, 256, 0.45); // worlds are in metres
    if (this.ao) this.composer.addPass(this.ao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.warp = new ShaderPass(WarpShader);
    this.warp.enabled = false;
    this.composer.addPass(this.warp);

    // Work done ahead of first sight: textures uploaded a few per frame (tick), shaders compiled
    // in parallel (compileAsync), and models that drop in later compiled the same way.
    this.uploader = new Uploader(this.renderer);
    this.busy = false;
    onModelLoaded((obj, holder) => {
      let root = holder;
      while (root.parent) root = root.parent;
      for (const w of this.worlds.values()) {
        if (w.scene !== root) continue;
        this.queueTextures(obj);
        this.compileAhead(obj, root);
      }
    });
    this.worlds = new Map(); // chapter -> built world
    this.order = []; // most recently used last
    this.scheduled = new Set();
    this.world = null;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
  }

  // Shaders depend on where they draw: the worlds draw into the composer's buffer (linear, tone
  // mapped later), not the screen. Compile with that buffer bound, or every shader is compiled
  // again on first sight.
  compileAhead(obj, scene) {
    const r = this.renderer;
    const prev = r.getRenderTarget();
    r.setRenderTarget(this.composer.readBuffer);
    r.compileAsync(obj, this.camera, scene).catch(() => {});
    r.setRenderTarget(prev);
  }

  queueTextures(root) { this.uploader.queue(root); }

  tick() { this.uploader.tick(); }

  // Draw a built world once, small and unseen, from its first camera: its shadow maps and its
  // materials' variants compile, and its loaded textures upload, before the reader arrives.
  warmRender(w) {
    const r = this.renderer;
    if (!this.warmTarget) this.warmTarget = new THREE.WebGLRenderTarget(160, 90, { type: THREE.HalfFloatType });
    const cam = this.camera.clone();
    cam.position.copy(w.beats[0].pos);
    cam.lookAt(w.beats[0].look);
    cam.updateMatrixWorld();
    const prev = r.getRenderTarget();
    r.setRenderTarget(this.warmTarget);
    r.render(w.scene, cam);
    r.setRenderTarget(prev);
  }

  // Build a world and draw it once, unseen: compiles the shared passes (shadows, occlusion,
  // bloom, the grade) and the world's own shaders while the loading screen is up.
  warmUp(k) {
    if (!WORLDS[k]) return;
    this.pose(k, 0, 0, 0, 1 / 60, window.innerWidth, window.innerHeight);
    this.render();
  }

  captions(k) {
    return WORLDS[k] ? WORLDS[k].captions : [];
  }

  sceneCount(k) {
    return this.captions(k).length;
  }

  // Build a chapter's world in idle time, before the reader gets there.
  // Building a world is real work on the main thread, so it waits for a pause in the
  // scrolling (readers stop to read). If no pause comes within a few seconds, it builds anyway,
  // still ahead of the reader. (busy is set each frame by the page while the scroll is moving.)
  prefetch(k) {
    if (!WORLDS[k] || this.worlds.has(k) || this.scheduled.has(k)) return;
    this.scheduled.add(k);
    const asked = performance.now();
    const attempt = () => {
      if (!this.worlds.has(k)) {
        if (this.busy && performance.now() - asked < 1500) return whenIdle(attempt);
        this.ensure(k);
        // and, if the pause holds, draw it once unseen
        whenIdle(() => { const w = this.worlds.get(k); if (w && !this.busy && w !== this.world) this.warmRender(w); });
      }
      this.scheduled.delete(k);
    };
    whenIdle(attempt);
  }

  ensure(k) {
    let w = this.worlds.get(k);
    if (!w) {
      const t0 = performance.now();
      w = WORLDS[k].build({ renderer: this.renderer });
      w.k = k;
      performance.measure(`world ${k} build`, { start: t0 });
      // The camera curve runs through every beat, and through any waypoints a
      // beat lists in `via` (a doorway, a shaft, a stair) on the way to it.
      const pts = [];
      w.beatPoint = [];
      for (const b of w.beats) {
        if (b.via) pts.push(...b.via);
        w.beatPoint.push(pts.length);
        pts.push(b.pos);
      }
      w.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      w.curveLast = pts.length - 1;
      this.worlds.set(k, w);
      // compile shaders in parallel and queue the textures, well before the first visible frame
      this.compileAhead(w.scene, w.scene);
      this.queueTextures(w.scene);
    }
    this.order = this.order.filter((x) => x !== k).concat(k);
    while (this.order.length > KEEP) {
      const old = this.order.shift();
      const ow = this.worlds.get(old);
      if (ow && ow !== this.world) {
        disposeScene(ow.scene);
        this.worlds.delete(old);
      }
    }
    return w;
  }

  /**
   * s: 0 = establishing view, i = the i-th caption's view; beyond the last
   * caption the camera keeps moving into the scene. back: extra distance
   * behind the establishing view while the portal opens.
   */
  pose(k, s, back, t, dt, W, H) {
    const w = this.ensure(k);
    this.world = w;
    const beats = w.beats;
    const n = beats.length - 1;
    const sc = Math.min(s, n);
    const i = Math.min(Math.floor(sc), n);
    const f = sc - i;
    const a = w.beatPoint[i];
    const b = w.beatPoint[Math.min(i + 1, n)];
    w.curve.getPoint(w.curveLast ? (a + (b - a) * f) / w.curveLast : 0, this.pos);
    this.look.copy(beats[i].look).lerp(beats[Math.min(i + 1, n)].look, f);
    if (s > n) {
      this.tmp.copy(beats[n].look).sub(beats[n].pos).normalize();
      this.pos.addScaledVector(this.tmp, (s - n) * 2.2);
      this.look.addScaledVector(this.tmp, (s - n) * 2.2);
    }
    if (back > 0) {
      this.tmp.copy(beats[0].look).sub(beats[0].pos).normalize();
      // indoor worlds fall forward less far (backScale), so the camera never starts behind a wall
      this.pos.addScaledVector(this.tmp, -back * (w.backScale ?? 1));
    }
    // a slow breath of movement, so a held frame is never dead still
    this.pos.x += Math.sin(t * 0.31) * 0.03;
    this.pos.y += Math.sin(t * 0.23) * 0.02;
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);

    // Keep the subject clear of the caption: wide screens push it to the other
    // side (odd captions sit on the right), phones lift it above the caption.
    const wide = W > 860;
    const side = (j) => (j < 1 || j > n ? 0 : j % 2 ? 1 : -1);
    const sf = THREE.MathUtils.smoothstep(f, 0.25, 0.75);
    const blend = side(i) * (1 - sf) + side(i + 1) * sf;
    const lift = i >= 1 || f > 0.5 ? 1 : 0;
    this.camera.setViewOffset(W, H, wide ? blend * W * 0.12 : 0, wide ? 0 : H * 0.14 * lift, W, H);
    this.camera.updateProjectionMatrix();

    this.renderer.toneMappingExposure = w.exposure || 1;
    // a world can ask for its own finish: a painted world shows its colours untouched
    this.renderer.toneMapping = w.toneMapping ?? THREE.ACESFilmicToneMapping;
    if (this.ao) this.ao.enabled = !w.noAO;
    this.bloom.strength = w.bloom ?? 0.32;
    w.camera = this.camera;
    const g = { ...GRADE, ...(w.grade || {}) };
    const u = this.grade.uniforms;
    u.uTime.value = t;
    u.uShadow.value.setRGB(...g.shadow);
    u.uHigh.value.setRGB(...g.high);
    u.uContrast.value = g.contrast;
    u.uLift.value = g.lift;
    u.uSat.value = g.sat;
    u.uVignette.value = g.vignette;
    u.uGrain.value = g.grain;
    w.update(t, dt, s, this.camera.position);
  }

  /** amount: 0..1 while the reader dives through the page; cx, cy: the portal's centre (0..1, from the bottom left). */
  setWarp(amount, cx = 0.5, cy = 0.5) {
    this.warp.enabled = amount > 0.004;
    this.warp.uniforms.uAmount.value = amount;
    this.warp.uniforms.uCenter.value.set(cx, cy);
  }

  setPixelRatio(ratio) {
    this.renderer.setPixelRatio(Math.min(ratio, 1.25));
  }

  setSize(w, h) {
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    // (the glow is soft: phones draw it at half resolution)
    this.bloom.setSize(DESKTOP_CLASS ? w : w / 2, DESKTOP_CLASS ? h : h / 2);
    this.grade.uniforms.uRes.value.set(w, h);
    this.warp.uniforms.uAspect.value = w / h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render() {
    if (!this.world) return;
    this.renderPass.scene = this.world.scene;
    if (!this.world.noAO) aimAO(this.ao, this.world.scene, this.camera, this.world.aoRadius ?? 0.45);
    const t0 = performance.now();
    const p0 = this.renderer.info.programs.length, x0 = this.renderer.info.memory.textures;
    this.composer.render();
    const dt = performance.now() - t0;
    if (dt > 30) performance.measure(`inside render ${this.world.k ?? '?'} ${dt.toFixed(0)}ms +${this.renderer.info.programs.length - p0} programs +${this.renderer.info.memory.textures - x0} textures`, { start: t0 });
  }
}
