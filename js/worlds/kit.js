// Shared toolkit for the chapter worlds: noise, procedural textures, props and
// effects. Every world is built from these, so the eight places share one
// standard of material, light and finish.
import * as THREE from 'three';
import { Reflector } from '../../vendor/addons/objects/Reflector.js';
import { RoundedBoxGeometry } from '../../vendor/addons/RoundedBoxGeometry.js';
import { mergeGeometries } from '../../vendor/addons/utils/BufferGeometryUtils.js';

// ---- maths ------------------------------------------------------------------------
export function rng(seed = 1) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}
export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const hash2 = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
export function noise2(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 5) {
  let s = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * noise2(x * f, y * f);
    f *= 2.03;
    a *= 0.5;
  }
  return s;
}
export function ridged(x, y, oct = 5) {
  let s = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    let n = 1 - Math.abs(noise2(x * f, y * f) * 2 - 1);
    n *= n;
    s += a * n;
    f *= 2.07;
    a *= 0.5;
  }
  return s;
}

// ---- textures ---------------------------------------------------------------------
export function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// UVs from each face's plane in world units, so textures tile at a real scale.
export function worldUV(geo, scale) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let u;
    let v;
    if (nx >= ny && nx >= nz) [u, v] = [z, y];
    else if (ny >= nx && ny >= nz) [u, v] = [x, z];
    else [u, v] = [x, y];
    uv.setXY(i, u / scale, v / scale);
  }
  uv.needsUpdate = true;
  return geo;
}

