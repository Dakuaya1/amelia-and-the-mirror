// The grandfather's machine, in brass: gear wheels drawn to mesh, and the reading clock,
// whose hands keep the reader's place in the book while its gears turn under the scroll.
const SVG = 'http://www.w3.org/2000/svg';
const REDUCE = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * An SVG path for a gear wheel centred on (0, 0): straight-flanked teeth round a pitch
 * radius r, a bore, and (optionally) spokes with windows between them. Use with
 * fill-rule="evenodd". Two gears mesh when their centres are r1 + r2 apart and their
 * teeth have the same pitch (r / teeth).
 */
export function gearPath({ teeth, r, depth = 0.16, hole = 0.18, spokes = 0, rim = 0.72, hub = 0.32 }) {
  const step = (Math.PI * 2) / teeth;
  const toothH = (r * 2 * Math.PI) / teeth * 0.55; // tooth height follows the pitch
  const rootR = r - toothH * 0.5;
  const tipR = r + toothH * 0.5;
  const pt = (rad, a) => `${(Math.cos(a) * rad).toFixed(2)} ${(Math.sin(a) * rad).toFixed(2)}`;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    d += `${i ? 'L' : 'M'}${pt(rootR, a)} L${pt(rootR, a + step * 0.18)} L${pt(tipR, a + step * 0.34)} L${pt(tipR, a + step * 0.62)} L${pt(rootR, a + step * 0.78)} `;
  }
  d += 'Z ';
  const circle = (rad) => `M${rad.toFixed(2)} 0 A${rad.toFixed(2)} ${rad.toFixed(2)} 0 1 0 ${(-rad).toFixed(2)} 0 A${rad.toFixed(2)} ${rad.toFixed(2)} 0 1 0 ${rad.toFixed(2)} 0 Z `;
  if (spokes) {
    // windows between the spokes: ring sectors from the hub out to the rim
    const r0 = r * hub;
    const r1 = rootR * rim;
    const gap = Math.min(0.5, (r * 0.13) / r1); // the spoke's width, as an angle
    for (let k = 0; k < spokes; k++) {
      const a0 = (k * Math.PI * 2) / spokes + gap;
      const a1 = ((k + 1) * Math.PI * 2) / spokes - gap;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      d += `M${pt(r0, a0)} L${pt(r1, a0)} A${r1.toFixed(2)} ${r1.toFixed(2)} 0 ${large} 1 ${pt(r1, a1)} L${pt(r0, a1)} A${r0.toFixed(2)} ${r0.toFixed(2)} 0 ${large} 0 ${pt(r0, a0)} Z `;
    }
  }
  if (hole) d += circle(r * hole);
  return d.trim();
}

function el(name, attrs = {}, parent) {
  const n = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.append(n);
  return n;
}

/**
 * The reading clock: a brass clock in the corner. The hour hand goes once round the dial
 * across the whole journey, past a mark for each chapter you can step into; the minute
 * hand runs twelve times as fast; the gears behind the cut-away dial turn as the page
 * scrolls; the small seconds hand ticks. A click opens the Contents.
 *
 * marks: [{ at: 0..1 (place in the journey), label }]
 */
