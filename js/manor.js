// Forefore Manor, where the story starts and ends. Built from the book's own
// description: "grey stone under blackened slate, ivy loosening from the eastern
// wall", "broad rather than graceful", nine chimneys of which only four go
// anywhere, a formal garden of "clipped hedges, pale gravel, stone urns placed at
// mathematical intervals", a gate, a weak porch lamp, and a bird on the gable
// above the end of the east wing. Night and rain for the arrival; dawn for the end.
import * as THREE from 'three';
import { pbr, sky as hdrSky, skyEnv } from './assets.js';
import { RoundedBoxGeometry } from '../vendor/addons/RoundedBoxGeometry.js';
import { mergeVertices } from '../vendor/addons/utils/BufferGeometryUtils.js';
import { trees as floraTrees, setWind } from './worlds/flora.js';

function rng(seed = 1) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
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

// UVs from the vertex position on each face's plane, so one texture tiles at the
// same real-world scale across walls of any size.
function worldUV(geo, scale) {
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

// ---- textures -----------------------------------------------------------------


// A clipped hedge's surface: small dense leaves as colour, and the same leaves as a normal map,
// so the clipped faces catch the light leaf by leaf. Tiles seamlessly (leaves wrap at the edges).
function hedgeTextures() {
  const S = 512, r = rng(23), pal = ['#10200f', '#173018', '#1e3a1d', '#26452a', '#2d4f2c', '#132611'];
  const colour = document.createElement('canvas'), bump = document.createElement('canvas');
  colour.width = colour.height = bump.width = bump.height = S;
  const g = colour.getContext('2d'), b = bump.getContext('2d');
  g.fillStyle = '#0b160b'; g.fillRect(0, 0, S, S);
  b.fillStyle = '#000'; b.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const x = r() * S, y = r() * S, L = 9 + r() * 9, W = L * (0.45 + r() * 0.2), rot = r() * Math.PI, c = pal[Math.floor(r() * pal.length)];
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
      const X = x + dx, Y = y + dy;
      if (X < -L || X > S + L || Y < -L || Y > S + L) continue;
      g.save(); g.translate(X, Y); g.rotate(rot); g.fillStyle = c; g.beginPath(); g.ellipse(0, 0, L / 2, W / 2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(190,220,150,0.08)'; g.beginPath(); g.ellipse(-L * 0.1, -W * 0.15, L * 0.3, W * 0.18, 0, 0, Math.PI * 2); g.fill(); g.restore();
      const grad = b.createRadialGradient(X, Y, 0, X, Y, L / 2);
      grad.addColorStop(0, '#fff'); grad.addColorStop(1, '#555');
      b.save(); b.translate(X, Y); b.rotate(rot); b.scale(1, W / L); b.translate(-X, -Y); b.fillStyle = grad; b.beginPath(); b.arc(X, Y, L / 2, 0, Math.PI * 2); b.fill(); b.restore();
    }
  }
  const hd = b.getImageData(0, 0, S, S).data, nm = b.createImageData(S, S), d = nm.data, H = (x, y) => hd[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * 2.2, dy = (H(x, y + 1) - H(x, y - 1)) * 2.2, l = Math.hypot(dx, dy, 1), k = (y * S + x) * 4;
    d[k] = (-dx / l * 0.5 + 0.5) * 255; d[k + 1] = (dy / l * 0.5 + 0.5) * 255; d[k + 2] = (1 / l * 0.5 + 0.5) * 255; d[k + 3] = 255;
  }
  b.putImageData(nm, 0, 0);
  const map = new THREE.CanvasTexture(colour), normalMap = new THREE.CanvasTexture(bump);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, normalMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.5, 1.5); t.anisotropy = 8; }
  return { map, normalMap };
}

// A clipped hedge: a box with softened edges, its faces gently lumpy where the shears went.
function hedgeGeometry() {
  const g = mergeVertices(new RoundedBoxGeometry(1.0, 1.15, 4.6, 2, 0.1).translate(0, 0.575, 0));
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const lump = 0.018 * (Math.sin(x * 3.1 + z * 1.7) + Math.sin(y * 2.3 + z * 4.1) + 0.6 * Math.sin(z * 7.3 + x * 5.2)) * (y > 0.05 ? 1 : 0);
    p.setXYZ(i, x + n.getX(i) * lump, y + n.getY(i) * lump, z + n.getZ(i) * lump);
  }
  g.computeVertexNormals();
  return g;
}