const speckle = (g, w, h, r, n, alpha, light = false) => {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${light && r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * alpha})`;
    g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
};

export const tex = {
  planks(base = '#4a2f1c', seed = 1) {
    return canvasTex(512, 512, (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = '#120a05';
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 64) {
        let x = -r() * 200;
        while (x < w) {
          const len = 180 + r() * 260;
          const c = new THREE.Color(base).offsetHSL(0, (r() - 0.5) * 0.05, (r() - 0.5) * 0.06);
          g.fillStyle = `#${c.getHexString()}`;
          g.fillRect(x + 1, y + 1, len - 2, 62);
          for (let k = 0; k < 9; k++) {
            g.strokeStyle = `rgba(20,10,4,${0.08 + r() * 0.12})`;
            g.lineWidth = 0.6 + r() * 1.4;
            g.beginPath();
            const yy = y + 4 + r() * 56;
            g.moveTo(x, yy);
            g.bezierCurveTo(x + len * 0.3, yy + (r() - 0.5) * 8, x + len * 0.7, yy + (r() - 0.5) * 8, x + len, yy);
            g.stroke();
          }
          x += len;
        }
      }
      speckle(g, w, h, r, 5000, 0.12);
    });
  },
  panel(base = '#3b2416', seed = 2) {
    return canvasTex(512, 512, (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      const pad = 34;
      const cols = 2;
      const pw = (w - pad * (cols + 1)) / cols;
      for (let c = 0; c < cols; c++) {
        const x = pad + c * (pw + pad);
        const grad = g.createLinearGradient(x, pad, x + pw, h - pad);
        grad.addColorStop(0, 'rgba(255,220,180,0.10)');
        grad.addColorStop(1, 'rgba(0,0,0,0.35)');
        g.fillStyle = grad;
        g.fillRect(x, pad, pw, h - 2 * pad);
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.lineWidth = 4;
        g.strokeRect(x + 10, pad + 10, pw - 20, h - 2 * pad - 20);
      }
      speckle(g, w, h, r, 4000, 0.1);
    });
  },
  damask(base = '#2c3b2c', ink = 'rgba(210,190,140,0.10)', seed = 3) {
    return canvasTex(256, 256, (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      g.fillStyle = ink;
      for (const [cx, cy] of [[64, 64], [192, 192], [192, 64], [64, 192]]) {
        g.beginPath();
        g.ellipse(cx, cy, 26, 40, 0, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.ellipse(cx, cy - 46, 8, 12, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = ink;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, 128);
      g.lineTo(128, 0);
      g.lineTo(256, 128);
      g.lineTo(128, 256);
      g.closePath();
      g.stroke();
      speckle(g, w, h, r, 2500, 0.12);
    });
  },
  plaster(base = '#d9d2c3', seed = 4) {
    return canvasTex(512, 512, (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      speckle(g, w, h, r, 16000, 0.07, true);
      for (let i = 0; i < 30; i++) {
        const x = r() * w;
        const y = r() * h;
        const rad = 30 + r() * 90;
        const grad = g.createRadialGradient(x, y, 0, x, y, rad);
        grad.addColorStop(0, 'rgba(60,45,30,0.06)');
        grad.addColorStop(1, 'rgba(60,45,30,0)');
        g.fillStyle = grad;
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    });
  },
  brick(base = '#6b3a2a', seed = 5) {
    return canvasTex(512, 512, (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = '#3a3330';
      g.fillRect(0, 0, w, h);
      for (let y = 0, row = 0; y < h; y += 32, row++) {
        for (let x = row % 2 ? -48 : 0; x < w; x += 96) {
          const c = new THREE.Color(base).offsetHSL((r() - 0.5) * 0.02, (r() - 0.5) * 0.1, (r() - 0.5) * 0.1);
          g.fillStyle = `#${c.getHexString()}`;
          g.fillRect(x + 3, y + 3, 90, 26);
        }
      }
      speckle(g, w, h, r, 9000, 0.15, true);
    });
  },
  stone(base = '#8b877d', seed = 6) {
    return canvasTex(512, 512, (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = '#4c4943';
      g.fillRect(0, 0, w, h);
      for (let y = 0, row = 0; y < h; y += 40, row++) {
        let x = row % 2 ? -50 : 0;
        while (x < w) {
          const bw = 70 + r() * 80;
          const c = new THREE.Color(base).offsetHSL(0, 0, (r() - 0.5) * 0.08);
          g.fillStyle = `#${c.getHexString()}`;
          g.fillRect(x + 2, y + 2, bw - 4, 36);
          x += bw;
        }
      }
      speckle(g, w, h, r, 9000, 0.12, true);
    });
  },
  concrete(base = '#6f6e6a', seed = 7) {
    return canvasTex(512, 512, (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      speckle(g, w, h, r, 20000, 0.1, true);
      for (let i = 0; i < 40; i++) {
        const x = r() * w;
        const len = 60 + r() * 220;
        const grad = g.createLinearGradient(0, 0, 0, len);
        grad.addColorStop(0, 'rgba(30,25,20,0.18)');
        grad.addColorStop(1, 'rgba(30,25,20,0)');
        g.fillStyle = grad;
        g.fillRect(x, r() * h, 3 + r() * 8, len);
      }
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.strokeRect(0, 0, w, h);
    });
  },
  fabric(base = '#5a1f22', seed = 8) {
    return canvasTex(256, 256, (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 2) {
        g.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.06})`;
        g.fillRect(0, y, w, 1);
      }
      speckle(g, w, h, r, 4000, 0.12, true);
    }, { repeat: [3, 3] });
  },
  // A dark oil portrait: a pale face emerging from brown varnish.
  portrait(seed = 9) {
    return canvasTex(256, 320, (g, w, h) => {
      const r = rng(seed);
      const bg = g.createRadialGradient(w / 2, h * 0.4, 10, w / 2, h * 0.45, h * 0.7);
      bg.addColorStop(0, '#3a2a1a');
      bg.addColorStop(1, '#0d0906');
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#120c08';
      g.beginPath();
      g.ellipse(w / 2, h * 0.92, w * 0.42, h * 0.32, 0, 0, Math.PI * 2);
      g.fill();
      const face = g.createRadialGradient(w / 2 - 8, h * 0.38, 4, w / 2, h * 0.4, 52);
      face.addColorStop(0, `rgba(${200 + r() * 30},${160 + r() * 20},${120 + r() * 20},0.9)`);
      face.addColorStop(1, 'rgba(60,40,25,0)');
      g.fillStyle = face;
      g.beginPath();
      g.ellipse(w / 2, h * 0.4, 40, 54, 0, 0, Math.PI * 2);
      g.fill();
      speckle(g, w, h, r, 3000, 0.15);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; // craquelure
      for (let i = 0; i < 60; i++) {
        g.beginPath();
        const x = r() * w;
        const y = r() * h;
        g.moveTo(x, y);
        g.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 30);
        g.stroke();
      }
    });
  },
  // A faded sepia photograph: a back step, a doorway, two soft figures.
  photo() {
    return canvasTex(320, 220, (g, w, h) => {
      const r = rng(31);
      g.fillStyle = '#c9b48d';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#5b4630';
      g.fillRect(w * 0.55, h * 0.05, w * 0.28, h * 0.62); // doorway
      g.fillStyle = '#8f7a57';
      g.fillRect(0, h * 0.62, w, h * 0.12); // step
      g.fillStyle = '#7d6848';
      g.fillRect(0, h * 0.74, w, h * 0.26);
      g.filter = 'blur(3px)';
      g.fillStyle = '#3c2c1c';
      g.beginPath();
      g.ellipse(w * 0.42, h * 0.38, 20, 24, 0, 0, Math.PI * 2); // head
      g.fill();
      g.fillRect(w * 0.34, h * 0.45, 52, 70); // seated man
      g.fillStyle = '#5a4128';
      g.beginPath();
      g.ellipse(w * 0.43, h * 0.6, 12, 14, 0, 0, Math.PI * 2); // child
      g.fill();
      g.filter = 'none';
      const vig = g.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.7);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(60,40,20,0.55)');
      g.fillStyle = vig;
      g.fillRect(0, 0, w, h);
      speckle(g, w, h, r, 2500, 0.15, true);
      g.strokeStyle = '#efe6d0';
      g.lineWidth = 10;
      g.strokeRect(0, 0, w, h);
    });
  },
  // small feathers in overlapping rows, each with a darker shaft and a paler edge
  feathers() {
    return canvasTex(256, 256, (g, w, h) => {
      const r = rng(41);
      g.fillStyle = '#9a9aa2';
      g.fillRect(0, 0, w, h);
      for (let y = -16; y < h + 16; y += 11) {
        for (let x = ((y / 11) % 2) * 8 - 16; x < w + 16; x += 16) {
          const grd = g.createRadialGradient(x, y - 4, 1, x, y, 11);
          grd.addColorStop(0, 'rgba(70,70,80,0.9)');
          grd.addColorStop(0.75, 'rgba(120,120,130,0.6)');
          grd.addColorStop(1, `rgba(230,230,235,${0.25 + r() * 0.2})`);
          g.fillStyle = grd;
          g.beginPath(); g.ellipse(x, y, 8, 10, 0, 0, Math.PI); g.fill();
        }
      }
    }, { repeat: [3, 3] });
  },
  // buttoned leather: a diamond of tufts, each a soft hollow round a button
  buttonedLeather() {
    return canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#c9a796';
      g.fillRect(0, 0, w, h);
      const step = 64;
      for (let y = -step; y <= h + step; y += step / 2) {
        for (let x = -step; x <= w + step; x += step) {
          const cx = x + ((y / (step / 2)) % 2 ? step / 2 : 0);
          const grd = g.createRadialGradient(cx, y, 2, cx, y, step * 0.55);
          grd.addColorStop(0, 'rgba(60,30,20,0.9)');
          grd.addColorStop(0.18, 'rgba(90,50,35,0.35)');
          grd.addColorStop(0.6, 'rgba(255,240,230,0.18)');
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = grd;
          g.beginPath(); g.arc(cx, y, step * 0.55, 0, Math.PI * 2); g.fill();
        }
      }
    }, { repeat: [3, 2] });
  },
  // a radiator's honeycomb core
  honeycomb() {
    return canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#2a2016';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#c79a52';
      g.lineWidth = 2;
      const r = 6;
      for (let y = 0, row = 0; y < h + r; y += r * 1.5, row++) {
        for (let x = (row % 2) * r * 0.866; x < w + r; x += r * 1.732) {
          g.beginPath();
          for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
          g.closePath(); g.stroke();
        }
      }
    }, { repeat: [2, 1.6] });
  },
  clockFace() {
    return canvasTex(256, 256, (g, w) => {
      g.fillStyle = '#efe6d0';
      g.beginPath();
      g.arc(w / 2, w / 2, w / 2 - 4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1a1410';
      g.font = '600 22px Georgia, serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const nums = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      nums.forEach((n, i) => {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        g.fillText(n, w / 2 + Math.cos(a) * 96, w / 2 + Math.sin(a) * 96);
      });
      g.strokeStyle = '#1a1410';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(w / 2, w / 2);
      g.lineTo(w / 2 + 40, w / 2 - 50);
      g.moveTo(w / 2, w / 2);
      g.lineTo(w / 2 - 10, w / 2 + 70);
      g.stroke();
    });
  },
  // Painted lettering, e.g. a name on a trunk lid.
  lettering(text, { bg = '#5a5a58', ink = '#efe6d0', font = 'italic 64px Georgia, serif', w = 512, h = 256 } = {}) {
    return canvasTex(w, h, (g) => {
      const r = rng(13);
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      speckle(g, w, h, r, 6000, 0.15, true);
      g.fillStyle = ink;
      g.font = font;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2);
    });
  },
};

// ---- materials ------------------------------------------------------------------
export function std(params) {
  return new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, ...params });
}
export const metal = {
  brass: () => std({ color: 0xc9a25a, metalness: 1, roughness: 0.3 }),
  iron: () => std({ color: 0x1b1b1d, metalness: 0.85, roughness: 0.45 }),
  steel: () => std({ color: 0x9aa0a6, metalness: 0.9, roughness: 0.3 }),
  tin: () => std({ color: 0x7c7f80, metalness: 0.8, roughness: 0.5 }),
};

// ---- building blocks ------------------------------------------------------------
/** A box placed by its centre. uv: world-UV scale (0 keeps the default UVs). */
export function box(parent, w, h, d, mat, x, y, z, { uv = 2, cast = true, receive = true, ry = 0, rx = 0, rz = 0 } = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (uv) worldUV(geo, uv);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}

/**
 * A room along z, from z0 (near) to z1 (far), centred on x = 0. Door openings
 * (width, or 0 for a solid wall) in the near and far walls keep the camera
 * path straight through a suite of rooms.
 */
export function room(parent, { w, h, z0, z1, floor, wall, ceiling, nearDoor = 0, farDoor = 0, doorH = 2.5, t = 0.2 }) {
  const d = z0 - z1;
  const zc = (z0 + z1) / 2;
  box(parent, w, t, d, floor, 0, -t / 2, zc);
  if (ceiling) box(parent, w, t, d, ceiling, 0, h + t / 2, zc);
  box(parent, t, h, d, wall, -w / 2 - t / 2, h / 2, zc);
  box(parent, t, h, d, wall, w / 2 + t / 2, h / 2, zc);
  for (const [z, door] of [[z0, nearDoor], [z1, farDoor]]) {
    if (!door) {
      box(parent, w + 2 * t, h, t, wall, 0, h / 2, z);
      continue;
    }
    const side = (w - door) / 2;
    box(parent, side, h, t, wall, -door / 2 - side / 2, h / 2, z);
    box(parent, side, h, t, wall, door / 2 + side / 2, h / 2, z);
    box(parent, door, h - doorH, t, wall, 0, doorH + (h - doorH) / 2, z);
  }
}

// ---- props ----------------------------------------------------------------------
export function table(parent, { len, wid = 1.1, height = 0.78, mat, x = 0, z = 0 }) {
  const g = new THREE.Group();
  box(g, wid, 0.07, len, mat, 0, height, 0, { uv: 1.5 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) box(g, 0.08, height, 0.08, mat, sx * (wid / 2 - 0.08), height / 2, sz * (len / 2 - 0.1));
  }
  g.position.set(x, 0, z);
  parent.add(g);
  return g;
}

export function chair(parent, { mat, x = 0, z = 0, ry = 0, seatMat }) {
  const g = new THREE.Group();
  box(g, 0.46, 0.05, 0.46, seatMat || mat, 0, 0.46, 0, { uv: 1 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) box(g, 0.04, 0.46, 0.04, mat, sx * 0.2, 0.23, sz * 0.2, { uv: 1 });
    box(g, 0.045, 0.62, 0.045, mat, sx * 0.2, 0.78, -0.21, { uv: 1 });
  }
  box(g, 0.44, 0.08, 0.03, mat, 0, 1.05, -0.21, { uv: 1 });
  for (let i = -1; i <= 1; i++) box(g, 0.03, 0.42, 0.02, mat, i * 0.1, 0.8, -0.21, { uv: 1 });
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  parent.add(g);
  return g;
}

export function armchair(parent, { fabric, wood, x = 0, z = 0, ry = 0 }) {
  const g = new THREE.Group();
  // Upholstered parts are rounded boxes, so they read as stuffed fabric, not blocks.
  const soft = (w, h, d, px, py, pz, rad, rot = {}) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, rad), fabric);
    m.position.set(px, py, pz);
    m.rotation.set(rot.x || 0, rot.y || 0, rot.z || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  };
  soft(0.9, 0.26, 0.82, 0, 0.42, 0.04, 0.06); // seat base
  soft(0.86, 1.0, 0.22, 0, 0.98, -0.33, 0.09, { x: -0.08 }); // back
  for (const sx of [-1, 1]) {
    soft(0.17, 0.34, 0.76, sx * 0.44, 0.68, 0.02, 0.07); // arms
    soft(0.13, 0.66, 0.36, sx * 0.43, 1.12, -0.19, 0.06, { y: sx * 0.3 }); // wings
    for (const sz of [-1, 1]) box(g, 0.06, 0.32, 0.06, wood, sx * 0.36, 0.16, sz * 0.32, { uv: 1 });
  }
  soft(0.74, 0.14, 0.66, 0, 0.6, 0.08, 0.06); // cushion
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  parent.add(g);
  return g;
}

// Soft round glow used for flames, lamps and smoke.
let glowTex = null;
export function glowTexture() {
  if (!glowTex) {
    glowTex = canvasTex(128, 128, (g) => {
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
    });
  }
  return glowTex;
}

/** A candle flame: a bright core, a soft halo and a flickering light. */
export function flame(parent, x, y, z, { color = 0xffb35c, intensity = 1.2, distance = 6, scale = 1, light = true } = {}) {
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff1c8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  core.material.color.multiplyScalar(2.5);
  core.scale.set(0.05 * scale, 0.11 * scale, 1);
  core.position.set(x, y, z);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
  halo.scale.set(0.42 * scale, 0.42 * scale, 1);
  halo.position.set(x, y, z);
  parent.add(core, halo);
  let pl = null;
  if (light) {
    pl = new THREE.PointLight(color, intensity, distance, 2);
    pl.position.set(x, y + 0.05, z);
    parent.add(pl);
  }
  const seed = Math.random() * 10;
  return {
    update(t) {
      const f = 0.86 + Math.sin(t * 11.3 + seed) * 0.06 + Math.sin(t * 23.7 + seed * 2) * 0.05 + Math.sin(t * 3.1 + seed) * 0.04;
      core.scale.y = 0.11 * scale * (0.9 + (f - 0.86) * 1.5);
      halo.material.opacity = 0.45 * f;
      if (pl) pl.intensity = intensity * f;
    },
  };
}

export function candlestick(parent, brass, x, y, z, opts) {
  const profile = [[0, 0], [0.09, 0], [0.09, 0.02], [0.04, 0.05], [0.025, 0.25], [0.04, 0.27], [0.03, 0.3], [0, 0.3]].map(([a, b]) => new THREE.Vector2(a, b));
  const stick = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), brass);
  stick.position.set(x, y, z);
  stick.castShadow = true;
  parent.add(stick);
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.2, 12), std({ color: 0xf2e8d2, roughness: 0.6 }));
  candle.position.set(x, y + 0.4, z);
  parent.add(candle);
  return flame(parent, x, y + 0.53, z, opts);
}

export function framedPicture(parent, map, { w, h, x, y, z, ry = 0, frameMat }) {
  const g = new THREE.Group();
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map, roughness: 0.55 }));
  g.add(pic);
  const t = 0.09;
  for (const [bw, bh, bx, by] of [[w + 2 * t, t, 0, h / 2 + t / 2], [w + 2 * t, t, 0, -h / 2 - t / 2], [t, h, -w / 2 - t / 2, 0], [t, h, w / 2 + t / 2, 0]]) {
    box(g, bw, bh, 0.06, frameMat, bx, by, 0.02, { uv: 0 });
  }
  g.position.set(x, y, z);
  g.rotation.y = ry;
  parent.add(g);
  return g;
}

/** Books, shelved or stacked, as one instanced mesh. */
export function books(parent, list) {
  const colors = ['#5b1f1c', '#1d2f4a', '#2f4a2c', '#7a5a22', '#3a2418', '#6b2c4a', '#24363a', '#8a6b35'];
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std({ roughness: 0.75 }), list.length);
  const o = new THREE.Object3D();
  const c = new THREE.Color();
  const r = rng(list.length);
  list.forEach((b, i) => {
    o.position.set(b.x, b.y, b.z);
    o.rotation.set(b.rx || 0, b.ry || 0, b.rz || 0);
    o.scale.set(b.w, b.h, b.d);
    o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
    mesh.setColorAt(i, c.set(colors[Math.floor(r() * colors.length)]));
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// ---- the Mirror -------------------------------------------------------------------
// "Slightly taller than Amelia and supported by three iron legs. Seven pieces of dark green glass
// had been fitted edge to edge" ... "Near the lowest edge were three empty sockets."
// Built to the author's illustrations: a deep case of dark iron rising to a pointed gothic arch,
// a bronze molding round the window, rivets; seven panes of green glass held in raised lead, smoky
// inside, with light crawling through them; three brass-rimmed sockets in the panel below; a spire
// with a brass ball; copper pipes climbing both sides and coiling near the top; three turned legs.
// The interface is unchanged: { group, uniforms: { uTime, uGlow, uCrack, uOut }, update(t, glow) }.
function ironTexture(seed) {
  const t = canvasTex(512, 512, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = '#17191b'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { // mottled cast iron
      const x = r() * w, y = r() * h, s = 2 + r() * 14;
      g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${0.15 + r() * 0.25})` : `rgba(70,74,78,${0.08 + r() * 0.16})`;
      g.beginPath(); g.ellipse(x, y, s, s * (0.4 + r() * 0.6), r() * 3, 0, Math.PI * 2); g.fill();
    }
    for (let v = 0; v < 7; v++) { // faint warm veins, as in the black stone of the drawings
      let x = r() * w, y = r() * h;
      g.strokeStyle = `rgba(150,118,62,${0.12 + r() * 0.12})`; g.lineWidth = 0.6 + r();
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 18; k++) { x += (r() - 0.5) * 50; y += (r() - 0.3) * 30; g.lineTo(x, y); }
      g.stroke();
    }
  }, { repeat: [1.8, 1.8] });
  return t;
}