export class ReadingClock {
  constructor(root, { marks, onOpen }) {
    this.root = root;
    this.marks = marks;
    this.svg = el('svg', { viewBox: '0 0 120 120', class: 'clock__svg', 'aria-hidden': 'true' });
    const defs = el('defs', {}, this.svg);
    const brass = el('radialGradient', { id: 'clk-brass', cx: '38%', cy: '30%', r: '75%' }, defs);
    el('stop', { offset: '0', 'stop-color': '#fbe7b0' }, brass);
    el('stop', { offset: '0.45', 'stop-color': '#c9a159' }, brass);
    el('stop', { offset: '1', 'stop-color': '#5e4420' }, brass);
    const enamel = el('radialGradient', { id: 'clk-enamel', cx: '50%', cy: '40%', r: '65%' }, defs);
    el('stop', { offset: '0', 'stop-color': '#18284a' }, enamel);
    el('stop', { offset: '1', 'stop-color': '#070d1a' }, enamel);
    const steel = el('linearGradient', { id: 'clk-gear', x1: '0', y1: '0', x2: '1', y2: '1' }, defs);
    el('stop', { offset: '0', 'stop-color': '#e9c77e' }, steel);
    el('stop', { offset: '1', 'stop-color': '#8a6a32' }, steel);

    // the case: a knurled brass bezel
    el('circle', { cx: 60, cy: 60, r: 58, fill: 'url(#clk-brass)' }, this.svg);
    el('circle', { cx: 60, cy: 60, r: 57, fill: 'none', stroke: 'rgba(40,26,8,0.55)', 'stroke-width': 1.6, 'stroke-dasharray': '0.7 1.5' }, this.svg);
    el('circle', { cx: 60, cy: 60, r: 53.5, fill: 'none', stroke: 'rgba(60,40,12,0.7)', 'stroke-width': 1 }, this.svg);

    // the works, seen through a window in the dial: three wheels in a train
    const works = el('g', {}, this.svg);
    el('circle', { cx: 60, cy: 82, r: 19, fill: '#120c06' }, works);
    const wheel = (teeth, r, x, y, spokes) => {
      const g = el('g', { transform: `translate(${x} ${y})` }, works);
      const p = el('path', { d: gearPath({ teeth, r, spokes, hole: 0.16 }), fill: 'url(#clk-gear)', 'fill-rule': 'evenodd', stroke: 'rgba(40,26,8,0.6)', 'stroke-width': 0.3 }, g);
      el('circle', { cx: 0, cy: 0, r: r * 0.12, fill: '#2a1c0a' }, g);
      return p;
    };
    // pitch r/teeth = 1.0 for all three, so they mesh: centres r1 + r2 apart
    this.wheels = [
      { p: wheel(16, 16, 52, 84, 4), ratio: 1, phase: 0 },
      { p: wheel(10, 10, 52 + 26 * Math.cos(-0.35), 84 + 26 * Math.sin(-0.35), 0), ratio: -1.6, phase: 18 },
      { p: wheel(8, 8, 52 + 26 * Math.cos(-0.35) + 18 * Math.cos(0.9), 84 + 26 * Math.sin(-0.35) + 18 * Math.sin(0.9), 0), ratio: 2.0, phase: 0 },
    ];

    // the dial, with its window cut out
    const face = 'M60 8 A52 52 0 1 1 59.99 8 Z M60 63 A19 19 0 1 0 60.01 63 Z';
    el('path', { d: face, fill: 'url(#clk-enamel)', 'fill-rule': 'evenodd' }, this.svg);
    el('circle', { cx: 60, cy: 82, r: 19.6, fill: 'none', stroke: 'url(#clk-brass)', 'stroke-width': 1.4 }, this.svg);
    // minute track
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const long = i % 5 === 0;
      const r0 = long ? 45.5 : 48;
      el('line', {
        x1: 60 + Math.sin(a) * r0, y1: 60 - Math.cos(a) * r0,
        x2: 60 + Math.sin(a) * 50.5, y2: 60 - Math.cos(a) * 50.5,
        stroke: '#d9b56a', 'stroke-width': long ? 1.2 : 0.5, opacity: long ? 0.95 : 0.6,
      }, this.svg);
    }
    // the chapters you can step into, as small diamonds round the dial
    this.markEls = marks.map((m) => {
      const a = m.at * Math.PI * 2;
      const x = 60 + Math.sin(a) * 40;
      const y = 60 - Math.cos(a) * 40;
      return el('path', { d: `M${x} ${y - 2.6} L${x + 1.8} ${y} L${x} ${y + 2.6} L${x - 1.8} ${y} Z`, class: 'clock__mark', transform: `rotate(${m.at * 360} ${x} ${y})` }, this.svg);
    });
    // the seconds, on a small dial of their own
    el('circle', { cx: 60, cy: 34, r: 8.5, fill: 'none', stroke: 'rgba(217,181,106,0.5)', 'stroke-width': 0.5 }, this.svg);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      el('line', { x1: 60 + Math.sin(a) * 7, y1: 34 - Math.cos(a) * 7, x2: 60 + Math.sin(a) * 8.5, y2: 34 - Math.cos(a) * 8.5, stroke: '#d9b56a', 'stroke-width': 0.4 }, this.svg);
    }
    this.seconds = el('line', { x1: 60, y1: 36, x2: 60, y2: 27, class: 'clock__sec' }, this.svg);
    el('circle', { cx: 60, cy: 34, r: 0.9, fill: '#7ef0c8' }, this.svg);
    // the hands: a spade hour hand, a long minute hand
    this.hour = el('path', { d: 'M59 66 L59.2 40 L57.4 37 L60 30 L62.6 37 L60.8 40 L61 66 Z', class: 'clock__hand' }, this.svg);
    this.minute = el('path', { d: 'M59.4 68 L59.7 16 L60 12 L60.3 16 L60.6 68 Z', class: 'clock__hand clock__hand--min' }, this.svg);
    el('circle', { cx: 60, cy: 60, r: 3.2, fill: 'url(#clk-brass)', stroke: 'rgba(40,26,8,0.6)', 'stroke-width': 0.4 }, this.svg);

    root.append(this.svg);
    this.label = document.createElement('span');
    this.label.className = 'clock__label';
    root.append(this.label);
    root.addEventListener('click', () => onOpen?.());
    this.state = { p: -1, spin: null, sec: -1, here: -2 };
  }

  /** p: 0..1 through the journey; spin: degrees for the gear train (from the scroll); now: ms. */
  update(p, spin, now) {
    const s = this.state;
    if (Math.abs(p - s.p) > 0.0002) {
      s.p = p;
      this.hour.setAttribute('transform', `rotate(${(p * 360).toFixed(2)} 60 60)`);
      this.minute.setAttribute('transform', `rotate(${((p * 360 * 12) % 360).toFixed(2)} 60 60)`);
      // the last chapter mark passed is "here"
      let here = -1;
      this.marks.forEach((m, i) => { if (p >= m.at - 0.004) here = i; });
      if (here !== s.here) {
        s.here = here;
        this.markEls.forEach((m, i) => m.classList.toggle('is-here', i === here));
        this.label.textContent = here >= 0 ? this.marks[here].label : 'Forefore Manor';
        this.root.setAttribute('aria-label', `Contents. You are at: ${this.label.textContent}`);
      }
    }
    const sp = Math.round(spin * 4) / 4;
    if (sp !== s.spin && !REDUCE) {
      s.spin = sp;
      for (const w of this.wheels) w.p.setAttribute('transform', `rotate(${(sp * w.ratio + w.phase).toFixed(2)})`);
    }
    const sec = Math.floor(now / 1000) % 60;
    if (sec !== s.sec) {
      s.sec = sec;
      // a tick: the hand jumps, with a little recoil (see .clock__sec)
      this.seconds.style.transform = `rotate(${sec * 6 + 360 * Math.floor(now / 60000)}deg)`;
    }
  }
}

