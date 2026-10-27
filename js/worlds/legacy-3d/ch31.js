// Chapter Thirty-one: The Armchair. Forefore at night. "Something unfolded from
// it"; Vivrant stepping over the fallen door; the long-case clock that "struck
// once as it broke. Its weights came down on the flags"; and at the bottom of the
// flight, her father in the kitchen doorway. The creature and the father are
// shown as shapes against the light, not as models.
import * as THREE from 'three';
import * as K from '../kit.js';
import { pbr, model, sky, lightZones } from '../../assets.js';

// A dark figure cut from the light: plated skull, broad shoulders, a tail.
function creatureSilhouette() {
  return K.canvasTex(256, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#020302';
    g.beginPath();
    g.moveTo(128, 20); // crown
    for (let i = 0; i < 5; i++) {
      g.lineTo(108 - i * 3, 34 + i * 14);
      g.lineTo(118 - i * 2, 40 + i * 14);
    }
    g.quadraticCurveTo(84, 120, 60, 150); // neck to shoulder
    g.quadraticCurveTo(30, 170, 34, 250); // arm
    g.quadraticCurveTo(30, 330, 44, 360);
    g.lineTo(58, 356);
    g.quadraticCurveTo(66, 280, 74, 240);
    g.lineTo(80, 330);
    g.quadraticCurveTo(84, 420, 92, 492); // leg
    g.lineTo(120, 492);
    g.lineTo(128, 360);
    g.lineTo(136, 492);
    g.lineTo(164, 492);
    g.quadraticCurveTo(172, 420, 176, 330);
    g.lineTo(182, 240);
    g.quadraticCurveTo(190, 280, 198, 356);
    g.lineTo(212, 360);
    g.quadraticCurveTo(226, 330, 222, 250);
    g.quadraticCurveTo(226, 170, 196, 150);
    g.quadraticCurveTo(172, 120, 148, 100);
    for (let i = 4; i >= 0; i--) {
      g.lineTo(138 + i * 2, 40 + i * 14);
      g.lineTo(148 + i * 3, 34 + i * 14);
    }
    g.closePath();
    g.fill();
    // the tail, curling round behind
    g.lineWidth = 22;
    g.lineCap = 'round';
    g.strokeStyle = '#020302';
    g.beginPath();
    g.moveTo(150, 360);
    g.quadraticCurveTo(250, 420, 200, 500);
    g.stroke();
    // a faint copper-green edge where the firelight catches the plates
    g.globalCompositeOperation = 'source-atop';
    const rim = g.createLinearGradient(0, 0, w, 0);
    rim.addColorStop(0, 'rgba(90,140,100,0.7)');
    rim.addColorStop(0.2, 'rgba(0,0,0,0)');
    g.fillStyle = rim;
    g.fillRect(0, 0, w, h);
  });
}

