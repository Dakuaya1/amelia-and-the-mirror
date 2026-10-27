// One experience. The book lies on a desk in a lit room; scroll opens it and
// turns its pages. At each chapter the camera dives into the page's picture,
// the scene opens out of the page like a portal, the reader travels through the
// chapter's illustrations, and the portal closes back into the page before it
// turns. scrollcraft owns the pinned act and the copy cues; this file maps the
// scroll position onto the book, the desk camera and the world inside the page.
import * as THREE from 'three';
import { EffectComposer } from '../vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/addons/postprocessing/OutputPass.js';
import { ShaderPass } from '../vendor/addons/postprocessing/ShaderPass.js';
import { Book, STATE_CLOSED, LEAF_COUNT } from './book.js';
import { buildRoom } from './room.js';
import { studioEnvironment } from './desk.js';
import { buildManor } from './manor.js';
import { Inside, Uploader } from './inside.js';
import SCENES from './scenes.js';
import { WORLDS } from './worlds/index.js';
import { renderPage, CHAPTERS, CAST } from './pages.js';
import { SmoothScroll } from './smooth-scroll.js';
import { makeAO, aimAO } from './ao.js';
import { prepareSkies, onModelLoaded } from './assets.js';
import { TextFx } from './text-fx.js';
import { Warp, Hud } from './scifi.js';
import { ReadingClock, Odometer, gearSvg } from './machine.js';
import { DESKTOP_CLASS } from './device.js';

const BASE = './';
// ?lite drops bloom, vignette and the mirror reflection: a fallback for weak GPUs.
const LITE = new URLSearchParams(location.search).has('lite');

// The chapters this edition showcases. The pages between them riffle past.
const SHOWCASE = [1, 4, 10, 18, 22, 29, 31, 32];
// each showcased chapter's first painting (assets/illus/chNN/), printed as its plate in the book
const PLATES = { 1: 'table', 4: 'trunk', 10: 'wheel', 18: 'workshop', 22: 'lake', 29: 'vault', 31: 'armchair', 32: 'stair' };

// Timeline, in units. One unit of timeline = VH_PER_UNIT viewport heights of scroll.
// Every step is given room: a page turn, a dive or a scene each takes about a
// full screen of scrolling, so nothing races past under a single flick.
const VH_PER_UNIT = 0.42;
const MANOR_T = 5.0; // up the drive at night, to the lit study window
const ARRIVE_T = 1.8; // through the window: the study, the book on the desk
const COVER_T = 3.2; // cover opening, slow on purpose
const TITLE_T = 1.8; // title page and cast
const SPREAD_T = 1.6; // a chapter's spread, before the dive
const IN_T = 2.0; // camera dives into the page, the portal opens
const LEAD = 0.8; // inside: settle on the opener before the first scene
const SCENE_T = 2.0; // inside: one illustration
const TAIL = 0.8; // inside: travel past the last illustration
const OUT_T = 1.8; // portal closes back into the page
const FLIP_T = 1.0; // a single page turn
const RIFFLE_STEP = 0.2; // each extra page riffled past adds this much
const CLOSE_T = 1.8; // the last spread
const LEAVE_T = 1.4; // up from the desk, into the morning light
const DAWN_T = 4.0; // back out of the window: the manor at dawn

const CHAPTER_COUNT = CHAPTERS.length;
// How high the book is set over the desk: its back board rests on the writing mat (desk.js,
// 0.01 thick) rather than sinking into it.
const BOOK_Y = 0.16 + 0.012;

