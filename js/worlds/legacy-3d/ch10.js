// Chapter Ten: The Man Who Does Not Promise. The workshop with the engine on its
// stand and the back table; the first run, eight minutes and then the knock; and
// the hill beyond the gate "at one in eight, wet gravel shining between the hedges".
import * as THREE from 'three';
import * as K from '../kit.js';
import * as F from '../flora.js';
import { pbr, model, sky, blendedGround, lightZones } from '../../assets.js';
import { RoundedBoxGeometry } from '../../../vendor/addons/RoundedBoxGeometry.js';

const SLOPE = 0.125; // one in eight
const roadY = (z) => Math.max(0, (-z - 12) * SLOPE);
// the hill: a flat verge under the walls, then fields rolling away on either side
function hillHeight(x, z) {
  const ax = Math.abs(x);
  const shoulder = ax > 2.6 ? (ax - 2.6) * 0.22 + K.smoothstep(5, 14, ax) * K.fbm(x * 0.05, z * 0.05, 4) * 6 : 0;
  return (z < -10.2 ? roadY(z) : -0.05) + shoulder;
}

// The hill's ground: grass on the fields and verges, gravel on the road, rock where it is steep.
const GRASS = [new THREE.Color(0x4d6a30), new THREE.Color(0x6d7f3c)];
const GRAVEL = new THREE.Color(0x77726a);
const ROCK = new THREE.Color(0x6e6a60);
function hillMix(slope, x) {
  const road = Math.abs(x) < 2.0 ? 1 : 0;
  const rock = K.smoothstep(0.35, 0.6, slope) * (1 - road);
  return [(1 - road) * (1 - rock), road, rock];
}