// A man in a doorway, in a long coat, one hand raised to the frame: drawn with curves,
// at a man's proportions (the head an eighth of his height), softened at the edge where
// the kitchen light wraps round him.
function manSilhouette() {
  return K.canvasTex(256, 512, (g) => {
    g.clearRect(0, 0, 256, 512);
    g.fillStyle = '#060504';
    g.shadowColor = 'rgba(6,5,4,0.85)';
    g.shadowBlur = 6;
    // head and neck
    g.beginPath();
    g.ellipse(124, 52, 21, 27, -0.05, 0, Math.PI * 2);
    g.fill();
    g.fillRect(114, 72, 20, 18);
    // shoulders, coat and legs, as one body
    g.beginPath();
    g.moveTo(118, 86);
    g.bezierCurveTo(96, 88, 78, 96, 72, 112); // left shoulder
    g.bezierCurveTo(64, 160, 66, 230, 70, 280); // left arm hanging
    g.bezierCurveTo(72, 296, 84, 300, 86, 286);
    g.bezierCurveTo(84, 250, 84, 200, 88, 168);
    g.bezierCurveTo(86, 240, 80, 330, 84, 372); // coat hem, left
    g.lineTo(98, 374);
    g.bezierCurveTo(98, 420, 100, 470, 98, 496); // left leg
    g.lineTo(122, 498);
    g.bezierCurveTo(124, 460, 126, 410, 128, 378);
    g.bezierCurveTo(130, 410, 134, 460, 136, 498); // right leg
    g.lineTo(160, 496);
    g.bezierCurveTo(158, 470, 158, 420, 158, 374);
    g.lineTo(170, 372);
    g.bezierCurveTo(172, 320, 170, 230, 166, 172); // coat, right
    g.bezierCurveTo(176, 150, 188, 128, 196, 108); // right arm going up
    g.bezierCurveTo(206, 86, 214, 66, 222, 50); // to the hand
    g.lineTo(234, 54);
    g.bezierCurveTo(226, 80, 214, 112, 200, 140);
    g.bezierCurveTo(190, 160, 180, 170, 176, 176);
    g.bezierCurveTo(172, 130, 160, 96, 132, 86);
    g.closePath();
    g.fill();
    // two fingers on the frame
    g.fillRect(228, 34, 6, 22);
    g.fillRect(236, 36, 5, 18);
  });
}