function buildTimeline() {
  const segs = [];
  const leafAt = new Array(LEAF_COUNT); // when each leaf turns: { start, len }
  let t = 0;
  const push = (kind, len, extra = {}) => {
    segs.push({ kind, start: t, len, ...extra });
    t += len;
  };
  // Turn leaves from..to-1 in one gesture: a single page, or a riffle through
  // several, each leaf starting a moment after the one before.
  const turn = (from, to) => {
    const m = to - from;
    if (m <= 0) return;
    const len = FLIP_T + (m - 1) * RIFFLE_STEP;
    const each = m === 1 ? len : len * 0.55;
    const stagger = m === 1 ? 0 : (len - each) / (m - 1);
    for (let j = 0; j < m; j++) leafAt[from + j] = { start: t + j * stagger, len: each };
    push('flip', len, { from, to });
  };

  push('manor', MANOR_T);
  push('arrive', ARRIVE_T);
  push('cover', COVER_T);
  push('spread', TITLE_T, { k: 0 });
  let at = 0; // leaves turned so far
  for (const k of SHOWCASE) {
    turn(at, k);
    at = k;
    const n = WORLDS[k] ? WORLDS[k].captions.length : 0;
    push('spread', SPREAD_T, { k });
    push('in', IN_T, { k });
    push('inside', LEAD + n * SCENE_T + TAIL, { k, n });
    push('out', OUT_T, { k, n });
  }
  turn(at, LEAF_COUNT);
  push('spread', CLOSE_T, { k: LEAF_COUNT });
  push('leave', LEAVE_T);
  push('dawn', DAWN_T);
  const find = (kind) => segs.find((seg) => seg.kind === kind);
  return { total: t, segs, leafAt, arrive: find('arrive'), cover: find('cover'), dawn: find('dawn') };
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const pct = (v) => v.toFixed(5);
// Gentler than the cubic ease: motion spread evenly across the scroll, no burst in the middle.
const soft = (t) => t * t * (3 - 2 * t);

// Inside a chapter: where the camera is along the flight. Holds on each
// illustration, then glides to the next.
function flightPosition(seg, u) {
  const w = u - seg.start;
  const times = [0];
  for (let i = 1; i <= seg.n; i++) times.push(LEAD + (i - 0.5) * SCENE_T);
  times.push(seg.len);
  let i = 0;
  while (i < times.length - 2 && w >= times[i + 1]) i++;
  const q = (w - times[i]) / (times[i + 1] - times[i]);
  // A short hold on each picture, then a long, gentle glide to the next.
  return i + smoothstep(0.18, 0.82, q);
}

async function loadFonts() {
  const faces = [
    '400 40px "Cinzel"',
    '600 40px "Cinzel"',
    '400 40px "Cormorant Garamond"',
    '600 40px "Cormorant Garamond"',
    'italic 400 40px "Cormorant Garamond"',
  ];
  try {
    await Promise.all(faces.map((f) => document.fonts.load(f)));
  } catch {
    // Offline: canvas uses the system serif.
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadAssets() {
  const loader = new THREE.TextureLoader();
  const cover = (name) =>
    loader.loadAsync(`${BASE}textures/${name}`).then((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    });
  const [front, back, spine] = await Promise.all([cover('front.jpg'), cover('back.jpg'), cover('spine.jpg')]);
  // The showcased chapters' plates: the painting the reader is about to step into, printed
  // on the left-hand page, with the moment it shows as its caption.
  // These load behind the opening rather than before it (a phone on a slow connection would
  // otherwise wait for 40 pictures it will not see for minutes): each chapter's page is drawn
  // again when its picture arrives (see arrived, below).
  const plates = new Map();
  const panels = new Map();
  const arrived = []; // promises of chapter numbers whose picture has come in
  for (const k of SHOWCASE) {
    arrived.push(loadImage(`assets/illus/ch${String(k).padStart(2, '0')}/${PLATES[k]}.webp`).then((img) => {
      plates.set(k, { img, caption: SCENES[k][WORLDS[k].captions[0]].title });
      return k;
    }, () => null)); // no painting: the page keeps the chapter's panel
  }
  for (const c of CHAPTERS) {
    if (!c.panel) continue;
    arrived.push(loadImage(`${BASE}textures/panels/${c.panel}`).then((img) => {
      panels.set(c.num, img);
      return c.num;
    }, () => null)); // missing illustration: the page keeps its text
  }
  return { textures: { front, back, spine }, panels, plates, arrived };
}

// ---- copy: one block per beat, cued by scrollcraft on the act's progress ----
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function cue(node, from, to, total) {
  node.dataset.scCue = `${pct(Math.max(0, from) / total)} ${pct(to / total)}`;
  return node;
}

function buildCopy(layer, timeline) {
  const { total, segs } = timeline;
  // The frontispiece is authored in index.html; it greets on load and fades as
  // the walk up the drive begins.
  document.getElementById('hero').dataset.scCue = `0 ${pct((MANOR_T * 0.24) / total)} 0`;

  // In the study, before the cover opens.
  const { arrive, cover, dawn } = timeline;
  const study = cue(el('div', 'beat beat--study'), arrive.start + arrive.len * 0.45, cover.start + cover.len * 0.3, total);
  study.append(el('p', 'folio', 'Forefore Manor · The east wing'));
  study.append(el('p', 'line', 'Open the book.'));
  layer.append(study);

  // The end, back where it began: the manor at dawn.
  const finale = el('div', 'beat beat--finale');
  // An explicit window: a short fade in, then hold to the end of the page. (A
  // single cue value would fade over 18% of this very long act.)
  finale.dataset.scCue = `${pct((dawn.start + dawn.len * 0.42) / total)} 1.2 0.02 0`;
  // the machine again, at the end: two wheels in sepia behind the title, turning while it shows
  const finaleWorks = el('div', 'finale__works');
  finaleWorks.setAttribute('aria-hidden', 'true');
  finaleWorks.innerHTML = gearSvg({ teeth: 30, r: 100, cls: 'finale__wheel finale__wheel--a', spokes: 5, hole: 0.1 })
    + gearSvg({ teeth: 16, r: 53.33, cls: 'finale__wheel finale__wheel--b', spokes: 4, hole: 0.14 });
  finale.append(finaleWorks);
  finale.append(el('p', 'eyebrow', 'Book One · The Origin'));
  finale.append(el('h2', 'finale__title', 'Amelia and the Mirror'));
  finale.append(el('p', 'finale__by', 'by Priyanshu Sharma'));
  // where to buy it: the same links as the top bar and the edition section (read from the page)
  const buy = el('div', 'finale__buy');
  for (const [cls, text, store] of [['buy-btn buy-btn--primary', 'Get the book', 'all'], ['buy-btn', 'Amazon', 'amazon']]) {
    const link = el('a', cls, text);
    link.href = document.querySelector(`[data-store="${store}"]`)?.href || '';
    link.target = '_blank';
    link.rel = 'noopener';
    buy.append(link);
  }
  finale.append(buy);
  finale.append(el('p', 'finale__legal', '© 2026 Priyanshu Sharma. All rights reserved.'));
  layer.append(finale);

  let prevChapter = 0; // the showcased chapter before this one: its number flips up from there
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (seg.kind === 'spread' && seg.k === 0) {
      const beat = cue(el('div', 'beat'), seg.start + seg.len * 0.15, seg.start + seg.len * 0.92, total);
      beat.append(el('p', 'folio', 'The People of This Story'));
      beat.append(el('p', 'dek', CAST.map((g) => g.name).join(' · ')));
      beat.append(el('p', 'line', 'Turn the page to step into the first chapter.'));
      layer.append(beat);
    } else if (seg.kind === 'spread' && seg.k > CHAPTER_COUNT) {
      const beat = cue(el('div', 'beat'), seg.start + seg.len * 0.15, seg.start + seg.len * 0.95, total);
      beat.append(el('p', 'folio', 'Amelia and the Mirror · The Origin'));
      beat.append(el('p', 'dek', 'The end of Book One.'));
      layer.append(beat);
    } else if (seg.kind === 'spread') {
      // The chapter title holds through the spread and fades as the dive begins.
      const dive = segs[i + 1];
      const chapter = CHAPTERS[seg.k - 1];
      const beat = cue(el('div', 'beat beat--spread'), seg.start + seg.len * 0.12, dive.start + dive.len * 0.3, total);
      const slot = el('span', 'flap-slot');
      slot.dataset.from = String(prevChapter);
      slot.dataset.to = String(seg.k);
      prevChapter = seg.k;
      beat.append(slot);
      beat.append(el('p', 'folio', chapter.label));
      beat.append(el('h2', null, chapter.heading));
      beat.append(el('p', 'dek', chapter.subtitle));
      if (seg.k === 1) beat.append(el('p', 'line', 'Keep scrolling to step inside the scene.'));
      layer.append(beat);
    } else if (seg.kind === 'inside') {
      const chapter = CHAPTERS[seg.k - 1];
      (WORLDS[seg.k] ? WORLDS[seg.k].captions : []).forEach((idx, j) => {
        const scene = SCENES[seg.k][idx];
        const i1 = j + 1;
        const center = seg.start + LEAD + (i1 - 0.5) * SCENE_T;
        // Odd scenes sit on the left of the frame, so their caption goes right.
        const side = i1 % 2 ? 'beat--right' : 'beat--left';
        const beat = cue(el('div', `beat beat--scene ${side}`), center - SCENE_T * 0.34, center + SCENE_T * 0.34, total);
        const count = WORLDS[seg.k].captions.length;
        beat.append(el('p', 'fx-index', `Scene ${String(i1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`));
        beat.append(el('p', 'folio', `${chapter.label} · ${chapter.heading}`));
        beat.append(el('h3', null, scene.title));
        beat.append(el('p', 'passage', scene.text));
        layer.append(beat);
      });
    }
  }
}

// The desk seen through a lens: sharp across the book, softening into bokeh towards the
// frame's edges (the desk's things, the lamp, the motes). A golden-angle disc of samples,
// weighted towards bright ones so highlights open into soft discs. Off at the manor and
// as the camera dives into the page.
const LensShader = {
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uFocus: { value: new THREE.Vector2(0.5, 0.5) },
    uRadius: { value: 0.5 },
    uSoft: { value: 0.35 },
    uAmount: { value: 1 },
    uMaxPx: { value: 9 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes, uFocus;
    uniform float uRadius, uSoft, uAmount, uMaxPx;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = (vUv - uFocus) * vec2(uRes.x / uRes.y, 1.0);
      float m = smoothstep(uRadius, uRadius + uSoft, length(q)) * uAmount;
      if (m < 0.01) { gl_FragColor = c; return; }
      vec3 acc = c.rgb;
      float tot = 1.0;
      for (int i = 0; i < 12; i++) {
        float a = float(i) * 2.39996;
        float r = sqrt(float(i) + 0.5) / 3.5;
        vec3 s = texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * r * m * uMaxPx / uRes).rgb;
        float w = 1.0 + dot(s, vec3(0.6));
        acc += s * w;
        tot += w;
      }
      gl_FragColor = vec4(acc / tot, c.a);
    }`,
};

// Vignette and a touch of film grain, applied after tone mapping.
const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float v = 1.0 - smoothstep(0.25, 0.9, length(d) * 1.25); // (edges low to high: reversed is undefined, and dark on Metal)
      c.rgb *= mix(0.42, 1.0, v);
      c.rgb += (hash(vUv * 1024.0) - 0.5) * 0.022;
      gl_FragColor = c;
    }`,
};

// ---- the contents page: the book's own, with the reader's place marked ----
// Page numbers are the printed edition's, from its Contents page. The places this
// tour opens are buttons that jump there; the other chapters are listed as in the book.
const BOOK_PAGES = [1, 17, 29, 47, 61, 77, 95, 113, 131, 149, 167, 187, 205, 227, 249, 269,
  291, 313, 335, 357, 371, 397, 419, 441, 455, 473, 489, 511, 533, 559, 579, 603];
const BACK_MATTER = [['The Story in Dates', 629], ['How the Machine Works', 631], ['Glossary', 633], ['Places', 635]];

function buildChapterMenu(timeline, scrollToUnit) {
  const toggle = document.getElementById('chapters-toggle');
  const panel = document.getElementById('chapters');
  const list = document.getElementById('chapters-list');
  const inTour = new Map(); // chapter number -> where its spread opens
  for (const seg of timeline.segs) {
    if (seg.kind !== 'spread' || seg.k < 1 || seg.k > CHAPTER_COUNT || inTour.has(seg.k)) continue;
    inTour.set(seg.k, seg.start + seg.len * 0.4);
  }
  const entries = [
    { title: 'Forefore Manor', matter: true, u: 0 },
    { title: 'The book on the desk', matter: true, u: timeline.arrive.start + timeline.arrive.len * 0.9 },
    { gap: true },
    ...CHAPTERS.map((c, i) => ({ num: i + 1, title: c.heading, page: BOOK_PAGES[i], u: inTour.get(i + 1) })),
    { gap: true },
    ...BACK_MATTER.map(([title, page]) => ({ title, page })),
    { gap: true },
    { title: 'Dawn at Forefore', matter: true, u: timeline.dawn.start + timeline.dawn.len * 0.7 },
  ];

  const open = (on) => {
    panel.hidden = !on;
    toggle.setAttribute('aria-expanded', String(on));
    if (!on) return;
    const here = panel.querySelector('[aria-current="true"]') || panel.querySelector('button');
    panel.scrollTop = Math.max(0, here.offsetTop - panel.clientHeight / 2);
    here.focus({ preventScroll: true });
  };

  const marks = []; // the rows the reader can jump to, in scroll order
  entries.forEach((e, i) => {
    const li = document.createElement('li');
    li.style.setProperty('--i', String(i));
    if (e.gap) { li.className = 'toc__gap'; li.setAttribute('aria-hidden', 'true'); list.append(li); return; }
    const jump = e.u !== undefined;
    const row = document.createElement(jump ? 'button' : 'div');
    row.className = `toc__row${jump ? ' toc__row--tour' : ''}${e.matter ? ' toc__row--matter' : ''}`;
    const num = el('span', 'toc__num');
    if (e.num) num.append(el('span', 'vh', 'Chapter '), String(e.num));
    const name = el('span', 'toc__name');
    if (jump) name.insertAdjacentHTML('beforeend', '<svg class="star toc__star" aria-hidden="true"><use href="#star"/></svg>');
    name.append(el('span', null, e.title));
    const page = el('span', 'toc__page');
    if (e.page) page.append(el('span', 'vh', ', page '), String(e.page));
    row.append(num, name, page);
    if (jump) {
      row.type = 'button';
      row.addEventListener('click', () => {
        scrollToUnit(e.u);
        open(false);
        toggle.focus({ preventScroll: true });
      });
      marks.push({ u: e.u, row });
    }
    li.append(row);
    list.append(li);
  });
  marks.sort((a, b) => a.u - b.u);

  toggle.addEventListener('click', () => open(panel.hidden));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) { open(false); toggle.focus({ preventScroll: true }); }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!panel.hidden && !panel.contains(e.target) && !toggle.contains(e.target)) open(false);
  });

  let current = null;
  return {
    // Called every frame with the scroll position: marks the last place the reader has reached.
    mark(u) {
      let m = marks[0];
      for (const x of marks) if (x.u <= u + 1e-3) m = x;
      if (m === current) return;
      current?.row.removeAttribute('aria-current');
      m.row.setAttribute('aria-current', 'true');
      current = m;
    },
  };
}

