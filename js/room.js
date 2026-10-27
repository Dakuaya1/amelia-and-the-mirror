// The room the book lies in: a desk under a brass lamp, a candle, a bookshelf,
// a mirror on the wall and dust in the air. Everything here is built from
// primitives and canvas textures, so the build needs no external models.
import * as THREE from 'three';
import { Reflector } from '../vendor/addons/objects/Reflector.js';
import { pbr } from './assets.js';
import { writingMat, letters, fountainPen, inkBottle, bookStack, beamDust, orrery, pocketWatch } from './desk.js';

// ---- procedural textures ----------------------------------------------------
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Deterministic random so the room looks the same on every load.
function rng(seed = 1) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}



// ---- book spines on the shelf -----------------------------------------------
const SPINE_COLORS = ['#5b1f1c', '#1d2f4a', '#2f4a2c', '#7a5a22', '#3a2418', '#6b2c4a', '#24363a', '#8a6b35', '#2a2a33'];

function addShelf(group, materials) {
  const r = rng(42);
  const shelfW = 2.6;
  const shelfH = 2.5;
  const depth = 0.42;
  const x0 = -3.5;
  const y0 = 0;
  const z = -2.02;
  // frame and boards
  const board = new THREE.Mesh(new THREE.BoxGeometry(shelfW + 0.12, 0.05, depth + 0.04), materials.wood);
  for (let i = 0; i <= 4; i++) {
    const shelf = board.clone();
    shelf.position.set(x0 + shelfW / 2, y0 + (i * shelfH) / 4, z - depth / 2);
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    group.add(shelf);
  }
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, shelfH, depth), materials.wood);
    post.position.set(x0 + (side < 0 ? 0 : shelfW), shelfH / 2, z - depth / 2);
    post.castShadow = true;
    group.add(post);
  }
  // Book spines, packed along each shelf with a few gaps. Collected first, then
  // drawn as one instanced mesh: one draw call instead of ~150 (x3 with the
  // shadow and mirror passes).
  const spines = [];
  for (let row = 0; row < 4; row++) {
    let x = x0 + 0.1;
    const rowY = y0 + (row * shelfH) / 4 + 0.03;
    while (x < x0 + shelfW - 0.12) {
      if (r() < 0.06) {
        x += 0.08 + r() * 0.12; // gap
        continue;
      }
      const h = 0.34 + r() * 0.12;
      const t = 0.035 + r() * 0.04;
      const color = SPINE_COLORS[Math.floor(r() * SPINE_COLORS.length)];
      const d = depth * (0.8 + r() * 0.15);
      spines.push({ x: x + t / 2, y: rowY + h / 2, z: z - depth / 2, w: t, h, d, color });
      x += t + 0.004;
    }
  }
  const shelfBooks = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 }),
    spines.length,
  );
  const o = new THREE.Object3D();
  const c = new THREE.Color();
  spines.forEach((b, i) => {
    o.position.set(b.x, b.y, b.z);
    o.scale.set(b.w, b.h, b.d);
    o.updateMatrix();
    shelfBooks.setMatrixAt(i, o.matrix);
    shelfBooks.setColorAt(i, c.set(b.color));
  });
  shelfBooks.castShadow = true;
  shelfBooks.receiveShadow = true;
  group.add(shelfBooks);
}

