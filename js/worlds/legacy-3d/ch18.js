// Chapter Eighteen: The Best in the Business. "The workshop was full of
// daylight... fresh shavings under the bench... A ladder stood under the roof
// beams." Then the glass: "The bench disappeared first. Then the ladder. The
// window stayed visible for a moment, hanging at the wrong angle." And in the
// lower field at dusk, "a broad, tapered shape descended above the far end of
// the field... a dull silver curve with a dark line along one side."
import * as THREE from 'three';
import * as K from '../kit.js';
import * as F from '../flora.js';
import { DESKTOP_CLASS } from '../device.js';
import { pbr, model, sky, blendedGround, lightZones } from '../../assets.js';

// Fade every mesh in a group (models included) towards transparent.
function fadeGroup(group, opacity) {
  group.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      m.transparent = true;
      m.opacity = opacity;
    }
  });
}

export function build(ctx = {}) {
  const scene = new THREE.Scene();
  const HAZE = 0xc9a97d;
  scene.background = new THREE.Color(HAZE);
  scene.fog = new THREE.FogExp2(HAZE, 0.005);

  // Photographed surfaces (Poly Haven, CC0), and a real sunset over the field.
  const boards = pbr('old_wooden_floor_02', { color: 0xe0c8a8, roughness: 1.35, envMapIntensity: 0.55 });
  const lime = pbr('plastered_wall_03', { color: 0xf2ece0 });
  const beam = pbr('oak_wood_planks', { color: 0x6e4e34 });
  if (ctx.renderer) sky(scene, ctx.renderer, 'belfast_sunset_puresky', { envIntensity: 0.3, backgroundIntensity: 0.13, rotation: 3.1 }); // sun low on the left, beyond the field
  // inside, a photographed workshop's light (Poly Haven); out in the field, the sunset's
  const light = ctx.renderer ? lightZones(scene, ctx.renderer, [
    { sky: 'belfast_sunset_puresky', intensity: 0.55, rotation: 3.1, when: (c) => c.z < -9 },
    { sky: 'abandoned_workshop', intensity: 0.7 },
  ]) : null;
  const r = K.rng(18);

  // ---- the workshop ----
  K.room(scene, { w: 7, h: 4.0, z0: 3.8, z1: -8, floor: boards, wall: lime, ceiling: beam, farDoor: 3.2, doorH: 3.2 });
  for (let z = 2; z > -8; z -= 1.6) K.box(scene, 7, 0.22, 0.22, beam, 0, 3.7, z, { uv: 1 });
  // Windows down the left wall, and the sun coming through them.
  for (const z of [1.0, -2.2, -5.4]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.7), new THREE.MeshBasicMaterial({ color: 0xfff2d6 }));
    win.material.color.multiplyScalar(1.6);
    win.position.set(-3.49, 2.2, z);
    win.rotation.y = Math.PI / 2;
    scene.add(win);
  }
  const sun = new THREE.DirectionalLight(0xffd79a, 4.2);
  sun.position.set(-12, 9, -1);
  sun.target.position.set(1, 0, -3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 });
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xe8d6b8, 0x4a3a28, 0.9));
  // shafts of sunlight hanging in the dusty air
  const shaftTex = K.canvasTex(64, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(255,230,180,0.0)');
    grad.addColorStop(0.2, 'rgba(255,230,180,0.35)');
    grad.addColorStop(1, 'rgba(255,230,180,0.0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 256);
  });
  for (const z of [1.0, -2.2, -5.4]) {
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 5.5), new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.22 }));
    shaft.position.set(-1.6, 1.4, z + 0.2);
    shaft.rotation.set(0, Math.PI / 2, -0.85);
    scene.add(shaft);
  }
  const dust = K.motes(scene, { count: 600, min: new THREE.Vector3(-3, 0.3, -6.5), max: new THREE.Vector3(1, 3.2, 1.8), color: 0xffe2b0, size: 0.02, opacity: 0.6 });

  // The bench, with shavings under it and the bright heads of new screws.
  const benchMat = pbr('oak_wood_planks', { color: 0xb08a64, transparent: true });
  const bench = new THREE.Group();
  K.box(bench, 0.85, 0.09, 3.0, benchMat, 0, 0.9, 0, { uv: 1 });
  for (const sz of [-1.3, 1.3]) for (const sx of [-1, 1]) K.box(bench, 0.09, 0.9, 0.09, benchMat, sx * 0.34, 0.45, sz, { uv: 1 });
  K.box(bench, 0.75, 0.05, 2.8, benchMat, 0, 0.2, 0, { uv: 1 });
  // real tools on the bench: a vice, a smoothing plane, a handsaw
  model(bench, 'bench_vice_01', { position: [0.3, 0.945, 1.05], rotation: [0, Math.PI / 2, 0], align: 'bottom', ownMaterials: true });
  model(bench, 'hand_plane_no4', { position: [0.05, 0.945, -0.2], rotation: [0, 0.4, 0], align: 'bottom', ownMaterials: true });
  model(bench, 'handsaw_wood', { position: [-0.15, 0.945, 0.5], rotation: [0, 0.1, Math.PI / 2], align: 'bottom', ownMaterials: true });
  bench.position.set(-1.6, 0, -3.6);
  scene.add(bench);
  const shavingMat = K.std({ color: 0xd9b37a, roughness: 0.7, side: THREE.DoubleSide, transparent: true });
  const shavings = new THREE.InstancedMesh(new THREE.TorusGeometry(0.04, 0.008, 4, 10, Math.PI * 1.4), shavingMat, 160);
  const o = new THREE.Object3D();
  for (let i = 0; i < 160; i++) {
    o.position.set(-1.6 + (r() - 0.5) * 1.4, 0.015, -3.6 + (r() - 0.5) * 3.2);
    o.rotation.set(r() * 3, r() * 3, r() * 3);
    const sc = 0.7 + r() * 0.9;
    o.scale.set(sc, sc, sc);
    o.updateMatrix();
    shavings.setMatrixAt(i, o.matrix);
  }
  shavings.castShadow = true;
  scene.add(shavings);
  const screwMat = K.std({ color: 0xe6e2d8, metalness: 1, roughness: 0.15, transparent: true });
  const screws = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 10), screwMat, 40);
  for (let i = 0; i < 40; i++) {
    o.position.set(-1.6 + (r() - 0.5) * 0.7, 0.95, -3.6 + (r() - 0.5) * 2.6);
    o.rotation.set(0, 0, 0);
    o.scale.set(1, 1, 1);
    o.updateMatrix();
    screws.setMatrixAt(i, o.matrix);
  }
  scene.add(screws);

  // The ladder under the roof beams.
  const ladder = new THREE.Group();
  ladder.position.set(1.5, 0, -5.8);
  scene.add(ladder);
  model(ladder, 'wooden_ladder', { scale: 1.7, align: 'bottom', ownMaterials: true });

  // The glass, clean, on its stand; and the window that hangs at the wrong angle.
  const glass = K.greenMirror(scene, { x: 0.2, z: -5.9, scale: 0.85, ry: -0.25 });
  const ghostWindow = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.4), new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0, depthWrite: false }));
  ghostWindow.position.set(0.15, 1.6, -6.6);
  scene.add(ghostWindow);

  // ---- the lower field ----
  const fieldHeight = (x, z) => (z > -9 ? -0.05 : -Math.min(6, (-z - 9) * 0.06) + K.fbm(x * 0.02, z * 0.02, 4) * 5 * K.smoothstep(-20, -60, z));
  K.terrain(scene, {
    size: 260,
    depth: 220,
    seg: 140,
    z: -120,
    height: fieldHeight,
    // late-summer grass going gold, with worn bare patches
    colour: (h, slope, x, z) => {
      const bare = K.smoothstep(0.62, 0.75, K.fbm(x * 0.04, z * 0.04, 3));
      return new THREE.Color(0x5e6a2e).lerp(new THREE.Color(0x8a8040), K.fbm(x * 0.05, z * 0.05, 3)).lerp(new THREE.Color(0x7a6448), bare);
    },
    weights: (h, slope, x, z) => {
      const bare = K.smoothstep(0.62, 0.75, K.fbm(x * 0.04, z * 0.04, 3));
      return [1 - bare, bare, 0];
    },
    material: blendedGround([{ id: 'leafy_grass', scale: 3 }, { id: 'gravelly_sand', scale: 3 }], { normalize: true, desat: 0.5 }),
  });
  // long grass near the path: clumps of curved blades going gold at the tips, moving in the wind
  F.grass(scene, {
    count: DESKTOP_CLASS ? 14000 : 6000, // desktop-class screens get the full meadow
    tall: 0.55,
    colours: ['#2e3618', '#6a7436', '#bba862'],
    place: (i, rr) => { const x = (rr() - 0.5) * 36, z = -9 - rr() * 44; return [x, fieldHeight(x, z), z]; },
  });
  // oaks along the far end of the field, a hedgerow in front of them
  const oaks = [], hedge = [];
  for (let i = 0; i < 30; i++) { const x = -80 + i * 5.4 + (r() - 0.5) * 3, z = -96 + (r() - 0.5) * 8; oaks.push([x, fieldHeight(x, z) - 0.2, z, 0.85 + r() * 0.5]); }
  for (let x = -82; x < 82; x += 1.6) { const z = -90 + (r() - 0.5) * 1.5; hedge.push([x, fieldHeight(x, z) - 0.1, z, 0.9 + r() * 0.5]); }
  F.trees(scene, oaks, { kind: 'oak', seed: 18 });
  F.trees(scene, hedge, { kind: 'bush', seed: 81, shadows: false });

  // The ship, descending above the far end of the field.
  const craft = K.ship(scene, { x: 4, y: 40, z: -78, scale: 2.4, ry: 0.15 });

  return {
    scene,
    exposure: 1.0,
    backScale: 0.4,
    beats: [
      { pos: new THREE.Vector3(2.4, 1.7, 2.3), look: new THREE.Vector3(-0.6, 1.1, -4.0) },
      { pos: new THREE.Vector3(1.4, 1.55, -1.1), look: new THREE.Vector3(-1.4, 0.95, -4.0) },
      { pos: new THREE.Vector3(1.1, 1.45, -3.0), look: new THREE.Vector3(0.0, 1.25, -6.0) },
      { pos: new THREE.Vector3(0, 2.1, -18), look: new THREE.Vector3(2, 9, -78), via: [new THREE.Vector3(0.7, 1.7, -6.4), new THREE.Vector3(0.2, 1.8, -9.4)] },
    ],
    update(t, dt, s, cam) {
      F.setWind(t);
      dust.update(t);
      // the open sky lights the field; indoors only a little of it reaches the boards
      light?.(cam, dt);
      glass.update(t, 0.45 + 0.5 * K.smoothstep(1.4, 2.0, s));
      // "The bench disappeared first. Then the ladder."
      const benchGone = K.smoothstep(1.55, 1.95, s) * (1 - K.smoothstep(2.4, 2.7, s));
      const ladderGone = K.smoothstep(1.75, 2.15, s) * (1 - K.smoothstep(2.4, 2.7, s));
      for (const m of [benchMat, shavingMat, screwMat]) m.opacity = 1 - benchGone;
      fadeGroup(bench, 1 - benchGone);
      fadeGroup(ladder, 1 - ladderGone);
      bench.visible = benchGone < 0.99;
      ladder.visible = ladderGone < 0.99;
      ghostWindow.material.opacity = 0.45 * K.smoothstep(1.85, 2.1, s) * (1 - K.smoothstep(2.35, 2.6, s));
      ghostWindow.rotation.set(0.35, 0.6 + t * 0.05, 0.2);
      // the ship comes down above the far end of the field
      craft.position.y = 40 - 30 * K.smoothstep(2.55, 3.6, s) + Math.sin(t * 0.5) * 0.3;
    },
  };
}
