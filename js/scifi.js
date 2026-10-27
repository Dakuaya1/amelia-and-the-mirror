// The Mirror's light, wherever the reader crosses into a page: streaks of green
// glass rushing out of the portal as the camera dives through it, and a small
// readout in the corner while the reader is inside a chapter.
const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const GLASS = [126, 240, 200];
const GILT = [228, 197, 135];

/** Light streaks radiating from the portal's centre: the speed of the dive, seen. */
export class Warp {
  constructor(canvas, count = 130) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ratio = 1;
    this.shown = false;
    this.streaks = Array.from({ length: count }, () => this.spawn({}, true));
  }

  spawn(s, anywhere = false) {
    s.a = Math.random() * Math.PI * 2;
    s.d = anywhere ? Math.random() : Math.random() * 0.15; // 0 at the centre, 1 at the screen's corner
    s.v = 0.35 + Math.random() * 0.9;
    s.w = 0.6 + Math.random() * 1.4;
    s.gilt = Math.random() < 0.28;
    return s;
  }

  setSize(w, h, ratio) {
    this.ratio = Math.min(ratio, 1);
    this.canvas.width = Math.round(w * this.ratio);
    this.canvas.height = Math.round(h * this.ratio);
    this.w = w;
    this.h = h;
  }

  /**
   * amount: 0..1, how fast the reader is falling through the page.
   * cx, cy: the portal's centre on screen (px).
   */
  update(amount, cx, cy, dt) {
    const g = this.ctx;
    if (REDUCE || amount < 0.01) {
      if (this.shown) {
        g.setTransform(1, 0, 0, 1, 0, 0); // the whole canvas, whatever scale the last frame drew at
        g.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.shown = false;
      }
      return;
    }
    this.shown = true;
    const r = this.ratio;
    g.setTransform(r, 0, 0, r, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    const reach = Math.hypot(this.w, this.h) * 0.75;
    const speed = 0.25 + amount * 2.4;
    for (const s of this.streaks) {
      // farther out, faster: things accelerate past the eye
      s.d += dt * s.v * speed * (0.25 + s.d * 1.6);
      if (s.d > 1.15) this.spawn(s);
      const r0 = s.d * reach;
      const len = (8 + amount * 220 * s.v) * (0.3 + s.d);
      const ca = Math.cos(s.a);
      const sa = Math.sin(s.a);
      const fade = Math.min(1, s.d * 4) * Math.min(1, (1.15 - s.d) * 5);
      const [cr, cg, cb] = s.gilt ? GILT : GLASS;
      g.strokeStyle = `rgba(${cr},${cg},${cb},${Math.min(1, amount * fade * 0.85).toFixed(3)})`;
      g.lineWidth = s.w * (0.8 + amount * 1.4);
      g.beginPath();
      g.moveTo(cx + ca * r0, cy + sa * r0);
      g.lineTo(cx + ca * (r0 + len), cy + sa * (r0 + len));
      g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
  }
}

const pad = (n, w = 2) => String(n).padStart(w, '0');

/** A small readout while the reader is inside a chapter: where, which scene, how long. */
export class Hud {
  constructor(root) {
    this.root = root;
    this.title = root.querySelector('[data-hud="title"]');
    this.page = root.querySelector('[data-hud="page"]');
    this.scene = root.querySelector('[data-hud="scene"]');
    this.bars = root.querySelector('[data-hud="bars"]');
    this.time = root.querySelector('[data-hud="time"]');
    this.wave = root.querySelector('[data-hud="wave"]');
    this.key = '';
    this.sceneKey = '';
    this.entered = 0;
    this.lastTick = 0;
  }

  /**
   * chapter: number (or null when not inside), label, heading, page: the printed
   * page, scene/n: the caption on screen (1-based, 0 before the first).
   */
  update({ chapter, label, heading, page, scene, n, now }) {
    if (!chapter) {
      this.key = '';
      return;
    }
    const key = `${chapter}`;
    if (key !== this.key) {
      this.key = key;
      this.entered = now;
      this.title.textContent = `${label} · ${heading}`;
      this.page.textContent = `Page ${page}`;
      this.bars.innerHTML = Array.from({ length: n }, () => '<i></i>').join('');
      this.sceneKey = '';
    }
    const sk = `${scene}`;
    if (sk !== this.sceneKey) {
      this.sceneKey = sk;
      this.scene.textContent = `Scene ${pad(Math.max(1, scene))} / ${pad(n)}`;
      [...this.bars.children].forEach((b, i) => b.classList.toggle('is-on', i < scene));
    }
    // the clock and the signal, ten times a second
    if (now - this.lastTick < 100) return;
    this.lastTick = now;
    const e = (now - this.entered) / 1000;
    this.time.textContent = `T+ ${pad(Math.floor(e / 60))}:${pad(Math.floor(e % 60))}.${Math.floor((e * 10) % 10)}`;
    if (!REDUCE) {
      const t = now / 1000;
      let d = 'M0 8';
      for (let x = 0; x <= 120; x += 4) {
        const y = 8 + Math.sin(x * 0.21 + t * 5.2) * 3.2 * Math.sin(x * 0.045 + t * 1.3) + Math.sin(x * 0.9 + t * 11) * 0.8;
        d += ` L${x} ${y.toFixed(1)}`;
      }
      this.wave.setAttribute('d', d);
    }
  }
}