export function build(ctx = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030407);
  scene.fog = new THREE.FogExp2(0x030407, 0.05);
  // a little moonlight in every reflection
  // a photographed room lit by its fire at night (Poly Haven): warm bounce in the sitting room,
  // less of it out in the hall and on the stair
  const light = ctx.renderer ? lightZones(scene, ctx.renderer, [
    { sky: 'fireplace', intensity: 0.26, when: (c) => c.z < -6 },
    { sky: 'fireplace', intensity: 0.5 },
  ]) : null;

  // Photographed surfaces (Poly Haven, CC0): old boards, red jacquard on the
  // walls, lime plaster, stone flags, dark oak.
  const boards = pbr('old_wooden_floor_02', { color: 0xc8b098, roughness: 1.35, envMapIntensity: 0.55 });
  const damask = pbr('plastered_wall_03', { color: 0x8a3330 }); // painted plaster, Pompeian red
  const plaster = pbr('plastered_wall_03', { color: 0xd2c8b6 });
  const flags = pbr('castle_wall_slates', { color: 0xb4aea4 });
  const wood = pbr('oak_wood_planks', { color: 0x5e4432 });
  const flames = [];

  // ---- the sitting room ----
  K.room(scene, { w: 6, h: 3.4, z0: 3.4, z1: -6, floor: boards, wall: damask, ceiling: plaster, farDoor: 1.6, doorH: 2.5 });
  K.box(scene, 2.6, 0.012, 3.4, pbr('velour_velvet', { color: 0x8a5a48, repeat: [2.5, 3] }), -0.6, 0.006, -2.4, { uv: 0 });
  // oak wainscot to the dado rail, with a skirting, a picture rail and a cornice
  const panelWood = pbr('oak_wood_planks', { color: 0x4a3426 });
  const moulding = K.std({ color: 0x3a281c, roughness: 0.45 });
  for (const [sx, len, zc] of [[-1, 8.4, -1.8], [1, 8.4, -1.8]]) {
    K.box(scene, 0.05, 1.0, len, panelWood, sx * 2.975, 0.5, zc, { uv: 0.8 });
    K.box(scene, 0.07, 0.06, len, moulding, sx * 2.96, 1.02, zc, { uv: 0 });
    K.box(scene, 0.06, 0.14, len, moulding, sx * 2.965, 0.07, zc, { uv: 0 });
    K.box(scene, 0.05, 0.04, len, moulding, sx * 2.97, 2.62, zc, { uv: 0 });
    K.box(scene, 0.14, 0.16, len, K.std({ color: 0xd8cfbe, roughness: 0.7 }), sx * 2.93, 3.32, zc, { uv: 0 });
    for (let z = 2.0; z > -5.8; z -= 0.9) {
      K.box(scene, 0.02, 0.62, 0.66, moulding, sx * 2.945, 0.52, z - 0.45, { uv: 0 }); // raised panels
    }
  }
  // the chimneypiece: pilasters, a moulded shelf, an arched iron fireback, the fire burned down to embers
  const marble = pbr('chipped_concrete', { color: 0x2a2622, roughness: 0.4 });
  const ironBlack = K.std({ color: 0x141312, metalness: 0.6, roughness: 0.55 });
  for (const dz of [-0.82, 0.82]) {
    K.box(scene, 0.32, 1.3, 0.3, marble, -2.82, 0.65, -2.5 + dz, { uv: 0.6 });
    K.box(scene, 0.36, 0.08, 0.34, marble, -2.8, 0.04, -2.5 + dz, { uv: 0.6 });
  }
  K.box(scene, 0.32, 0.3, 1.94, marble, -2.82, 1.15, -2.5, { uv: 0.6 });
  K.box(scene, 0.55, 0.07, 2.3, marble, -2.78, 1.335, -2.5, { uv: 0.6 });
  K.box(scene, 0.5, 0.04, 2.2, marble, -2.79, 1.29, -2.5, { uv: 0.6 });
  K.box(scene, 0.9, 0.05, 2.1, marble, -2.6, 0.025, -2.5, { uv: 0.6 }); // the hearth
  const arch = new THREE.Shape();
  arch.moveTo(-0.5, 0); arch.lineTo(-0.5, 0.55); arch.absarc(0, 0.55, 0.5, Math.PI, 0, true); arch.lineTo(0.5, 0); arch.lineTo(-0.5, 0);
  const fireback = new THREE.Mesh(new THREE.ShapeGeometry(arch, 24), ironBlack);
  fireback.rotation.y = Math.PI / 2;
  fireback.position.set(-2.97, 0.02, -2.5);
  scene.add(fireback);
  for (let i = 0; i < 6; i++) K.box(scene, 0.02, 0.02, 0.7, ironBlack, -2.6, 0.12 + i * 0.05, -2.5, { uv: 0 }); // the grate bars
  const coals = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.66), K.std({ color: 0x1a0a05, emissive: 0xff4a10, emissiveIntensity: 1.6, roughness: 0.9 }));
  coals.position.set(-2.66, 0.16, -2.5);
  scene.add(coals);
  model(scene, 'mantel_clock_01', { position: [-2.8, 1.37, -2.5], rotation: [0, Math.PI / 2, 0], align: 'bottom', scale: 1.0 });
  const brassC = K.metal.brass();
  for (const dz of [-0.95, 0.95]) flames.push(K.candlestick(scene, brassC, -2.8, 1.37, -2.5 + dz, { intensity: 0.7, distance: 4, scale: 0.6 }));
  model(scene, 'fancy_picture_frame_01', { position: [-2.92, 2.2, -2.5], rotation: [0, Math.PI / 2, 0], scale: 2.0 });
  // books on the worn shelves by the window
  model(scene, 'wooden_bookshelf_worn', { position: [2.65, 0, -3.4], rotation: [0, -Math.PI / 2, 0], align: 'bottom', scale: 1.0 });
  const grate = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.75), new THREE.MeshBasicMaterial({ color: 0x080403 }));
  grate.rotation.y = Math.PI / 2;
  grate.position.set(-2.63, 0.45, -2.5);
  scene.add(grate);
  for (const [dz, s] of [[-0.25, 1.6], [0.1, 2.1], [0.3, 1.3]]) flames.push(K.flame(scene, -2.55, 0.2, -2.5 + dz, { color: 0xff5a1a, light: false, scale: s }));
  const embers = new THREE.PointLight(0xff6a24, 11, 10, 1.8);
  embers.position.set(-2.2, 0.4, -2.5);
  embers.castShadow = true;
  embers.shadow.mapSize.set(512, 512);
  scene.add(embers);
  // her mother's armchair, facing the fire
  model(scene, 'ArmChair_01', { position: [-1.0, 0, -2.5], rotation: [0, -Math.PI / 2, 0], scale: 1.08, align: 'bottom' });
  // the thing that unfolds from it, and its shadow up the wall behind
  const creatureTex = creatureSilhouette();
  const creature = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.3), new THREE.MeshBasicMaterial({ map: creatureTex, transparent: true, alphaTest: 0.05, depthWrite: false }));
  // rising from the seat, on the fire side of the chair's high back
  creature.position.set(-1.3, 0, -2.5);
  creature.rotation.y = Math.PI / 2 - 0.3;
  scene.add(creature);
  // its shadow, thrown huge up the chimney breast by the fire below
  const shadowOnWall = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3.0), new THREE.MeshBasicMaterial({ map: creatureTex, transparent: true, opacity: 0, depthWrite: false }));
  shadowOnWall.position.set(-2.96, 2.2, -2.3);
  shadowOnWall.rotation.y = Math.PI / 2;
  scene.add(shadowOnWall);
  // a tall window with the moon in it
  const winMat = new THREE.MeshBasicMaterial({ color: 0x2a3a5e });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), winMat);
  win.position.set(2.99, 1.7, 0.4);
  win.rotation.y = -Math.PI / 2;
  scene.add(win);
  const moon = new THREE.SpotLight(0x8ea4d6, 34, 16, 0.55, 0.7, 1.4);
  moon.position.set(4.5, 3.0, 0.4);
  moon.target.position.set(-1, 0, -1.5);
  scene.add(moon, moon.target);
  scene.add(new THREE.HemisphereLight(0x2e3a58, 0x140a06, 0.7));

  // ---- the hall ----
  K.room(scene, { w: 3.4, h: 3.6, z0: -6, z1: -15, floor: flags, wall: plaster, ceiling: plaster, nearDoor: 1.6, farDoor: 1.4, doorH: 2.4 });
  // the front door, off its hinges and lying on the flags
  const fallenDoor = new THREE.Group();
  fallenDoor.position.set(0.25, 0, -8.6);
  fallenDoor.rotation.y = 0.35;
  scene.add(fallenDoor);
  model(fallenDoor, 'large_castle_door', { pick: 'large_castle_door_left', position: [0, 0.07, 1.1], rotation: [-Math.PI / 2, 0, 0], scale: 0.8, align: 'bottom' });
  // the empty doorway it came from, with the night outside
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.3), new THREE.MeshBasicMaterial({ color: 0x1a2440 }));
  outside.position.set(1.69, 1.15, -8.2);
  outside.rotation.y = -Math.PI / 2;
  scene.add(outside);
  const nightIn = new THREE.SpotLight(0x9fb4e0, 18, 14, 0.6, 0.8, 1.6);
  nightIn.position.set(3.0, 2.0, -8.2);
  nightIn.target.position.set(-0.5, 0, -8.8);
  nightIn.castShadow = true;
  nightIn.shadow.mapSize.set(1024, 1024);
  scene.add(nightIn, nightIn.target);
  // the umbrella stand, knocked over
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.55, 18, 1, true), K.metal.brass());
  stand.rotation.z = Math.PI / 2;
  stand.position.set(-1.1, 0.15, -7.6);
  scene.add(stand);
  for (const [dx, dz, ry] of [[-0.6, -7.9, 0.4], [-0.4, -7.3, -0.3]]) K.box(scene, 0.03, 0.03, 0.85, K.std({ color: 0x111111 }), -1.1 + dx + 0.8, 0.03, dz, { ry, uv: 0 });
  // the long-case clock, broken on the flags, its weights fallen
  const fallenClock = new THREE.Group();
  fallenClock.position.set(-0.6, 0, -12);
  fallenClock.rotation.y = 0.4;
  scene.add(fallenClock);
  model(fallenClock, 'vintage_grandfather_clock_01', { position: [1.0, 0.31, 0], rotation: [0, 0, Math.PI / 2 - 0.18], align: 'bottom' });
  const brass = K.metal.brass();
  for (const [wx, wz] of [[0.6, 0.5], [0.95, 0.35]]) {
    const w8 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 16), brass);
    w8.rotation.z = Math.PI / 2;
    w8.position.set(-0.6 + wx, 0.05, -12 + wz);
    w8.castShadow = true;
    scene.add(w8);
  }
  model(scene, 'Lantern_01', { position: [1.2, 0, -12.6], scale: 1.4, align: 'bottom' });
  const lampOnFloor = K.flame(scene, 1.2, 0.17, -12.6, { intensity: 1.2, distance: 5, scale: 0.8 });
  flames.push(lampOnFloor);

  // ---- the flight down to the kitchen ----
  K.stairs(scene, { steps: 9, width: 1.3, mat: wood, railMat: wood, x: 0, y: -0.1, z: -15.2, down: true });
  K.box(scene, 3.4, 0.2, 3, flags, 0, -1.95, -18.6);
  const kitchen = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), new THREE.MeshBasicMaterial({ color: 0xffc27a }));
  kitchen.material.color.multiplyScalar(1.5);
  kitchen.position.set(0, -0.75, -19.4);
  scene.add(kitchen);
  K.box(scene, 3.4, 4.4, 0.2, plaster, 0, -0.3, -19.55, { uv: 2 }).visible = false; // (wall behind, kept for shadows)
  const father = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.75), new THREE.MeshBasicMaterial({ map: manSilhouette(), transparent: true, alphaTest: 0.05, depthWrite: false }));
  father.position.set(0.05, -0.97, -19.35);
  scene.add(father);
  const kitchenLight = new THREE.PointLight(0xffb468, 9, 9, 2);
  kitchenLight.position.set(0, -0.6, -18.9);
  scene.add(kitchenLight);
  for (const sx of [-1, 1]) K.box(scene, 0.12, 2.4, 0.2, wood, sx * 0.62, -0.75, -19.35, { uv: 0 }); // the door frame

  return {
    scene,
    exposure: 1.55,
    backScale: 0.4,
    beats: [
      { pos: new THREE.Vector3(2.0, 1.6, 1.8), look: new THREE.Vector3(-1.0, 1.0, -3.0) },
      { pos: new THREE.Vector3(1.7, 1.75, 0.3), look: new THREE.Vector3(-1.5, 1.3, -2.6) },
      { pos: new THREE.Vector3(0, 1.65, -7.0), look: new THREE.Vector3(0.3, 0.1, -9.4), via: [new THREE.Vector3(0.3, 1.6, -5.0), new THREE.Vector3(0, 1.65, -6.2)] },
      { pos: new THREE.Vector3(0.9, 1.45, -10.0), look: new THREE.Vector3(-0.6, 0.35, -12.0) },
      { pos: new THREE.Vector3(0, 1.4, -14.4), look: new THREE.Vector3(0, -0.8, -19.2) },
    ],
    update(t, dt, s, cam) {
      light?.(cam, dt);
      for (const f of flames) f.update(t);
      embers.intensity = 11 * (0.8 + Math.sin(t * 5.3) * 0.1 + Math.sin(t * 11.7) * 0.08);
      // "Something unfolded from it, slowly"
      const rise = K.smoothstep(0.55, 1.25, s);
      creature.scale.set(1, 0.15 + rise * 0.85, 1);
      creature.position.y = (0.15 + rise * 0.85) * 1.15;
      creature.material.opacity = Math.min(1, rise * 3);
      creature.material.transparent = true;
      shadowOnWall.material.opacity = 0.55 * rise * (1 - K.smoothstep(1.6, 2.0, s));
      shadowOnWall.scale.set(1, 0.3 + rise * 0.7, 1);
    },
  };
}
