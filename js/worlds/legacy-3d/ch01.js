// Chapter One: The Eleven Feet. Forefore's east wing at night: the dining room
// "designed to make twelve people feel insufficient", the east-wing landing with
// a chair across the door, the attic with the string, and the clean room where
// the mirror stands.
import * as THREE from 'three';
import * as K from '../kit.js';
import { pbr, model, sky, lightZones } from '../../assets.js';

export function build(ctx = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050608);
  scene.fog = new THREE.FogExp2(0x050608, 0.03);

  // Photographed surfaces (Poly Haven, CC0), tinted to the house.
  const floorDark = pbr('old_wooden_floor_02', { color: 0x8a6650, roughness: 1.35, envMapIntensity: 0.55 });
  const floorPale = pbr('old_wooden_floor_02', { color: 0xd8c6ae, roughness: 1.35, envMapIntensity: 0.55 });
  const damask = pbr('quatrefoil_jacquard_fabric', { color: 0xa89088, repeat: [1.5, 1.5] }); // crimson jacquard
  const panel = pbr('oak_wood_planks', { color: 0x6b4630 });
  const darkWood = pbr('oak_wood_planks', { color: 0x5a3622 });
  const plaster = pbr('plastered_wall_03', { color: 0xd6ccb8 });
  const white = pbr('plastered_wall_03', { color: 0xffffff });
  // a faint real night sky, for reflections on wood, brass and glass
  // Image-based light from photographed rooms (Poly Haven): a room by its fire for the dining
  // room and the landing, a timber attic for the attic. It follows the camera from room to room.
  const light = ctx.renderer ? lightZones(scene, ctx.renderer, [
    { sky: 'pine_attic', intensity: 0.34, when: (c) => c.z < -16.2 && c.z > -27 },
    { sky: 'fireplace', intensity: 0.36, when: (c) => c.z < -9 && c.z >= -16.2 },
    { sky: 'fireplace', intensity: 0.62 },
  ]) : null;
  const brass = K.metal.brass();
  const gilt = K.std({ color: 0xb08a45, metalness: 0.9, roughness: 0.35 });
  const flames = [];

  // ---- the dining room ----
  K.room(scene, { w: 7, h: 3.6, z0: 3.4, z1: -9, floor: floorDark, wall: damask, ceiling: darkWood, farDoor: 1.4, doorH: 2.5 });
  for (const sx of [-1, 1]) K.box(scene, 0.06, 1.2, 11, panel, sx * 3.47, 0.6, -3.4, { uv: 1.2 }); // wainscot
  for (let z = 1.6; z > -9; z -= 1.4) K.box(scene, 7, 0.22, 0.24, darkWood, 0, 3.49, z, { uv: 1 }); // carved beams
  for (const z of [-1.35, -3.6, -5.85]) model(scene, 'dining_table', {
    position: [-1.2, 0, z],
    rotation: [0, Math.PI / 2, 0],
    align: 'bottom',
    // bare polished wood: the model's checked cloth belongs in a farmhouse, not at Forefore
    onLoad: (obj) => { obj.getObjectByName('dining_table_cloth').visible = false; },
  });
  for (let i = 0; i < 6; i++) {
    const z = -0.6 - i * 1.2;
    model(scene, 'dining_chair_02', { position: [-0.32, 0, z], rotation: [0, -Math.PI / 2, 0], align: 'bottom' });
    model(scene, 'dining_chair_02', { position: [-2.08, 0, z], rotation: [0, Math.PI / 2, 0], align: 'bottom' });
  }
  // "At either end of the long table, the silver candlesticks stood like sentries."
  for (const z of [-0.5, -6.7]) {
    for (const dx of [-0.25, 0.25]) flames.push(K.candlestick(scene, brass, -1.2 + dx, 0.79, z, { intensity: 1.6, distance: 8 }));
  }
  // "Dark portraits watched from panelled walls."
  [[-3.48, 1.95, -1.2, 1], [-3.48, 2.0, -4.0, 2], [-3.48, 1.95, -6.8, 3], [3.48, 2.0, -2.6, 4], [3.48, 1.95, -5.6, 5]].forEach(([x, y, z, seed]) => {
    K.framedPicture(scene, K.tex.portrait(seed), { w: 0.9, h: 1.15, x, y, z, ry: x < 0 ? Math.PI / 2 : -Math.PI / 2, frameMat: gilt });
  });
  // tall windows on the right wall, with moonlight behind them
  for (const z of [-1.0, -7.0]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.2), new THREE.MeshBasicMaterial({ color: 0x24324a }));
    win.position.set(3.47, 1.7, z);
    win.rotation.y = -Math.PI / 2;
    scene.add(win);
  }
  scene.add(new THREE.HemisphereLight(0x3a4560, 0x1a0e06, 0.7));

  // A brass chandelier hanging over the table, its candles glowing.
  model(scene, 'Chandelier_02', { position: [-1.2, 3.6, -3.6], scale: 1.5, align: 'top' });
  flames.push(K.flame(scene, -1.2, 2.55, -3.6, { light: false, scale: 4, color: 0xffb867 }));
  const chandelier = new THREE.PointLight(0xffb867, 9, 12, 2);
  chandelier.position.set(-1.2, 2.4, -3.6);
  chandelier.castShadow = true;
  chandelier.shadow.mapSize.set(512, 512);
  scene.add(chandelier);
  flames.push({ update: (t) => (chandelier.intensity = 9 * (0.92 + Math.sin(t * 9.1) * 0.04 + Math.sin(t * 17.3) * 0.03)) });

  // A fire in the grate on the right-hand wall.
  const marble = K.std({ color: 0x2a2724, roughness: 0.35, metalness: 0.1 });
  K.box(scene, 0.35, 1.25, 1.9, marble, 3.3, 0.62, -4.0, { uv: 1 });
  K.box(scene, 0.5, 0.12, 2.2, marble, 3.25, 1.3, -4.0, { uv: 1 });
  const grate = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.75), new THREE.MeshBasicMaterial({ color: 0x0a0604 }));
  grate.rotation.y = -Math.PI / 2;
  grate.position.set(3.12, 0.45, -4.0);
  scene.add(grate);
  for (const [dz, dy, s] of [[-0.2, 0.3, 1.8], [0.15, 0.28, 2.2], [0.0, 0.4, 2.6]]) {
    flames.push(K.flame(scene, 3.05, dy, -4.0 + dz, { color: 0xff7a2a, light: false, scale: s }));
  }
  const fire = new THREE.PointLight(0xff8a3a, 6, 9, 2);
  fire.position.set(2.6, 0.6, -4.0);
  scene.add(fire);
  flames.push({ update: (t) => (fire.intensity = 6 * (0.85 + Math.sin(t * 7.3) * 0.08 + Math.sin(t * 13.1) * 0.06)) });

  // ---- the east-wing landing ----
  K.room(scene, { w: 2.4, h: 3.0, z0: -9, z1: -16, floor: floorDark, wall: plaster, ceiling: plaster, nearDoor: 1.4, farDoor: 1.1, doorH: 2.2 });
  K.box(scene, 0.9, 0.012, 6.6, K.std({ map: K.tex.fabric('#4a1414', 21), roughness: 0.95 }), 0, 0.006, -12.6, { uv: 0 }); // runner
  // "a heavy chair had been placed across it"
  K.chair(scene, { mat: darkWood, x: 0, z: -15.55, ry: Math.PI / 2 + 0.15 });
  flames.push(K.candlestick(scene, brass, -0.75, 0, -14.9, { intensity: 1.3, distance: 5, scale: 0.9 })); // a candle stub on the boards
  // a candle in a brass sconce halfway along, the only other light on the landing
  K.box(scene, 0.06, 0.18, 0.12, brass, 1.17, 1.72, -12.9, { uv: 0 });
  K.box(scene, 0.16, 0.02, 0.1, brass, 1.12, 1.64, -12.9, { uv: 0 });
  const sconceCandle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.14, 12), K.std({ color: 0xf2e8d2, roughness: 0.6 }));
  sconceCandle.position.set(1.08, 1.72, -12.9);
  scene.add(sconceCandle);
  flames.push(K.flame(scene, 1.08, 1.83, -12.9, { intensity: 1.8, distance: 6, scale: 0.7 }));
  K.box(scene, 0.025, 0.8, 0.025, K.metal.iron(), 0.95, 0.4, -15.3, { rz: 0.35, uv: 0 }); // the fire iron
  K.framedPicture(scene, K.tex.portrait(7), { w: 0.6, h: 0.8, x: -1.19, y: 1.7, z: -12, ry: Math.PI / 2, frameMat: gilt });

  // ---- the attic ----
  const attic = new THREE.Group();
  scene.add(attic);
  K.box(attic, 5, 0.2, 11, floorPale, 0, -0.1, -21.5);
  for (const sx of [-1, 1]) {
    // knee walls and the slope of the roof
    K.box(attic, 0.2, 1.2, 11, plaster, sx * 2.6, 0.6, -21.5);
    const slope = K.box(attic, 3.2, 0.12, 11, darkWood, sx * 1.35, 2.25, -21.5, { rz: sx * -0.72 });
    slope.receiveShadow = true;
  }
  for (let z = -16.5; z > -27; z -= 1.0) {
    for (const sx of [-1, 1]) K.box(attic, 3.1, 0.14, 0.12, darkWood, sx * 1.3, 2.2, z, { rz: sx * -0.72, uv: 1 }); // rafters
    K.box(attic, 4.6, 0.12, 0.12, darkWood, 0, 2.05, z, { uv: 1 }); // ties
  }
  K.box(attic, 5.4, 3.4, 0.2, plaster, 0, 1.7, -16.05); // near gable, with the doorway cut
  // The string, knotted at every yard, stretched across the attic.
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 4.9, 6), K.std({ color: 0xd9c8a0, roughness: 0.9 }));
  string.rotation.z = Math.PI / 2;
  string.position.set(0, 1.25, -21.2);
  attic.add(string);
  for (let x = -2.4; x <= 2.4; x += 0.9144) {
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), string.material);
    knot.position.set(x, 1.25, -21.2);
    attic.add(knot);
  }
  model(attic, 'book_encyclopedia_set_01', { position: [-1.7, 0, -20.4], rotation: [0, 0.4, 0], align: 'bottom', scale: 1.2 });
  model(attic, 'book_encyclopedia_set_01', { position: [1.5, 0, -22.8], rotation: [0, -1.2, 0], align: 'bottom', scale: 1.2 });
  model(attic, 'Lantern_01', { position: [-1.2, 0, -20.0], align: 'bottom', scale: 1.4 });
  // A shaft of moonlight from a skylight, with dust hanging in it.
  const moon = new THREE.SpotLight(0x9fb4e0, 32, 14, 0.42, 0.6, 1.4);
  moon.position.set(-1.4, 3.6, -19.5);
  moon.target.position.set(0.4, 0, -21.8);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  scene.add(moon, moon.target);
  const skylight = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ color: 0x7d93c4 }));
  skylight.position.set(-1.35, 2.62, -19.5);
  skylight.rotation.set(Math.PI / 2, 0.72, 0);
  attic.add(skylight);
  K.lightShaft(attic, { from: new THREE.Vector3(-1.35, 2.6, -19.5), to: new THREE.Vector3(0.4, 0, -21.8), r0: 0.36, r1: 1.0, color: 0x9fb4e0, opacity: 0.13 });
  flames.push(K.flame(scene, -1.2, 0.22, -20.0, { intensity: 1.4, distance: 5, scale: 0.7 })); // the lantern, lit
  const dust = K.motes(scene, { count: 500, min: new THREE.Vector3(-1.6, 0.2, -23), max: new THREE.Vector3(1.2, 3, -19.5), color: 0xc8d6ff, size: 0.025, opacity: 0.55 });

  // ---- the clean room, behind the wall ----
  K.room(scene, { w: 3.6, h: 3.2, z0: -27, z1: -33.5, floor: floorPale, wall: white, ceiling: white, nearDoor: 1.2, doorH: 2.3 });
  K.box(scene, 5.4, 3.4, 0.2, plaster, 0, 1.7, -27.0, { uv: 2 });
  const mirror = K.greenMirror(scene, { x: 0, z: -31.2 });
  const roomLight = new THREE.PointLight(0xfff4e2, 3.2, 9, 2);
  roomLight.position.set(0, 2.9, -29.5);
  scene.add(roomLight);

  return {
    scene,
    exposure: 1.15,
    backScale: 0.4,
    // 0: establishing; then one camera per caption, in the registry's order.
    beats: [
      { pos: new THREE.Vector3(2.4, 1.7, 1.6), look: new THREE.Vector3(-1.0, 1.0, -5.5) },
      { pos: new THREE.Vector3(1.35, 1.6, -0.6), look: new THREE.Vector3(-1.4, 0.95, -6.4) },
      { pos: new THREE.Vector3(0, 1.6, -10.6), look: new THREE.Vector3(0, 0.7, -15.8), via: [new THREE.Vector3(0.5, 1.65, -7.6), new THREE.Vector3(0, 1.65, -9.3)] },
      { pos: new THREE.Vector3(0.6, 1.45, -17.4), look: new THREE.Vector3(-0.5, 1.15, -22.5), via: [new THREE.Vector3(0, 1.75, -15.2), new THREE.Vector3(0, 1.7, -16.4)] },
      { pos: new THREE.Vector3(0, 1.45, -28.0), look: new THREE.Vector3(0, 1.3, -31.2), via: [new THREE.Vector3(0, 1.5, -26.0), new THREE.Vector3(0, 1.45, -27.2)] },
    ],
    update(t, dt, s, cam) {
      light?.(cam, dt);
      for (const f of flames) f.update(t);
      dust.update(t);
      // the glass wakes as the reader reaches it
      mirror.update(t, 0.3 + 0.7 * K.smoothstep(3.2, 4.2, s));
    },
  };
}