/** An inline SVG gear (markup), centred, sized one SVG unit to one CSS pixel. */
export function gearSvg({ teeth, r, cls = '', spokes = 0, hole = 0.2, style = '' }) {
  const half = Math.ceil(r + (r * 2 * Math.PI) / teeth * 0.3 + 1);
  return `<svg class="${cls}" viewBox="${-half} ${-half} ${half * 2} ${half * 2}" width="${half * 2}" height="${half * 2}"${style ? ` style="${style}"` : ''} aria-hidden="true"><path d="${gearPath({ teeth, r, spokes, hole })}" fill-rule="evenodd"/></svg>`;
}

/**
 * A split-flap counter, like a station board: each digit a tile whose upper leaf falls to show
 * the next number. play(from, to) flips through every number between; set(n) shows one at once.
 * The leaves turn by transform alone (Web Animations), so the flipping costs no repaints.
 */
export class SplitFlap {
  constructor(el, { digits = 2, value = 0 } = {}) {
    this.el = el;
    this.digits = digits;
    this.timers = [];
    el.setAttribute('aria-hidden', 'true');
    el.classList.add('flap');
    this.tiles = Array.from({ length: digits }, () => {
      const t = document.createElement('span');
      t.className = 'flap__tile';
      t.innerHTML = '<span class="flap__half flap__half--top"><b></b></span><span class="flap__half flap__half--bot"><b></b></span>'
        + '<span class="flap__leaf"><span class="flap__half flap__half--top"><b></b></span><span class="flap__half flap__half--back"><b></b></span></span>';
      el.append(t);
      const [top, bot, leaf] = t.children;
      return { top: top.firstChild, bot: bot.firstChild, leaf, front: leaf.children[0].firstChild, back: leaf.children[1].firstChild, value: null };
    });
    this.set(value);
  }