// ---- the room -----------------------------------------------------------------
export function buildRoom(renderer, { withMirror = true, shadowSize = 2048 } = {}) {
  const group = new THREE.Group();

  // Photographed surfaces (Poly Haven, CC0); tinted down to the study's lamplight.
  const materials = {
    wood: pbr('oak_wood_planks', { repeat: [2, 1], color: 0x8a6a50 }),
    desk: pbr('oak_wood_planks', { repeat: [3, 2], color: 0xa0704c }),
    floor: pbr('old_wooden_floor_02', { repeat: [7, 7], color: 0x7a6250 }),
    wall: pbr('plastered_wall_03', { repeat: [5, 2.5], color: 0x6f665c }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a25a, metalness: 1, roughness: 0.28 }),
    green: new THREE.MeshStandardMaterial({ color: 0x1f4a3a, roughness: 0.55, metalness: 0, side: THREE.DoubleSide }),
    wax: new THREE.MeshStandardMaterial({ color: 0xf1e4c8, roughness: 0.85, metalness: 0 }),
  };

  // Floor, desk and back wall.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), materials.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.9;
  floor.receiveShadow = true;
  group.add(floor);

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), materials.wall);
  wall.position.set(0, 3, -2.2);
  wall.receiveShadow = true;
  group.add(wall);

  const desk = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.14, 4.2), materials.desk);
  desk.position.set(0, -0.07, 0.1);
  desk.castShadow = true;
  desk.receiveShadow = true;
  group.add(desk);
  // desk legs
  for (const [x, z] of [[-3.1, 2], [3.1, 2], [-3.1, -1.8], [3.1, -1.8]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 0.16), materials.desk);
    leg.position.set(x, -0.6, z);
    leg.castShadow = true;
    group.add(leg);
  }

  addShelf(group, materials);

  // ---- on the desk: the writing mat the book lies on, and the reader's things round it ----
  // (placed at the edges of the frame, so they lead the eye in to the book)
  group.add(writingMat(3.3, 2.25));
  const place = (obj, x, z, ry = 0) => {
    obj.position.set(x, 0, z);
    obj.rotation.y = ry;
    group.add(obj);
    return obj;
  };
  // (the right of the frame stays clear: the open book moves left, and the copy sits there)
  place(letters(), -1.95, 1.05, 0.42);
  place(fountainPen(materials.brass), 0.35, 1.34, 0.08);
  place(inkBottle(materials.brass), -1.2, -1.42, 0.3);
  place(bookStack(materials.brass), -2.45, -1.62, 0.2);
  // clockwork: an orrery turning at the back of the desk, a pocket watch ticking at the front
  const planets = orrery(materials.brass);
  place(planets.object, 2.45, -1.35, 0);
  const watch = pocketWatch();
  place(watch.object, 1.55, 1.18, 0.35);

  // ---- mirror: a real planar reflection, in a brass frame ----
  const mirrorW = 1.5;
  const mirrorH = 2.2;
  const mirror = new Reflector(new THREE.PlaneGeometry(mirrorW, mirrorH), {
    textureWidth: 512,
    textureHeight: 512,
    clipBias: 0.003,
    color: 0x9aa6b8,
  });
  mirror.position.set(1.9, 1.35, -2.18);
  mirror.visible = withMirror;
  // The reflection is the whole room drawn again: refresh it every third frame, not every frame
  // (a small, soft mirror at the edge of the view; nobody sees the difference, the GPU does).
  const reflect = mirror.onBeforeRender;
  let mirrorFrame = 0;
  mirror.onBeforeRender = function (...args) {
    if (mirrorFrame++ % 3 === 0) reflect.apply(this, args);
  };
  group.add(mirror);
  const frameT = 0.09;
  const frameGeos = [
    [mirrorW + frameT * 2, frameT, 0.06, 0, mirrorH / 2 + frameT / 2],
    [mirrorW + frameT * 2, frameT, 0.06, 0, -mirrorH / 2 - frameT / 2],
    [frameT, mirrorH, 0.06, -mirrorW / 2 - frameT / 2, 0],
    [frameT, mirrorH, 0.06, mirrorW / 2 + frameT / 2, 0],
  ];
  for (const [w, h, d, x, y] of frameGeos) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials.brass);
    bar.position.set(1.9 + x, 1.35 + y, -2.16);
    bar.castShadow = true;
    group.add(bar);
  }

  // ---- brass desk lamp, shade angled over the book ----
  const lamp = new THREE.Group();
  lamp.position.set(-2.35, 0, -0.55);
  group.add(lamp);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.07, 48), materials.brass);
  base.position.y = 0.035;
  base.castShadow = true;
  lamp.add(base);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.35, 20), materials.brass);
  post.position.y = 0.7;
  post.castShadow = true;
  lamp.add(post);
  const armPivot = new THREE.Group();
  armPivot.position.set(0, 1.4, 0);
  lamp.add(armPivot);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 16), materials.brass);
  arm.rotation.z = Math.PI / 2 + 0.55;
  arm.position.set(0.4, 0.12, 0);
  arm.castShadow = true;
  armPivot.add(arm);
  const headPivot = new THREE.Group();
  headPivot.position.set(0.8, -0.25, 0);
  armPivot.add(headPivot);
  // open-ended shade: looks down over the desk
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.36, 48, 1, true), materials.green);
  shade.rotation.z = Math.PI; // opening faces down
  shade.position.set(0, -0.1, 0);
  shade.castShadow = true;
  headPivot.add(shade);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffd49a, emissiveIntensity: 6 }),
  );
  bulb.position.set(0, -0.12, 0);
  headPivot.add(bulb);
  headPivot.rotation.z = -0.25;
  headPivot.rotation.x = 0.0;

  const lampLight = new THREE.SpotLight(0xffdcb2, 6.5, 0, 0.62, 0.9, 2);
  lampLight.position.set(-1.55, 1.1, -0.55); // world position of the bulb at the end of the arm
  lampLight.target.position.set(0.0, 0, 0.05);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(shadowSize, shadowSize); // crisp contact shadow under the book's boards (1024 on phones)
  lampLight.shadow.bias = -0.00035;
  lampLight.shadow.normalBias = 0.02;
  lampLight.shadow.camera.near = 0.3;
  lampLight.shadow.camera.far = 8;
  group.add(lampLight);
  group.add(lampLight.target);
  // cool light from the window on the right: blue in the shadows, a rim on the boards' edges
  const windowLight = new THREE.DirectionalLight(0x9db4e0, 0.35);
  windowLight.position.set(4, 3, -2);
  group.add(windowLight);

  // ---- candle on the right of the desk ----
  const candle = new THREE.Group();
  candle.position.set(2.5, 0, 0.5);
  group.add(candle);
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.42, 40), materials.wax);
  wax.position.y = 0.21;
  wax.castShadow = true;
  candle.add(wax);
  const wick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8),
    new THREE.MeshStandardMaterial({ color: 0x111111 }),
  );
  wick.position.y = 0.44;
  candle.add(wick);
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.95 }),
  );
  flame.scale.set(1, 1.7, 1);
  flame.position.y = 0.5;
  candle.add(flame);
  const flameLight = new THREE.PointLight(0xffa552, 1.6, 3.4, 2);
  flameLight.position.set(0, 0.56, 0);
  candle.add(flameLight);

  // ---- dust: a few motes, lit only where they drift through the lamp's beam ----
  const dust = beamDust({
    count: 70,
    from: new THREE.Vector3(-1.5, 0.25, -0.8),
    to: new THREE.Vector3(1.0, 1.6, 0.9),
    lampPos: lampLight.position,
    lampDir: lampLight.target.position.clone().sub(lampLight.position),
    cone: 0.62,
  });
  group.add(dust.object);

  return {
    group,
    mirror,
    lampLight,
    flameLight,
    flame,
    dust,
    // Called every frame: candle flicker, the dust, the clockwork (turn: the reader's place, which turns the orrery).
    update(t, turn = 0) {
      planets.update(t, turn);
      watch.update(performance.now());
      const flick = 0.85 + Math.sin(t * 11.3) * 0.06 + Math.sin(t * 27.1) * 0.04 + Math.sin(t * 3.1) * 0.05;
      flameLight.intensity = 1.6 * flick;
      flame.scale.set(1, 1.7 * (0.95 + (flick - 0.85) * 0.5), 1);
      dust.update(t);
      lampLight.intensity = 6.5 * (1 + Math.sin(t * 0.7) * 0.004);
    },
  };
}