// The engine on its test stand: a cast bed and crankcase in green enamel, two finned
// cylinders with porcelain plugs, the exhaust manifold up to the flue, drip oilers in
// brass, the gauge on its bracket, and the flywheel, its rim machined bright.
function engineOnStand({ iron, brass, steel }) {
  const g = new THREE.Group();
  const enamel = K.std({ color: 0x23302a, metalness: 0.35, roughness: 0.42 });
  const timber = pbr('oak_wood_planks', { color: 0x7a5a40 });
  // the trestle
  for (const sx of [-1, 1]) K.box(g, 0.12, 0.12, 1.8, timber, sx * 0.42, 0.42, 0, { uv: 0 });
  for (const sz of [-0.8, 0.8]) for (const sx of [-1, 1]) K.box(g, 0.1, 0.42, 0.1, timber, sx * 0.42, 0.21, sz, { uv: 0 });
  for (const sz of [-0.8, 0.8]) K.box(g, 0.9, 0.08, 0.08, timber, 0, 0.12, sz, { uv: 0 });
  const engine = new THREE.Group();
  const bed = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.14, 1.25, 3, 0.04), enamel);
  bed.position.y = 0.55;
  const crank = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.44, 0.92, 4, 0.11), enamel);
  crank.position.y = 0.84;
  engine.add(bed, crank);
  for (const z of [-0.18, 0.18]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.38, 24), iron);
    barrel.position.set(0, 1.24, z);
    engine.add(barrel);
    for (let i = 0; i < 9; i++) {
      const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.012, 28), iron);
      fin.position.set(0, 1.09 + i * 0.036, z);
      engine.add(fin);
    }
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.125, 0.07, 24), steel);
    head.position.set(0, 1.47, z);
    const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.05, 10), K.std({ color: 0xb8ab94, roughness: 0.6 }));
    plug.position.set(0.05, 1.53, z);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), iron);
    tip.position.set(0.05, 1.56, z);
    engine.add(head, plug, tip);
    for (const vx of [-0.05, 0.05]) {
      const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 8), steel);
      valve.position.set(-0.13, 1.36, z + vx);
      engine.add(valve);
    }
  }
  // the exhaust: a manifold from both cylinders up into the flue
  const flue = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.14, 1.3, 0.18), new THREE.Vector3(-0.26, 1.32, 0.0), new THREE.Vector3(-0.28, 1.6, -0.3), new THREE.Vector3(-0.28, 3.95, -0.35)]);
  engine.add(new THREE.Mesh(new THREE.TubeGeometry(flue, 48, 0.045, 12), iron));
  const branch = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.14, 1.3, -0.18), new THREE.Vector3(-0.24, 1.31, -0.08), new THREE.Vector3(-0.26, 1.33, 0.0)]);
  engine.add(new THREE.Mesh(new THREE.TubeGeometry(branch, 16, 0.04, 10), iron));
  // drip oilers: brass caps over glass
  for (const z of [-0.3, 0.3]) {
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 14), K.std({ color: 0xc9a85a, roughness: 0.05, transparent: true, opacity: 0.55 }));
    glass.position.set(0.18, 1.12, z);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 14), brass);
    cap.position.set(0.18, 1.16, z);
    engine.add(glass, cap);
  }
  // the gauge on a bracket
  K.box(engine, 0.02, 0.24, 0.02, iron, 0.36, 0.95, 0.56, { uv: 0 });
  const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 28), brass);
  gauge.rotation.x = Math.PI / 2;
  gauge.position.set(0.36, 1.08, 0.58);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.075, 28), K.std({ map: K.tex.clockFace(), roughness: 0.4 }));
  dial.position.set(0.36, 1.08, 0.61);
  engine.add(gauge, dial);
  // the flywheel: a rim machined bright on its face, six curved spokes, a keyed boss
  const flywheel = new THREE.Group();
  const rimPts = [new THREE.Vector2(0.44, -0.06), new THREE.Vector2(0.515, -0.06), new THREE.Vector2(0.515, 0.06), new THREE.Vector2(0.44, 0.06), new THREE.Vector2(0.44, -0.06)];
  const rim = new THREE.Mesh(new THREE.LatheGeometry(rimPts, 72), enamel);
  rim.rotation.x = Math.PI / 2;
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.517, 0.517, 0.122, 72, 1, true), steel);
  face.rotation.x = Math.PI / 2;
  flywheel.add(rim, face);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const c = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0),
      new THREE.Vector3(Math.cos(a + 0.22) * 0.26, Math.sin(a + 0.22) * 0.26, 0),
      new THREE.Vector3(Math.cos(a + 0.1) * 0.45, Math.sin(a + 0.1) * 0.45, 0),
    );
    const spoke = new THREE.Mesh(new THREE.TubeGeometry(c, 16, 0.026, 10), enamel);
    spoke.scale.z = 1.4;
    flywheel.add(spoke);
  }
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.17, 24), steel);
  boss.rotation.x = Math.PI / 2;
  const key = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.18), iron);
  key.position.y = 0.05;
  flywheel.add(boss, key);
  flywheel.rotation.y = Math.PI / 2;
  flywheel.position.set(0.58, 0.86, 0.25);
  engine.add(flywheel);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 14), steel);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.set(0.4, 0.86, 0.25);
  engine.add(shaft);
  engine.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  // the cast parts never move apart: bake them into one mesh per material (the flywheel turns, so not it)
  engine.remove(flywheel);
  K.mergeGroup(engine);
  engine.add(flywheel);
  g.add(engine);
  return { group: g, engine, flywheel };
}