// a pointed (gothic) arch: straight sides from y0 to the spring, then two arcs meeting at the apex
function ogive(w, y0, spring, rise, n = 28) {
  const half = w / 2, r = (half * half + rise * rise) / (2 * half); // each arc's radius
  const pts = [new THREE.Vector2(-half, y0), new THREE.Vector2(half, y0), new THREE.Vector2(half, spring)];
  // the right arc from the spring to the apex, then the left arc back down
  for (let i = 1; i <= n; i++) { const a = (i / n) * Math.asin(Math.min(1, rise / r)); pts.push(new THREE.Vector2(half - r + r * Math.cos(a), spring + r * Math.sin(a))); }
  for (let i = n - 1; i >= 0; i--) { const a = (i / n) * Math.asin(Math.min(1, rise / r)); pts.push(new THREE.Vector2(-(half - r + r * Math.cos(a)), spring + r * Math.sin(a))); }
  return pts;
}

// split a convex polygon by the infinite line through a and b; returns both sides and the cut
function splitConvex(poly, a, b) {
  const side = (p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const L = [], R = [], cut = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
    if (sp >= 0) L.push(p); if (sp <= 0) R.push(p);
    if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
      const t = sp / (sp - sq), x = new THREE.Vector2(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t);
      L.push(x); R.push(x); cut.push(x);
    }
  }
  return { L, R, cut };
}
const polyArea = (p) => Math.abs(p.reduce((s, v, i) => s + v.x * p[(i + 1) % p.length].y - p[(i + 1) % p.length].x * v.y, 0)) / 2;

