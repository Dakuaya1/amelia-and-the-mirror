// What lies on the study desk around the book, and the light it is seen by: a green
// morocco writing mat with a double gilt rule, a bundle of old letters tied with
// butcher's string, a fountain pen, an ink bottle, a stack of old books, and dust
// that glows only where the lamp catches it. Built from primitives and canvas
// textures. Units are the book's: one page is 1.0 wide (about 15 cm).
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/addons/RoundedBoxGeometry.js';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';

/**
 * Bake a still group's meshes into one mesh per material: one draw call each (and one each in
 * the shadow and occlusion passes) instead of one per part. Meshes marked userData.keep (moving
 * parts) and multi-material meshes are left as they are.
 */
function bake(group) {
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert();
  const buckets = new Map();
  const parts = [];
  group.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || o.userData.keep) return;
    let held = false;
    for (let p = o.parent; p && p !== group; p = p.parent) if (p.userData.keep) held = true;
    if (held) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(inv.clone().multiply(o.matrixWorld));
    if (!buckets.has(o.material)) buckets.set(o.material, { geos: [], cast: false });
    const b = buckets.get(o.material);
    b.geos.push(g);
    b.cast = b.cast || o.castShadow;
    parts.push(o);
  });
  for (const o of parts) o.parent.remove(o);
  for (const [mat, b] of buckets) {
    const m = new THREE.Mesh(mergeGeometries(b.geos), mat);
    m.castShadow = b.cast;
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
}

function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true, clamp = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

// Deterministic random, so the desk is the same on every load.
function rng(seed = 1) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

/**
 * The light the study's surfaces reflect, built like a photographer's set: a broad warm
 * softbox above and beyond the book (so the cover's gold and the paper's sheen catch it from
 * where the reader looks), the lamp as a small hot disc to the left, a cool window to the
 * right, and the dim warmth of the room everywhere else.
 */
export function studioEnvironment(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ color: 0x140d08, side: THREE.BackSide })));
  const centre = new THREE.Vector3(0, 0, 0);
  const panel = (w, h, color, strength, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(centre);
    env.add(m);
  };
  panel(14, 6, 0xffe9cc, 2.4, 0, 10, -9); // the softbox
  panel(2.4, 2.4, 0xffc488, 7, -8, 6, -2); // the lamp
  panel(5, 8, 0x9db3dc, 0.9, 10, 4, 3); // the window
  panel(40, 40, 0x2a1a10, 1, 0, -8, 0); // the desk and the floor, warm and dim
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return tex;
}