// A sash window: dark frame, 6-over-6 panes. Lit windows glow with curtains drawn back.
function windowTexture(kind) {
  return canvasTex(128, 224, (g, w, h) => {
    g.fillStyle = '#16110c';
    g.fillRect(0, 0, w, h);
    const m = 9;
    const bar = 5;
    const paneW = (w - 2 * m - bar) / 2;
    const sashH = (h - 2 * m - bar * 2) / 2;
    for (let s = 0; s < 2; s++) {
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 2; col++) {
          const x = m + col * (paneW + bar);
          const ph = (sashH - bar * 2) / 3;
          const y = m + s * (sashH + bar * 2) + row * (ph + bar);
          let grad;
          if (kind === 'dark') {
            grad = g.createLinearGradient(x, y, x + paneW, y + ph);
            grad.addColorStop(0, '#2a3a52');
            grad.addColorStop(0.5, '#0d1420');
            grad.addColorStop(1, '#141d2c');
          } else {
            const c = { lit: ['#ffe2a8', '#e0913e'], dim: ['#e0a560', '#7a461f'], blue: ['#bfe3ff', '#2f6aa8'] }[kind];
            grad = g.createRadialGradient(w / 2, h * 0.55, 10, w / 2, h * 0.55, h * 0.7);
            grad.addColorStop(0, c[0]);
            grad.addColorStop(1, c[1]);
          }
          g.fillStyle = grad;
          g.fillRect(x, y, paneW, ph);
        }
      }
    }
    if (kind !== 'dark') {
      // curtains drawn back at either side
      g.fillStyle = kind === 'blue' ? 'rgba(10,30,60,0.55)' : 'rgba(70,25,10,0.55)';
      g.fillRect(m, m, w * 0.14, h - 2 * m);
      g.fillRect(w - m - w * 0.14, m, w * 0.14, h - 2 * m);
    }
  });
}

function doorTexture() {
  return canvasTex(128, 224, (g, w, h) => {
    const r = rng(17);
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = `hsl(25, 35%, ${12 + r() * 6}%)`;
      g.fillRect(x, 0, 15, h);
    }
    g.fillStyle = '#0b0b0d';
    for (const y of [36, 112, 188]) g.fillRect(6, y, w - 12, 8); // iron straps
    g.fillStyle = '#c9a25a';
    g.beginPath();
    g.arc(w - 26, h * 0.55, 5, 0, Math.PI * 2);
    g.fill();
  });
}

function ivyTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rng(29);
    for (let i = 0; i < 2600; i++) {
      // denser low down and to the east, thinning upward
      const y = h - Math.pow(r(), 1.6) * h;
      const x = Math.pow(r(), 0.7) * w;
      g.save();
      g.translate(x, y);
      g.rotate(r() * Math.PI * 2);
      g.fillStyle = `hsl(${95 + r() * 30}, ${25 + r() * 20}%, ${8 + r() * 12}%)`;
      g.beginPath();
      g.ellipse(0, 0, 4 + r() * 5, 3 + r() * 3, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  });
}

function softDot(inner, outer) {
  return canvasTex(128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, outer);
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  });
}