export function greenMirror(parent, { x = 0, z = 0, ry = 0, scale = 1 } = {}) {
  const g = new THREE.Group();
  // dimensions in metres: three legs, a base panel with the sockets, the arched window, the spire
  const LEG = 0.34, CASE_W = 0.86, DEPTH = 0.2, WIN_W = 0.6, WIN_Y = 0.30, WIN_SPRING = 0.84, WIN_RISE = 0.38;
  const OUT_SPRING = 1.0, OUT_RISE = 0.5; // the case's own arch sits outside the window's
  const iron = new THREE.MeshStandardMaterial({ map: ironTexture(41), color: 0xffffff, metalness: 0.55, roughness: 0.5 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0x6e5a36, metalness: 0.9, roughness: 0.42 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a25a, metalness: 1, roughness: 0.3 });
  const copper = new THREE.MeshPhysicalMaterial({ color: 0xb8693a, metalness: 1, roughness: 0.32, clearcoat: 0.3, clearcoatRoughness: 0.4 });
  const lead = new THREE.MeshStandardMaterial({ color: 0x1c1d1e, metalness: 0.6, roughness: 0.5 });
  const body = new THREE.Group();
  body.position.y = LEG;
  g.add(body);

  // the case: outer gothic silhouette with the window cut through it, extruded front to back
  const outer = new THREE.Shape(ogive(CASE_W, 0, OUT_SPRING, OUT_RISE));
  const windowPts = ogive(WIN_W, WIN_Y, WIN_SPRING, WIN_RISE);
  outer.holes.push(new THREE.Path([...windowPts].reverse()));
  const caseGeo = new THREE.ExtrudeGeometry(outer, { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 24 });
  caseGeo.translate(0, 0, -DEPTH / 2);
  const caseMesh = new THREE.Mesh(caseGeo, iron);
  caseMesh.castShadow = caseMesh.receiveShadow = true;
  body.add(caseMesh);

  // a bronze molding round the window, standing proud of the front
  const ringOuter = new THREE.Shape(ogive(WIN_W + 0.07, WIN_Y - 0.035, WIN_SPRING, WIN_RISE + 0.035));
  ringOuter.holes.push(new THREE.Path([...windowPts].reverse()));
  const ring = new THREE.Mesh(new THREE.ExtrudeGeometry(ringOuter, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 24 }), bronze);
  ring.position.z = DEPTH / 2;
  ring.castShadow = true;
  body.add(ring);

  // rivets round the frame, between the molding and the case's edge
  const rivetPath = ogive((WIN_W + CASE_W) / 2 + 0.02, 0.06, (WIN_SPRING + OUT_SPRING) / 2, (WIN_RISE + OUT_RISE) / 2 + 0.03);
  const rivetGeo = new THREE.SphereGeometry(0.009, 8, 6);
  const rivetSpots = [];
  for (let i = 1; i < rivetPath.length; i++) {
    const a = rivetPath[i - 1], b = rivetPath[i], len = a.distanceTo(b), n = Math.max(1, Math.round(len / 0.07));
    for (let k = 0; k < n; k++) rivetSpots.push(a.clone().lerp(b, k / n));
  }
  const rivets = new THREE.InstancedMesh(rivetGeo, bronze, rivetSpots.length);
  const o = new THREE.Object3D();
  rivetSpots.forEach((p, i) => { o.position.set(p.x, p.y, DEPTH / 2 + 0.012); o.updateMatrix(); rivets.setMatrixAt(i, o.matrix); });
  body.add(rivets);

  // seven panes: the window split by six lead lines, each pane a slightly different green
  const shapeRand = rng(7);
  let panes = [windowPts.map((p) => new THREE.Vector2(p.x * 1.03, WIN_Y + (p.y - WIN_Y) * 1.02 - 0.006))];
  const cuts = [];
  const cutAt = (k, a, b) => { const s = splitConvex(panes[k], a, b); panes.splice(k, 1, s.L, s.R); if (s.cut.length === 2) cuts.push(s.cut); };
  const V = (px, py) => new THREE.Vector2(px, py);
  cutAt(0, V(-0.4, WIN_Y + 0.33), V(0.4, WIN_Y + 0.25));                // a slanting bar across the lower third
  const lowerIdx = () => panes.findIndex((p) => p.every((v) => v.y <= WIN_Y + 0.34));
  cutAt(lowerIdx(), V(0.03, WIN_Y - 0.1), V(-0.05, WIN_Y + 0.5));      // the lower pane, split near the middle
  const largest = () => panes.reduce((m, p, i) => (polyArea(p) > polyArea(panes[m]) ? i : m), 0);
  for (const ang of [2.2, 0.95, 1.75, 0.4]) {                           // then the largest pane, again and again
    const k = largest(), c = panes[k].reduce((s, v) => s.add(v), V(0, 0)).multiplyScalar(1 / panes[k].length);
    const d = V(Math.cos(ang), Math.sin(ang)).multiplyScalar(0.5);
    cutAt(k, c.clone().sub(d).add(V((shapeRand() - 0.5) * 0.04, 0)), c.clone().add(d));
  }
  const paneGeos = panes.map((poly) => {
    const geo = new THREE.ShapeGeometry(new THREE.Shape(poly));
    const shade = shapeRand();
    geo.setAttribute('shade', new THREE.Float32BufferAttribute(new Array(geo.attributes.position.count).fill(shade), 1));
    return geo;
  });
  const glassGeo = mergeGeometries(paneGeos);
  const glassMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uGlow: { value: 0.35 }, uCrack: { value: 0 }, uOut: { value: 0 } },
    vertexShader: `
      attribute float shade;
      varying vec2 vP; varying float vShade; varying vec3 vN; varying vec3 vV;
      void main() {
        vP = position.xy; vShade = shade;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime, uGlow, uCrack, uOut;
      varying vec2 vP; varying float vShade; varying vec3 vN; varying vec3 vV;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int k = 0; k < 5; k++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
      void main() {
        vec2 p = vP;
        // smoke drifting in the depth of the glass
        float smoke = fbm(p * 3.2 + vec2(0.0, -uTime * 0.05));
        float depth = fbm(p * 7.0 + smoke * 1.5 + uTime * 0.03);
        vec3 deep = vec3(0.004, 0.035, 0.02) * (0.65 + vShade * 0.7);
        vec3 lit = vec3(0.10, 0.55, 0.30) * (0.8 + vShade * 0.4);
        vec3 col = mix(deep, lit, uGlow * smoothstep(0.25, 0.95, smoke) * (0.4 + 0.6 * depth));
        // filaments of light crawling through the panes, brighter as the glass wakes
        // (hair-thin at any distance: the width follows the screen, and only patches of glass carry them)
        float n = fbm(p * 5.0 + vec2(uTime * 0.12, uTime * 0.07)) - 0.5;
        float thread = 1.0 - smoothstep(0.0, max(1.4 * fwidth(n), 1e-5), abs(n));
        float patchy = smoothstep(0.52, 0.72, fbm(p * 1.7 + uTime * 0.02));
        col += vec3(0.45, 0.95, 0.65) * thread * patchy * smoothstep(0.35, 1.0, uGlow) * 0.55;
        // the sheen of glass: brighter at grazing angles, and one soft reflected band
        float fres = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 3.0);
        float band = (1.0 - smoothstep(0.0, 0.07, abs(p.x * 0.8 + p.y * 0.35 - 0.55))) * 0.1;
        col += vec3(0.6, 0.75, 0.7) * (fres * 0.25 + band);
        // a crack across the glass, then the light going out
        float line = abs(p.y - ${(WIN_Y + 0.62).toFixed(3)} - sin(p.x * 13.0) * 0.05 - p.x * 0.45);
        col = mix(col, vec3(0.9, 1.0, 0.95), (1.0 - smoothstep(0.0, 0.006, line)) * uCrack);
        col *= 1.0 - uOut * 0.85;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.z = 0.02; // set back inside the case, so its walls frame the glass
  body.add(glass);
  // the lead between the panes, standing a little proud of the glass
  const cames = cuts.map(([a, b]) => {
    const len = a.distanceTo(b), c = new THREE.CylinderGeometry(0.0055, 0.0055, len, 6);
    c.rotateZ(Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2);
    c.translate((a.x + b.x) / 2, (a.y + b.y) / 2, 0.025);
    return c;
  });
  if (cames.length) body.add(new THREE.Mesh(mergeGeometries(cames), lead));

  // three empty sockets in the panel under the glass, rimmed in brass
  const sockY = WIN_Y / 2 + 0.01;
  for (const sx of [-0.16, 0, 0.16]) {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.03, 24), new THREE.MeshBasicMaterial({ color: 0x050505 }));
    hole.position.set(sx, sockY, DEPTH / 2 + 0.002);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.008, 10, 28), brass);
    rim.position.set(sx, sockY, DEPTH / 2 + 0.006);
    rim.castShadow = true;
    body.add(hole, rim);
  }

  // the spire on the apex, and its brass ball
  const apex = OUT_SPRING + OUT_RISE;
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), iron);
  spire.position.set(0, apex + 0.07, 0); spire.rotation.y = Math.PI / 4;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 16), brass);
  collar.position.set(0, apex + 0.16, 0);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.04, 20, 14), brass);
  ball.position.set(0, apex + 0.21, 0);
  for (const m of [spire, collar, ball]) { m.castShadow = true; body.add(m); }

  // copper pipes up both sides: straight, a kink outwards, a coil near the top, then over the shoulder
  for (const sd of [-1, 1]) {
    const px = sd * (CASE_W / 2 + 0.035), pts = [];
    pts.push(new THREE.Vector3(px, 0.04, 0.02), new THREE.Vector3(px, 0.45, 0.02), new THREE.Vector3(px + sd * 0.03, 0.62, 0.04), new THREE.Vector3(px, 0.78, 0.03));
    for (let k = 0; k <= 36; k++) { // two turns of coil
      const a = (k / 36) * Math.PI * 4, y = 0.84 + (k / 36) * 0.14;
      pts.push(new THREE.Vector3(px + Math.cos(a) * 0.03 * sd, y, 0.03 + Math.sin(a) * 0.03));
    }
    pts.push(new THREE.Vector3(px, 1.06, 0.03), new THREE.Vector3(sd * (CASE_W / 2 - 0.05), OUT_SPRING + 0.2, 0.06), new THREE.Vector3(sd * 0.1, apex - 0.06, 0.07), new THREE.Vector3(sd * 0.025, apex + 0.13, 0.03));
    const pipe = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.012, 8, false), copper);
    pipe.castShadow = true;
    body.add(pipe);
    for (const cy of [0.04, 0.45, 1.06]) { // brass collars where the pipe is held
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.03, 14), brass);
      c.position.set(px, cy, 0.02);
      body.add(c);
    }
  }

  // three turned iron legs, ringed in brass
  const legGeo = new THREE.LatheGeometry([
    [0.0, 0], [0.045, 0], [0.05, 0.012], [0.04, 0.03], [0.028, 0.07], [0.024, 0.13], [0.033, 0.19],
    [0.024, 0.25], [0.03, 0.3], [0.042, 0.32], [0.042, LEG], [0.0, LEG],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 20);
  for (const [lx, lz] of [[-0.33, 0.05], [0.33, 0.05], [0, -0.06]]) {
    const leg = new THREE.Mesh(legGeo, iron);
    leg.position.set(lx, 0, lz);
    leg.castShadow = true;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.006, 8, 20), brass);
    band.rotation.x = Math.PI / 2; band.position.set(lx, LEG - 0.04, lz);
    g.add(leg, band);
  }

  const glowLight = new THREE.PointLight(0x4cd18a, 0, 5, 2);
  glowLight.position.set(0, LEG + 0.75, 0.6);
  g.add(glowLight);
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  g.scale.setScalar(scale);
  parent.add(g);
  return {
    group: g,
    uniforms: glassMat.uniforms,
    update(t, glow = 0.35) {
      glassMat.uniforms.uTime.value = t;
      glassMat.uniforms.uGlow.value = glow;
      glowLight.intensity = glow * 2.2 * (1 - glassMat.uniforms.uOut.value);
    },
  };
}

// ---- larger pieces ----------------------------------------------------------------
export function stairs(parent, { steps, width = 1.1, rise = 0.19, run = 0.27, mat, railMat, x = 0, y = 0, z = 0, down = true }) {
  const g = new THREE.Group();
  const treads = new THREE.InstancedMesh(worldUV(new THREE.BoxGeometry(width, 0.05, run + 0.03), 1), mat, steps);
  const risers = new THREE.InstancedMesh(worldUV(new THREE.BoxGeometry(width, rise, 0.03), 1), mat, steps);
  // turned balusters: a vase over a square-ish foot, as a joiner would turn them
  const bal = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    const r = u < 0.12 ? 0.026 : u < 0.18 ? 0.018 : u < 0.55 ? 0.016 + Math.sin((u - 0.18) / 0.37 * Math.PI) * 0.011 : u < 0.85 ? 0.014 : u < 0.9 ? 0.02 : 0.017;
    bal.push(new THREE.Vector2(r, (u - 0.5) * 0.85));
  }
  const posts = new THREE.InstancedMesh(new THREE.LatheGeometry(bal, 12), railMat, steps);
  const o = new THREE.Object3D();
  const dir = down ? -1 : 1;
  for (let i = 0; i < steps; i++) {
    const sy = y + dir * i * rise;
    const sz = z - i * run;
    o.position.set(x, sy, sz);
    o.updateMatrix();
    treads.setMatrixAt(i, o.matrix);
    o.position.set(x, sy - dir * rise / 2 + (down ? 0 : -rise), sz + run / 2);
    o.updateMatrix();
    risers.setMatrixAt(i, o.matrix);
    o.position.set(x + width / 2 - 0.05, sy + 0.45, sz);
    o.updateMatrix();
    posts.setMatrixAt(i, o.matrix);
  }
  for (const m of [treads, risers, posts]) {
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  // the handrail along the top of the posts
  const a = new THREE.Vector3(x + width / 2 - 0.05, y + 0.88, z + run / 2);
  const b = new THREE.Vector3(x + width / 2 - 0.05, y + dir * (steps - 1) * rise + 0.88, z - (steps - 1) * run);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, a.distanceTo(b), 10), railMat);
  rail.position.copy(a).add(b).multiplyScalar(0.5);
  rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.add(rail);
  parent.add(g);
  return g;
}

/** A long-case clock. broken: lying smashed, weights fallen. */
export function longcaseClock(parent, { wood, x = 0, z = 0, ry = 0, broken = false }) {
  const g = new THREE.Group();
  box(g, 0.55, 0.5, 0.3, wood, 0, 0.25, 0, { uv: 1 });
  box(g, 0.42, 1.0, 0.24, wood, 0, 1.0, 0, { uv: 1 });
  box(g, 0.56, 0.6, 0.3, wood, 0, 1.8, 0, { uv: 1 });
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), std({ map: tex.clockFace(), roughness: 0.5 }));
  face.position.set(0, 1.8, 0.152);
  g.add(face);
  box(g, 0.62, 0.08, 0.34, wood, 0, 2.14, 0, { uv: 1 });
  const brass = metal.brass();
  if (!broken) {
    const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 24), brass);
    bob.rotation.x = Math.PI / 2;
    bob.position.set(0, 0.85, 0.125);
    g.add(bob);
  }
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  if (broken) {
    g.rotation.z = Math.PI / 2 - 0.18; // fallen on its side
    g.position.y = 0.3;
    for (const [wx, wz] of [[0.6, 0.5], [0.95, 0.35]]) {
      const w8 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 16), brass);
      w8.rotation.z = Math.PI / 2;
      w8.position.set(x + wx, 0.05, z + wz);
      w8.castShadow = true;
      parent.add(w8);
    }
  }
  g.traverse((m) => {
    if (m.isMesh) m.castShadow = true;
  });
  parent.add(g);
  return g;
}

/** A broad, tapered ship with no propellers: dull silver, a dark line along its side. */
export function ship(parent, { x = 0, y = 0, z = 0, scale = 1, ry = 0 }) {
  const g = new THREE.Group();
  const profile = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    // fuller towards the front third, drawn out to a long taper behind
    profile.push(new THREE.Vector2(Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.9) * 1.0, (t - 0.5) * 10));
  }
  const hull = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), metal.steel());
  hull.material.color.set(0x8f969c);
  hull.material.roughness = 0.38;
  hull.rotation.z = Math.PI / 2;
  hull.scale.set(1, 0.85, 1.55); // broad, low and long
  hull.castShadow = true;
  g.add(hull);
  const line = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.06, 0.04), std({ color: 0x0a0a0c, roughness: 0.4 }));
  line.position.set(0, 0.05, 2.02);
  g.add(line);
  const under = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), new THREE.MeshBasicMaterial({ color: 0x8fc8ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
  under.rotation.x = Math.PI / 2;
  under.scale.set(2.2, 1, 1);
  under.position.y = -0.85;
  g.add(under);
  g.position.set(x, y, z);
  g.rotation.y = ry;
  g.scale.setScalar(scale);
  parent.add(g);
  return g;
}

/** The jackdaw, dark as spilled oil, with gold eyes. */
// A small perching bird, life size (about 0.24 m beak to tail): a lathe-turned body tipped
// up at the breast, a round head, a fine beak, folded wings of layered feathers that cross
// over the rump, a narrow fanned tail, and toes that grip. Feathers "dark as spilled oil":
// near-black with an iridescent sheen. Eyes gold, with a pupil and a wet highlight.
// Faces +x before ry. (Named for the chapters' corvids; scale up for a jackdaw.)
export function jackdaw(parent, { x, y, z, ry = 0, scale = 1, eye = 0xe8b23a, plumage = 0x0b0a0e } = {}) {
  const g = new THREE.Group();
  const feather = tex.feathers();
  const oil = new THREE.MeshPhysicalMaterial({
    color: plumage, map: feather, roughness: 0.38, metalness: 0.05,
    iridescence: 1, iridescenceIOR: 1.7, iridescenceThicknessRange: [180, 520],
    sheen: 0.6, sheenColor: new THREE.Color(0x3a2a5a), sheenRoughness: 0.4,
  });
  const horn = std({ color: 0x1c1a1a, roughness: 0.35 });
  const skin = std({ color: 0x3a2b28, roughness: 0.6 });
  // body: a teardrop turned on a lathe, axis along x, breast up
  const prof = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    prof.push(new THREE.Vector2(Math.max(0.002, 0.048 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.75)), 0.85)), (u - 0.5) * 0.16));
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), oil);
  body.rotation.z = -Math.PI / 2 + 0.42; // axis along x, tipped up at the front
  body.scale.set(1, 1, 0.92);
  body.position.set(0, 0.06, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.031, 24, 18), oil);
  head.scale.set(1.12, 1, 0.92);
  head.position.set(0.078, 0.122, 0);
  const nape = new THREE.Mesh(new THREE.SphereGeometry(0.034, 18, 14), oil);
  nape.position.set(0.055, 0.1, 0);
  // the beak, fine and a little down-turned
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.0085, 0.034, 12), horn);
  beak.rotation.z = -Math.PI / 2 - 0.12;
  beak.position.set(0.118, 0.118, 0);
  g.add(body, head, nape, beak);
  // eyes: a gold iris, a black pupil, a clear wet cornea over both
  const iris = new THREE.MeshBasicMaterial({ color: eye });
  const pupil = new THREE.MeshBasicMaterial({ color: 0x020202 });
  const cornea = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transmission: 0, transparent: true, opacity: 0.25, clearcoat: 1 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.0072, 14, 10), iris);
    e.position.set(0.094, 0.128, s * 0.0255);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 10, 8), pupil);
    p.position.set(0.0985, 0.1285, s * 0.03);
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.0078, 14, 10), cornea);
    c.position.copy(e.position);
    g.add(e, p, c);
  }
  // folded wings: layered feathers, lying along the flanks and crossing at the tips
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.bezierCurveTo(0.03, 0.03, 0.11, 0.028, 0.15, 0.004);
  wingShape.bezierCurveTo(0.1, -0.012, 0.03, -0.02, 0, 0);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 16 });
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(wingGeo, oil);
    w.position.set(0.05, 0.085, s * 0.036);
    w.rotation.set(s * 0.18, Math.PI, -0.32);
    w.scale.set(1, 1, s);
    g.add(w);
  }
  // the tail: narrow feathers, a little fanned, angled down from the rump
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.003, 0.013), oil);
    const a = (i - 2.5) * 0.07;
    f.position.set(-0.115, 0.012, a * 0.12);
    f.rotation.set(0, a, 0.35);
    g.add(f);
  }
  // legs and toes, gripping whatever it stands on
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0032, 0.034, 6), skin);
    leg.position.set(0.012, 0.017, s * 0.016);
    leg.rotation.z = 0.15;
    g.add(leg);
    for (const [yaw, len] of [[-0.45, 0.022], [0, 0.026], [0.45, 0.022], [Math.PI, 0.018]]) {
      const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0024, len, 5), skin);
      toe.rotation.z = Math.PI / 2;
      toe.rotation.y = yaw;
      toe.position.set(0.012 + Math.cos(yaw) * len * 0.5, 0.0015, s * 0.016 - Math.sin(yaw) * len * 0.5);
      g.add(toe);
    }
  }
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  g.position.set(x, y, z);
  g.rotation.y = ry;
  g.scale.setScalar(scale);
  parent.add(g);
  return g;
}

// ---- landscape ------------------------------------------------------------------
/**
 * A terrain patch. height(x, z) returns metres; colour(h, slope) returns a
 * THREE.Color. Vertex colours carry rock, grass, sand and snow.
 */
export function terrain(parent, { size = 400, depth = size, seg = 200, height, colour, weights, material, x = 0, z = 0, roughness = 0.95 }) {
  const geo = new THREE.PlaneGeometry(size, depth, seg, Math.round(seg * (depth / size)));
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, height(pos.getX(i) + x, pos.getZ(i) + z));
  }
  geo.computeVertexNormals();
  const nor = geo.attributes.normal;
  // colour and weights in one pass, vertex by vertex, so a world can work each vertex out once
  const cols = new Float32Array(pos.count * 3);
  const w = weights ? new Float32Array(pos.count * 3) : null;
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i), slope = 1 - nor.getY(i), vx = pos.getX(i) + x, vz = pos.getZ(i) + z;
    const c = colour(h, slope, vx, vz);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    if (w) w.set(weights(h, slope, vx, vz), i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  // per-vertex blend weights for a blended photographed ground (assets.blendedGround)
  if (w) geo.setAttribute('weights', new THREE.BufferAttribute(w, 3));
  const mesh = new THREE.Mesh(geo, material || std({ vertexColors: true, roughness }));
  mesh.position.set(x, 0, z);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// Lake water: the planar reflection rippled by a moving wave field, mixed with the
// water's own colour by a Fresnel term (deep blue looking down, sky at a glance),
// with a sun glint. `shore` (an ellipse: x, z, rx, rz) pales and thins the water
// towards its edge, so it meets the land without a cut.
const LakeShader = {
  name: 'LakeWater',
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(0x0e3550) },
    uShallow: { value: new THREE.Color(0x2f8a96) },
    uShore: { value: new THREE.Vector4(0, 0, 0, 0) },
    uSunDir: { value: new THREE.Vector3(0.3, 0.8, -0.5).normalize() },
    uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
    uScale: { value: 0.35 },
    uChop: { value: 0.12 },
  }]),
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    #include <common>
    #include <fog_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 color; uniform sampler2D tDiffuse;
    uniform float uTime, uScale, uChop;
    uniform vec3 uDeep, uShallow, uSunDir, uSunColor; uniform vec4 uShore;
    varying vec4 vUv; varying vec3 vWorld;
    #include <common>
    #include <fog_pars_fragment>
    float hh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hh(i), hh(i + vec2(1.0, 0.0)), u.x), mix(hh(i + vec2(0.0, 1.0)), hh(i + vec2(1.0, 1.0)), u.x), u.y); }
    float waves(vec2 p) {
      float h = 0.0, a = 0.5; vec2 d = vec2(1.0, 0.35);
      for (int i = 0; i < 5; i++) { h += a * vn(p + d * uTime * (0.22 + 0.09 * float(i))); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; d = vec2(-d.y, d.x); }
      return h;
    }
    void main() {
      vec2 p = vWorld.xz * uScale;
      float e = 0.04, h0 = waves(p);
      vec3 n = normalize(vec3(-(waves(p + vec2(e, 0.0)) - h0) / e * uChop, 1.0, -(waves(p + vec2(0.0, e)) - h0) / e * uChop));
      vec3 V = normalize(cameraPosition - vWorld);
      float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
      vec4 uv = vUv; uv.xy += n.xz * 0.06 * uv.w;
      vec3 refl = texture2DProj(tDiffuse, uv).rgb * color;
      float edge = 0.0;
      if (uShore.z > 0.0) edge = length((vWorld.xz - uShore.xy) / uShore.zw);
      vec3 body = mix(uDeep, uShallow, smoothstep(0.55, 1.0, edge));
      vec3 col = mix(body, refl, clamp(fres, 0.0, 1.0));
      vec3 hv = normalize(normalize(uSunDir) + V);
      float nh = max(dot(n, hv), 0.0);
      col += uSunColor * (pow(nh, 900.0) * 9.0 + pow(nh, 80.0) * 0.12);
      float alpha = uShore.z > 0.0 ? mix(1.0, 0.15, smoothstep(0.9, 1.0, edge)) : 1.0;
      gl_FragColor = vec4(col, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
};

export function water(parent, { w, d, x = 0, y = 0, z = 0, color = 0xffffff, deep = 0x0e3550, shallow = 0x2f8a96, shore = null, scale = 0.35, chop = 0.12, size = 512 }) {
  // the reflection is rippled anyway, so it renders small and without multisampling
  const m = new Reflector(new THREE.PlaneGeometry(w, d), { textureWidth: size, textureHeight: size, color, clipBias: 0.003, shader: LakeShader, multisample: 0 });
  const u = m.material.uniforms;
  u.uDeep.value.set(deep);
  u.uShallow.value.set(shallow);
  u.uScale.value = scale;
  u.uChop.value = chop;
  if (shore) u.uShore.value.set(shore.x, shore.z, shore.rx, shore.rz);
  m.material.fog = true;
  m.material.transparent = Boolean(shore);
  const reflect = m.onBeforeRender;
  m.onBeforeRender = function (...args) {
    u.uTime.value = performance.now() / 1000;
    reflect.apply(this, args);
  };
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// A shaft of light (sun through a window, a lamp in dust): a soft additive cone that is
// thickest down its middle, fades along its length, and carries slowly drifting motes.
export function lightShaft(parent, { from, to, r0 = 0.3, r1 = 1.2, color = 0xfff1d6, opacity = 0.2 }) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(r0, r1, len, 40, 1, true);
  geo.translate(0, -len / 2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uTime: { value: 0 } },
    vertexShader: `
      varying float vAlong; varying vec3 vN; varying vec3 vP;
      void main() {
        vAlong = -position.y / ${len.toFixed(4)};
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vP = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity, uTime;
      varying float vAlong; varying vec3 vN; varying vec3 vP;
      float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float n3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h(i), h(i + vec3(1, 0, 0)), f.x), mix(h(i + vec3(0, 1, 0)), h(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(h(i + vec3(0, 0, 1)), h(i + vec3(1, 0, 1)), f.x), mix(h(i + vec3(0, 1, 1)), h(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
      void main() {
        float core = pow(clamp(abs(dot(normalize(vN), normalize(cameraPosition - vP))), 0.0, 1.0), 1.8);
        float fall = smoothstep(0.0, 0.1, vAlong) * pow(clamp(1.0 - vAlong, 0.0, 1.0), 1.3); // clamped: pow of a negative is NaN, and bloom spreads NaN over the frame
        float motes = 0.7 + 0.6 * n3(vP * 2.5 + vec3(0.0, uTime * 0.12, uTime * 0.05));
        gl_FragColor = vec4(uColor * uOpacity * core * fall * motes, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(from);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
  m.renderOrder = 2;
  m.castShadow = m.receiveShadow = false;
  m.onBeforeRender = () => { mat.uniforms.uTime.value = performance.now() / 1000; };
  parent.add(m);
  return m;
}

/**
 * A sky dome: horizon-to-zenith gradient with an optional sun or moon glow.
 * uniforms.opacity lets a photographed sky (scene.background) show through it.
 */
export function sky(parent, { top, horizon, below, glowDir, glowColor = '#ffffff', glowPower = 12, glowStrength = 0.6, radius = 900 }) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    transparent: true,
    fog: false,
    uniforms: {
      opacity: { value: 1 },
      top: { value: new THREE.Color(top) },
      horizon: { value: new THREE.Color(horizon) },
      below: { value: new THREE.Color(below || horizon) },
      glowDir: { value: (glowDir || new THREE.Vector3(0, 1, 0)).clone().normalize() },
      glowColor: { value: new THREE.Color(glowColor) },
      glowPower: { value: glowPower },
      glowStrength: { value: glowDir ? glowStrength : 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 below; uniform vec3 glowDir; uniform vec3 glowColor;
      uniform float glowPower; uniform float glowStrength; uniform float opacity;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 col = h > 0.0 ? mix(horizon, top, pow(h, 0.5)) : mix(horizon, below, pow(-h, 0.4));
        col += glowColor * pow(max(dot(normalize(vDir), glowDir), 0.0), glowPower) * glowStrength;
        gl_FragColor = vec4(col, opacity);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
  dome.renderOrder = -1; // first of the transparent things, so stars and glows draw over it
  parent.add(dome);
  return { dome, uniforms: mat.uniforms };
}

export function stars(parent, { count = 1500, radius = 800, full = false, size = 1.6, color = 0xe8eeff, seed = 3 }) {
  const r = rng(seed);
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = r() * 2 - 1;
    const yv = full ? u : 0.05 + Math.abs(u) * 0.95;
    const a = r() * Math.PI * 2;
    const rad = Math.sqrt(1 - yv * yv);
    pos.set([Math.cos(a) * rad * radius, yv * radius, Math.sin(a) * rad * radius], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }));
  parent.add(p);
  return p;
}

// ---- weather and air ------------------------------------------------------------
export function rain(parent, { count = 1600, area = 40, height = 18, opacity = 0.3, speed = 15 } = {}) {
  const r = rng(91);
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) seeds.set([r() * area - area / 2, r() * height, r() * area - area / 2], i * 3);
  const pos = new Float32Array(count * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xa9b8d0, transparent: true, opacity, depthWrite: false }));
  lines.frustumCulled = false;
  parent.add(lines);
  return {
    object: lines,
    update(dt, cam) {
      for (let i = 0; i < count; i++) {
        let y = seeds[i * 3 + 1] - dt * speed;
        if (y < 0) y += height;
        seeds[i * 3 + 1] = y;
        const x = cam.x + seeds[i * 3];
        const z = cam.z + seeds[i * 3 + 2];
        const j = i * 6;
        pos[j] = x;
        pos[j + 1] = y;
        pos[j + 2] = z;
        pos[j + 3] = x - 0.04;
        pos[j + 4] = y + 0.45;
        pos[j + 5] = z;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

/** Dust drifting in light. */
export function motes(parent, { count = 400, min, max, color = 0xffe2b0, size = 0.02, opacity = 0.5, additive = true }) {
  const r = rng(51);
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos.set([min.x + r() * (max.x - min.x), min.y + r() * (max.y - min.y), min.z + r() * (max.z - min.z)], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({
    color, size, map: glowTexture(), transparent: true, opacity, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));
  parent.add(p);
  const base = pos.slice();
  return {
    object: p,
    update(t) {
      for (let i = 0; i < count; i++) {
        pos[i * 3] = base[i * 3] + Math.sin(t * 0.2 + i) * 0.08;
        pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.13 + i * 1.7) * 0.06;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

/** Puffs of smoke or steam from fixed sources. */
export function smoke(parent, sources, { color = 'rgba(190,190,195,0.6)', drift = new THREE.Vector3(0.8, 2, 0), size = 1, life = 1 } = {}) {
  const map = canvasTex(128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(190,190,195,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  });
  const puffs = [];
  sources.forEach((src, si) => {
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, opacity: 0 }));
      s.userData = { src, phase: i / 12 + si * 0.17 };
      parent.add(s);
      puffs.push(s);
    }
  });
  return {
    update(t, strength = 1) {
      for (const p of puffs) {
        const age = (t * 0.15 / life + p.userData.phase) % 1;
        const src = p.userData.src;
        p.position.set(src.x + age * drift.x, src.y + age * drift.y, src.z + age * drift.z);
        const s = (0.3 + age * 1.6) * size;
        p.scale.set(s, s, 1);
        p.material.opacity = Math.sin(age * Math.PI) * 0.45 * strength;
      }
    },
  };
}

// ---- housekeeping ---------------------------------------------------------------
// ---- performance ------------------------------------------------------------------------
// Bake a group of static meshes into one mesh per material (fewer draw calls in every pass:
// the main view, the shadow maps, the occlusion pass). Only for things that never move alone.
export function mergeGroup(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const byMat = new Map();
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return;
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(o);
  });
  const m4 = new THREE.Matrix4();
  for (const [mat, list] of byMat) {
    if (list.length < 2) continue;
    const geos = list.map((o) => {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.morphAttributes = {};
      return g.applyMatrix4(m4.multiplyMatrices(inv, o.matrixWorld));
    });
    const merged = new THREE.Mesh(mergeGeometries(geos, false), mat);
    merged.castShadow = list.some((o) => o.castShadow);
    merged.receiveShadow = list.some((o) => o.receiveShadow);
    group.add(merged);
    for (const o of list) o.parent.remove(o);
  }
  return group;
}

// ---- the high country: prayer flags, cairns, outbuildings ---------------------------
// A string of prayer flags from a to b, sagging between them: blue, white, red, green and
// yellow, each a small cloth that hangs from the cord and lifts in the wind. update(t).
export function prayerFlags(parent, a, b, { count = 24, sag = 0.6, size = 0.26, seed = 7 } = {}) {
  const r = rng(seed);
  const COLOURS = ['#2c58a8', '#efeadd', '#c22f29', '#2e8a4b', '#e6bc34'].map((c) => new THREE.Color(c));
  const along = (u) => new THREE.Vector3().lerpVectors(a, b, u).add(new THREE.Vector3(0, -sag * 4 * u * (1 - u), 0));
  const side = new THREE.Vector3().subVectors(b, a).setY(0).normalize();
  const geos = [];
  for (let i = 0; i < count; i++) {
    const u = (i + 0.5) / count;
    const g = new THREE.PlaneGeometry(size, size * 1.2, 3, 4);
    g.translate(0, -size * 0.6, 0);
    const top = along(u);
    const yaw = Math.atan2(side.x, side.z) - Math.PI / 2;
    g.rotateY(yaw);
    g.translate(top.x, top.y, top.z);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const flag = new Float32Array(n * 2);
    const c = COLOURS[i % 5].clone().offsetHSL(0, 0, (r() - 0.5) * 0.06);
    for (let j = 0; j < n; j++) {
      col.set([c.r, c.g, c.b], j * 3);
      flag.set([u * count + r() * 0.3, Math.max(0, top.y - g.attributes.position.getY(j)) / (size * 1.2)], j * 2);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aFlag', new THREE.BufferAttribute(flag, 2));
    geos.push(g);
  }
  const geo = mergeGeometries(geos);
  const time = { value: 0 };
  const mat = std({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  const n = new THREE.Vector3(-side.z, 0, side.x);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.uniforms.uSide = { value: n };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aFlag;\nuniform float uTime;\nuniform vec3 uSide;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float lift = aFlag.y;
        transformed += uSide * sin(uTime * 3.1 + aFlag.x * 1.7 + lift * 2.4) * 0.09 * lift
                     + vec3(0.0, 0.03, 0.0) * sin(uTime * 4.3 + aFlag.x) * lift;`);
  };
  const flags = new THREE.Mesh(geo, mat);
  flags.castShadow = true;
  parent.add(flags);
  const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 12 }, (_, i) => along(i / 11))), 24, 0.006, 4), std({ color: 0x8a7a62 }));
  parent.add(cord);
  return { update(t) { time.value = t; } };
}

// A cairn (a mani pile): flat stones stacked and leaning, the largest at the bottom.
export function cairn(parent, x, y, z, mat, { stones = 7, size = 0.35, seed = 3 } = {}) {
  const r = rng(seed);
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    v.multiplyScalar(0.85 + fbm(v.x * 3 + seed, v.z * 3 + v.y * 2, 3) * 0.3);
    p.setXYZ(i, v.x, v.y * 0.42, v.z);
  }
  geo.computeVertexNormals();
  const inst = new THREE.InstancedMesh(geo, mat, stones);
  const o = new THREE.Object3D();
  let h = y;
  for (let i = 0; i < stones; i++) {
    const s = size * (1 - (i / stones) * 0.6) * (0.85 + r() * 0.3);
    h += s * 0.3;
    o.position.set(x + (r() - 0.5) * s * 0.3, h, z + (r() - 0.5) * s * 0.3);
    o.rotation.set((r() - 0.5) * 0.25, r() * 6.3, (r() - 0.5) * 0.25);
    o.scale.set(s, s, s * (0.8 + r() * 0.3));
    o.updateMatrix();
    inst.setMatrixAt(i, o.matrix);
    h += s * 0.3;
  }
  inst.castShadow = inst.receiveShadow = true;
  parent.add(inst);
  return inst;
}

// A low outbuilding of a remote station: rendered walls on a darker plinth, a
// corrugated roof pitched to shed snow with an overhang and fascia, framed windows whose
// glass lights from within (glass.emissiveIntensity), a door and a sill under each window.
// Faces +z before ry. Returns { group, glass } (glass is one material, shared).
export function outbuilding(parent, { x, y, z, w, d, h = 3, ry = 0, wall, roof, trim, glass, windows = [-1, 1], door = 0 }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  parent.add(g);
  box(g, w, h, d, wall, 0, h / 2, 0, { uv: 2.5 });
  box(g, w + 0.08, 0.35, d + 0.08, trim.plinth, 0, 0.175, 0, { uv: 1 });
  // the roof: one sheet falling to the back, over a fascia board
  const pitch = 0.07;
  const sheet = box(g, w + 0.7, 0.06, d + 0.8, roof, 0, h + 0.18, 0, { uv: 0, rx: pitch });
  const uv = sheet.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w + 0.7) / 2.2, uv.getY(i) * (d + 0.8) / 2.2);
  box(g, w + 0.72, 0.22, 0.04, trim.dark, 0, h + 0.1, d / 2 + 0.42, { uv: 0 });
  box(g, w + 0.72, 0.22, 0.04, trim.dark, 0, h + 0.05 - (d + 0.8) * pitch, -d / 2 - 0.42, { uv: 0 });
  const front = d / 2;
  for (const wx of windows) {
    const cx = wx * Math.min(w / 4, 1.5);
    const ww = 0.85;
    const wh = 0.75;
    const wy = h * 0.55;
    // reveal, frame, mullions, glass, sill
    box(g, ww + 0.16, wh + 0.16, 0.05, trim.dark, cx, wy, front + 0.02, { uv: 0 });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), glass);
    pane.position.set(cx, wy, front + 0.05);
    g.add(pane);
    box(g, 0.04, wh, 0.04, trim.dark, cx, wy, front + 0.07, { uv: 0 });
    box(g, ww, 0.04, 0.04, trim.dark, cx, wy, front + 0.07, { uv: 0 });
    box(g, ww + 0.3, 0.06, 0.18, trim.plinth, cx, wy - wh / 2 - 0.1, front + 0.09, { uv: 0 });
  }
  if (door !== null && door !== false) {
    const dx = door * (w / 2 - 0.9);
    box(g, 1.0, 2.05, 0.06, trim.dark, dx, 1.03, front + 0.03, { uv: 0 });
    box(g, 0.86, 1.95, 0.05, trim.door, dx, 1.0, front + 0.05, { uv: 0 });
    box(g, 1.3, 0.12, 0.7, trim.plinth, dx, 0.06, front + 0.35, { uv: 0 });
  }
  return { group: g };
}

// A radio mast: a slim lattice of three legs with braces, guyed, a light at the top.
export function mast(parent, { x, y, z, h = 14, mat }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  const r0 = 0.28;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    box(g, 0.05, h, 0.05, mat, Math.cos(a) * r0, h / 2, Math.sin(a) * r0, { uv: 0 });
  }
  for (let yy = 0.6; yy < h; yy += 0.9) {
    for (let i = 0; i < 3; i++) {
      const a0 = (i / 3) * Math.PI * 2, a1 = ((i + 1) / 3) * Math.PI * 2;
      const p0 = new THREE.Vector3(Math.cos(a0) * r0, yy, Math.sin(a0) * r0);
      const p1 = new THREE.Vector3(Math.cos(a1) * r0, yy + 0.45, Math.sin(a1) * r0);
      const len = p0.distanceTo(p1);
      const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 4), mat);
      brace.position.copy(p0).add(p1).multiplyScalar(0.5);
      brace.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
      g.add(brace);
    }
  }
  const wire = std({ color: 0x3a3a3a });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const top = new THREE.Vector3(0, h * 0.8, 0), foot = new THREE.Vector3(Math.cos(a) * h * 0.55, 0, Math.sin(a) * h * 0.55);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, top.distanceTo(foot), 3), wire);
    c.position.copy(top).add(foot).multiplyScalar(0.5);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(foot).normalize());
    g.add(c);
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
  beacon.position.y = h + 0.1;
  g.add(beacon);
  return { group: g, beacon };
}

// A dish aerial on a short pedestal, tilted at the sky.
export function dish(parent, { x, y, z, r = 1.2, ry = 0, tilt = 0.7, mat, frame }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  parent.add(g);
  box(g, 0.18, 1.3, 0.18, frame, 0, 0.65, 0, { uv: 0 });
  const pts = [];
  for (let i = 0; i <= 16; i++) { const u = i / 16; pts.push(new THREE.Vector2(u * r, u * u * r * 0.32)); }
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), mat);
  bowl.material.side = THREE.DoubleSide;
  const head = new THREE.Group();
  head.position.y = 1.35;
  head.rotation.x = -tilt;
  head.add(bowl);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, r * 0.9, 6), frame);
  arm.position.y = r * 0.45;
  head.add(arm);
  bowl.castShadow = true;
  g.add(head);
  return g;
}

// ---- the lane: dry-stone walls ---------------------------------------------------------
// A dry-stone wall along [x, z] points, following the ground: lengths of stacked stone with
// a ragged line of coping stones stood on edge along the top. Returns the wall's top points.
export function dryStoneWall(parent, pts, { ground = () => 0, height = 1.1, width = 0.55, mat, capMat = mat, seed = 5 } = {}) {
  const r = rng(seed);
  const tops = [];
  const cap = new THREE.IcosahedronGeometry(1, 1);
  const cp = cap.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(cp, i);
    v.multiplyScalar(0.85 + fbm(v.x * 2.3 + 1, v.y * 2.3 + v.z, 3) * 0.3);
    cp.setXYZ(i, v.x * 0.13, v.y * 0.12, v.z * 0.05);
  }
  cap.computeVertexNormals();
  const caps = [];
  const lengths = new THREE.Group();
  parent.add(lengths);
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1];
    const [x1, z1] = pts[i];
    const y0 = ground(x0, z0);
    const y1 = ground(x1, z1);
    const len = Math.hypot(x1 - x0, z1 - z0);
    const h = height * (0.94 + r() * 0.12);
    const seg = box(lengths, width, h, len + 0.08, mat, 0, 0, 0, { uv: 1.4 });
    seg.position.set((x0 + x1) / 2, (y0 + y1) / 2 + h / 2 - 0.05, (z0 + z1) / 2);
    seg.lookAt(x1, y1 + h / 2 - 0.05, z1);
    for (let d = 0.12; d < len; d += 0.21 + r() * 0.05) {
      const u = d / len;
      caps.push([x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + h - 0.02, z0 + (z1 - z0) * u, Math.atan2(x1 - x0, z1 - z0)]);
    }
    tops.push([x0, y0 + h, z0]);
  }
  mergeGroup(lengths);
  const inst = new THREE.InstancedMesh(cap, capMat, caps.length);
  const o = new THREE.Object3D();
  caps.forEach(([x, y, z, yaw], i) => {
    o.position.set(x, y + 0.08, z);
    o.rotation.set((r() - 0.5) * 0.35, yaw + Math.PI / 2 + (r() - 0.5) * 0.3, (r() - 0.5) * 0.25);
    o.scale.setScalar(0.8 + r() * 0.5);
    o.updateMatrix();
    inst.setMatrixAt(i, o.matrix);
  });
  inst.castShadow = inst.receiveShadow = true;
  parent.add(inst);
  return tops;
}

// ---- an Edwardian motor tourer ------------------------------------------------------------
// About 1903: wooden artillery wheels on pneumatic tyres, a louvred bonnet behind a brass
// honeycomb radiator, a tonneau body in deep green coachwork with a fine red line, buttoned
// leather seats, black wings and running boards, acetylene headlamps, oil side lamps, a
// bulb horn and the hood folded behind. Faces +z, wheels on y = 0.
function artilleryWheel(wood, tyre, brass, iron) {
  const g = new THREE.Group();
  const R = 0.43;
  const t = new THREE.Mesh(new THREE.TorusGeometry(R - 0.045, 0.045, 14, 48), tyre);
  const felloe = new THREE.Mesh(new THREE.TorusGeometry(R - 0.1, 0.028, 8, 48), wood);
  felloe.scale.z = 1.6;
  g.add(t, felloe);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const len = R - 0.17;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.024, len, 8), wood);
    spoke.scale.z = 1.5;
    spoke.position.set(Math.cos(a) * (0.08 + len / 2), Math.sin(a) * (0.08 + len / 2), 0);
    spoke.rotation.z = a - Math.PI / 2;
    g.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.12, 20), iron);
  hub.rotation.x = Math.PI / 2;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 20), brass);
  cap.rotation.x = Math.PI / 2;
  cap.position.z = 0.09;
  g.add(hub, cap);
  return g;
}

export function motorcar(parent, { paint = 0x1d3b2a, lamps = true, beams = true } = {}) {
  const g = new THREE.Group();
  const coach = new THREE.MeshPhysicalMaterial({ color: paint, roughness: 0.3, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08 });
  const black = new THREE.MeshPhysicalMaterial({ color: 0x0b0b0c, roughness: 0.35, metalness: 0.1, clearcoat: 0.7, clearcoatRoughness: 0.2 });
  const brass = metal.brass();
  const iron = std({ color: 0x1a1a1b, metalness: 0.7, roughness: 0.5 });
  const wood = std({ color: 0x8a5a30, roughness: 0.45 });
  const tyre = std({ color: 0x141414, roughness: 0.92 });
  const leather = std({ map: tex.buttonedLeather(), color: 0x7a3524, roughness: 0.55 });
  const line = std({ color: 0x9c1f1f, roughness: 0.4 });
  // chassis rails and cross members
  for (const sx of [-1, 1]) box(g, 0.08, 0.14, 3.3, iron, sx * 0.48, 0.55, 0.05, { uv: 0 });
  for (const z of [1.55, 0.4, -1.4]) box(g, 1.0, 0.08, 0.08, iron, 0, 0.55, z, { uv: 0 });
  // wheels and axles
  for (const [z, sx] of [[1.25, -1], [1.25, 1], [-1.2, -1], [-1.2, 1]]) {
    const w = artilleryWheel(wood, tyre, brass, iron);
    w.rotation.y = sx * Math.PI / 2;
    w.position.set(sx * 0.7, 0.43, z);
    g.add(w);
  }
  for (const z of [1.25, -1.2]) {
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 8), iron);
    axle.rotation.z = Math.PI / 2;
    axle.position.set(0, 0.43, z);
    g.add(axle);
  }
  // the bonnet: a rounded section, louvred down each side
  const bs = new THREE.Shape();
  const bw = 0.4, bh = 0.5, rr = 0.17;
  bs.moveTo(-bw, 0); bs.lineTo(-bw, bh - rr); bs.quadraticCurveTo(-bw, bh, -bw + rr, bh); bs.lineTo(bw - rr, bh); bs.quadraticCurveTo(bw, bh, bw, bh - rr); bs.lineTo(bw, 0); bs.lineTo(-bw, 0);
  const bonnet = new THREE.Mesh(new THREE.ExtrudeGeometry(bs, { depth: 0.95, bevelEnabled: false, curveSegments: 10 }), coach);
  bonnet.position.set(0, 0.62, 0.62);
  g.add(bonnet);
  for (const sx of [-1, 1]) for (let i = 0; i < 9; i++) box(g, 0.012, 0.22, 0.035, black, sx * 0.405, 0.86, 0.75 + i * 0.085, { uv: 0 });
  box(g, 0.83, 0.025, 0.95, brass, 0, 1.125, 1.095, { uv: 0 });
  // the radiator: a brass shell round a honeycomb core, with its filler cap
  box(g, 0.86, 0.72, 0.09, brass, 0, 0.97, 1.62, { uv: 0 });
  const core = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.6), std({ map: tex.honeycomb(), roughness: 0.5, metalness: 0.6 }));
  core.position.set(0, 0.97, 1.667);
  g.add(core);
  const filler = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.07, 14), brass);
  filler.position.set(0, 1.37, 1.62);
  g.add(filler);
  // scuttle and dashboard, with brass gauges and the side lamps
  box(g, 1.0, 0.55, 0.05, wood, 0, 0.93, 0.6, { uv: 0 });
  for (const sx of [-0.18, 0.18]) {
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 18), brass);
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(sx, 1.02, 0.57);
    g.add(gauge);
  }
  // the tonneau: rounded coachwork, two seats, a fine red line along the waist
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.32, 0.5, 2.05, 5, 0.14), coach);
  body.position.set(0, 0.86, -0.42);
  g.add(body);
  for (const sx of [-1, 1]) box(g, 0.004, 0.018, 1.9, line, sx * 0.662, 1.02, -0.42, { uv: 0 });
  for (const [z, w] of [[0.05, 1.18], [-1.0, 1.2]]) {
    const cushion = new THREE.Mesh(new RoundedBoxGeometry(w, 0.16, 0.55, 3, 0.06), leather);
    cushion.position.set(0, 1.13, z);
    g.add(cushion);
    // the seat back: a curved shell of buttoned leather
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.5, 24, 1, true, Math.PI * 0.5, Math.PI), leather);
    shell.material.side = THREE.DoubleSide;
    shell.scale.set(1, 1, 0.45);
    shell.position.set(0, 1.4, z - 0.12);
    g.add(shell);
  }
  // the hood folded down behind the rear seat
  for (let i = 0; i < 3; i++) {
    const fold = new THREE.Mesh(new THREE.CylinderGeometry(0.07 - i * 0.012, 0.07 - i * 0.012, 1.3, 12), std({ color: 0x1c1a17, roughness: 0.85 }));
    fold.rotation.z = Math.PI / 2;
    fold.position.set(0, 1.18 + i * 0.07, -1.5 + i * 0.03);
    g.add(fold);
  }
  // wings over the wheels, joined by running boards
  for (const sx of [-1, 1]) {
    for (const z of [1.25, -1.2]) {
      const wing = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.24, 28, 1, true, -0.2, Math.PI * 0.62), black);
      wing.material.side = THREE.DoubleSide;
      wing.rotation.z = Math.PI / 2;
      wing.rotation.x = z > 0 ? -0.3 : 0.6;
      wing.position.set(sx * 0.7, 0.43, z);
      g.add(wing);
    }
    box(g, 0.24, 0.025, 1.45, black, sx * 0.7, 0.45, 0.02, { uv: 0 });
  }
  // steering wheel on its raked column
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.75, 8), iron);
  column.position.set(0.3, 1.18, 0.38);
  column.rotation.x = 0.75;
  g.add(column);
  const helm = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.015, 8, 32), wood);
  helm.position.set(0.3, 1.45, 0.14);
  helm.rotation.x = -0.82;
  g.add(helm);
  // the bulb horn
  const hornPath = new THREE.CatmullRomCurve3([new THREE.Vector3(0.68, 1.1, 0.5), new THREE.Vector3(0.74, 1.15, 0.9), new THREE.Vector3(0.7, 1.05, 1.2), new THREE.Vector3(0.66, 1.0, 1.4)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(hornPath, 24, 0.018, 8), brass));
  const bell = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.12, 16, 1, true), brass);
  bell.material.side = THREE.DoubleSide;
  bell.rotation.x = Math.PI / 2;
  bell.position.set(0.66, 1.0, 1.46);
  g.add(bell);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), std({ color: 0x1a1a1a, roughness: 0.7 }));
  bulb.position.set(0.68, 1.1, 0.46);
  g.add(bulb);
  const lights = [];
  if (lamps) {
    // acetylene headlamps: brass bells with a glass face
    const prof = [];
    for (let i = 0; i <= 10; i++) { const u = i / 10; prof.push(new THREE.Vector2(0.06 + Math.sin(u * Math.PI * 0.5) * 0.07, u * 0.18)); }
    for (const sx of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), brass);
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(sx * 0.55, 1.0, 1.62);
      g.add(lamp);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.125, 24), new THREE.MeshBasicMaterial({ color: 0xffe9b8 }));
      lens.material.color.multiplyScalar(2.2);
      lens.position.set(sx * 0.55, 1.0, 1.81);
      g.add(lens);
      const bracket = box(g, 0.03, 0.18, 0.03, brass, sx * 0.55, 0.88, 1.62, { uv: 0 });
      bracket.castShadow = false;
      // oil side lamps on the dash
      box(g, 0.1, 0.16, 0.1, black, sx * 0.55, 1.12, 0.62, { uv: 0 });
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.08, 4), brass);
      top.position.set(sx * 0.55, 1.24, 0.62);
      top.rotation.y = Math.PI / 4;
      g.add(top);
      if (beams) {
        const beam = new THREE.SpotLight(0xffe2a8, 30, 30, 0.42, 0.5, 1.5);
        beam.position.set(sx * 0.55, 1.0, 1.8);
        beam.target.position.set(sx * 0.4, 0.2, 12);
        g.add(beam, beam.target);
        lights.push(beam);
      }
    }
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b2a }));
    tail.material.color.multiplyScalar(2);
    tail.position.set(0.5, 0.95, -1.47);
    g.add(tail);
  }
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  parent.add(g);
  return g;
}

export function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.userData.shared) return; // model meshes shared with other worlds
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      for (const k of ['map', 'emissiveMap', 'bumpMap', 'roughnessMap', 'normalMap', 'alphaMap', 'aoMap', 'metalnessMap']) {
        if (m[k] && m[k] !== glowTex && !m[k].userData.shared) m[k].dispose();
      }
      m.dispose();
    }
    if (o.isReflector && o.dispose) o.dispose();
  });
}
