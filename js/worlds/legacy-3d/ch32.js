// Chapter Thirty-two: The Twelfth Stair. "It was dark on the stairs... The rail
// was cold beneath her hand. The treads were bare wood, worn in the middle." The
// stair that keeps going: "Each time he tried to arrive, there was one more
// tread." The glass: "For one moment the whole sheet of green glass brightened...
// Then the crack opened." And in the morning, "Anna was on the broken
// drawing-room sill... A small bird, dark as spilled oil, with gold eyes."
import * as THREE from 'three';
import * as K from '../kit.js';
import { pbr, model, sky, lightZones } from '../../assets.js';

const RISE = 0.19;
const RUN = 0.27;
const STEPS = 70;
const stepY = (i) => -i * RISE;
const stepZ = (i) => -i * RUN;

// What the broken window looks out on: a pale morning over the lawn.
function morningView() {
  return K.canvasTex(512, 384, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h * 0.62);
    sky.addColorStop(0, '#b9cbe0');
    sky.addColorStop(1, '#f4e3c6');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#3d4a33';
    g.beginPath();
    g.moveTo(0, h * 0.62);
    for (let x = 0; x <= w; x += 16) g.lineTo(x, h * 0.6 - Math.sin(x * 0.03) * 10 - Math.sin(x * 0.11) * 5);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();
    const lawn = g.createLinearGradient(0, h * 0.62, 0, h);
    lawn.addColorStop(0, '#6f8a52');
    lawn.addColorStop(1, '#4c6a38');
    g.fillStyle = lawn;
    g.fillRect(0, h * 0.66, w, h);
  });
}