  digitsOf(n) {
    return String(Math.max(0, Math.round(n))).padStart(this.digits, '0').slice(-this.digits).split('');
  }

  set(n) {
    this.stop();
    this.digitsOf(n).forEach((d, i) => {
      const t = this.tiles[i];
      t.top.textContent = t.bot.textContent = d;
      t.leaf.style.visibility = 'hidden';
      t.value = d;
    });
  }

  stop() {
    for (const id of this.timers) clearTimeout(id);
    this.timers = [];
  }

  flipTile(t, d, ms) {
    if (t.value === d) return;
    const old = t.value;
    t.top.textContent = d; // the upper half of the next number waits behind the falling leaf
    t.bot.textContent = old;
    t.front.textContent = old;
    t.back.textContent = d;
    t.leaf.style.visibility = 'visible';
    t.value = d;
    const a = t.leaf.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-180deg)' }], { duration: ms, easing: 'cubic-bezier(0.5, 0, 0.9, 0.6)' });
    a.onfinish = () => {
      t.bot.textContent = d;
      t.leaf.style.visibility = 'hidden';
    };
  }

  play(from, to, { step = 80 } = {}) {
    this.set(from);
    const dir = to >= from ? 1 : -1;
    const n = Math.abs(to - from);
    for (let k = 1; k <= n; k++) {
      this.timers.push(setTimeout(() => {
        this.digitsOf(from + dir * k).forEach((d, i) => this.flipTile(this.tiles[i], d, step * 1.5));
      }, 140 + k * step));
    }
  }
}

/**
 * An odometer: a row of drums, each a strip of figures that rolls to the next. Rolling forward
 * past 9 it carries on to the 0 below and settles there, rather than spinning back.
 */
export class Odometer {
  constructor(el, { digits = 3 } = {}) {
    this.el = el;
    this.value = -1;
    this.drums = Array.from({ length: digits }, () => {
      const drum = document.createElement('span');
      drum.className = 'odo__drum';
      const strip = document.createElement('span');
      strip.className = 'odo__strip';
      strip.textContent = '0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n0'; // one figure a line (white-space: pre)
      drum.append(strip);
      el.append(drum);
      return { strip, d: 0 };
    });
    this.set(0, false);
  }

  set(n, animate = true) {
    n = Math.max(0, Math.round(n));
    if (n === this.value) return;
    const up = n > this.value;
    this.value = n;
    const ds = String(n).padStart(this.drums.length, '0').slice(-this.drums.length).split('').map(Number);
    ds.forEach((d, i) => {
      const drum = this.drums[i];
      if (d === drum.d && animate) return;
      const s = drum.strip;
      if (animate && up && d < drum.d) {
        // carry: roll on to the lower 0, then settle on the figure without showing the jump
        s.style.transition = '';
        s.style.transform = `translateY(${(-10 / 11) * 100}%)`;
        s.addEventListener('transitionend', () => {
          s.style.transition = 'none';
          s.style.transform = `translateY(${(-d / 11) * 100}%)`;
          void s.offsetWidth;
          s.style.transition = '';
        }, { once: true });
      } else {
        s.style.transition = animate ? '' : 'none';
        s.style.transform = `translateY(${(-d / 11) * 100}%)`;
      }
      drum.d = d;
    });
  }
}