/** The writing mat: green morocco, mottled and grained, darker at its worn edges, ruled in gold. */
export function writingMat(w = 3.2, d = 2.2) {
  const W = 1024;
  const H = Math.round((W * d) / w);
  const r = rng(5);
  const rule = (g, inset, width) => {
    g.lineWidth = width;
    g.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  };
  const colour = canvasTex(W, H, (g) => {
    g.fillStyle = '#1d3528';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) {
      const x = r() * W;
      const y = r() * H;
      const rad = 6 + r() * 40;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, r() < 0.55 ? 'rgba(6,14,10,0.16)' : 'rgba(80,120,90,0.10)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 26000; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '130,160,130'},${0.04 + r() * 0.06})`;
      g.fillRect(r() * W, r() * H, 1 + r() * 1.5, 1 + r() * 1.5);
    }
    const edge = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,0,0.4)');
    g.fillStyle = edge;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#c99d55';
    rule(g, 30, 5);
    rule(g, 44, 2);
    g.fillStyle = '#c99d55';
    for (const [x, y] of [[44, 44], [W - 44, 44], [44, H - 44], [W - 44, H - 44]]) {
      g.beginPath();
      g.moveTo(x, y - 14);
      g.quadraticCurveTo(x + 2, y - 2, x + 14, y);
      g.quadraticCurveTo(x + 2, y + 2, x, y + 14);
      g.quadraticCurveTo(x - 2, y + 2, x - 14, y);
      g.quadraticCurveTo(x - 2, y - 2, x, y - 14);
      g.fill();
    }
  }, { clamp: true });
  // the gold is metal and smoother than the leather (G = roughness, B = metalness)
  const surface = canvasTex(W, H, (g) => {
    g.fillStyle = 'rgb(0,140,0)';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgb(0,70,235)';
    rule(g, 30, 5);
    rule(g, 44, 2);
  }, { srgb: false, clamp: true });
  const grain = canvasTex(512, 512, (g) => {
    const rr = rng(9);
    g.fillStyle = '#808080';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(${rr() < 0.5 ? '0,0,0' : '255,255,255'},${0.08 + rr() * 0.12})`;
      const s = 1 + rr() * 3;
      g.fillRect(rr() * 512, rr() * 512, s, s);
    }
  }, { srgb: false, repeat: [3, 2] });
  const top = new THREE.MeshStandardMaterial({ map: colour, roughnessMap: surface, metalnessMap: surface, roughness: 1, metalness: 1, bumpMap: grain, bumpScale: 0.5 });
  const mat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.01, d), top);
  mat.position.y = 0.005;
  mat.receiveShadow = true;
  return mat;
}

// handwriting, scribbled: lines of joined loops, the way an address reads from a little way off
function scribble(g, x, y, w, r) {
  g.strokeStyle = 'rgba(38,30,62,0.78)';
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(x, y);
  let cx = x;
  while (cx < x + w) {
    const step = 6 + r() * 7;
    const up = (r() < 0.2 ? 18 : 8) * (0.6 + r() * 0.6);
    g.quadraticCurveTo(cx + step * 0.25, y - up, cx + step * 0.5, y);
    g.quadraticCurveTo(cx + step * 0.75, y + 3, cx + step, y - 1);
    cx += step;
    if (r() < 0.12) {
      cx += 10;
      g.moveTo(cx, y);
    }
  }
  g.stroke();
}

/** A bundle of old letters tied with butcher's string, the top one turned over, sealed in red wax. */
export function letters() {
  const group = new THREE.Group();
  const r = rng(23);
  const W = 0.96;
  const D = 0.62;
  const T = 0.009;
  for (let i = 0; i < 4; i++) {
    const tex = canvasTex(512, 332, (g) => {
      g.fillStyle = ['#e7d9bc', '#eee2c9', '#e2d2b2', '#ebdfc3'][i];
      g.fillRect(0, 0, 512, 332);
      for (let k = 0; k < 420; k++) {
        g.fillStyle = `rgba(110,80,40,${0.03 + r() * 0.05})`;
        g.fillRect(r() * 512, r() * 332, 2 + r() * 4, 2 + r() * 4);
      }
      if (i === 3) {
        g.strokeStyle = 'rgba(90,70,45,0.45)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(256, 196);
        g.lineTo(512, 0);
        g.stroke();
      } else {
        for (let l = 0; l < 3; l++) scribble(g, 170, 170 + l * 34, 220 - l * 30, r);
        g.strokeStyle = 'rgba(120,40,40,0.5)';
        g.lineWidth = 2;
        g.strokeRect(420, 26, 66, 78);
        g.beginPath();
        g.arc(410, 86, 34, 0, Math.PI * 2);
        g.stroke();
      }
    }, { clamp: true });
    const env = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    env.position.set((r() - 0.5) * 0.06, T / 2 + i * (T + 0.0006), (r() - 0.5) * 0.05);
    env.rotation.y = (r() - 0.5) * 0.16;
    env.castShadow = env.receiveShadow = true;
    group.add(env);
  }
  const top = 4 * (T + 0.0006);
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.082, 0.018, 28), new THREE.MeshPhysicalMaterial({ color: 0x7a0f14, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 }));
  seal.position.set(0.02, top + 0.009, 0.1);
  seal.castShadow = true;
  group.add(seal);
  const string = new THREE.MeshStandardMaterial({ color: 0xd6c6a0, roughness: 0.95 });
  const along = new THREE.Mesh(new THREE.BoxGeometry(W + 0.03, top + 0.012, 0.012), string);
  along.position.y = (top + 0.012) / 2 - 0.002;
  const across = new THREE.Mesh(new THREE.BoxGeometry(0.012, top + 0.014, D + 0.03), string);
  across.position.set(-0.2, (top + 0.014) / 2 - 0.002, 0);
  group.add(along, across);
  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 8, 20), string);
    loop.rotation.x = Math.PI / 2;
    loop.scale.set(1, 0.6, 1);
    loop.position.set(-0.2 + s * 0.04, top + 0.012, 0);
    group.add(loop);
  }
  group.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return bake(group);
}

/** A fountain pen lying on the desk: black lacquer, a gold band and clip, a gold nib. */
export function fountainPen(brass) {
  const pen = new THREE.Group();
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x0b0c10, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
  const R = 0.042;
  const parts = [
    [new THREE.CylinderGeometry(R, R * 0.82, 0.62, 28), lacquer, 0.31],
    [new THREE.CylinderGeometry(R * 1.08, R * 1.08, 0.42, 28), lacquer, 0.83],
    [new THREE.SphereGeometry(R * 1.08, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), lacquer, 1.04],
    [new THREE.CylinderGeometry(R * 1.12, R * 1.12, 0.03, 28), brass, 0.635],
    [new THREE.CylinderGeometry(R * 0.82, R * 0.6, 0.1, 24), lacquer, -0.05],
    [new THREE.ConeGeometry(R * 0.6, 0.14, 16), brass, -0.17],
  ];
  for (const [geo, mat, y] of parts) {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    if (geo.type === 'ConeGeometry') m.rotation.x = Math.PI;
    m.castShadow = true;
    pen.add(m);
  }
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.3, 0.01), brass);
  clip.position.set(0, 0.86, R * 1.15);
  pen.add(clip);
  pen.rotation.z = Math.PI / 2; // lying down
  pen.position.y = R * 1.1;
  const holder = new THREE.Group();
  holder.add(pen);
  return bake(holder);
}

/** A square ink bottle of dark glass with a brass cap. */
export function inkBottle(brass) {
  const group = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0c1428, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.3, 0.34, 3, 0.045), glass);
  body.position.y = 0.15;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.06, 24), glass);
  neck.position.y = 0.33;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.08, 28), brass);
  cap.position.y = 0.39;
  for (const m of [body, neck, cap]) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  return bake(group);
}

/** Three old books lying flat, one on another: cloth boards, toned page edges, a gilt band. */
export function bookStack(brass) {
  const group = new THREE.Group();
  const r = rng(61);
  const edge = new THREE.MeshStandardMaterial({ color: 0xd9c9a5, roughness: 0.95 });
  let y = 0;
  [[1.55, 1.05, 0.2, 0x5a1a1a], [1.4, 0.98, 0.17, 0x1d3a2a], [1.25, 0.88, 0.22, 0x1c2742]].forEach(([w, d, t, c], i) => {
    const book = new THREE.Group();
    const cloth = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.72, sheen: 0.5, sheenRoughness: 0.5, sheenColor: new THREE.Color(c).offsetHSL(0, 0, 0.25) });
    const board = new RoundedBoxGeometry(w, 0.022, d, 2, 0.008);
    for (const by of [0.011, t - 0.011]) {
      const m = new THREE.Mesh(board, cloth);
      m.position.y = by;
      book.add(m);
    }
    const spine = new THREE.Mesh(new RoundedBoxGeometry(0.05, t, d, 2, 0.02), cloth);
    spine.position.set(-w / 2 + 0.02, t / 2, 0);
    const block = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, t - 0.044, d - 0.04), edge);
    block.position.set(0.015, t / 2, 0);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.054, t * 0.5, 0.05), brass);
    band.position.set(-w / 2 + 0.017, t / 2, d * 0.25);
    book.add(spine, block, band);
    book.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    book.position.y = y;
    book.rotation.y = (r() - 0.5) * 0.3 + i * 0.08;
    group.add(book);
    y += t;
  });
  return bake(group);
}

/**
 * Dust that hangs in the lamp's beam: a few soft motes, lit only inside the cone, drifting.
 * Returns { object, update(t) }.
 */
export function beamDust({ count = 70, from, to, lampPos, lampDir, cone = 0.62 }) {
  const r = rng(77);
  const base = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    base[i * 3] = from.x + r() * (to.x - from.x);
    base[i * 3 + 1] = from.y + r() * (to.y - from.y);
    base[i * 3 + 2] = from.z + r() * (to.z - from.z);
    phase[i] = r() * 100;
  }
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const sprite = canvasTex(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.3, 'rgba(255,255,255,0.5)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  }, { clamp: true });
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    map: sprite,
    size: 0.032,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  points.frustumCulled = false;
  const dir = lampDir.clone().normalize();
  const v = new THREE.Vector3();
  const cosCone = Math.cos(cone);
  return {
    object: points,
    update(t) {
      for (let i = 0; i < count; i++) {
        const p = phase[i];
        const x = base[i * 3] + Math.sin(t * 0.11 + p) * 0.18;
        const y = base[i * 3 + 1] + Math.sin(t * 0.07 + p * 1.3) * 0.12 - ((t * 0.015 + p) % 1) * 0.05;
        const z = base[i * 3 + 2] + Math.cos(t * 0.09 + p * 0.7) * 0.15;
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
        // lit only inside the lamp's cone, brightest on its axis; a slow twinkle as each turns
        v.set(x, y, z).sub(lampPos).normalize();
        const inBeam = THREE.MathUtils.smoothstep(v.dot(dir), cosCone, cosCone + (1 - cosCone) * 0.6);
        const glint = 0.45 + 0.55 * Math.max(0, Math.sin(t * 0.8 + p * 3.1));
        const k = inBeam * glint * 0.75;
        col[i * 3] = k;
        col[i * 3 + 1] = k * 0.88;
        col[i * 3 + 2] = k * 0.7;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}

/**
 * A brass orrery on a walnut plinth: the sun glowing at the top of its column, four planets
 * on arms at their own speeds (the third with its moon), an ecliptic ring round them all.
 * Returns { object, update(t, turn) }: time turns it slowly, the reader's scroll (turn) more.
 */
export function orrery(brass) {
  const group = new THREE.Group();
  const walnut = new THREE.MeshStandardMaterial({ color: 0x3a2214, roughness: 0.45, metalness: 0 });
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.37, 0.07, 48), walnut);
  plinth.position.y = 0.035;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.06, 48), brass);
  base.position.y = 0.1;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.5, 20), brass);
  column.position.y = 0.38;
  group.add(plinth, base, column);
  const SUN_Y = 0.66;
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 32, 16),
    new THREE.MeshStandardMaterial({ color: 0xffd58a, emissive: 0xffa040, emissiveIntensity: 2.4, roughness: 0.4 }),
  );
  sun.position.y = SUN_Y;
  group.add(sun);
  // the ecliptic: a fine ring with twelve studs
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.006, 8, 96), brass);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = SUN_Y - 0.06;
  group.add(ring);
  for (let i = 0; i < 12; i++) {
    const stud = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 6), brass);
    const a = (i / 12) * Math.PI * 2;
    stud.position.set(Math.cos(a) * 0.6, SUN_Y - 0.06, Math.sin(a) * 0.6);
    group.add(stud);
  }
  // ring supports down to the base
  for (const a of [0.4, 0.4 + (Math.PI * 2) / 3, 0.4 + (Math.PI * 4) / 3]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, SUN_Y - 0.13, 8), brass);
    leg.position.set(Math.cos(a) * 0.6, (SUN_Y - 0.06 + 0.13) / 2, Math.sin(a) * 0.6);
    group.add(leg);
  }
  const planet = (color, r, rough = 0.35, metal = 0.2) => new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12), new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
  const arms = [];
  [[0.17, 0.02, 0xb07a52, 1.6], [0.27, 0.03, 0xe8dcc0, 1.18], [0.38, 0.034, 0x3a6aa8, 1.0], [0.5, 0.027, 0xb0442c, 0.8]].forEach(([dist, r, color, speed], i) => {
    const arm = new THREE.Group();
    arm.position.y = SUN_Y - 0.1 - i * 0.025;
    const rod = new THREE.Mesh(new THREE.BoxGeometry(dist, 0.006, 0.006), brass);
    rod.position.x = dist / 2;
    const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 6), brass);
    drop.position.set(dist, 0.03, 0);
    const body = planet(color, r);
    body.position.set(dist, 0.06 + r * 0.5, 0);
    arm.add(rod, drop, body);
    if (i === 2) {
      // the third planet's moon, on its own small arm
      const moonArm = new THREE.Group();
      moonArm.position.copy(body.position);
      const moon = planet(0xd8d4cc, 0.01, 0.6, 0);
      moon.position.x = 0.07;
      moonArm.add(moon);
      arm.add(moonArm);
      arm.userData.moon = moonArm;
    }
    arm.rotation.y = i * 1.7;
    arm.userData.speed = speed;
    arm.userData.keep = true;
    arms.push(arm);
    group.add(arm);
  });
  // a collar where the arms meet the column
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 20), brass);
  collar.position.y = SUN_Y - 0.15;
  group.add(collar);
  group.traverse((m) => { if (m.isMesh && m !== sun) { m.castShadow = true; m.receiveShadow = true; } });
  for (const arm of arms) arm.traverse((m) => { if (m.isMesh) m.castShadow = false; });
  bake(group);
  return {
    object: group,
    update(t, turn = 0) {
      const a = t * 0.12 + turn * 0.35;
      arms.forEach((arm, i) => {
        arm.rotation.y = i * 1.7 + a * arm.userData.speed;
        if (arm.userData.moon) arm.userData.moon.rotation.y = a * 6;
      });
    },
  };
}

/**
 * An open pocket watch with its chain, lid standing open. It shows a quarter past six (the
 * hour the story starts at) and runs from there; the seconds hand ticks.
 * Returns { object, update(now) }.
 */
export function pocketWatch() {
  const group = new THREE.Group();
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xd9b46a, metalness: 1, roughness: 0.22, clearcoat: 0.4, clearcoatRoughness: 0.2 });
  const R = 0.17;
  const caseBody = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.05, 48), gold);
  caseBody.position.y = 0.035;
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(R, 0.016, 12, 64), gold);
  bezel.rotation.x = Math.PI / 2;
  bezel.position.y = 0.06;
  // the dial: white enamel, Roman hours, a minute track, small seconds at six
  const face = canvasTex(512, 512, (g) => {
    g.fillStyle = '#f3ecdc';
    g.beginPath();
    g.arc(256, 256, 256, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#2a2016';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(256, 256, 236, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const r0 = i % 5 ? 222 : 212;
      g.lineWidth = i % 5 ? 2 : 4;
      g.beginPath();
      g.moveTo(256 + Math.sin(a) * r0, 256 - Math.cos(a) * r0);
      g.lineTo(256 + Math.sin(a) * 234, 256 - Math.cos(a) * 234);
      g.stroke();
    }
    g.fillStyle = '#2a2016';
    g.font = '600 44px "Cinzel", Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((n, i) => {
      if (i === 6) return; // the seconds dial sits there
      const a = (i / 12) * Math.PI * 2;
      g.save();
      g.translate(256 + Math.sin(a) * 172, 256 - Math.cos(a) * 172);
      g.rotate(a);
      g.fillText(n, 0, 0);
      g.restore();
    });
    g.lineWidth = 2;
    g.beginPath();
    g.arc(256, 362, 44, 0, Math.PI * 2);
    g.stroke();
    g.font = 'italic 22px "Cormorant Garamond", Georgia, serif';
    g.fillText('Forefore', 256, 150);
  }, { clamp: true });
  const dial = new THREE.Mesh(new THREE.CircleGeometry(R * 0.96, 48), new THREE.MeshStandardMaterial({ map: face, roughness: 0.3 }));
  dial.rotation.x = -Math.PI / 2;
  dial.position.y = 0.061;
  const blued = new THREE.MeshStandardMaterial({ color: 0x1b2a5c, metalness: 0.8, roughness: 0.3 });
  const hand = (len, w) => {
    const pivot = new THREE.Group();
    pivot.position.y = 0.064;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.003, len), blued);
    m.position.z = -len / 2 + 0.01;
    pivot.add(m);
    return pivot;
  };
  const hourHand = hand(R * 0.52, 0.012);
  const minuteHand = hand(R * 0.78, 0.008);
  minuteHand.position.y += 0.002;
  const secondsHand = hand(0.035, 0.004);
  secondsHand.position.set(0, 0.067, R * 0.96 * (106 / 256));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.01, 12), gold);
  cap.position.y = 0.068;
  // the crown and its bow at twelve
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.04, 16), gold);
  stem.rotation.x = Math.PI / 2;
  stem.position.set(0, 0.035, -R - 0.025);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.03, 20), gold);
  crown.rotation.x = Math.PI / 2;
  crown.position.set(0, 0.035, -R - 0.055);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.007, 8, 24), gold);
  bow.rotation.x = Math.PI / 2;
  bow.position.set(0, 0.035, -R - 0.1);
  // the lid, standing open on its hinge at nine o'clock, engraved inside with fine rings
  const lidTex = canvasTex(256, 256, (g) => {
    g.fillStyle = '#c9a25a';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(90,60,20,0.5)';
    for (let r = 10; r < 128; r += 6) {
      g.lineWidth = 1;
      g.beginPath();
      g.arc(128, 128, r, 0, Math.PI * 2);
      g.stroke();
    }
  }, { clamp: true });
  const lidHinge = new THREE.Group();
  lidHinge.position.set(-R, 0.06, 0);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.02, 48), [gold, new THREE.MeshPhysicalMaterial({ map: lidTex, metalness: 1, roughness: 0.3 }), gold]);
  lid.position.x = -R;
  lidHinge.add(lid);
  lidHinge.rotation.z = -Math.PI * 0.42; // swung open, standing up and leaning back
  // the chain, lying in a loose curve across the desk
  const chainPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.035, -R - 0.13),
    new THREE.Vector3(0.1, 0.01, -R - 0.3),
    new THREE.Vector3(0.32, 0.008, -R - 0.36),
    new THREE.Vector3(0.5, 0.008, -R - 0.2),
    new THREE.Vector3(0.62, 0.008, -R - 0.32),
  ]);
  const chain = new THREE.Mesh(new THREE.TubeGeometry(chainPath, 80, 0.007, 6, false), gold);
  for (const m of [caseBody, bezel, dial, cap, stem, crown, bow, lid, chain]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  for (const h of [hourHand, minuteHand, secondsHand]) h.userData.keep = true;
  group.add(caseBody, bezel, dial, hourHand, minuteHand, secondsHand, cap, stem, crown, bow, lidHinge, chain);
  bake(group);
  const start = performance.now();
  return {
    object: group,
    update(now) {
      const elapsed = (now - start) / 1000;
      const secs = 6 * 3600 + 15 * 60 + elapsed; // a quarter past six, and running
      const tick = Math.floor(secs);
      // the hands turn clockwise seen from above: negative about y
      secondsHand.rotation.y = -((tick % 60) / 60) * Math.PI * 2;
      minuteHand.rotation.y = -((secs / 60) % 60 / 60) * Math.PI * 2;
      hourHand.rotation.y = -((secs / 3600) % 12 / 12) * Math.PI * 2;
    },
  };
}