export function build(ctx = {}) {
  const scene = new THREE.Scene();
  const SKY = 0x8b939c;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.FogExp2(SKY, 0.02);

  // Photographed surfaces (Poly Haven, CC0), and an overcast sky over the farmland.
  const earth = pbr('dirt_floor', { color: 0x8f877c });
  const brick = pbr('brick_wall_08');
  const timber = pbr('oak_wood_planks', { color: 0x8a6a50 });
  const iron = pbr('rusty_metal_02', { color: 0x6e6e6e });
  const steel = K.std({ color: 0xb9bec4, metalness: 1, roughness: 0.28 });
  if (ctx.renderer) sky(scene, ctx.renderer, 'farmland_overcast', { envIntensity: 0.8 });
  // inside, a photographed workshop's light (Poly Haven); out on the lane, the overcast farmland's
  const light = ctx.renderer ? lightZones(scene, ctx.renderer, [
    { sky: 'farmland_overcast', intensity: 0.8, when: (c) => c.z < -9.5 },
    { sky: 'abandoned_workshop', intensity: 0.9 },
  ]) : null;
  const brass = K.metal.brass();
  const flames = [];

  // ---- the workshop: brick, a beaten-earth floor, a king-post roof ----
  K.room(scene, { w: 7, h: 4.2, z0: 3.6, z1: -10, floor: earth, wall: brick, ceiling: timber, farDoor: 3.4, doorH: 3.4 });
  for (let z = 2; z > -10; z -= 2) {
    K.box(scene, 7, 0.22, 0.2, timber, 0, 3.95, z, { uv: 1 }); // tie beams
    K.box(scene, 0.16, 0.9, 0.16, timber, 0, 3.45, z, { uv: 1 }); // king posts
  }
  // High windows down the right wall, the day coming through them in shafts.
  const frameMat = K.std({ color: 0x2c2620, roughness: 0.7 });
  for (const z of [0.5, -3.0, -6.5]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshBasicMaterial({ color: 0xd9e2ec }));
    win.position.set(3.49, 3.0, z);
    win.rotation.y = -Math.PI / 2;
    scene.add(win);
    K.box(scene, 0.06, 1.08, 0.06, frameMat, 3.46, 3.0, z, { uv: 0 });
    K.box(scene, 0.06, 0.06, 1.66, frameMat, 3.46, 3.0, z, { uv: 0 });
    K.box(scene, 0.14, 0.08, 1.75, frameMat, 3.42, 2.48, z, { uv: 0 });
    K.lightShaft(scene, { from: new THREE.Vector3(3.4, 3.0, z), to: new THREE.Vector3(0.6, 0.0, z - 0.9), r0: 0.45, r1: 1.2, color: 0xdfe8f2, opacity: 0.1 });
  }
  const day = new THREE.DirectionalLight(0xdfe6f0, 2.2);
  day.position.set(9, 9, -2);
  day.target.position.set(-1, 0, -4);
  day.castShadow = true;
  day.shadow.mapSize.set(2048, 2048);
  day.shadow.radius = 4;
  Object.assign(day.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
  scene.add(day, day.target);
  scene.add(new THREE.HemisphereLight(0xbcc6d2, 0x3a3428, 1.9)); // the soft grey light the high windows let in
  K.motes(scene, { count: 500, min: new THREE.Vector3(-3, 0.3, -9), max: new THREE.Vector3(3.2, 3.8, 2), color: 0xf2ece0, size: 0.012, opacity: 0.45 });

  // The engine on its test stand, with the flywheel and the gauge.
  const { group: stand, engine, flywheel } = engineOnStand({ iron, brass, steel });
  stand.position.set(0, 0, -4);
  scene.add(stand);
  const workLamp = new THREE.PointLight(0xffc782, 6, 8, 2);
  workLamp.position.set(0.4, 2.6, -3.6);
  scene.add(workLamp);
  model(scene, 'Lantern_01', { position: [0.4, 2.62, -3.6], align: 'top', scale: 1.1 });
  K.box(scene, 0.012, 1.2, 0.012, iron, 0.4, 3.2, -3.6, { uv: 0 });
  const exhaustSmoke = K.smoke(scene, [new THREE.Vector3(-0.28, 3.95, -4.35)], { color: 'rgba(120,120,125,0.7)', drift: new THREE.Vector3(0.3, 1.6, -0.6), size: 0.8 });

  // A bench of tools on the right wall: vice, plane, saw, the drill press.
  K.box(scene, 0.8, 0.08, 3.2, timber, 3.0, 0.9, -3.4, { uv: 1 });
  for (const z of [-2.2, -4.6]) K.box(scene, 0.7, 0.9, 0.08, timber, 3.0, 0.45, z, { uv: 1 });
  K.box(scene, 0.04, 1.0, 3.0, timber, 3.42, 1.55, -3.4, { uv: 1 }); // tool board
  model(scene, 'bench_vice_01', { position: [2.9, 0.94, -2.4], rotation: [0, -Math.PI / 2, 0], align: 'bottom' });
  model(scene, 'hand_plane_no4', { position: [2.85, 0.94, -3.2], rotation: [0, 0.4, 0], align: 'bottom' });
  model(scene, 'handsaw_wood', { position: [3.38, 1.6, -3.6], rotation: [0, -Math.PI / 2, Math.PI / 2], align: 'bottom' });
  model(scene, 'old_drill_press', { position: [3.0, 0.94, -4.4], rotation: [0, -Math.PI / 2, 0], align: 'bottom' });
  // shelves of tins and jars on the left wall, crates and a drum below, a ladder at the end
  for (const y of [1.5, 2.1]) K.box(scene, 0.35, 0.04, 2.4, timber, -3.3, y, -1.6, { uv: 1 });
  const tinR = K.rng(108);
  const tins = new THREE.Group();
  scene.add(tins);
  const tinMats = [0x7c2f22, 0x2f4f3a, 0x8a7a3a, 0x3a4a5e, 0x6b5a4a].map((c) => K.std({ color: c, metalness: 0.5, roughness: 0.5 }));
  for (const y of [1.52, 2.12]) {
    for (let z = -0.6; z > -2.7; z -= 0.17 + tinR() * 0.1) {
      const r = 0.045 + tinR() * 0.03;
      const h = 0.08 + tinR() * 0.12;
      const tin = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), tinMats[Math.floor(tinR() * 5)]);
      tin.position.set(-3.3 + (tinR() - 0.5) * 0.12, y + h / 2, z);
      tin.castShadow = true;
      tins.add(tin);
    }
  }
  K.mergeGroup(tins);
  model(scene, 'wooden_crate_01', { position: [-2.85, 0, 1.4], rotation: [0, 0.2, 0], align: 'bottom', scale: 0.9 });
  model(scene, 'wooden_crate_01', { position: [-2.9, 0, 0.55], rotation: [0, -0.15, 0], align: 'bottom', scale: 0.8 });
  model(scene, 'wooden_crate_01', { position: [-2.8, 0.7, 1.25], rotation: [0, 0.6, 0], align: 'bottom', scale: 0.62 });
  model(scene, 'wooden_ladder', { position: [-3.25, 0, -8.6], rotation: [0.22, Math.PI / 2, 0], align: 'bottom' });

  // The back table: papers, a ledger, mugs, an oil lamp.
  K.table(scene, { len: 2.0, wid: 0.95, mat: timber, x: -2.4, z: -7.3 });
  const paper = K.std({ color: 0xece4d2, roughness: 0.9 });
  for (let i = 0; i < 7; i++) {
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.3), paper);
    sheet.rotation.set(-Math.PI / 2, 0, (i - 3) * 0.25);
    sheet.position.set(-2.4 + (i % 3 - 1) * 0.22, 0.815 + i * 0.001, -7.3 + (i - 3) * 0.18);
    sheet.receiveShadow = true;
    scene.add(sheet);
  }
  K.books(scene, [{ x: -2.55, y: 0.84, z: -6.6, w: 0.3, h: 0.05, d: 0.4, ry: 0.2 }]);
  for (const [x, z] of [[-2.1, -7.9], [-2.7, -7.6]]) {
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 16), K.std({ color: 0xd8d2c4, roughness: 0.4 }));
    mug.position.set(x, 0.86, z);
    scene.add(mug);
  }
  model(scene, 'vintage_oil_lamp', { position: [-2.2, 0.79, -6.9], scale: 0.62, align: 'bottom' });
  flames.push(K.flame(scene, -2.2, 1.05, -6.9, { intensity: 1.4, distance: 4, scale: 0.7 }));
  for (let i = -1; i <= 1; i += 2) K.chair(scene, { mat: timber, x: -2.4 + i * 0.75, z: -7.3, ry: -i * Math.PI / 2 });

  // ---- outside: the hill at one in eight, between dry-stone walls ----
  const hill = K.terrain(scene, {
    size: 160,
    depth: 128,
    seg: 160,
    z: -75.2,
    height: hillHeight,
    colour: (h, slope, x, z) => {
      const [g, r, k] = hillMix(slope, x);
      const grass = GRASS[0].clone().lerp(GRASS[1], K.fbm(x * 0.04, z * 0.04, 3));
      return grass.multiplyScalar(g).add(GRAVEL.clone().multiplyScalar(r)).add(ROCK.clone().multiplyScalar(k));
    },
    weights: (h, slope, x) => hillMix(slope, x),
    material: blendedGround([{ id: 'leafy_grass', scale: 3 }, { id: 'gravel_road', scale: 2.5 }, { id: 'aerial_rocks_02', scale: 8, tri: true }], { normalize: true, desat: 0.5 }),
  });
  hill.castShadow = false;
  // the wet gravel of the road itself, shining, with puddles in the ruts
  const road = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 60, 1, 60), pbr('gravel_road', { repeat: [1.6, 22], color: 0x8a857e, roughness: 0.5 }));
  road.rotation.x = -Math.PI / 2;
  const rp = road.geometry.attributes.position;
  for (let i = 0; i < rp.count; i++) rp.setZ(i, roadY(-rp.getY(i) - 40) + 0.03);
  road.geometry.computeVertexNormals();
  road.position.set(0, 0, -40);
  road.receiveShadow = true;
  scene.add(road);
  const puddle = K.std({ color: 0x15171a, roughness: 0.1, metalness: 0.1, envMapIntensity: 0.55 });
  const pr = K.rng(110);
  for (let i = 0; i < 9; i++) {
    const z = -14 - pr() * 50;
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.22 + pr() * 0.3, 20), puddle);
    p.scale.set(1, 1.6 + pr(), 1);
    p.rotation.set(-Math.PI / 2 + Math.atan(SLOPE), 0, 0);
    p.position.set((pr() < 0.5 ? -1 : 1) * (0.7 + pr() * 0.5), roadY(z) + 0.045, z);
    scene.add(p);
  }
  // dry-stone walls along both sides of the lane, and across the fields
  const wallStone = pbr('stacked_stone_wall', { color: 0xb8b2a6 });
  const capStone = pbr('castle_wall_slates', { color: 0x8f8a80 });
  const verge = (x, z) => hillHeight(x, z);
  const bushes = [];
  const br = K.rng(1010);
  for (const sx of [-1, 1]) {
    const line = [];
    for (let z = -13.0; z > -80; z -= 2.6) line.push([sx * (2.95 + Math.sin(z * 0.21) * 0.06), z]);
    const tops = K.dryStoneWall(scene, line, { ground: verge, height: 1.15, width: 0.55, mat: wallStone, capMat: capStone, seed: sx > 0 ? 11 : 17 });
    for (const [x, y, z] of tops) if (br() < 0.55) bushes.push([x + sx * 0.25, y - 0.1, z + (br() - 0.5) * 1.4, 0.55 + br() * 0.35]);
  }
  for (const [x0, x1, z0, z1, seed] of [[3.2, 46, -30, -34, 21], [3.2, 52, -55, -60, 22], [-3.2, -44, -24, -27, 23], [-3.2, -50, -48, -52, 24]]) {
    const line = [];
    for (let i = 0; i <= 14; i++) { const u = i / 14; line.push([x0 + (x1 - x0) * u, z0 + (z1 - z0) * u + Math.sin(u * 7) * 0.8]); }
    K.dryStoneWall(scene, line, { ground: verge, height: 1.05, width: 0.5, mat: wallStone, capMat: capStone, seed });
  }
  F.trees(scene, bushes, { kind: 'bush', seed: 101, shadows: false });
  // grass and weeds along the verges, at the feet of the walls
  F.grass(scene, {
    count: 5200,
    tall: 0.3,
    colours: ['#26311a', '#46532a', '#737447'],
    seed: 10,
    place: (i, r) => {
      const z = -12.8 - r() * 66;
      const x = (r() < 0.5 ? -1 : 1) * (2.08 + r() * 0.62);
      return [x, roadY(z) + 0.02, z];
    },
  });
  // ash and sycamore out on the fields
  const fieldTrees = [];
  for (const [x, z] of [[-18, -40], [-26, -62], [22, -44], [30, -70], [15, -26], [-34, -30], [40, -55], [-12, -75]]) fieldTrees.push([x, hillHeight(x, z) - 0.2, z, 0.9 + (Math.abs(x) % 5) * 0.08]);
  F.trees(scene, fieldTrees, { kind: 'oak', seed: 102, shadows: false });
  // the gate: stone pillars capped, and a five-bar gate swung open against the wall
  for (const x of [-2.6, 2.6]) {
    K.box(scene, 0.62, 2.3, 0.62, wallStone, x, 1.15, -12.6, { uv: 1.2 });
    K.box(scene, 0.74, 0.12, 0.74, capStone, x, 2.36, -12.6, { uv: 0.8 });
  }
  const gate = new THREE.Group();
  const gateWood = pbr('oak_wood_planks', { color: 0x9a8a72 });
  for (let i = 0; i < 5; i++) K.box(gate, 0.06, 0.09, 2.3, gateWood, 0, 0.3 + i * 0.25, 1.15, { uv: 0 });
  for (const z of [0.05, 2.25]) K.box(gate, 0.08, 1.35, 0.1, gateWood, 0, 0.72, z, { uv: 0 });
  K.box(gate, 0.05, 0.08, 2.5, gateWood, 0, 0.75, 1.15, { uv: 0, rx: 0.48 });
  gate.position.set(2.28, 0, -12.9);
  gate.rotation.y = -0.18;
  scene.add(gate);

  const motor = K.motorcar(scene, { beams: false }); // a grey wet day: the lamps are lit but throw no beam
  const rainFx = K.rain(scene, { count: 1800, area: 36, height: 16, opacity: 0.32 });
  rainFx.object.visible = false;

  return {
    scene,
    exposure: 1.0,
    backScale: 0.4,
    beats: [
      { pos: new THREE.Vector3(2.6, 1.8, 2.0), look: new THREE.Vector3(0, 1.0, -4) },
      { pos: new THREE.Vector3(1.55, 1.25, -2.8), look: new THREE.Vector3(0.45, 0.95, -3.85) },
      { pos: new THREE.Vector3(-0.85, 1.55, -5.8), look: new THREE.Vector3(-2.4, 0.85, -7.3) },
      { pos: new THREE.Vector3(2.7, 1.7, -1.3), look: new THREE.Vector3(0.1, 1.0, -4.3) },
      { pos: new THREE.Vector3(1.3, 2.7, -15.5), look: new THREE.Vector3(0, 5.0, -36), via: [new THREE.Vector3(0.9, 1.8, -7.8), new THREE.Vector3(0.4, 2.0, -10.8)] },
    ],
    update(t, dt, s, cam) {
      light?.(cam, dt);
      for (const f of flames) f.update(t);
      F.setWind(t);
      // the wheel turns slowly while it is measured; at the first run the engine catches
      const running = K.smoothstep(2.55, 3.0, s);
      flywheel.rotation.x += dt * (0.4 + running * 14);
      engine.position.x = running * Math.sin(t * 60) * 0.004;
      exhaustSmoke.update(t, running);
      // outside, the rain, and the car climbing the hill
      const outside = cam.z < -9.5;
      rainFx.object.visible = outside;
      if (outside) rainFx.update(dt, cam);
      const z = -16 - 26 * K.smoothstep(3.25, 4.6, s);
      motor.position.set(0, roadY(z), z);
      motor.rotation.set(Math.atan(SLOPE), Math.PI, 0);
    },
  };
}
