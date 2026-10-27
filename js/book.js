import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/addons/RoundedBoxGeometry.js';
import { DESKTOP_CLASS } from './device.js';

// The book on the desk: a cased hardcover, modelled like the 3D book reel.
//   Case: rounded boards with squares over the text block, a rounded spine carrying the spine art,
//     cloth with a slight sheen, a satin laminate on the cover whose gold print is metallic.
//   Text block: paper on both sides of the gutter whose thickness follows the reading position,
//     its fore-edge, head and tail showing the leaves; headbands; a satin ribbon left on the desk.
//   Leaves: each page rises out of the gutter, lifts a little at the fore-edge, and turns with
//     a curl (the free edge leads). Paper has fibre and a faint cockle.
// The public API is unchanged: Book, STATE_CLOSED, LEAF_COUNT, root, setRenderer, pose, setTilt,
// plus leftPageZ(), which tells the camera how high the left-hand page sits.

export const STATE_CLOSED = -1; // front cover shut
export const LEAF_COUNT = 33;

// Units: one page is 1.0 wide (6 in). The book's local +z is up from the desk.
const PAGE_W = 1.0;
const PAGE_H = 1.5;
const BOARD_W = 1.06;
const BOARD_H = 1.59;
const BOARD_T = 0.03;
const SPINE_T = 0.29; // matches the spine art's 0.184 aspect ratio
const BOARD_Z = SPINE_T / 2 - BOARD_T / 2;
const BOTTOM = -BOARD_Z + BOARD_T / 2; // the back board's inner face: the text block stands on it
const LEAF_GAP = 0.0004; // spacing of resting leaves
const LEAF_T = 0.0008; // a leaf's thickness: its two printed faces are separate surfaces
const PAPER = SPINE_T - 2 * BOARD_T - LEAF_COUNT * LEAF_GAP - 0.004; // paper under the loose leaves
const SINK = 0.015; // sets the back board down on the desk
const GUTTER = 0.075; // how quickly a page rises out of the gutter
const SEG_X = 28; // segments across a page, so it can curl
const SEG_Y = 3;
const CLOTH = 0x16223d;
const EDGE_V = 0.18; // one repeat of the edge texture (256 leaves) per 0.18 of paper
const WINDOW = 3; // leaves either side of the current spread that show their page textures
const WARM = WINDOW + 3; // leaves either side whose pages are drawn ahead, in idle time
const KEEP = WINDOW + 5; // beyond this, cached page textures are released
// The spread being read (and the leaves either side of it) is drawn at this many canvas pixels
// per page pixel, so its type and plates stay sharp on a fine screen and as the camera dives in.
// It is drawn in idle time and swapped in; until then the page shows its normal drawing.
const HI = DESKTOP_CLASS ? 2 : 1.5;

// Run work when the browser is idle, so drawing pages never lands mid-scroll.
const whenIdle = window.requestIdleCallback
  ? (fn) => window.requestIdleCallback(fn, { timeout: 120 })
  : (fn) => window.setTimeout(fn, 24);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