export function build(ctx = {}) {
  const scene = new THREE.Scene();
  const darkBg = new THREE.Color(0x020203);
  scene.background = darkBg;
  scene.fog = new THREE.FogExp2(0x020203, 0.06);
  // the real morning beyond the broken window: fields under a pale sky
  let morningSky = null;
  if (ctx.renderer) {
    sky(scene, ctx.renderer, 'farmland_overcast', { background: false, envIntensity: 0 }).then(({ hdr }) => {
      morningSky = hdr;
    });
  }

  // an old room's light (Poly Haven): barely any on the dark stair, morning in the drawing room
  const light = ctx.renderer ? lightZones(scene, ctx.renderer, [
    { sky: 'old_room', intensity: 0.85, when: (c) => c.z < -18.5 },
    { sky: 'old_room', intensity: 0.1 },
  ]) : null;

  // Photographed surfaces (Poly Haven, CC0): bare treads, worn in the middle,
  // lime plaster, and the drawing-room floorboards.
  const tread = pbr('old_wooden_floor_02', { color: 0xd8b898, repeat: [0.7, 0.7], roughness: 1.35, envMapIntensity: 0.55 });
  const rail = K.std({ color: 0x2a1a0e, roughness: 0.35, metalness: 0.1 });
  const wall = pbr('plastered_wall_03', { color: 0x9a9080 });
  const pale = pbr('plastered_wall_03', { color: 0xf4ecdc });
  const boards = pbr('old_wooden_floor_02', { color: 0xe0c8a8, roughness: 1.35, envMapIntensity: 0.55 });

  // ---- the top landing and the stair that keeps going ----
  // (the landing runs back to z 4.6, so the camera falling through the page starts on it)
  K.box(scene, 1.8, 0.2, 4.6, boards, 0, -0.1, 2.3);
  K.box(scene, 1.9, 0.2, 5.8, wall, 0, 3.45, 1.7);
  K.box(scene, 1.9, 3.6, 0.2, wall, 0, 1.7, 4.7);
  K.stairs(scene, { steps: STEPS, width: 1.4, rise: RISE, run: RUN, mat: tread, railMat: rail, x: 0, y: -0.02, z: -0.1, down: true });
  // the stairwell walls; the right one opens on an alcove partway down
  const span = (z0, z1) => [(z0 + z1) / 2, Math.abs(z0 - z1)];
  const [lc, ll] = span(4.6, -20);
  K.box(scene, 0.2, 19, ll, wall, -0.85, -6, lc, { uv: 2 });
  const A = { z0: -6.9, z1: -8.3, floor: stepY(28), top: stepY(28) + 2.7 };
  for (const [z0, z1] of [[4.6, A.z0], [A.z1, -20]]) {
    const [c, l] = span(z0, z1);
    K.box(scene, 0.2, 19, l, wall, 0.85, -6, c, { uv: 2 });
  }
  K.box(scene, 0.2, 3.5 - A.top, 1.4, wall, 0.85, (A.top + 3.5) / 2, -7.6, { uv: 2 });
  K.box(scene, 0.2, A.floor + 15.5, 1.4, wall, 0.85, (A.floor - 15.5) / 2, -7.6, { uv: 2 });
  // the alcove, and the mirror in it
  K.box(scene, 2.5, 0.2, 1.4, boards, 2.05, A.floor - 0.1, -7.6);
  K.box(scene, 2.5, 0.2, 1.4, wall, 2.05, A.top + 0.1, -7.6);
  K.box(scene, 0.2, 2.9, 1.4, wall, 3.3, A.floor + 1.35, -7.6);
  for (const z of [A.z0, A.z1]) K.box(scene, 2.5, 2.9, 0.2, wall, 2.05, A.floor + 1.35, z);
  const mirror = K.greenMirror(scene, { x: 2.55, z: -7.6, ry: -Math.PI / 2 });
  mirror.group.position.y = A.floor;

  // the only light: a little from above, and what the reader's eyes can gather
  const fromAbove = new THREE.PointLight(0x8a96b4, 1.6, 9, 2);
  fromAbove.position.set(0, 2.2, 2.0);
  scene.add(fromAbove);
  const near = new THREE.PointLight(0xb8c2d8, 1.1, 5.5, 2);
  scene.add(near);
  scene.add(new THREE.HemisphereLight(0x1a1e28, 0x050403, 0.35));
  // a tall narrow window high on the stairwell wall: moonlight falls through it across the
  // treads, and the balusters throw their shadows down the steps
  const moonWin = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.5), new THREE.MeshBasicMaterial({ color: 0xa9bde6 }));
  moonWin.material.color.multiplyScalar(1.4);
  moonWin.position.set(-0.74, 1.5, -2.4);
  moonWin.rotation.y = Math.PI / 2;
  scene.add(moonWin);
  const sashMat = K.std({ color: 0x1c1712, roughness: 0.7 });
  for (const dy of [-0.77, 0.77]) K.box(scene, 0.06, 0.06, 0.64, sashMat, -0.72, 1.5 + dy, -2.4, { uv: 0 });
  for (const dz of [-0.3, 0, 0.3]) K.box(scene, 0.06, 1.6, 0.04, sashMat, -0.72, 1.5, -2.4 + dz, { uv: 0 });
  K.box(scene, 0.06, 0.04, 0.6, sashMat, -0.72, 1.5, -2.4, { uv: 0 });
  const moon = new THREE.SpotLight(0xa9bde6, 42, 14, 0.55, 0.6, 1.4);
  moon.position.set(-0.6, 1.9, -2.4);
  moon.target.position.set(0.35, -1.3, -3.3);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.radius = 2;
  scene.add(moon, moon.target);
  K.lightShaft(scene, { from: new THREE.Vector3(-0.66, 1.5, -2.4), to: new THREE.Vector3(0.35, -1.5, -3.5), r0: 0.3, r1: 0.95, color: 0xa9bde6, opacity: 0.07 });

  // ---- the drawing room, at the bottom, in the morning ----
  const F = stepY(STEPS) - 0.1; // floor level
  const room = new THREE.Group();
  scene.add(room);
  K.box(room, 6, 0.2, 8.4, boards, 0, F - 0.1, -23.2);
  K.box(room, 6, 0.2, 8.4, pale, 0, F + 3.5, -23.2);
  for (const sx of [-1, 1]) K.box(room, 0.2, 3.6, 8.4, pale, sx * 3.1, F + 1.7, -23.2);
  // the far wall, with the broken window
  const winW = 1.8;
  const winH = 2.0;
  const sillY = F + 0.95;
  K.box(room, (6.2 - winW) / 2, 3.6, 0.3, pale, -(winW / 2 + (6.2 - winW) / 4), F + 1.7, -27.4);
  K.box(room, (6.2 - winW) / 2, 3.6, 0.3, pale, winW / 2 + (6.2 - winW) / 4, F + 1.7, -27.4);
  K.box(room, winW, sillY - F, 0.3, pale, 0, (F + sillY) / 2, -27.4);
  K.box(room, winW, F + 3.5 - (sillY + winH), 0.3, pale, 0, (sillY + winH + F + 3.5) / 2, -27.4);
  K.box(room, winW + 0.3, 0.08, 0.5, pbr('oak_wood_planks', { color: 0xd9cdb8 }), 0, sillY, -27.25, { uv: 0.6 }); // the sill
  K.box(room, winW + 0.2, 0.05, 0.08, K.std({ color: 0xe8e2d4, roughness: 0.6 }), 0, sillY - 0.065, -27.05, { uv: 0 });
  const velvet = pbr('velour_velvet', { color: 0x7a3a3e, repeat: [1.5, 3], side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    const cg = new THREE.PlaneGeometry(0.75, 2.7, 28, 6);
    const cp = cg.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const cx = cp.getX(i);
      const cy = cp.getY(i);
      cp.setZ(i, Math.sin(cx * 24) * 0.045 + Math.sin(cx * 9 + cy) * 0.015);
      cp.setX(i, cx * (0.8 + 0.2 * (cy + 1.35) / 2.7)); // gathered at the foot, falling straight from the rail
    }
    cg.computeVertexNormals();
    const curtain = new THREE.Mesh(cg, velvet);
    curtain.position.set(sx * (winW / 2 + 0.3), F + 1.95, -27.18);
    curtain.castShadow = curtain.receiveShadow = true;
    room.add(curtain);
  }
  const railRod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, winW + 1.6, 12), K.metal.brass());
  railRod.rotation.z = Math.PI / 2;
  railRod.position.set(0, F + 3.3, -27.15);
  room.add(railRod);
  K.lightShaft(room, { from: new THREE.Vector3(-0.2, sillY + 1.3, -27.6), to: new THREE.Vector3(0.9, F, -24.2), r0: 0.75, r1: 1.6, color: 0xffe2b8, opacity: 0.12 });
  // what is left of the glazing bars and glass
  const barMat = K.std({ color: 0xece6d8, roughness: 0.5 });
  K.box(room, 0.05, winH, 0.06, barMat, 0, sillY + winH / 2, -27.45, { uv: 0 });
  K.box(room, winW, 0.05, 0.06, barMat, 0, sillY + winH * 0.55, -27.45, { uv: 0 });
  const shardMat = new THREE.MeshStandardMaterial({ color: 0xd8e6ea, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
  const r = K.rng(32);
  for (let i = 0; i < 9; i++) {
    const tri = new THREE.Shape();
    tri.moveTo(0, 0);
    tri.lineTo(0.15 + r() * 0.25, 0);
    tri.lineTo(r() * 0.2, 0.2 + r() * 0.3);
    tri.closePath();
    const shard = new THREE.Mesh(new THREE.ShapeGeometry(tri), shardMat);
    const corner = i % 4;
    shard.position.set(corner % 2 ? 0.75 : -0.85, sillY + (corner < 2 ? 0.05 : winH - 0.45), -27.44);
    shard.rotation.z = r() * 6;
    room.add(shard);
  }
  const floorGlass = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.05), shardMat, 50);
  const o = new THREE.Object3D();
  for (let i = 0; i < 50; i++) {
    o.position.set((r() - 0.5) * 2.4, F + 0.02, -26.6 + r() * 1.4);
    o.rotation.set(r() * 3, r() * 3, r() * 3);
    o.scale.set(1, 0.2, 1 + r());
    o.updateMatrix();
    floorGlass.setMatrixAt(i, o.matrix);
  }
  room.add(floorGlass);
  const view = new THREE.Mesh(new THREE.PlaneGeometry(14, 10.5), new THREE.MeshBasicMaterial({ map: morningView(), fog: false }));
  view.position.set(0, sillY + 1.2, -33);
  room.add(view);
  const sun = new THREE.DirectionalLight(0xffe0b4, 4.5);
  sun.position.set(-2.5, sillY + 6, -34);
  sun.target.position.set(0.6, F, -23);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
  scene.add(sun, sun.target);
  const morningFill = new THREE.PointLight(0xffe8c8, 3, 10, 2);
  morningFill.position.set(0, F + 2.6, -24.5);
  scene.add(morningFill);
  // two pictures on the drawing-room walls, found again in daylight
  for (const [sx, z] of [[-1, -22.2], [1, -24.6]]) {
    model(room, 'fancy_picture_frame_01', { position: [sx * 3.0, F + 1.75, z], rotation: [0, -sx * Math.PI / 2, 0], scale: 1.5 });
  }
  // Anna on the sill
  K.jackdaw(room, { x: 0.3, y: sillY + 0.04, z: -27.22, ry: -Math.PI / 2 + 0.75, scale: 1.25 });

  return {
    scene,
    exposure: 1.2,
    beats: [
      { pos: new THREE.Vector3(0, 1.5, 1.6), look: new THREE.Vector3(0, -0.6, -4) },
      { pos: new THREE.Vector3(0, 0.45, -1.6), look: new THREE.Vector3(0.1, -2.2, -7.5) },
      { pos: new THREE.Vector3(0, -2.6, -5.6), look: new THREE.Vector3(0, -10, -17) },
      { pos: new THREE.Vector3(0.2, -3.85, -7.6), look: new THREE.Vector3(2.5, -4.25, -7.6) },
      { pos: new THREE.Vector3(0.62, sillY + 0.62, -25.7), look: new THREE.Vector3(0.28, sillY + 0.14, -27.2), via: [new THREE.Vector3(0.1, -6.5, -10.5), new THREE.Vector3(0.1, -10.3, -15.8), new THREE.Vector3(0.1, F + 1.75, -19.6)] },
    ],
    update(t, dt, s, cam) {
      near.position.set(cam.x, cam.y + 0.3, cam.z - 0.4);
      // the darkness thins once the reader is in the morning room
      const morning = K.smoothstep(3.4, 3.9, s);
      scene.fog.density = 0.09 * (1 - morning) + 0.01 * morning;
      scene.background = morningSky && morning > 0.01 ? morningSky : darkBg;
      light?.(cam, dt);
      view.visible = !morningSky;
      // the glass brightens, cracks, and goes out
      mirror.update(t, 0.3 + 0.9 * K.smoothstep(2.4, 2.9, s));
      mirror.uniforms.uCrack.value = K.smoothstep(2.95, 3.1, s);
      mirror.uniforms.uOut.value = K.smoothstep(3.1, 3.4, s);
    },
  };
}
