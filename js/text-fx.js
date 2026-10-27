// Text that arrives. When a caption fades in, its kicker and title decode out of
// glyphs lit like the Mirror's green glass into their letters, a line of light
// draws under the title, and the passage surfaces word by word. When it has gone,
// it resets, so scrolling back plays it again.
//
// The glyphs are drawn over each letter (a pseudo-element), never in its place,
// so a decoding word keeps its width and nothing around it shifts.
import { SplitFlap, gearSvg } from './machine.js';

const GLYPHS = 'ΔΛΞΠΣΦΨΩ◇◈⌬⟁∴⊹ᚠᚢᚦᚨᚱᚲᛉᛟ';
// the two little wheels at the head of each title's line of light (they mesh: same tooth pitch)
const GEARS = gearSvg({ teeth: 12, r: 7, cls: 'fx-gear fx-gear--a', hole: 0.24 })
  + gearSvg({ teeth: 8, r: 4.67, cls: 'fx-gear fx-gear--b', hole: 0.26 });
const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const glyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

// Words, each its own span, for text that surfaces.
function splitWords(node) {
  const text = node.textContent.trim();
  node.textContent = '';
  let i = 0;
  for (const part of text.split(/\s+/)) {
    if (i) node.append(' ');
    const w = document.createElement('span');
    w.className = 'fx-w';
    w.style.setProperty('--i', String(i++));
    w.textContent = part;
    node.append(w);
  }
}

// Letters, each its own span, for text that decodes. Readers of the page get the
// plain text (a visually hidden copy); the spans are hidden from them.
function splitChars(node) {
  const text = node.textContent.trim().replace(/\s+/g, ' ');
  node.textContent = '';
  const plain = document.createElement('span');
  plain.className = 'vh';
  plain.textContent = text;
  const shown = document.createElement('span');
  shown.setAttribute('aria-hidden', 'true');
  const chars = [];
  text.split(' ').forEach((word, wi) => {
    if (wi) shown.append(' ');
    const wd = document.createElement('span');
    wd.className = 'fx-wd';
    for (const ch of word) {
      const c = document.createElement('span');
      c.className = 'fx-c';
      c.textContent = ch;
      wd.append(c);
      chars.push(c);
    }
    shown.append(wd);
  });
  node.append(plain, shown);
  return chars;
}

/**
 * One decoding run over a list of letter spans: each letter waits, flickers
 * through glyphs, then sets with a flash. Times in ms from the run's start.
 */
class Decode {
  constructor(chars, { delay = 0, step = 34, scramble = 360 } = {}) {
    this.chars = chars.map((el, i) => ({ el, start: delay + i * step, end: delay + i * step + scramble, state: 0, next: 0 }));
    this.t0 = 0;
    this.done = true;
  }

  start(now) {
    this.t0 = now;
    this.done = false;
    for (const c of this.chars) {
      c.state = 0;
      c.el.className = 'fx-c is-wait';
    }
  }

  reset() {
    this.done = true;
    for (const c of this.chars) {
      c.state = 0;
      c.el.className = 'fx-c is-wait';
    }
  }

  // Show every letter at once (reduced motion).
  finish() {
    this.done = true;
    for (const c of this.chars) {
      c.state = 2;
      c.el.className = 'fx-c';
    }
  }

  update(now) {
    if (this.done) return;
    const t = now - this.t0;
    let pending = 0;
    for (const c of this.chars) {
      if (c.state === 2) continue;
      pending++;
      if (t < c.start) continue;
      if (t >= c.end) {
        c.state = 2;
        c.el.className = 'fx-c is-set';
        c.el.removeAttribute('data-g');
        continue;
      }
      if (c.state === 0) {
        c.state = 1;
        c.el.className = 'fx-c is-scr';
      }
      if (now >= c.next) {
        c.el.dataset.g = glyph();
        c.next = now + 55 + Math.random() * 40;
      }
    }
    if (!pending) this.done = true;
  }
}