// ---- the scene ----
async function main() {
  // Build the scroll layer first: the engine reads data-sc-* when it mounts.
  const timeline = buildTimeline();
  const act = document.getElementById('book');
  act.dataset.scSpan = String((timeline.total * VH_PER_UNIT).toFixed(1));
  buildCopy(document.getElementById('copy'), timeline);

  await loadFonts();
  // titles that decode and passages that surface (split once the fonts are in)
  const textFx = new TextFx(document.getElementById('copy'));
  const assets = await loadAssets();

  // ---- the desk ----
  const canvas = document.getElementById('scene3d');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // Resolution starts at up to 1.25x and steps down if frames run slow (see frame()).
  // (phones start at one pixel per point: their screens are dense and their GPUs share the battery)
  let pixelRatio = Math.min(window.devicePixelRatio, DESKTOP_CLASS ? 1.25 : 1);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // The shadow map is drawn when asked (see frame()), not on every render call: left to itself
  // three.js redraws it for the main view, the occlusion pass and the mirror, three times a frame.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0c12);
  // Image-based light built like a photographer's set (desk.js): a warm softbox beyond the
  // book for the cover's gold and the paper's sheen to catch, the lamp, a cool window.
  scene.environment = studioEnvironment(renderer);
  scene.environmentIntensity = 0.55;

  const room = buildRoom(renderer, { withMirror: !LITE && DESKTOP_CLASS, shadowSize: DESKTOP_CLASS ? 2048 : 1024 });
  scene.add(room.group);

  // The book lies flat on the desk: its cover faces up, its spine runs left.
  const book = new Book({ textures: assets.textures, renderPage: (page, scale) => renderPage(page, assets, scale) });
  book.setRenderer(renderer);
  // a chapter's picture page (page 2n for chapter n) is drawn again once its picture is in
  for (const p of assets.arrived) p.then((n) => { if (n) book.invalidatePage(2 * n); });
  const bookPose = new THREE.Group();
  bookPose.rotation.x = -Math.PI / 2;
  bookPose.position.set(0, BOOK_Y, 0);
  bookPose.add(book.root);
  scene.add(bookPose);
  book.pose(STATE_CLOSED, 0, new Array(LEAF_COUNT).fill(0));

  const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.05, 100);
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  // contact shadows where things meet; the radius follows each world's scale (see frame())
  const ao = makeAO(scene, camera, window.innerWidth, window.innerHeight, 0.12);
  if (ao) composer.addPass(ao);
  const lens = new ShaderPass(LensShader);
  composer.addPass(lens);
  const lensFocus = new THREE.Vector3();

  // Forefore Manor: the opening and the closing world.
  const manor = buildManor(renderer);
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.12, 0.45, 0.95);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const vignette = new ShaderPass(VignetteShader);
  composer.addPass(vignette);

  // ---- the world inside the page ----
  const inside = new Inside(document.getElementById('inside3d'));
  const portal = document.getElementById('portal');
  const ring = document.getElementById('portal-ring');
  // the Mirror's light: streaks through the dive, and the readout while inside
  const warp = new Warp(document.getElementById('warp'));
  const hud = new Hud(document.getElementById('hud'));
  let warpVel = 0; // how fast the reader is scrolling, eased (0..1)
  // the machine: the iris in the portal's gate, the reading clock, the clockwork behind the title
  const gate = ring.querySelector('.gate');
  let irisShown = -1;
  const works = document.querySelector('.hero__works');
  let worksSpin = null;
  // the page odometer beside the clock: the printed page the reader has reached, rolling on as
  // they read (from the book's own Contents: each showcased chapter's first and last page)
  const odo = new Odometer(document.querySelector('#odometer .odo__drums'), { digits: 3 });
  const pageMarks = [];
  for (const seg of timeline.segs) {
    if (seg.kind === 'spread' && seg.k === 0) pageMarks.push([seg.start, 1]);
    else if (seg.kind === 'spread' && SHOWCASE.includes(seg.k)) pageMarks.push([seg.start, BOOK_PAGES[seg.k - 1]]);
    else if (seg.kind === 'out') pageMarks.push([seg.start + seg.len, seg.k < CHAPTER_COUNT ? BOOK_PAGES[seg.k] - 1 : 628]);
    else if (seg.kind === 'spread' && seg.k > CHAPTER_COUNT) pageMarks.push([seg.start, 629]);
  }
  const pageAt = (u) => {
    if (u < pageMarks[0][0]) return 0;
    for (let i = 1; i < pageMarks.length; i++) {
      const [u1, p1] = pageMarks[i];
      if (u <= u1) {
        const [u0, p0] = pageMarks[i - 1];
        return p0 + (p1 - p0) * clamp01((u - u0) / Math.max(1e-6, u1 - u0));
      }
    }
    return pageMarks[pageMarks.length - 1][1];
  };
  const windup = document.querySelector('.windup');
  const clock = new ReadingClock(document.getElementById('reading-clock'), {
    marks: timeline.segs
      .filter((seg) => seg.kind === 'spread' && SHOWCASE.includes(seg.k))
      .map((seg) => ({ at: seg.start / timeline.total, label: `${CHAPTERS[seg.k - 1].label} · ${CHAPTERS[seg.k - 1].heading}` })),
    onOpen: () => document.getElementById('chapters-toggle').click(),
  });
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) ring.querySelector('svg')?.pauseAnimations();

  // Scroll position <-> timeline. Measured, not read back from the engine, so
  // the camera is not quantised to the engine's four decimals.
  let actTop = 0;
  let actRange = 1;
  const measure = () => {
    actTop = act.getBoundingClientRect().top + window.scrollY;
    actRange = Math.max(1, act.offsetHeight - window.innerHeight);
  };
  let smooth = null; // created once scrollcraft has set the page height
  const scrollToUnit = (u) => {
    const y = actTop + (u / timeline.total) * actRange;
    if (smooth) smooth.jumpTo(y);
    else window.scrollTo({ top: y, behavior: 'instant' });
  };
  const menu = buildChapterMenu(timeline, scrollToUnit);
  const ribbon = document.getElementById('ribbon');
  let ribbonH = -1;

  // The skip link jumps past the tour to the first section after it; "Begin again" returns to the drive.
  document.querySelector('.skip')?.addEventListener('click', (e) => {
    e.preventDefault();
    const y = document.getElementById('out-now').getBoundingClientRect().top + window.scrollY;
    if (smooth) smooth.jumpTo(y);
    else window.scrollTo({ top: y, behavior: 'instant' });
    document.getElementById('out-now-title').focus({ preventScroll: true });
  });
  document.getElementById('begin-again')?.addEventListener('click', () => {
    scrollToUnit(0);
    document.getElementById('open-book').focus({ preventScroll: true });
  });

  // "Open the book" glides the scroll through the cover to the title page.
  // "Step inside" glides up the drive, through the window, to the book on the desk.
  document.getElementById('open-book').addEventListener('click', () => {
    const y = actTop + ((timeline.arrive.start + timeline.arrive.len * 0.9) / timeline.total) * actRange;
    if (smooth) smooth.glideTo(y);
    else window.scrollTo({ top: y, behavior: 'smooth' });
  });

  // The canvases fill the stage, which on a phone is the screen's full height (index.html: 100lvh).
  // Its size does not change as the address bar slides in and out while scrolling, so neither do
  // the canvases: no costly resize mid-scroll, no frame cleared to black, no stretched picture.
  const stage = canvas.parentElement;
  let stageW = window.innerWidth;
  let stageH = window.innerHeight;
  let sizedW = 0;
  let sizedH = 0;
  let sizedRatio = 0;
  const onResize = () => {
    measure();
    const w = stage.clientWidth || window.innerWidth;
    const h = stage.clientHeight || window.innerHeight;
    stageW = w;
    stageH = h;
    if (w === sizedW && h === sizedH && pixelRatio === sizedRatio) return;
    sizedW = w;
    sizedH = h;
    sizedRatio = pixelRatio;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(w, h);
    lens.uniforms.uRes.value.set(w * pixelRatio, h * pixelRatio);
    lens.uniforms.uMaxPx.value = 9 * pixelRatio;
    // (the glow is soft: phones draw it at half resolution)
    bloom.setSize(DESKTOP_CLASS ? w : w / 2, DESKTOP_CLASS ? h : h / 2);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    inside.setPixelRatio(pixelRatio);
    inside.setSize(w, h);
    warp.setSize(w, h, pixelRatio);
  };
  window.addEventListener('resize', onResize);

  // Pointer parallax on the book.
  let deskMoved = 0; // when the book last moved (scroll or pointer): its shadow needs redrawing
  window.addEventListener('pointermove', (e) => {
    deskMoved = performance.now();
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    book.setTilt(ny * 0.04, nx * 0.08);
  });

  // Desk camera keyframes.
  const CLOSED_POS = new THREE.Vector3(0, 3.1, 3.3);
  const OPEN_POS = new THREE.Vector3(0, 2.9, 2.7);
  const LOOK = new THREE.Vector3(0, 0, 0);
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const art = new THREE.Vector3();
  const divePos = new THREE.Vector3();
  const DIVE_OFFSET = new THREE.Vector3(0, 0.42, 0.1); // where the camera ends up above the picture
  const SETTLE_POS = new THREE.Vector3(0.6, 1.7, 1.2); // close over the desk, just through the window

  // The veil of lamplight that carries the reader through the study window.
  const veilEl = document.getElementById('veil');
  let veilShown = -1;
  const setVeil = (v) => {
    const rounded = Math.round(v * 1000) / 1000;
    if (rounded === veilShown) return;
    veilShown = rounded;
    veilEl.style.opacity = String(rounded);
  };
  const projected = new THREE.Vector3();
  const leaves = new Array(LEAF_COUNT).fill(0);

  // Only touch the portal's styles when they change; style writes cost a repaint.
  const portalState = { visible: null, mask: null, ring: null };
  const GATE_R = 360; // the gate's drawn radius (css .portal-ring); it is scaled to the portal's
  const gateSvg = ring.querySelector('svg');
  const gateStill = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let gateRunning = true;
  const setPortal = (visible, mask, ringCss) => {
    const showRing = visible && !ringCss.startsWith('opacity:0;') && ringCss !== 'opacity:0';
    if (showRing !== gateRunning) {
      gateRunning = showRing;
      if (showRing && !gateStill) gateSvg.unpauseAnimations();
      else gateSvg.pauseAnimations();
    }
    if (visible !== portalState.visible) {
      portal.style.visibility = visible ? 'visible' : 'hidden';
      portalState.visible = visible;
    }
    if (mask !== portalState.mask) {
      portal.style.maskImage = mask;
      portal.style.webkitMaskImage = mask;
      portalState.mask = mask;
    }
    if (ringCss !== portalState.ring) {
      ring.style.cssText = ringCss;
      portalState.ring = ringCss;
    }
  };

  // Adaptive resolution: if frames average slower than ~45 fps for a second,
  // step the pixel ratio down (never below 0.75). Smoothness beats sharpness.
  const perf = { avg: 16, frames: 0 };
  // Resolution follows the frame rate: a step down after a second of frames slower than ~52 fps,
  // a step back up after ten steady seconds at full rate. (Shared by the study and the
  // chapter worlds; one-off stalls barely move the average, so they do not trigger it.)
  const MAX_RATIO = pixelRatio;
  let roomy = 0;
  let ups = 0; // at most two steps back up, so it cannot see-saw
  const adaptResolution = (dt) => {
    perf.avg += (Math.min(dt * 1000, 50) - perf.avg) * 0.05;
    if (++perf.frames < 60) return;
    perf.frames = 0;
    if (perf.avg > 19 && pixelRatio > 0.75) {
      pixelRatio = Math.max(0.75, pixelRatio - 0.125);
      roomy = 0;
      renderer.setPixelRatio(pixelRatio);
      onResize();
    } else if (perf.avg < 17.4 && pixelRatio < MAX_RATIO && ups < 2) {
      if (++roomy >= 10) { // ten steady seconds at full rate (on a 60 Hz screen frames never come faster)
        roomy = 0;
        ups++;
        pixelRatio = Math.min(MAX_RATIO, pixelRatio + 0.125);
        renderer.setPixelRatio(pixelRatio);
        onResize();
      }
    } else roomy = 0;
  };

  const segAt = (u) => {
    const segs = timeline.segs;
    let lo = 0;
    let hi = segs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segs[mid].start <= u) lo = mid;
      else hi = mid - 1;
    }
    return segs[lo];
  };

  let last = performance.now();
  let lastScrollY = window.scrollY;
  let shadowTick = 0;
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000));
    last = now;
    adaptResolution(dt);
    smooth?.update(dt); // glide the scroll position before reading it
    // is the page moving? (heavy work like building a world waits for a pause)
    const scrolled = Math.abs(window.scrollY - lastScrollY);
    inside.busy = Boolean(smooth?.moving) || scrolled > 0.5;
    book.busy = inside.busy; // sharp page drawings wait for the scroll to rest
    if (inside.busy) deskMoved = now;
    lastScrollY = window.scrollY;
    warpVel += (Math.min(1, scrolled / dt / 1400) - warpVel) * Math.min(1, dt * 5);

    const t = now / 1000;
    const W = stageW;
    const H = stageH;
    const p = clamp01((window.scrollY - actTop) / actRange);
    const u = p * timeline.total;
    const seg = segAt(u);
    const q = clamp01((u - seg.start) / seg.len);

    // ---- book pose ----
    const cover = ease(clamp01((u - timeline.cover.start) / timeline.cover.len));
    let turned = 0;
    for (let i = 0; i < LEAF_COUNT; i++) {
      const f = timeline.leafAt[i];
      leaves[i] = soft(clamp01((u - f.start) / f.len));
      if (leaves[i] >= 0.5) turned++;
    }
    const state = cover < 0.5 ? STATE_CLOSED : turned;
    book.pose(state, cover, leaves, dt);

    // ---- where we are inside the chapter ----
    let dive = 0;
    let chapter = null;
    let flight = 0;
    let back = 0;
    if (seg.kind === 'in') {
      chapter = seg.k;
      dive = soft(q);
      back = (1 - dive) * 2.4; // the inside camera falls forward as the portal opens
    } else if (seg.kind === 'inside') {
      chapter = seg.k;
      dive = 1;
      flight = flightPosition(seg, u);
    } else if (seg.kind === 'out') {
      chapter = seg.k;
      dive = 1 - soft(q);
      flight = seg.n + 1 + q * 0.6; // keep travelling into the paper as it closes
    }
    // Fetch the showcased chapter we are in (or heading to), and the one after it.
    const ci = chapter ? SHOWCASE.indexOf(chapter) : SHOWCASE.findIndex((k) => k >= Math.max(1, state));
    if (ci >= 0) {
      inside.prefetch(SHOWCASE[ci]);
      if (ci + 1 < SHOWCASE.length) inside.prefetch(SHOWCASE[ci + 1]);
    }

    // ---- which world, and the warm veil between them ----
    // The manor holds the start and the end; the study (desk, book, pages) is
    // everything between. Passing through the lit window is a veil of lamplight.
    let world = 'desk';
    let veil = 0;
    let settle = 0; // the desk camera drifts down onto the book on arrival, and lifts away at the end
    if (seg.kind === 'manor') {
      world = 'manor';
      manor.setDawn(0);
      manor.shot('arrive', q, W, H);
      veil = smoothstep(0.8, 1, q);
    } else if (seg.kind === 'dawn') {
      world = 'manor';
      manor.setDawn(smoothstep(0, 0.75, q));
      manor.shot('depart', q, W, H);
      veil = 1 - smoothstep(0, 0.32, q);
    } else if (seg.kind === 'arrive') {
      veil = 1 - smoothstep(0, 0.5, q);
      settle = 1 - ease(q);
    } else if (seg.kind === 'leave') {
      veil = smoothstep(0.35, 1, q);
      settle = ease(q);
    }
    setVeil(veil);

    // ---- desk camera ----
    const wide = W > 860;
    const fitK = wide ? 1.2 : clamp01(1.2 - W / H) * 0.9 + 1.3;
    pos.copy(CLOSED_POS).lerp(OPEN_POS, cover);
    pos.sub(LOOK).multiplyScalar(fitK).add(LOOK);
    look.copy(LOOK);
    if (settle > 0) pos.lerp(SETTLE_POS, settle);
    if (dive > 0) {
      // Centre of the picture on the left-hand page of this spread.
      // (the book reports how high that page sits on its block of paper)
      art.set(-0.5, BOOK_Y + book.leftPageZ(chapter - 1), -0.0694);
      divePos.copy(art).add(DIVE_OFFSET);
      pos.lerp(divePos, dive);
      look.lerp(art, dive);
    }
    camera.position.copy(pos);
    camera.lookAt(look);
    // Wide layouts: open, the book moves left, leaving room for the copy.
    const shiftX = wide ? W * 0.2 * cover * (1 - dive) : 0;
    // Narrow screens: once open, the book rises into the upper part of the screen, leaving the
    // lower part to its caption (instead of a band of dark wall above and the copy over the pages).
    const shiftY = wide ? 0 : H * 0.13 * cover * (1 - dive);
    camera.setViewOffset(W, H, shiftX, shiftY, W, H);
    camera.updateMatrixWorld();

    // ---- portal: the inside world opens out of the picture ----
    const diag = Math.hypot(W, H);
    // how hard the reader is falling through the page: most in the middle of the dive (and of
    // the climb back out), and more the faster they scroll
    const crossing = seg.kind === 'in' ? Math.sin(Math.PI * q) : seg.kind === 'out' ? Math.sin(Math.PI * q) * 0.85 : 0;
    const warpAmt = crossing * (0.35 + 0.65 * warpVel);
    let warpX = W / 2;
    let warpY = H / 2;
    // The portal opens steadily across the dive rather than bursting at the end.
    const open = chapter ? smoothstep(0.25, 1, dive) : 0;
    const R = diag * 1.05 * open;
    const full = chapter && dive >= 1;
    // the iris opens with the portal, wide by the time it fills a third of the screen
    const iris = Math.round(smoothstep(0, 0.45, open) * 200) / 200;
    if (iris !== irisShown) {
      irisShown = iris;
      gate.style.setProperty('--open', String(iris));
    }
    if (chapter && R > 1) {
      projected.copy(art).project(camera);
      const cx = ((projected.x + 1) / 2) * W;
      const cy = ((1 - projected.y) / 2) * H;
      if (!full) {
        warpX = cx;
        warpY = cy;
      }
      if (full) {
        setPortal(true, 'none', 'opacity:0');
      } else {
        const r = R.toFixed(1);
        const x = cx.toFixed(1);
        const y = cy.toFixed(1);
        setPortal(
          true,
          `radial-gradient(circle ${r}px at ${x}px ${y}px, #000 ${Math.max(0, R - 40).toFixed(1)}px, transparent ${r}px)`,
          // (once the portal outgrows the screen the gate has faded: hidden, so its rings stop turning)
          0.9 * (1 - R / diag) < 0.005 ? 'opacity:0' : `opacity:${(0.9 * (1 - R / diag)).toFixed(3)};transform:translate(${(cx - GATE_R).toFixed(1)}px,${(cy - GATE_R).toFixed(1)}px) scale(${(R / GATE_R).toFixed(4)})`,
        );
      }
      inside.pose(chapter, flight, back, t, dt, W, H);
      inside.setWarp(warpAmt * 0.9, warpX / W, 1 - warpY / H);
      inside.render();
    } else {
      setPortal(false, 'none', 'opacity:0');
    }

    warp.update(warpAmt, warpX, warpY, dt);
    clock.update(u / timeline.total, window.scrollY * 0.35, now);
    odo.set(pageAt(u));
    if (u < MANOR_T * 0.4) {
      const spin = Math.round(window.scrollY * 0.12);
      if (spin !== worksSpin) {
        worksSpin = spin;
        works?.style.setProperty('--spin', String(spin));
        windup?.style.setProperty('--spin', String(spin));
      }
    }
    textFx.update(now);
    const inChapter = seg.kind === 'inside' ? CHAPTERS[seg.k - 1] : null;
    hud.update({
      chapter: inChapter ? seg.k : null,
      label: inChapter?.label,
      heading: inChapter?.heading,
      page: BOOK_PAGES[seg.k - 1],
      scene: inChapter ? Math.max(0, Math.min(seg.n, Math.round(flight))) : 0,
      n: seg.n,
      now,
    });
    document.body.classList.toggle('is-inside', Boolean(full));
    document.body.classList.toggle('is-past-hero', u > MANOR_T * 0.1);
    document.body.classList.toggle('is-finale', seg.kind === 'dawn' && q > 0.4); // the closing links take clicks only while shown
    // The ribbon bookmark lengthens with the reading; the contents page marks the reader's place.
    document.body.classList.toggle('is-after-act', window.scrollY > actTop + actRange - 2);
    const rh = Math.round(28 + clamp01(u / timeline.total) * (H - 46));
    if (rh !== ribbonH) { ribbonH = rh; ribbon.style.height = `${rh}px`; }
    menu.mark(u);

    // Draw one world per frame. The desk is hidden behind the open portal, so it
    // is skipped while inside a chapter; nothing is drawn under a solid veil, or
    // once the stage has scrolled away above the edition section.
    const offstage = window.scrollY > actTop + actRange + H;
    if (veil < 0.999 && !offstage) {
      if (world === 'manor') {
        manor.update(t, dt);
        renderPass.scene = manor.scene;
        renderPass.camera = manor.camera;
      } else if (!full) {
        room.update(t, u);
        renderPass.scene = scene;
        renderPass.camera = camera;
      }
      if (world === 'manor' || !full) {
        if (LITE) {
          renderer.render(renderPass.scene, renderPass.camera);
        } else {
          vignette.uniforms.uTime.value = t;
          // the study is in page units (one page = 1); the manor is in metres
          aimAO(ao, renderPass.scene, renderPass.camera, world === 'manor' ? 0.6 : 0.12);
          // the lens: focused on what the camera looks at; wider while the book lies open
          const lensAmt = world === 'manor' ? 0 : (1 - smoothstep(0, 0.3, dive)) * (cover > 0.5 ? 0.8 : 1);
          lens.enabled = DESKTOP_CLASS && lensAmt > 0.01; // (phones go without: too costly for a subtle effect)
          if (lens.enabled) {
            lensFocus.copy(look).project(camera);
            lens.uniforms.uFocus.value.set((lensFocus.x + 1) / 2, (lensFocus.y + 1) / 2);
            lens.uniforms.uRadius.value = lerp(0.48, 0.64, cover);
            lens.uniforms.uAmount.value = lensAmt;
          }
          // shadows: once this frame, if anything that casts one has moved (the manor's every frame;
          // the study's while the book moves, and now and then)
          if (world === 'manor' || now - deskMoved < 600 || ++shadowTick % 30 === 0) renderer.shadowMap.needsUpdate = true;
          const tr = performance.now();
          const p0 = renderer.info.programs.length, x0 = renderer.info.memory.textures;
          composer.render();
          if (performance.now() - tr > 30) performance.measure(`desk render ${world} ${(performance.now() - tr).toFixed(0)}ms +${renderer.info.programs.length - p0} programs +${renderer.info.memory.textures - x0} textures`, { start: tr });
        }
      }
    }
    inside.tick(); // upload a few textures for the worlds ahead
    deskUploads.tick(); // and the study's, which arrive after the loader
    requestAnimationFrame(frame);
  };

  // The study's photographed surfaces (2k on desktop) finish loading after the loading screen;
  // upload them a few per frame while the reader is at the manor, not all on the first frame of the study.
  const deskUploads = new Uploader(renderer);
  deskUploads.queue(scene);

  // Mount scrollcraft once the act and its beats exist, then measure the act.
  ScrollCraft.mount(document.body);
  onResize();
  smooth = new SmoothScroll();
  // While the loading screen is still up: draw the study once and the first chapter's world
  // once, unseen, so their shaders compile now and not as the reader arrives.
  if (!LITE) {
    renderPass.scene = scene;
    renderPass.camera = camera;
    renderer.compile(scene, camera);
    composer.render();
    renderPass.scene = manor.scene;
    renderPass.camera = manor.camera;
    inside.warmUp(SHOWCASE[0]);
  }
  requestAnimationFrame(frame);
  document.getElementById('loader').classList.add('is-hidden');
  // the chapter worlds' skies, prepared in the background (each world then gets its light at once)
  // (the chapter worlds are the book's paintings, lit as painted: they need no sky)
  prepareSkies(renderer, ['misty_dawn']);
  // models arriving later in the study or at the manor compile in the background too
  onModelLoaded((obj, holder) => {
    let root = holder;
    while (root.parent) root = root.parent;
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(composer.readBuffer); // compiled for the buffer it will draw into
    if (root === scene) renderer.compileAsync(obj, camera, root).catch(() => {});
    else if (root === manor.scene) renderer.compileAsync(obj, manor.camera, root).catch(() => {});
    renderer.setRenderTarget(prev);
  });
  // Start the frontispiece entrance as the loader fades.
  requestAnimationFrame(() => {
    document.body.classList.add('is-ready');
    textFx.playHero();
  });
}

main().catch((err) => {
  console.error(err);
  const p = document.querySelector('#loader p');
  if (p) p.textContent = 'Could not open the book. Check the console for details.';
});
