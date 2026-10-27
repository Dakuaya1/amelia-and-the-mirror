// Plants for the outdoor worlds, built in code: grass as clumps of curved blades, trees and bushes
// as a trunk and branches carrying crowns of leaf-cluster cards. Crowns are lit as volumes (each
// card's normal points out from the crown's centre), cast leaf-shaped shadows (alpha-tested depth),
// and everything sways a little in one shared wind. Instanced throughout.
//
//   grass(parent, { count, place(i) => [x, y, z] | null, colours })
//   trees(parent, list, { kind: 'oak' | 'bush' | 'scrub', seed, shadows })
//   setWind(t)  — call from a world's update(t)
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/addons/utils/BufferGeometryUtils.js';
import { rng, canvasTex } from './kit.js';

// ---- wind ---------------------------------------------------------------------------------------
const wind = { value: 0 };
export function setWind(t) { wind.value = t; }

// Sway a material's vertices with the wind: more at the top (position.y / height), phase from the
// instance's place in the world so neighbours move a little differently.
function windy(mat, height, amp) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        #else
          vec2 ip = vec2(0.0);
        #endif
        float hgt = clamp(position.y / ${height.toFixed(3)}, 0.0, 1.0);
        float sway = sin(uWind * 1.6 + ip.x * 0.31 + ip.y * 0.23) + 0.35 * sin(uWind * 3.3 + ip.x * 0.9 + position.x * 2.0);
        transformed.x += sway * ${amp.toFixed(4)} * hgt * hgt;
        transformed.z += sway * ${(amp * 0.5).toFixed(4)} * hgt * hgt;`);
    // a card seen from behind keeps its outward normal: no flip, so crowns and lawns light evenly
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'));
  };
  mat.customProgramCacheKey = () => `windy-${height}-${amp}`;
  return mat;
}

// ---- grass --------------------------------------------------------------------------------------
// One clump: five tapering blades, each bending away from the centre, dark at the root and pale at
// the tip; normals lean up so the blades take the sky's light the way a lawn does.
function clumpGeometry(seed, tall, colours) {
  const r = rng(seed), pos = [], col = [], idx = [];
  const [root, mid, tip] = colours.map((c) => new THREE.Color(c));
  const SEGS = 4;
  for (let b = 0; b < 5; b++) {
    const yaw = r() * Math.PI * 2, h = tall * (0.65 + r() * 0.5), w = 0.012 + r() * 0.01, lean = 0.12 + r() * 0.2;
    const ox = (r() - 0.5) * 0.08, oz = (r() - 0.5) * 0.08, dx = Math.cos(yaw), dz = Math.sin(yaw), px = -dz, pz = dx;
    const base = pos.length / 3;
    for (let k = 0; k <= SEGS; k++) {
      const t = k / SEGS, bend = lean * t * t, half = w * (1 - t * 0.95);
      const cx = ox + dx * bend, cy = h * t, cz = oz + dz * bend;
      pos.push(cx - px * half, cy, cz - pz * half, cx + px * half, cy, cz + pz * half);
      const c = t < 0.5 ? root.clone().lerp(mid, t * 2) : mid.clone().lerp(tip, (t - 0.5) * 2);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (k < SEGS) { const a = base + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = g.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < n.count; i++) { v.set(n.getX(i), n.getY(i), n.getZ(i)); if (v.y < 0) v.negate(); v.lerp(new THREE.Vector3(0, 1, 0), 0.65).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
  return g;
}

export function grass(parent, { count, place, tall = 0.5, colours = ['#2f3a1a', '#6f7a3a', '#b9a65c'], seed = 5 }) {
  const mat = windy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), tall, 0.06);
  const variants = [0, 1, 2].map((k) => clumpGeometry(seed * 10 + k, tall, colours));
  const r = rng(seed), o = new THREE.Object3D(), meshes = variants.map((g) => new THREE.InstancedMesh(g, mat, Math.ceil(count / 3)));
  const used = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    const p = place(i, r);
    if (!p) continue;
    const k = i % 3, m = meshes[k];
    if (used[k] >= m.count) continue;
    o.position.set(p[0], p[1], p[2]);
    o.rotation.set((r() - 0.5) * 0.25, r() * Math.PI * 2, (r() - 0.5) * 0.25);
    const s = 0.7 + r() * 0.7;
    o.scale.set(s, s * (0.8 + r() * 0.5), s);
    o.updateMatrix();
    m.setMatrixAt(used[k]++, o.matrix);
  }
  meshes.forEach((m, k) => { m.count = used[k]; m.instanceMatrix.needsUpdate = true; m.receiveShadow = true; m.frustumCulled = false; parent.add(m); });
  return meshes;
}

// ---- leaves and bark ----------------------------------------------------------------------------
const PALETTES = {
  oak: ['#24351a', '#2f4520', '#3b5526', '#4a6430', '#2a3c1c'],
  bush: ['#22331a', '#2e4422', '#3a5328', '#283a1d'],
  scrub: ['#5f5b3c', '#6e6a46', '#7d775a', '#55523a'],
};
const leafCache = new Map();
// A cluster of leaves on a transparent card: many small leaves with gaps between them.
function leafTexture(kind) {
  if (leafCache.has(kind)) return leafCache.get(kind);
  const pal = PALETTES[kind], r = rng(kind.length * 31 + 7), sparse = kind === 'scrub';
  const tex = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const n = sparse ? 70 : 150;
    for (let i = 0; i < n; i++) {
      // leaves gather towards the card's middle, thinning to ragged edges
      const a = r() * Math.PI * 2, d = Math.pow(r(), 0.6) * w * 0.46, x = w / 2 + Math.cos(a) * d, y = h / 2 + Math.sin(a) * d;
      const L = (sparse ? 7 : 11) + r() * (sparse ? 6 : 9), W = L * (sparse ? 0.32 : 0.5), rot = r() * Math.PI;
      if (sparse && r() < 0.5) { // twigs
        g.strokeStyle = 'rgba(70,58,44,0.9)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(rot) * L * 1.6, y + Math.sin(rot) * L * 1.6); g.stroke();
      }
      g.save(); g.translate(x, y); g.rotate(rot);
      g.fillStyle = pal[Math.floor(r() * pal.length)];
      g.beginPath(); g.ellipse(0, 0, L / 2, W / 2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,230,0.09)'; // a lit edge on each leaf
      g.beginPath(); g.ellipse(-L * 0.08, -W * 0.12, L * 0.38, W * 0.22, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  });
  tex.userData.shared = true; // kept across worlds
  leafCache.set(kind, tex);
  return tex;
}
let barkTex = null;
function bark() {
  if (barkTex) return barkTex;
  const r = rng(77);
  barkTex = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#3a3128'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { const x = r() * w; g.fillStyle = r() < 0.5 ? 'rgba(20,16,12,0.55)' : 'rgba(110,98,84,0.35)'; g.fillRect(x, 0, 1 + r() * 3, h); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(15,12,9,0.5)'; g.fillRect(r() * w, r() * h, 2 + r() * 8, 1 + r() * 3); }
  }, { repeat: [2, 3] });
  barkTex.wrapS = barkTex.wrapT = THREE.RepeatWrapping;
  barkTex.userData.shared = true;
  return barkTex;
}

// ---- one plant: wood and leaves as two geometries ------------------------------------------------
const SHAPES = {
  // height, trunk radius, branches, crown lobes, lobe radius, cards per lobe, card size
  oak: { height: [7, 10], trunk: 0.38, branches: [5, 7], lobes: [7, 10], lobe: [2.0, 3.0], cards: 36, card: 1.7 },
  bush: { height: [1.6, 2.6], trunk: 0.08, branches: [3, 4], lobes: [4, 6], lobe: [0.9, 1.4], cards: 26, card: 0.9 },
  scrub: { height: [0.5, 0.9], trunk: 0.03, branches: [3, 4], lobes: [2, 3], lobe: [0.35, 0.6], cards: 10, card: 0.55 },
};
function plantGeometry(kind, seed) {
  const S = SHAPES[kind], r = rng(seed), rr = (a, b) => a + (b - a) * r();
  const wood = [], leaves = [], H = rr(...S.height), up = new THREE.Vector3(0, 1, 0);
  const limb = (from, to, r0, r1) => {
    const d = new THREE.Vector3().subVectors(to, from), len = d.length();
    const g = new THREE.CylinderGeometry(r1, r0, len, 7, 3, true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d.clone().normalize()));
    g.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    wood.push(g);
  };
  const lean = new THREE.Vector3(rr(-0.4, 0.4), 0, rr(-0.4, 0.4));
  const top = new THREE.Vector3(0, H * 0.72, 0).add(lean);
  limb(new THREE.Vector3(0, -0.3, 0), top, S.trunk, S.trunk * 0.6);
  const ends = [top.clone().add(new THREE.Vector3(0, H * 0.18, 0))];
  const nb = Math.round(rr(...S.branches));
  for (let b = 0; b < nb; b++) {
    const a = (b / nb) * Math.PI * 2 + rr(-0.4, 0.4), el = rr(0.35, 0.9), len = H * rr(0.28, 0.42);
    const from = new THREE.Vector3(0, H * rr(0.42, 0.68), 0).add(lean.clone().multiplyScalar(0.6));
    const to = from.clone().add(new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)).multiplyScalar(len));
    limb(from, to, S.trunk * 0.45, S.trunk * 0.18);
    ends.push(to);
  }
  // the crown: lobes round the branch ends, each filled with crossed leaf cards
  const crownC = ends.reduce((acc, e) => acc.add(e), new THREE.Vector3()).multiplyScalar(1 / ends.length);
  const nl = Math.round(rr(...S.lobes));
  const card = (c, n, size, rot) => { // two crossed quads at c, lit as if part of the crown's volume
    for (const q of [0, Math.PI / 2]) {
      const g = new THREE.PlaneGeometry(size, size);
      g.rotateY(q); g.applyQuaternion(rot); g.translate(c.x, c.y, c.z);
      const nn = g.attributes.normal;
      for (let i = 0; i < nn.count; i++) nn.setXYZ(i, n.x, n.y, n.z);
      leaves.push(g);
    }
  };
  for (let l = 0; l < nl; l++) {
    const e = ends[l % ends.length], R = rr(...S.lobe);
    const c = e.clone().add(new THREE.Vector3(rr(-0.5, 0.5), rr(-0.2, 0.5), rr(-0.5, 0.5)).multiplyScalar(R));
    for (let k = 0; k < S.cards; k++) {
      const dir = new THREE.Vector3(rr(-1, 1), rr(-0.7, 1), rr(-1, 1)).normalize(), d = R * Math.pow(r(), 0.35);
      const p = c.clone().addScaledVector(dir, d);
      const n = p.clone().sub(crownC).normalize().lerp(up, 0.25).normalize();
      const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(rr(-0.6, 0.6), r() * Math.PI, rr(-0.6, 0.6)));
      card(p, n, S.card * rr(0.75, 1.25), rot);
    }
  }
  return { wood: mergeGeometries(wood), leaves: mergeGeometries(leaves), height: H * 1.2 };
}

/**
 * Plants at the given places. list: [[x, y, z, scale?, ry?], ...]. Three shapes of each kind are
 * grown from the seed and shared out among the places; each instance gets a slightly different green.
 */
export function trees(parent, list, { kind = 'oak', seed = 1, shadows = true, tint = 0.12 } = {}) {
  const r = rng(seed), V = 3, shapes = [0, 1, 2].map((k) => plantGeometry(kind, seed * 13 + k));
  const leafTex = leafTexture(kind);
  const height = Math.max(...shapes.map((s) => s.height));
  const leafMat = windy(new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 }), height, kind === 'oak' ? 0.12 : 0.05);
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leafTex, alphaTest: 0.45 });
  const woodMat = new THREE.MeshStandardMaterial({ map: bark(), roughness: 0.95 });
  const groups = shapes.map(() => []);
  list.forEach((p, i) => groups[i % V].push(p));
  const o = new THREE.Object3D(), c = new THREE.Color(), out = [];
  shapes.forEach((sh, k) => {
    const items = groups[k];
    if (!items.length) return;
    const wood = new THREE.InstancedMesh(sh.wood, woodMat, items.length);
    const leaves = new THREE.InstancedMesh(sh.leaves, leafMat, items.length);
    items.forEach(([x, y, z, s = 1, ry = r() * Math.PI * 2], i) => {
      o.position.set(x, y, z); o.rotation.set(0, ry, 0); o.scale.setScalar(s); o.updateMatrix();
      wood.setMatrixAt(i, o.matrix); leaves.setMatrixAt(i, o.matrix);
      // a little variety from plant to plant: brightness, and a faint shift in hue
      c.setRGB(1 + (r() - 0.5) * 0.08, 1 + (r() - 0.5) * 0.08, 1 + (r() - 0.5) * 0.08).multiplyScalar(1 + (r() - 0.5) * tint * 2);
      leaves.setColorAt(i, c);
    });
    leaves.customDepthMaterial = depth;
    for (const m of [wood, leaves]) { m.castShadow = shadows; m.receiveShadow = true; m.instanceMatrix.needsUpdate = true; parent.add(m); out.push(m); }
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  });
  return out;
}