// One caption: what decodes, what surfaces, and whether it is playing.
class Beat {
  constructor(el) {
    this.el = el;
    this.live = false;
    this.runs = [];
    const kicker = el.querySelector(':scope > .folio, :scope > .eyebrow');
    const title = el.querySelector(':scope > h2, :scope > h3');
    const index = el.querySelector(':scope > .fx-index');
    if (index) this.runs.push(new Decode(splitChars(index), { delay: 0, step: 22, scramble: 200 }));
    if (kicker) this.runs.push(new Decode(splitChars(kicker), { delay: index ? 120 : 0, step: 14, scramble: 260 }));
    if (title) {
      this.runs.push(new Decode(splitChars(title), { delay: 220, step: 38, scramble: 380 }));
      // under the title: two small wheels that turn while the caption is up, and a line of light
      const row = document.createElement('span');
      row.className = 'fx-ruleline';
      row.setAttribute('aria-hidden', 'true');
      row.innerHTML = `${GEARS}<span class="fx-rule"></span>`;
      title.after(row);
    }
    // a chapter's number on split-flap tiles, flipping up from the chapter before
    const slot = el.querySelector('.flap-slot');
    if (slot) {
      this.flapFrom = Number(slot.dataset.from) || 0;
      this.flapTo = Number(slot.dataset.to) || 0;
      this.flap = new SplitFlap(slot, { digits: 2, value: REDUCE ? this.flapTo : this.flapFrom });
    }
    for (const p of el.querySelectorAll(':scope > .passage, :scope > .dek, :scope > .line, :scope > .finale__by')) splitWords(p);
    // a captured readout: HUD corners round the scene's caption
    if (el.classList.contains('beat--scene')) {
      const frame = document.createElement('span');
      frame.className = 'fx-frame';
      frame.setAttribute('aria-hidden', 'true');
      frame.innerHTML = '<i></i><i></i><i></i><i></i>';
      el.prepend(frame);
    }
    if (REDUCE) for (const r of this.runs) r.finish();
    else for (const r of this.runs) r.reset();
  }

  update(now) {
    // scrollcraft writes each caption's opacity inline as it cues it
    const o = parseFloat(this.el.style.opacity || '0');
    if (!this.live && o > 0.12) {
      this.live = true;
      this.el.classList.add('is-live');
      if (!REDUCE) for (const r of this.runs) r.start(now);
      if (this.flap && !REDUCE) this.flap.play(this.flapFrom, this.flapTo);
    } else if (this.live && o < 0.01) {
      this.live = false;
      this.el.classList.remove('is-live');
      if (!REDUCE) for (const r of this.runs) r.reset();
      if (this.flap && !REDUCE) this.flap.set(this.flapFrom);
    }
    if (this.live) for (const r of this.runs) r.update(now);
  }
}

export class TextFx {
  /** root: the copy layer. Call after the fonts have loaded. */
  constructor(root) {
    this.beats = [...root.querySelectorAll('.beat:not(.hero)')].map((el) => new Beat(el));
    this.hero = null;
    const words = document.querySelectorAll('.hero__word');
    if (words.length) {
      // the frontispiece's title decodes as each word rises (their rise delays, in ms)
      this.hero = [...words].map((w, i) => {
        w.dataset.text = w.textContent.trim();
        const chars = [];
        const text = w.textContent.trim();
        w.textContent = '';
        for (const ch of text) {
          const c = document.createElement('span');
          c.className = 'fx-c';
          c.textContent = ch;
          w.append(c);
          chars.push(c);
        }
        const d = new Decode(chars, { delay: 300 + i * 400, step: 70, scramble: 520 });
        if (REDUCE) d.finish();
        else d.reset();
        return d;
      });
    }
  }

  /** The frontispiece's entrance, with the page's own (as the loader lifts). */
  playHero() {
    if (!this.hero || REDUCE) return;
    const now = performance.now();
    for (const d of this.hero) d.start(now);
  }

  update(now = performance.now()) {
    for (const b of this.beats) b.update(now);
    if (this.hero) for (const d of this.hero) d.update(now);
  }
}
