// Inertial smooth scrolling for wheel, trackpad and keyboard. A mouse wheel
// moves the page in ~100px steps; fed straight into the 3D scene, every step
// becomes a visible jump. Here input only moves a target, and the real scroll
// position glides toward it each frame. Because the window itself scrolls,
// scrollcraft's cues and the 3D scene stay in step with each other.
// Touch is left native: phones already add their own momentum.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class SmoothScroll {
  /**
   * @param {{ lerp?: number, wheelScale?: number, maxStep?: number }} opts
   *   lerp: fraction of the remaining distance covered per 60 fps frame
   *   wheelScale: how far one unit of wheel input moves the page
   *   maxStep: the most a single wheel event can move the page, in px. Trackpad
   *     flicks send a few huge deltas; capped, a flick cannot fling the reader
   *     past several beats, and the page stops soon after the hand does.
   */
  constructor({ lerp = 0.12, wheelScale = 1.35, maxStep = 170 } = {}) {
    this.lerp = lerp;
    this.wheelScale = wheelScale;
    this.maxStep = maxStep;
    this.current = window.scrollY;
    this.target = this.current;
    this.lastSet = this.current;
    this.moving = false;
    this.enabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('scroll', () => this.onScroll(), { passive: true });
  }

  max() {
    return document.documentElement.scrollHeight - window.innerHeight;
  }

  push(delta) {
    this.target = clamp(this.target + delta, 0, this.max());
    this.moving = true;
  }

  onWheel(e) {
    if (!this.enabled || e.ctrlKey) return; // ctrl+wheel is pinch-zoom
    if (e.target.closest && e.target.closest('.chapters')) return; // the menu scrolls itself
    e.preventDefault();
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 40; // lines
    else if (e.deltaMode === 2) d *= window.innerHeight; // pages
    d = clamp(d * this.wheelScale, -this.maxStep, this.maxStep);
    this.push(d);
  }

  onKey(e) {
    if (!this.enabled || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, button, [contenteditable]')) return;
    const vh = window.innerHeight;
    const steps = {
      ArrowDown: vh * 0.15,
      ArrowUp: -vh * 0.15,
      PageDown: vh * 0.9,
      PageUp: -vh * 0.9,
      ' ': e.shiftKey ? -vh * 0.9 : vh * 0.9,
    };
    if (e.key === 'Home') this.target = 0;
    else if (e.key === 'End') this.target = this.max();
    else if (e.key in steps) this.push(steps[e.key]);
    else return;
    this.moving = true;
    e.preventDefault();
  }

  // A scroll we did not cause (scrollbar drag, touch, find-in-page): adopt it.
  onScroll() {
    if (Math.abs(window.scrollY - this.lastSet) > 2) {
      this.current = this.target = this.lastSet = window.scrollY;
      this.moving = false;
    }
  }

  /** Glide to a position, e.g. from a button. */
  glideTo(y) {
    if (!this.enabled) {
      this.jumpTo(y);
      return;
    }
    this.target = clamp(y, 0, this.max());
    this.moving = true;
  }

  /** Jump without gliding, e.g. from the chapter menu. */
  jumpTo(y) {
    this.current = this.target = this.lastSet = clamp(y, 0, this.max());
    this.moving = false;
    window.scrollTo({ top: this.current, behavior: 'instant' });
  }

  /** Call once per animation frame, before reading window.scrollY. */
  update(dt) {
    if (!this.moving) return;
    const alpha = 1 - Math.pow(1 - this.lerp, dt * 60);
    this.current += (this.target - this.current) * alpha;
    if (Math.abs(this.target - this.current) < 0.5) {
      this.current = this.target;
      this.moving = false;
    }
    this.lastSet = this.current;
    window.scrollTo({ top: this.current, behavior: 'instant' });
  }
}