let ANISO = 8; // raised to what the GPU allows once the renderer is known (setRenderer)
function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = ANISO;
  return tex;
}
function drawTexture(w, h, draw, srgb = true) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ---- procedural textures ----------------------------------------------------------------------
// paper fibre: tileable value noise in a few octaves, plus short streaks, as a normal map
function paperNormal() {
  const N = 256, r = rng(31);
  const octave = (period) => { const g = Float32Array.from({ length: period * period }, () => r()); return (x, y) => {
    const fx = (x / N) * period, fy = (y / N) * period, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const at = (i, j) => g[(((j % period) + period) % period) * period + (((i % period) + period) % period)];
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return lerp(lerp(at(x0, y0), at(x0 + 1, y0), sx), lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), sx), sy);
  }; };
  const o1 = octave(32), o2 = octave(64), o3 = octave(128), streak = octave(16);
  const hv = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) hv[y * N + x] = o1(x, y) * 0.5 + o2(x, y) * 0.3 + o3(x, y) * 0.2 + streak(x * 0.25, y * 4) * 0.25;
  const tex = drawTexture(N, N, (g) => {
    const img = g.createImageData(N, N), d = img.data;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = (hv[y * N + ((x + 1) % N)] - hv[y * N + ((x - 1 + N) % N)]) * 1.6, dy = (hv[((y + 1) % N) * N + x] - hv[((y - 1 + N) % N) * N + x]) * 1.6;
      const l = Math.hypot(dx, dy, 1), k = (y * N + x) * 4;
      d[k] = (-dx / l * 0.5 + 0.5) * 255; d[k + 1] = (dy / l * 0.5 + 0.5) * 255; d[k + 2] = (1 / l * 0.5 + 0.5) * 255; d[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, false);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 3);
  return tex;
}
// the paper's edge: one fine line per leaf, each a slightly different white
function pageEdge() {
  const r = rng(11);
  const tex = drawTexture(512, 512, (g) => {
    g.fillStyle = '#efe5cf'; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 2) {
      g.fillStyle = `rgba(104,90,70,${0.1 + r() * 0.26})`; g.fillRect(0, y, 512, 1);
      if (r() < 0.08) { g.fillStyle = 'rgba(255,250,238,0.35)'; g.fillRect(0, y + 1, 512, 1); }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
// the cover's gold print, found from the art itself: G = roughness, B = metalness
function foilMap(image) {
  try {
    const S = 1024;
    return drawTexture(S, S, (g) => {
      g.drawImage(image, 0, 0, S, S);
      const img = g.getImageData(0, 0, S, S), d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const R = d[i], G = d[i + 1], B = d[i + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B), sat = mx ? (mx - mn) / mx : 0;
        const gold = clamp((R - B) / 90, 0, 1) * clamp((mx - 95) / 80, 0, 1) * clamp((sat - 0.2) / 0.25, 0, 1) * (R >= G ? 1 : 0.6);
        d[i] = 0; d[i + 1] = 255 * lerp(0.55, 0.28, gold); d[i + 2] = 255 * lerp(0.02, 0.92, gold); d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }, false);
  } catch {
    return null; // an image the canvas cannot read: the cover stays satin, without foil
  }
}

// ---- a page surface: a grid whose positions are written each time the leaf moves -------------------
function pageGrid(mirrorU) {
  const g = new THREE.BufferGeometry(), n = (SEG_X + 1) * (SEG_Y + 1);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const uv = new Float32Array(n * 2);
  for (let i = 0; i <= SEG_X; i++) for (let j = 0; j <= SEG_Y; j++) {
    const k = i * (SEG_Y + 1) + j;
    uv[k * 2] = mirrorU ? 1 - i / SEG_X : i / SEG_X; // a recto's spine edge is its left edge; a verso's, its right
    uv[k * 2 + 1] = j / SEG_Y;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < SEG_X; i++) for (let j = 0; j < SEG_Y; j++) {
    const a = i * (SEG_Y + 1) + j, b = a + (SEG_Y + 1), c = a + 1, d = b + 1;
    idx.push(a, b, c, b, d, c);
  }
  g.setIndex(idx);
  return g;
}

export class Book {
  /**
   * @param {{ textures: { front, back, spine }, renderPage: (page: number|string) => HTMLCanvasElement }} opts
   */
  constructor({ textures, renderPage }) {
    this.renderPage = renderPage;
    this.state = STATE_CLOSED;
    this.cover = { value: 0 };
    this.tilt = { x: 0, y: 0, targetX: 0, targetY: 0 };
    this.root = new THREE.Group();
    this.frontPivot = new THREE.Group();
    this.leafFront = [];
    this.leafBack = [];
    this.leafValue = new Array(LEAF_COUNT).fill(0);
    this.leafDrawn = new Array(LEAF_COUNT).fill(null); // what each leaf's geometry was last written for
    this.renderer = null;
    this.cache = new Map(); // page -> texture
    this.queue = [];
    this.pumping = false;
    this.lastCenter = null;
    this.hL = 0;
    this.hR = PAPER;
    this.blockKey = '';
    this.hiPages = new Set(); // the two pages of the spread being read: the ones drawn sharp
    this.busy = false; // set by the page while the scroll is moving: sharp drawing waits for rest

    this.blankTex = canvasTexture(this.renderPage('blank'));
    this.paperNormal = paperNormal();

    const cloth = new THREE.MeshPhysicalMaterial({ color: CLOTH, roughness: 0.78, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x46557f), side: THREE.DoubleSide });
    const satin = (map) => new THREE.MeshStandardMaterial({ map, roughness: 0.5, metalness: 0.02 });
    const printed = (page) => satin(canvasTexture(this.renderPage(page, HI)));
    const foil = foilMap(textures.front.image);
    const coverMat = foil
      ? new THREE.MeshPhysicalMaterial({ map: textures.front, roughnessMap: foil, metalnessMap: foil, roughness: 1, metalness: 1, clearcoat: 0.25, clearcoatRoughness: 0.45 })
      : new THREE.MeshPhysicalMaterial({ map: textures.front, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.45 });

    // The boards: cloth cases with the printed faces laid on them (squares of 0.03 all round).
    const boardGeo = new RoundedBoxGeometry(BOARD_W, BOARD_H, BOARD_T, 3, 0.008);
    const faceGeo = new THREE.PlaneGeometry(BOARD_W - 0.016, BOARD_H - 0.016);
    const face = (mat, z, flip) => { const m = new THREE.Mesh(faceGeo, mat); m.position.z = z; if (flip) m.rotation.y = Math.PI; m.receiveShadow = true; return m; };

    // Front board: hinged at the spine, opens to the left. Outside, the cover; inside, page 0.
    const frontBoard = new THREE.Group();
    const frontCase = new THREE.Mesh(boardGeo, cloth);
    frontCase.castShadow = frontCase.receiveShadow = true;
    frontBoard.add(frontCase, face(coverMat, BOARD_T / 2 + 0.0004, false), face(printed(0), -BOARD_T / 2 - 0.0004, true));
    frontBoard.position.set(PAGE_W / 2, 0, BOARD_Z);
    this.frontPivot.add(frontBoard);
    this.root.add(this.frontPivot);

    // Back board stays put; its inside is the endpaper the text block stands on.
    const backBoard = new THREE.Group();
    const backCase = new THREE.Mesh(boardGeo, cloth);
    backCase.castShadow = backCase.receiveShadow = true;
    backBoard.add(backCase, face(printed('endpaper'), BOARD_T / 2 + 0.0004, false), face(satin(textures.back), -BOARD_T / 2 - 0.0004, true));
    backBoard.position.set(PAGE_W / 2, 0, -BOARD_Z);
    this.root.add(backBoard);

    // The spine: half a tube along y carrying the spine art, bulging to -x; it unrolls under
    // the gutter as the book opens.
    this.spine = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, BOARD_H, 32, 1, true, Math.PI, Math.PI),
      new THREE.MeshPhysicalMaterial({ map: textures.spine, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.45, side: THREE.DoubleSide }),
    );
    this.spine.castShadow = true;
    this.root.add(this.spine);

    // The text block on either side of the gutter: fore-edge, head and tail, rebuilt as paper moves.
    // Gilt edges, as on a fine edition: gold leaf over the leaves, each leaf still a fine line.
    const edgeMat = new THREE.MeshPhysicalMaterial({ map: pageEdge(), color: 0xe2bb6c, metalness: 0.45, roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.3, side: THREE.DoubleSide });
    this.rightBlock = new THREE.Mesh(new THREE.BufferGeometry(), edgeMat);
    this.leftBlock = new THREE.Mesh(new THREE.BufferGeometry(), edgeMat);
    for (const b of [this.rightBlock, this.leftBlock]) { b.castShadow = b.receiveShadow = true; this.root.add(b); }

    // Headbands at the head and tail of the gutter: small striped beads of silk.
    const bandTex = drawTexture(128, 16, (g) => { for (let x = 0; x < 128; x += 8) { g.fillStyle = '#1b2547'; g.fillRect(x, 0, 4, 16); g.fillStyle = '#c9a25a'; g.fillRect(x + 4, 0, 4, 16); } });
    const bandMat = new THREE.MeshPhysicalMaterial({ map: bandTex, roughness: 0.55, sheen: 0.8, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xe9cf96) });
    const bandGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.06, 12);
    bandGeo.rotateZ(Math.PI / 2);
    this.headbands = [1, -1].map((sy) => { const m = new THREE.Mesh(bandGeo, bandMat); m.position.set(0, sy * (PAGE_H / 2 + 0.003), BOTTOM + 0.006); m.castShadow = true; this.root.add(m); return m; });

    // The ribbon: leaves the gutter at the tail, rolls over the board's edge and lies on the desk.
    this.ribbon = this.makeRibbon();
    this.root.add(this.ribbon);

    // Leaves: a recto (front) and a verso (back) per leaf, both written directly in the book's frame.
    for (let s = 0; s < LEAF_COUNT; s++) {
      const leaf = (mirror) => {
        const m = new THREE.Mesh(pageGrid(mirror), new THREE.MeshStandardMaterial({ map: this.blankTex, roughness: 0.86, normalMap: this.paperNormal, normalScale: new THREE.Vector2(0.15, 0.15), side: THREE.DoubleSide }));
        m.castShadow = m.receiveShadow = true;
        m.userData.page = null;
        this.root.add(m);
        return m;
      };
      this.leafFront.push(leaf(false));
      this.leafBack.push(leaf(true));
    }

    this.refreshTextures();
  }

  makeRibbon() {
    const z0 = BOTTOM + 0.003, desk = -BOARD_Z - BOARD_T / 2 + 0.0015;
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.0, -0.6, z0), new THREE.Vector3(0.0, -PAGE_H / 2, z0), new THREE.Vector3(0.002, -BOARD_H / 2 - 0.002, BOTTOM + 0.001),
      new THREE.Vector3(0.006, -BOARD_H / 2 - 0.012, (BOTTOM + desk) / 2), new THREE.Vector3(0.01, -BOARD_H / 2 - 0.022, desk),
      new THREE.Vector3(0.03, -0.9, desk), new THREE.Vector3(0.07, -1.0, desk),
    ], false, 'centripetal');
    const N = 60, HW = 0.017, NOTCH = 0.013, up = new THREE.Vector3(0, 0, 1), pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = path.getPointAt(t), tg = path.getTangentAt(t), lat = new THREE.Vector3().crossVectors(up, tg).normalize();
      const back = i === N ? tg.clone().multiplyScalar(-NOTCH) : new THREE.Vector3(); // the V cut: the centre stops short
      for (const k of [-1, 0, 1]) { const q = p.clone().addScaledVector(lat, k * HW); if (k === 0) q.add(back); pos.push(q.x, q.y, q.z); uv.push((k + 1) / 2, t); }
    }
    for (let i = 0; i < N; i++) for (let k = 0; k < 2; k++) { const a = i * 3 + k, b = a + 1, c = a + 3, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: 0x6f1020, roughness: 0.38, sheen: 1, sheenRoughness: 0.32, sheenColor: new THREE.Color(0xff8a9a), side: THREE.DoubleSide }));
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  // Lets the book upload page textures to the GPU before they are needed.
  setRenderer(renderer) {
    this.renderer = renderer;
    ANISO = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  }

  /** A page's texture: drawn at normal resolution, or sharp (hi), replacing a normal one. */
  pageTexture(page, hi = false) {
    let e = this.cache.get(page);
    if (!e || (hi && !e.hi)) {
      const tex = canvasTexture(this.renderPage(page, hi ? HI : 1));
      if (e) this.retire(e.tex);
      e = { tex, hi };
      this.cache.set(page, e);
    }
    return e.tex;
  }

  // A texture a leaf may still be showing this frame is released a moment later, not now.
  retire(tex) {
    window.setTimeout(() => tex.dispose(), 500);
  }

  needs(page, hi) {
    const e = this.cache.get(page);
    return !e || (hi && !e.hi);
  }

  enqueue(page, hi) {
    const q = this.queue.find((x) => x.page === page);
    if (q) q.hi = q.hi || hi;
    else this.queue.push({ page, hi });
  }

  // Queue the pages around the reader, then draw and upload them one per idle slot: the
  // spread being read first (sharp), then the leaves further out (normal).
  warm(center) {
    for (let d = 0; d <= WARM; d++) {
      for (const s of d === 0 ? [center] : [center + d, center - d]) {
        if (s < 0 || s >= LEAF_COUNT) continue;
        for (const page of [2 * s + 1, 2 * s + 2]) {
          const hi = this.hiPages.has(page);
          if (this.needs(page, hi)) this.enqueue(page, hi);
        }
      }
    }
    if (!this.pumping) this.pump();
  }

  pump() {
    this.pumping = true;
    whenIdle(() => {
      let job = this.queue.shift();
      // a sharp drawing is for a spread being read: not one already turned away from, and not
      // while the page is moving (it is a large upload); it waits for the scroll to rest
      if (job?.hi && !this.hiPages.has(job.page)) job.hi = false;
      if (job?.hi && this.busy) {
        this.queue.push(job);
        job = this.queue.find((j) => !j.hi);
        if (job) this.queue.splice(this.queue.indexOf(job), 1);
      }
      if (job && this.needs(job.page, job.hi)) {
        const tex = this.pageTexture(job.page, job.hi);
        this.renderer?.initTexture(tex);
      }
      if (!this.queue.length) this.pumping = false;
      else if (!job) window.setTimeout(() => this.pump(), 250); // only sharp work left: try again at rest
      else this.pump();
    });
  }

  // Release page textures far behind or far ahead of the reader, and sharp ones once the
  // reader has moved on from them (they are drawn again, sharp, if the reader comes back).
  evict(center) {
    const inUse = new Set();
    for (const m of [...this.leafFront, ...this.leafBack]) inUse.add(m.userData.page);
    for (const [page, e] of this.cache) {
      const d = Math.abs(Math.floor((page - 1) / 2) - center);
      if (inUse.has(page)) continue;
      if (d > KEEP || (e.hi && !this.hiPages.has(page))) {
        e.tex.dispose();
        this.cache.delete(page);
      }
    }
  }

  get coverProgress() {
    return this.cover.value;
  }

  setTilt(x, y) {
    this.tilt.targetX = x;
    this.tilt.targetY = y;
  }

  /**
   * Scroll-driven pose: set the cover and every leaf directly.
   * state is the spread index (-1 while the front cover is shut).
   */
  pose(state, coverValue, leafValues, dt = 0) {
    this.state = state;
    this.cover.value = coverValue;
    for (let s = 0; s < LEAF_COUNT; s++) this.leafValue[s] = leafValues[s];
    this.refreshTextures();
    this.update(dt);
  }

  // Height of the paper surface at distance x from the spine, over a block h thick. The fore-edge
  // lifts a little once the book is open (curl 0..1).
  restZ(x, h, curl) {
    return BOTTOM + h * (1 - Math.exp(-x / GUTTER)) + curl * 0.006 * smooth((x / PAGE_W - 0.78) / 0.22);
  }

  // The stack position of leaf s: unturned leaves rest on the right, the first on top;
  // turned leaves rest on the left, the latest on top.
  lift(s, v) {
    if (v <= 0) return 0.001 + LEAF_GAP * (LEAF_COUNT - 1 - s);
    if (v >= 1) return 0.001 + LEAF_GAP * s;
    return 0.004;
  }

  /** How high (in the book's frame, desk sink included) the left-hand page of turned leaf s sits, mid-page. */
  leftPageZ(s) {
    return this.restZ(PAGE_W / 2, this.hL, this.cover.value) + this.lift(s, 1) - SINK;
  }

  update(dt) {
    const c = this.cover.value;
    this.frontPivot.rotation.y = -Math.PI * c;
    this.root.position.x = -0.5 * (1 - c);
    this.root.position.z = -SINK;

    // Paper moves from the right block to the left as leaves turn.
    let turned = 0;
    for (let s = 0; s < LEAF_COUNT; s++) turned += clamp(this.leafValue[s], 0, 1);
    const p = turned / LEAF_COUNT;
    this.hR = PAPER * (1 - p);
    this.hL = PAPER * p;

    // The spine wraps the closed book, then flattens under the gutter.
    const open = smooth(c);
    this.spine.scale.set(lerp(0.045, 0.02, open), 1, lerp(SPINE_T / 2, 0.04, open));
    this.spine.position.set(0, 0, lerp(0, -0.165, open)); // open, it sits below the gutter, out of sight
    const isOpen = c > 0.97;
    this.ribbon.visible = isOpen;
    for (const h of this.headbands) h.visible = isOpen;
    this.leftBlock.visible = c > 0.5;

    const key = `${this.hR.toFixed(5)}|${c.toFixed(3)}`;
    if (key !== this.blockKey) {
      this.blockKey = key;
      this.buildBlock(this.rightBlock.geometry, 1, this.hR, c);
      this.buildBlock(this.leftBlock.geometry, -1, this.hL, c);
    }

    // Only paper that can be seen is drawn: the top leaf of each pile and any leaf in the air.
    // (The rest lie a fraction of a millimetre under them; drawing them, their shadows and their
    // occlusion cost most of the book's frame for nothing.) Hidden leaves are reshaped when they
    // next show.
    let topRight = -1;
    let topLeft = -1;
    for (let s = 0; s < LEAF_COUNT; s++) {
      const v = this.leafValue[s];
      if (v <= 0 && topRight < 0) topRight = s;
      if (v >= 1) topLeft = s;
    }
    for (let s = 0; s < LEAF_COUNT; s++) {
      const v = clamp(this.leafValue[s], 0, 1);
      const turning = v > 0 && v < 1;
      this.leafFront[s].visible = turning || s === topRight;
      this.leafBack[s].visible = turning || s === topLeft;
      if (this.leafFront[s].visible || this.leafBack[s].visible) this.shapeLeaf(s, v, c);
    }

    const ease = 1 - Math.exp(-dt * 6);
    this.tilt.x += (this.tilt.targetX - this.tilt.x) * ease;
    this.tilt.y += (this.tilt.targetY - this.tilt.y) * ease;
    this.root.rotation.x = this.tilt.x;
    this.root.rotation.y = this.tilt.y;
  }

  // A leaf turning about the spine: the fore-edge leads, so the paper curls; v = 0 rests right,
  // v = 1 rests left. Both faces are written from one shape; the verso sits LEAF_T behind.
  shapeLeaf(s, v, curl) {
    const key = `${v.toFixed(4)}|${this.hR.toFixed(5)}|${curl.toFixed(3)}`;
    if (this.leafDrawn[s] === key) return;
    this.leafDrawn[s] = key;
    const th = Math.PI * v, bend = 0.9 * Math.sin(th), lift = this.lift(s, v), resting = v <= 0 || v >= 1;
    const xs = new Float32Array(SEG_X + 1), zs = new Float32Array(SEG_X + 1);
    let x = 0, z = 0;
    for (let i = 0; i <= SEG_X; i++) {
      const sx = (PAGE_W * i) / SEG_X;
      if (i > 0) { const phi = clamp(th + bend * Math.pow(sx / PAGE_W, 1.4), 0, Math.PI), ds = PAGE_W / SEG_X; x += Math.cos(phi) * ds; z += Math.sin(phi) * ds; }
      xs[i] = x;
      zs[i] = z + lerp(this.restZ(sx, this.hR, curl), this.restZ(sx, this.hL, curl), smooth(v)) + lift;
    }
    const front = this.leafFront[s].geometry, back = this.leafBack[s].geometry;
    const fp = front.attributes.position, bp = back.attributes.position;
    for (let i = 0; i <= SEG_X; i++) for (let j = 0; j <= SEG_Y; j++) {
      const k = i * (SEG_Y + 1) + j, y = -PAGE_H / 2 + (PAGE_H * j) / SEG_Y, sx = (PAGE_W * i) / SEG_X;
      const cockle = resting ? 0.0012 * Math.sin(y * 4 + sx * 3) * smooth(sx / 0.15) : 0;
      fp.setXYZ(k, xs[i], y, zs[i] + cockle);
    }
    fp.needsUpdate = true;
    front.computeVertexNormals();
    front.computeBoundingSphere();
    const n = front.attributes.normal;
    for (let k = 0; k < fp.count; k++) bp.setXYZ(k, fp.getX(k) - n.getX(k) * LEAF_T, fp.getY(k) - n.getY(k) * LEAF_T, fp.getZ(k) - n.getZ(k) * LEAF_T);
    bp.needsUpdate = true;
    back.setAttribute('normal', n);
    back.computeBoundingSphere();
  }

  // The fore-edge (x = ±PAGE_W) and the head and tail (y = ±PAGE_H/2) of one side of the block.
  buildBlock(g, side, h, curl) {
    const pos = [], nrm = [], uvs = [];
    const top = (x) => Math.max(BOTTOM + 0.001, this.restZ(x, h, curl) - 0.002);
    const quad = (pts, n, uv) => {
      const tri = (a, b, c) => {
        const e1 = new THREE.Vector3().subVectors(pts[b], pts[a]), e2 = new THREE.Vector3().subVectors(pts[c], pts[a]);
        const order = e1.cross(e2).dot(n) >= 0 ? [a, b, c] : [a, c, b];
        for (const k of order) { pos.push(pts[k].x, pts[k].y, pts[k].z); nrm.push(n.x, n.y, n.z); uvs.push(uv[k][0], uv[k][1]); }
      };
      tri(0, 1, 2); tri(0, 2, 3);
    };
    const X = (x) => side * x, Y = PAGE_H / 2, zt = top(PAGE_W);
    quad([new THREE.Vector3(X(PAGE_W), -Y, BOTTOM), new THREE.Vector3(X(PAGE_W), Y, BOTTOM), new THREE.Vector3(X(PAGE_W), Y, zt), new THREE.Vector3(X(PAGE_W), -Y, zt)],
      new THREE.Vector3(side, 0, 0), [[0, 0], [PAGE_H, 0], [PAGE_H, (zt - BOTTOM) / EDGE_V], [0, (zt - BOTTOM) / EDGE_V]]);
    for (const yc of [-Y, Y]) for (let i = 0; i < 20; i++) {
      const x0 = (PAGE_W * i) / 20, x1 = (PAGE_W * (i + 1)) / 20, z0 = top(x0), z1 = top(x1);
      quad([new THREE.Vector3(X(x0), yc, BOTTOM), new THREE.Vector3(X(x1), yc, BOTTOM), new THREE.Vector3(X(x1), yc, z1), new THREE.Vector3(X(x0), yc, z0)],
        new THREE.Vector3(0, Math.sign(yc), 0), [[x0, 0], [x1, 0], [x1, (z1 - BOTTOM) / EDGE_V], [x0, (z0 - BOTTOM) / EDGE_V]]);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.computeBoundingSphere();
  }

  // Only leaves near the current spread (or mid-turn) hold real page textures.
  // Everything else shows blank paper, which keeps GPU memory small.
  refreshTextures() {
    const center = clamp(this.state, 0, LEAF_COUNT - 1);
    if (center !== this.lastCenter) {
      this.lastCenter = center;
      // the spread in view: the left page (the back of the leaf before) and the right (this leaf's front)
      this.hiPages = new Set([2 * center, 2 * center + 1]);
      this.queue = this.queue.filter((job) => Math.abs(Math.floor((job.page - 1) / 2) - center) <= WARM);
      this.warm(center);
      this.evict(center);
    }
    for (let s = 0; s < LEAF_COUNT; s++) {
      const turning = this.leafValue[s] > 0.001 && this.leafValue[s] < 0.999;
      const keep = Math.abs(s - center) <= WINDOW || turning;
      // Only the spread being read is drawn on the spot; pages flashing past in a
      // riffle wait for idle time and show plain paper until then.
      const urgent = Math.abs(s - center) <= 1;
      this.setLeafPage(this.leafFront[s], keep ? 2 * s + 1 : null, urgent, this.hiPages.has(2 * s + 1));
      this.setLeafPage(this.leafBack[s], keep ? 2 * s + 2 : null, urgent, this.hiPages.has(2 * s + 2));
    }
  }

  setLeafPage(mesh, page, urgent = true, sharp = false) {
    const e = page === null ? null : this.cache.get(page);
    // done already: this page, as sharp as it will get here
    if (mesh.userData.page === page && (page === null || mesh.userData.hi || !sharp || !(e && e.hi) && this.queuedHi(page))) return;
    if (page === null) {
      mesh.material.map = this.blankTex;
      mesh.userData.page = null;
      mesh.userData.hi = false;
      return;
    }
    if (!urgent && !e) {
      // Not drawn yet: show paper, queue it, and try again next frame.
      mesh.material.map = this.blankTex;
      mesh.userData.page = null;
      this.enqueue(page, false);
      if (!this.pumping) this.pump();
      return;
    }
    // The spread being read: the sharp drawing if it is ready; if not, the normal one (drawn on
    // the spot only after a jump) while the sharp one is drawn at rest, in idle time.
    if (sharp && !(e && e.hi)) {
      this.enqueue(page, true);
      if (!this.pumping) this.pump();
    }
    const tex = e ? e.tex : this.pageTexture(page);
    mesh.material.map = tex;
    mesh.userData.page = page;
    mesh.userData.hi = Boolean(this.cache.get(page)?.hi);
  }

  /** Forget a page's drawing (its picture has just arrived): it is drawn again the next time it is needed. */
  invalidatePage(page) {
    const e = this.cache.get(page);
    if (e) {
      this.retire(e.tex);
      this.cache.delete(page);
    }
    for (const m of [...this.leafFront, ...this.leafBack]) if (m.userData.page === page) m.userData.page = undefined;
  }

  queuedHi(page) {
    return this.queue.some((x) => x.page === page && x.hi);
  }
}