function cloudTexture(seed) {
  return canvasTex(256, 128, (g, w, h) => {
    const r = rng(seed);
    for (let i = 0; i < 60; i++) {
      const x = w * (0.15 + r() * 0.7);
      const y = h * (0.35 + r() * 0.35);
      const rad = 18 + r() * 40;
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, 'rgba(255,255,255,0.22)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });
}

// ---- the manor ------------------------------------------------------------------
export function buildManor(renderer) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 900);
  const r = rng(61);

  const mats = {
    // Photographed surfaces (Poly Haven, CC0). Walls use world UVs at 4 m per unit.
    stone: pbr('castle_wall_slates', { repeat: [1.6, 1.6] }),
    trim: pbr('castle_wall_slates', { repeat: [2.4, 2.4], color: 0xd8d2c4 }),
    slate: pbr('roof_slates_02', { repeat: [1.4, 1.4], color: 0x9aa0aa }),
    lawn: pbr('leafy_grass', { repeat: [160, 160], color: 0x8a9a80 }),
    gravel: pbr('gravelly_sand', { repeat: [3, 30], color: 0xb0aaa0, roughness: 0.75 }),
    hedge: new THREE.MeshStandardMaterial({ ...hedgeTextures(), normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.85 }),
    pot: new THREE.MeshStandardMaterial({ color: 0x4a2a1c, roughness: 0.9 }),
    door: new THREE.MeshStandardMaterial({ map: doorTexture(), roughness: 0.7 }),
    bird: new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.6 }),
    ivy: new THREE.MeshStandardMaterial({ map: ivyTexture(), alphaTest: 0.5, roughness: 0.85, side: THREE.DoubleSide }),
  };
  const winMat = (kind, intensity) =>
    new THREE.MeshStandardMaterial(
      kind === 'dark'
        ? { map: windowTexture('dark'), roughness: 0.15, metalness: 0.4 }
        : { map: windowTexture(kind), emissiveMap: windowTexture(kind), emissive: 0xffffff, emissiveIntensity: intensity, roughness: 0.3 },
    );
  const windowsMats = {
    dark: winMat('dark'),
    lit: winMat('lit', 2.4),
    dim: winMat('dim', 1.4),
    blue: winMat('blue', 1.6),
    study: winMat('lit', 3.4),
  };

  const house = new THREE.Group();
  scene.add(house);
  const add = (mesh, cast = true, receive = true) => {
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    house.add(mesh);
    return mesh;
  };

  // Walls: centre block, a gable-fronted west wing, and the longer east wing.
  const block = (x0, x1, z0, z1, h) => {
    const geo = new THREE.BoxGeometry(x1 - x0, h, z1 - z0).translate(0, h / 2, 0);
    const mesh = new THREE.Mesh(worldUV(geo, 4), mats.stone);
    mesh.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    return add(mesh);
  };
  block(-5, 5, -3, 3, 7.5); // centre, three storeys
  block(-10, -5, -4, 4, 6.5); // west wing
  block(5, 13, -4, 4, 6.5); // east wing: longer by the eleven feet nobody can find

  // Pitched slate roofs; the stone gable ends come from the extrusion caps.
  const roof = (cx, cz, length, span, rise, y0, alongX) => {
    const over = 0.45;
    const shape = new THREE.Shape();
    shape.moveTo(-span / 2 - over, 0);
    shape.lineTo(span / 2 + over, 0);
    shape.lineTo(0, rise);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
    geo.translate(0, 0, -length / 2);
    if (alongX) geo.rotateY(Math.PI / 2);
    geo.computeVertexNormals();
    worldUV(geo, 2.4);
    const mesh = new THREE.Mesh(geo, [mats.stone, mats.slate]);
    mesh.position.set(cx, y0, cz);
    return add(mesh);
  };
  roof(0, 0, 10.2, 6, 2.6, 7.5, true);
  roof(-7.5, 0, 8.2, 5, 2.2, 6.5, false);
  roof(9, 0, 8.2, 8, 2.2, 6.5, true);

  // Nine chimneys. Only four of them smoke.
  const chimneys = [
    [-3.8, -0.8, 7.5, 10.1, true],
    [-1.2, 0.8, 7.5, 10.1, false],
    [1.2, -0.8, 7.5, 10.1, true],
    [3.8, 0.8, 7.5, 10.1, false],
    [-7.5, -2.5, 6.5, 8.7, true],
    [-7.5, 2.0, 6.5, 8.7, false],
    [7.0, 0.6, 6.5, 8.7, false],
    [9.6, -0.6, 6.5, 8.7, true],
    [12.2, 0.6, 6.5, 8.7, false],
  ];
  const smokeSources = [];
  for (const [x, z, y0, ridge, smokes] of chimneys) {
    const h = ridge + 1.3 - y0;
    const geo = new THREE.BoxGeometry(0.75, h, 0.95).translate(0, h / 2, 0);
    const stack = new THREE.Mesh(worldUV(geo, 4), mats.stone);
    stack.position.set(x, y0, z);
    add(stack);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 1.15), mats.trim);
    cap.position.set(x, y0 + h, z);
    add(cap);
    for (const dz of [-0.22, 0.22]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.42, 12), mats.pot);
      pot.position.set(x, y0 + h + 0.28, z + dz);
      add(pot);
    }
    if (smokes) smokeSources.push(new THREE.Vector3(x, y0 + h + 0.5, z));
  }

  // Windows, with stone sills and lintels. The study is the lit window the
  // camera flies into; one east-wing window holds a faint blue light.
  const STUDY = new THREE.Vector3(10, 4.55, 4.04);
  const windows = [
    // centre block, ground and first floor (the door takes the middle of the ground floor)
    ...[-3.6, -1.8, 1.8, 3.6].map((x, i) => [x, 1.75, 3.03, ['dark', 'lit', 'dark', 'dim'][i]]),
    ...[-3.6, -1.8, 0, 1.8, 3.6].map((x, i) => [x, 4.6, 3.03, ['dark', 'dark', 'dim', 'dark', 'lit'][i]]),
    // centre block, second floor: smaller windows
    ...[-3.6, -1.8, 0, 1.8, 3.6].map((x) => [x, 6.6, 3.03, 'dark', 0.65]),
    // west wing
    ...[-8.6, -6.4].map((x, i) => [x, 1.75, 4.03, ['dim', 'dark'][i]]),
    ...[-8.6, -6.4].map((x) => [x, 4.55, 4.03, 'dark']),
    // east wing
    ...[6.4, 8.2, 10, 11.8].map((x, i) => [x, 1.75, 4.03, ['dark', 'lit', 'dark', 'dark'][i]]),
    ...[6.4, 8.2, 10, 11.8].map((x, i) => [x, 4.55, 4.03, ['dark', 'dark', 'study', 'blue'][i]]),
  ];
  const sillGeo = worldUV(new THREE.BoxGeometry(1.3, 0.13, 0.22), 4);
  const lintelGeo = worldUV(new THREE.BoxGeometry(1.36, 0.2, 0.14), 4);
  const sills = new THREE.InstancedMesh(sillGeo, mats.trim, windows.length);
  const lintels = new THREE.InstancedMesh(lintelGeo, mats.trim, windows.length);
  const o = new THREE.Object3D();
  windows.forEach(([x, y, z, kind, scale = 1], i) => {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.0 * scale, 1.75 * scale), windowsMats[kind]);
    pane.position.set(x, y, z);
    pane.receiveShadow = kind === 'dark';
    house.add(pane);
    o.position.set(x, y - 0.95 * scale, z + 0.08);
    o.scale.set(scale, 1, 1);
    o.updateMatrix();
    sills.setMatrixAt(i, o.matrix);
    o.position.set(x, y + 0.97 * scale, z + 0.05);
    o.updateMatrix();
    lintels.setMatrixAt(i, o.matrix);
  });
  add(sills);
  add(lintels);
  // An attic window in the west wing's gable.
  const attic = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), windowsMats.dark);
  attic.position.set(-7.5, 7.5, 4.03);
  house.add(attic);

  // Warm light spilling from the lit windows onto the gravel.
  for (const [x, y, z, k] of [[10, 4.55, 5.2, 7], [8.2, 1.75, 5.2, 4], [-1.8, 1.75, 4.2, 4], [3.6, 4.6, 4.2, 3]]) {
    const light = new THREE.PointLight(0xffb469, k, 9, 2);
    light.position.set(x, y, z);
    scene.add(light);
  }

  // Porch: columns, entablature, a small pediment, an oak door, a weak lamp.
  for (const x of [-1.05, 1.05]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 3.0, 20), mats.trim);
    col.position.set(x, 1.5, 3.85);
    add(col);
  }
  const ent = new THREE.Mesh(worldUV(new THREE.BoxGeometry(2.8, 0.38, 1.25), 4), mats.trim);
  ent.position.set(0, 3.19, 3.55);
  add(ent);
  {
    const shape = new THREE.Shape();
    shape.moveTo(-1.55, 0);
    shape.lineTo(1.55, 0);
    shape.lineTo(0, 0.75);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false }).translate(0, 0, -0.6);
    geo.computeVertexNormals();
    const ped = new THREE.Mesh(worldUV(geo, 4), mats.trim);
    ped.position.set(0, 3.38, 3.55);
    add(ped);
  }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 2.6), mats.door);
  door.position.set(0, 1.3, 3.02);
  house.add(door);
  const fanlight = new THREE.Mesh(new THREE.CircleGeometry(0.72, 32, 0, Math.PI), windowsMats.dim);
  fanlight.position.set(0, 2.62, 3.02);
  house.add(fanlight);
  [3.4, 3.0, 2.6].forEach((w, i) => {
    const step = new THREE.Mesh(worldUV(new THREE.BoxGeometry(w, 0.16, 0.42), 4), mats.trim);
    step.position.set(0, 0.08 + i * 0.16, 4.65 - i * 0.38);
    add(step);
  });
  const porchLamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xffe0a8, emissive: 0xffc070, emissiveIntensity: 3 }),
  );
  porchLamp.position.set(0, 2.85, 3.7);
  house.add(porchLamp);
  const porchLight = new THREE.PointLight(0xffb060, 3, 7, 2);
  porchLight.position.set(0, 2.7, 4.2);
  scene.add(porchLight);

  // Ivy, loosening from the eastern wall.
  // Only the far east corner of the front: the study window stays clear.
  const ivyFront = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 6.2), mats.ivy);
  ivyFront.position.set(12.15, 3.1, 4.06);
  house.add(ivyFront);
  const ivyEast = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 6.2), mats.ivy);
  ivyEast.rotation.y = Math.PI / 2;
  ivyEast.position.set(13.06, 3.1, 0.2);
  house.add(ivyEast);

  // The bird on the gable above the end of the east wing.
  const bird = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), mats.bird);
  body.scale.set(1.5, 0.9, 0.9);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), mats.bird);
  head.position.set(0.24, 0.1, 0);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 8), mats.bird);
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.37, 0.09, 0);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.12), mats.bird);
  tail.position.set(-0.3, -0.02, 0);
  tail.rotation.z = 0.25;
  bird.add(body, head, beak, tail);
  bird.position.set(13.0, 8.85, 0);
  bird.rotation.y = -0.6;
  house.add(bird);

  // ---- grounds ----
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), mats.lawn);
  lawn.rotation.x = -Math.PI / 2;
  lawn.receiveShadow = true;
  scene.add(lawn);
  const forecourt = new THREE.Mesh(new THREE.CircleGeometry(7.5, 64), pbr('gravelly_sand', { repeat: [9, 9], color: 0xb0aaa0, roughness: 0.75 }));
  forecourt.rotation.x = -Math.PI / 2;
  forecourt.position.set(0, 0.02, 10);
  forecourt.receiveShadow = true;
  scene.add(forecourt);
  const drive = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 46), mats.gravel);
  drive.rotation.x = -Math.PI / 2;
  drive.position.set(0, 0.015, 37);
  drive.receiveShadow = true;
  scene.add(drive);

  // Clipped hedges down both sides of the drive, broken by urns at mathematical intervals.
  const URN_Z = [15, 20, 25, 30, 35];
  const hedgeGeo = worldUV(hedgeGeometry(), 2);
  const hedges = new THREE.InstancedMesh(hedgeGeo, mats.hedge, (URN_Z.length - 1) * 2);
  let hi = 0;
  for (let i = 0; i < URN_Z.length - 1; i++) {
    for (const x of [-3.4, 3.4]) {
      o.position.set(x, 0, (URN_Z[i] + URN_Z[i + 1]) / 2);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      hedges.setMatrixAt(hi++, o.matrix);
    }
  }
  hedges.castShadow = true;
  hedges.receiveShadow = true;
  scene.add(hedges);
  const urnProfile = [
    [0, 0], [0.22, 0], [0.24, 0.06], [0.14, 0.12], [0.12, 0.3], [0.3, 0.5], [0.36, 0.72], [0.3, 0.86], [0.36, 0.9], [0.36, 0.96], [0, 0.96],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const urnGeo = new THREE.LatheGeometry(urnProfile, 24);
  const plinthGeo = worldUV(new THREE.BoxGeometry(0.62, 0.9, 0.62).translate(0, 0.45, 0), 4);
  const urns = new THREE.InstancedMesh(urnGeo, mats.trim, URN_Z.length * 2);
  const plinths = new THREE.InstancedMesh(plinthGeo, mats.trim, URN_Z.length * 2);
  let ui = 0;
  for (const z of URN_Z) {
    for (const x of [-3.4, 3.4]) {
      o.position.set(x, 0, z);
      o.updateMatrix();
      plinths.setMatrixAt(ui, o.matrix);
      o.position.set(x, 0.9, z);
      o.scale.set(1.2, 1.2, 1.2);
      o.updateMatrix();
      urns.setMatrixAt(ui++, o.matrix);
      o.scale.set(1, 1, 1);
    }
  }
  for (const m of [urns, plinths]) {
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }

  // The gate, with ball-topped pillars, and a low boundary wall.
  for (const x of [-2.8, 2.8]) {
    const pillar = new THREE.Mesh(worldUV(new THREE.BoxGeometry(0.75, 2.9, 0.75).translate(0, 1.45, 0), 4), mats.trim);
    pillar.position.set(x, 0, 52);
    pillar.castShadow = true;
    scene.add(pillar);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), mats.trim);
    ball.position.set(x, 3.25, 52);
    scene.add(ball);
  }
  for (const [x0, x1] of [[-40, -3.2], [3.2, 40]]) {
    const wallGeo = worldUV(new THREE.BoxGeometry(x1 - x0, 1.1, 0.5).translate(0, 0.55, 0), 4);
    const wall = new THREE.Mesh(wallGeo, mats.stone);
    wall.position.set((x0 + x1) / 2, 0, 52);
    wall.receiveShadow = true;
    scene.add(wall);
  }

  // Oaks around the house: trunks and clustered crowns, all instanced.
  const TREES = [
    [-17, -6, 1.2], [-22, 6, 1.0], [-27, -15, 1.3], [-12, -14, 1.1], [-4, -19, 1.25], [6, -20, 1.2],
    [16, -16, 1.3], [20, -6, 1.1], [25, 6, 1.0], [30, -18, 1.4], [-14, 22, 1.15], [15, 26, 1.05], [-30, 30, 1.3], [33, 34, 1.2],
  ];
  // the same oaks as the chapter worlds: trunk, branches and leafy crowns, moving in the wind
  floraTrees(scene, TREES.map(([x, z, s]) => [x, 0, z, s * 1.05]), { kind: 'oak', seed: 7 });

  // ---- sky, moon, stars, clouds ----
  const SKY = {
    nightTop: new THREE.Color('#050913'),
    nightHorizon: new THREE.Color('#1f2a40'),
    dawnTop: new THREE.Color('#33476d'),
    dawnHorizon: new THREE.Color('#e7a77b'),
    fogNight: new THREE.Color('#141c2a'),
    fogDawn: new THREE.Color('#9b98a4'),
  };
  // Low in the sky, to the right, above the east wing in the opening frame.
  const moonDir = new THREE.Vector3(0.42, 0.26, -0.87).normalize();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: SKY.nightTop.clone() },
      horizon: { value: SKY.nightHorizon.clone() },
      moonDir: { value: moonDir },
      glow: { value: new THREE.Color('#5c6f96') },
      dawn: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * p;
      }`,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 moonDir;
      uniform vec3 glow;
      uniform float dawn;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(horizon, top, pow(h, 0.45));
        float m = max(dot(normalize(vDir), moonDir), 0.0);
        col += glow * pow(m, 18.0) * 0.55 * (1.0 - dawn);
        // a warm band low in the east at dawn
        float east = max(dot(normalize(vec3(vDir.x, 0.0, vDir.z)), normalize(vec3(1.0, 0.0, -0.35))), 0.0);
        col += vec3(1.0, 0.55, 0.3) * dawn * pow(1.0 - h, 6.0) * pow(east, 2.0) * 0.6;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 48, 24), skyMat);
  scene.add(sky);

  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot('rgba(190,205,240,0.55)', 'rgba(190,205,240,0)'), fog: false, depthWrite: false, transparent: true }));
  moonGlow.scale.set(90, 90, 1);
  moonGlow.position.copy(moonDir).multiplyScalar(400);
  scene.add(moonGlow);
  const moonMat = new THREE.SpriteMaterial({ map: softDot('rgba(255,252,240,1)', 'rgba(255,252,240,0)'), fog: false, depthWrite: false, transparent: true });
  moonMat.color.setScalar(3); // bright enough to bloom
  const moon = new THREE.Sprite(moonMat);
  moon.scale.set(16, 16, 1);
  moon.position.copy(moonDir).multiplyScalar(399);
  scene.add(moon);

  const starPos = new Float32Array(1200 * 3);
  for (let i = 0; i < 1200; i++) {
    const a = r() * Math.PI * 2;
    const y = 0.08 + r() * 0.92;
    const rad = Math.sqrt(1 - y * y);
    starPos.set([Math.cos(a) * rad * 430, y * 430, Math.sin(a) * rad * 430], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.8, fog: false, depthWrite: false }));
  scene.add(stars);

  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const mat = new THREE.SpriteMaterial({ map: cloudTexture(70 + i), color: 0x8a96b0, transparent: true, opacity: 0.55, fog: false, depthWrite: false });
    const c = new THREE.Sprite(mat);
    const a = -2.4 + (i / 9) * 2.6;
    const el = 0.12 + r() * 0.18;
    c.position.set(Math.cos(a) * 330, el * 330, Math.sin(a) * 330 - 60);
    c.scale.set(220 + r() * 120, 90 + r() * 40, 1);
    c.userData.speed = 0.6 + r() * 0.8;
    scene.add(c);
    clouds.push(c);
  }

  // ---- weather and smoke ----
  scene.fog = new THREE.FogExp2(SKY.fogNight.clone(), 0.013);

  const DROPS = 1800;
  const rainPos = new Float32Array(DROPS * 6);
  const rainSeed = new Float32Array(DROPS * 3);
  for (let i = 0; i < DROPS; i++) {
    rainSeed.set([r() * 50 - 25, r() * 22, r() * 50 - 25], i * 3);
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0xa9b8d0, transparent: true, opacity: 0.3, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  scene.add(rain);

  const smokeTex = softDot('rgba(180,185,195,0.55)', 'rgba(180,185,195,0)');
  const puffs = [];
  smokeSources.forEach((src, si) => {
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 });
      const s = new THREE.Sprite(mat);
      s.userData = { src, phase: i / 14 + si * 0.13 };
      scene.add(s);
      puffs.push(s);
    }
  });

  // ---- light ----
  const hemi = new THREE.HemisphereLight(0x3b4a6a, 0x0b120b, 0.55);
  scene.add(hemi);
  // Moonlight, raking across the front so the stone reads; it casts the house's shadow.
  const moonLight = new THREE.DirectionalLight(0x9fb2da, 0.9);
  moonLight.position.set(-24, 30, 26);
  moonLight.target.position.set(2, 0, 4);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  const sc = moonLight.shadow.camera;
  sc.left = -34;
  sc.right = 34;
  sc.top = 30;
  sc.bottom = -30;
  sc.near = 1;
  sc.far = 120;
  moonLight.shadow.bias = -0.0006;
  moonLight.shadow.normalBias = 0.04;
  scene.add(moonLight, moonLight.target);

  // ---- camera paths ----
  // Arrival: from the gate, up the drive, rising to the lit study window.
  const arrival = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-7, 3.4, 42),
    new THREE.Vector3(-3, 3.1, 30),
    new THREE.Vector3(2.5, 3.2, 18),
    new THREE.Vector3(7.6, 4.0, 8.5),
    new THREE.Vector3(9.8, 4.5, 5.9),
    new THREE.Vector3(STUDY.x, STUDY.y, STUDY.z + 0.75),
  ]);
  // Return at dawn: back out of the window and away down the lawn.
  const departure = new THREE.CatmullRomCurve3([
    new THREE.Vector3(STUDY.x, STUDY.y, STUDY.z + 0.75),
    new THREE.Vector3(9.4, 4.8, 9),
    new THREE.Vector3(5, 6, 22),
    new THREE.Vector3(-1.5, 6.6, 34),
    new THREE.Vector3(-6, 7.2, 44),
  ]);
  const HERO_LOOK = new THREE.Vector3(3.2, 4.8, 0);
  const STUDY_LOOK = STUDY.clone();
  const END_LOOK = new THREE.Vector3(2, 4.2, 0);
  const look = new THREE.Vector3();

  const HEMI_NIGHT = new THREE.Color(0x3b4a6a);
  const HEMI_DAWN = new THREE.Color(0xc9b3a3);
  const MOON_NIGHT = new THREE.Color(0x9fb2da);
  const MOON_DAWN = new THREE.Color(0xffc79a);
  const CLOUD_NIGHT = new THREE.Color(0x8a96b0);
  const CLOUD_DAWN = new THREE.Color(0xe9b9a2);
  let dawn = -1;
  const setDawn = (d) => {
    if (d === dawn) return;
    dawn = d;
    skyMat.uniforms.top.value.copy(SKY.nightTop).lerp(SKY.dawnTop, d);
    skyMat.uniforms.horizon.value.copy(SKY.nightHorizon).lerp(SKY.dawnHorizon, d);
    skyMat.uniforms.dawn.value = d;
    scene.fog.color.copy(SKY.fogNight).lerp(SKY.fogDawn, d);
    stars.material.opacity = 0.8 * (1 - d);
    moon.material.opacity = 1 - d * 0.85;
    moonGlow.material.opacity = 1 - d;
    rainMat.opacity = 0.3 * (1 - smoothstep(0, 0.6, d));
    scene.fog.density = 0.013 - 0.004 * d;
    hemi.color.copy(HEMI_NIGHT).lerp(HEMI_DAWN, d);
    hemi.intensity = 0.55 + d * 0.9;
    // the moonlit night's light until dawn is well up, then a real misty dawn's (Poly Haven)
    const dawnEnv = renderer ? skyEnv(renderer, 'misty_dawn') : null;
    const nightEnv = renderer ? skyEnv(renderer, 'moonlit_golf') : null;
    if (dawnEnv && d > 0.4) scene.environment = dawnEnv;
    else if (nightEnv) scene.environment = nightEnv;
    scene.environmentIntensity = d > 0.4 && dawnEnv ? 0.5 + d * 0.9 : 0.6 + d * 1.2;
    moonLight.color.copy(MOON_NIGHT).lerp(MOON_DAWN, d);
    moonLight.intensity = 0.9 + d * 0.9;
    for (const c of clouds) c.material.color.copy(CLOUD_NIGHT).lerp(CLOUD_DAWN, d);
  };
  setDawn(0);
  // A real moonlit sky lights the stone softly from every direction (the hand-made
  // dome and moon stay as the visible sky).
  if (renderer) hdrSky(scene, renderer, 'moonlit_golf', { background: false, envIntensity: 0.6 }).then(() => { const d = dawn; dawn = -1; setDawn(Math.max(0, d)); });

  return {
    scene,
    camera,
    /**
     * Place the camera. shot 'arrive': q runs gate -> study window.
     * shot 'depart': q runs study window -> far end of the lawn, at dawn.
     */
    shot(kind, q, W, H) {
      const wide = W > 860;
      if (kind === 'arrive') {
        const e = q * q * (3 - 2 * q); // even pace up the drive
        camera.position.copy(arrival.getPointAt(e));
        look.copy(HERO_LOOK).lerp(STUDY_LOOK, smoothstep(0.25, 0.92, q));
        // Hold the hero composition at first: house to the right on wide screens,
        // high in the frame on phones, so the title has room.
        const hold = 1 - smoothstep(0.02, 0.32, q);
        // Portrait screens see a narrow slice: stand further back for the opening frame.
        if (!wide) camera.position.sub(look).multiplyScalar(1 + 0.3 * hold).add(look);
        camera.setViewOffset(W, H, wide ? -W * 0.17 * hold : 0, wide ? 0 : H * 0.2 * hold, W, H);
      } else {
        const e = q * q * (3 - 2 * q);
        camera.position.copy(departure.getPointAt(e));
        look.copy(STUDY_LOOK).lerp(END_LOOK, smoothstep(0.05, 0.6, q));
        camera.setViewOffset(W, H, 0, wide ? 0 : -H * 0.08 * e, W, H);
      }
      camera.fov = wide ? 32 : 42;
      camera.aspect = W / H;
      camera.lookAt(look);
      camera.updateProjectionMatrix();
    },
    setDawn,
    update(t, dt) {
      setWind(t);
      // rain falls around the camera
      const cx = camera.position.x;
      const cz = camera.position.z;
      for (let i = 0; i < DROPS; i++) {
        let y = rainSeed[i * 3 + 1] - dt * 16;
        if (y < 0) y += 22;
        rainSeed[i * 3 + 1] = y;
        const x = cx + rainSeed[i * 3];
        const z = cz + rainSeed[i * 3 + 2];
        const j = i * 6;
        rainPos[j] = x;
        rainPos[j + 1] = y;
        rainPos[j + 2] = z;
        rainPos[j + 3] = x - 0.04;
        rainPos[j + 4] = y + 0.5;
        rainPos[j + 5] = z;
      }
      rainGeo.attributes.position.needsUpdate = true;
      // chimney smoke, flattened eastward by the wind
      for (const p of puffs) {
        const age = (t * 0.12 + p.userData.phase) % 1;
        const src = p.userData.src;
        p.position.set(src.x + age * 3.2, src.y + age * 2.2, src.z - age * 0.6);
        const s = 0.9 + age * 3.4;
        p.scale.set(s, s, 1);
        p.material.opacity = Math.sin(age * Math.PI) * 0.4 * (1 - dawn * 0.5);
      }
      for (const c of clouds) c.position.x += dt * c.userData.speed;
      // the bird shifts on the gable now and then
      bird.rotation.y = -0.6 + Math.sin(t * 0.7) * 0.15 * (Math.sin(t * 0.23) > 0.6 ? 1 : 0);
    },
  };
}
