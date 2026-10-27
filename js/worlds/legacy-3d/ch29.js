// Chapter Twenty-nine: Past Tense. The vault in Nevada: "The air struck the
// exposed side of the enclosure and drove dust out of every seam... Something hit
// the lead base above their heads, and the filament stretched across the passage
// snapped." Then, out of the ground: "Below them the desert opened into a broad
// empty valley. There were no roads in it. No buildings. Only pale ground and
// scrub, and a dry watercourse running towards mountains."
import * as THREE from 'three';
import * as K from '../kit.js';
import * as F from '../flora.js';
import { pbr, model, sky, blendedGround, lightZones } from '../../assets.js';

// turns the photographed dawn so its brightest sky sits where this world's sun rises
const DAWN_SKY_ROT = 1.86;

// the dry watercourse wanders down the valley floor towards the mountains
const course = (z) => Math.sin(z * 0.012) * 40 + Math.sin(z * 0.031) * 12;

function desert(x, z) {
  const ridge = 10 - K.smoothstep(0, 140, -z) * 42; // the high ground falls away into the valley
  const sides = Math.abs(x) * 0.08 * K.smoothstep(0, 120, -z);
  const dunes = K.fbm(x * 0.015, z * 0.015, 5) * 14;
  const wx = x + K.fbm(x * 0.004 + 3.3, z * 0.004, 3) * 120;
  const wz = z + K.fbm(x * 0.004, z * 0.004 + 9.1, 3) * 120;
  const mountains = K.smoothstep(320, 560, -z) * (Math.pow(K.ridged(wx * 0.005, wz * 0.005, 5), 1.6) * 260 + 20);
  const wash = Math.exp(-((x - course(z)) ** 2) / 60) * 3.5 * K.smoothstep(60, 160, -z);
  return ridge + sides + dunes + mountains - wash;
}

export function build(ctx = {}) {
  const scene = new THREE.Scene();
  const vaultBg = new THREE.Color(0x05060a);
  scene.background = vaultBg;
  scene.fog = new THREE.FogExp2(0x05060a, 0.06);

  // Photographed surfaces (Poly Haven, CC0): poured concrete, a worn slab floor,
  // weathered steel, and dull lead.
  const concrete = pbr('chipped_concrete', { color: 0xc4c0b8 });
  const slab = pbr('concrete_floor_worn_001', { color: 0xc8c6c0 });
  const steel = pbr('rusty_metal_02', { color: 0x8c949c });
  const lead = pbr('rusty_metal_02', { color: 0x4c5058 });
  const r = K.rng(29);

  // ---- the vault ----
  const W = 6;
  const H = 4;
  // (the vault runs back to z 6.5, so the camera, falling forward through the page, starts inside it)
  K.box(scene, W, 0.2, 16.5, slab, 0, -0.1, -1.75);
  for (const sx of [-1, 1]) K.box(scene, 0.2, H, 16.5, concrete, sx * (W / 2 + 0.1), H / 2, -1.75);
  K.box(scene, W + 0.4, H, 0.2, concrete, 0, H / 2, 6.5);
  // the ceiling, with the shaft opening above x 0, z -7
  K.box(scene, W, 0.3, 12.3, concrete, 0, H + 0.15, 0.35);
  K.box(scene, W, 0.3, 1.8, concrete, 0, H + 0.15, -9.1);
  for (const sx of [-1, 1]) K.box(scene, (W - 2.4) / 2, 0.3, 2.4, concrete, sx * (1.2 + (W - 2.4) / 4), H + 0.15, -7.0);
  // the shaft up to the surface
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 8, 24, 1, true), pbr('chipped_concrete', { color: 0xa8a49c, repeat: [4, 4], side: THREE.BackSide }));
  shaft.position.set(0, H + 4, -7);
  scene.add(shaft);
  for (let y = H + 0.6; y < H + 7.6; y += 0.4) K.box(scene, 0.5, 0.03, 0.03, steel, 0, y, -8.15, { uv: 0 }); // ladder rungs
  // the passage beyond
  K.box(scene, 1.8, 0.2, 6, slab, 0, -0.1, -13);
  for (const sx of [-1, 1]) K.box(scene, (W - 1.8) / 2, H, 0.2, concrete, sx * (0.9 + (W - 1.8) / 4), H / 2, -10);
  K.box(scene, 1.8, H - 2.7, 0.2, concrete, 0, 2.7 + (H - 2.7) / 2, -10);
  for (const sx of [-1, 1]) K.box(scene, 0.2, 2.6, 6, concrete, sx * 1.0, 1.3, -13);
  K.box(scene, 2.2, 0.2, 6, concrete, 0, 2.7, -13);
  // the enclosure: steel uprights carrying a lead base overhead
  for (const [x, z] of [[-1.4, -4.6], [1.4, -4.6], [-1.4, -8.4], [1.4, -8.4]]) K.box(scene, 0.18, 2.7, 0.18, steel, x, 1.35, z, { uv: 0 });
  K.box(scene, 3.2, 0.42, 4.2, lead, 0, 2.9, -6.5, { uv: 0 });
  for (const z of [-4.6, -8.4]) K.box(scene, 3.0, 0.16, 0.16, steel, 0, 2.62, z, { uv: 0 });
  // cable trays and conduit along the walls, the cables lying in them, pipes under the ceiling
  const cableMat = K.std({ color: 0x15161a, roughness: 0.6 });
  for (const sx of [-1, 1]) {
    K.box(scene, 0.12, 0.08, 12, steel, sx * 2.85, 3.3, -3.5, { uv: 0 });
    for (let c = 0; c < 4; c++) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 12, 6), cableMat);
      cable.rotation.x = Math.PI / 2;
      cable.position.set(sx * (2.81 + c * 0.025), 3.35, -3.5);
      scene.add(cable);
    }
  }
  const pipeMat = pbr('rusty_metal_02', { color: 0x8a8f94, repeat: [6, 1] });
  for (const [px, r] of [[-1.6, 0.09], [-1.3, 0.06], [1.9, 0.11]]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 13, 16), pipeMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(px, H - 0.25, -3.5);
    pipe.castShadow = true;
    scene.add(pipe);
    for (let z = 2.5; z > -9.5; z -= 2) K.box(scene, r * 2.6, 0.03, 0.05, steel, px, H - 0.25 + r + 0.01, z, { uv: 0 });
  }
  // hazard stripes on the enclosure, and painted lines on the floor
  const hazard = K.std({ map: K.canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#d9a91c'; g.fillRect(0, 0, w, h); g.fillStyle = '#16140f'; for (let y = -64; y < h; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + 32); g.lineTo(w, y + 52); g.lineTo(0, y + 20); g.fill(); } }), roughness: 0.6 });
  for (const [x, z] of [[-1.4, -4.6], [1.4, -4.6], [-1.4, -8.4], [1.4, -8.4]]) K.box(scene, 0.19, 0.9, 0.19, hazard, x, 0.45, z, { uv: 0 });
  const lineMat = K.std({ color: 0xc9a227, roughness: 0.7 });
  for (const sx of [-1, 1]) K.box(scene, 0.08, 0.005, 12, lineMat, sx * 2.2, 0.003, -3.5, { uv: 0 });
  // the blast door's frame at the passage, steel round the opening
  for (const sx of [-1, 1]) K.box(scene, 0.25, 2.8, 0.35, steel, sx * 1.02, 1.4, -10.05, { uv: 0 });
  K.box(scene, 2.3, 0.3, 0.35, steel, 0, 2.75, -10.05, { uv: 0 });
  // a red emergency lamp over the passage
  const emergency = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), new THREE.MeshBasicMaterial({ color: 0xff2a14 }));
  emergency.position.set(0, 3.05, -9.85);
  scene.add(emergency);
  const red = new THREE.PointLight(0xff3a1a, 0, 8, 2);
  red.position.set(0, 2.9, -9.6);
  scene.add(red);

  // Work lights: caged lamps on the walls, throwing cold light.
  const lamps = [];
  for (const [x, z] of [[-2.85, -1], [2.85, -5], [-2.85, -9]]) {
    const sx = Math.sign(x);
    model(scene, 'industrial_caged_sconce', { pick: 'industrial_caged_sconce_a', position: [sx * 3.0, 2.98, z], rotation: [0, -sx * Math.PI / 2, 0], scale: 1.3 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: 0xeaf2ff }));
    bulb.material.color.multiplyScalar(2);
    bulb.position.set(sx * (3.0 - 0.15), 3.1, z);
    scene.add(bulb);
    const l = new THREE.PointLight(0xdfe9ff, 10, 13, 1.8);
    l.position.copy(bulb.position);
    scene.add(l);
    lamps.push({ l, bulb, base: 10 });
    K.lightShaft(scene, { from: new THREE.Vector3(sx * 2.85, 3.05, z), to: new THREE.Vector3(sx * 1.6, 0, z), r0: 0.12, r1: 1.0, color: 0xdfe9ff, opacity: 0.12 });
  }
  const vaultFill = new THREE.HemisphereLight(0x5a6478, 0x1a1712, 0.8);
  scene.add(vaultFill);

  // The filament stretched across the passage, in two halves that will snap apart.
  const glow = new THREE.MeshBasicMaterial({ color: 0x9fe8ff });
  glow.color.multiplyScalar(2.2);
  const halves = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.9, 1.35, -10.6);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.9, 6), glow);
    wire.rotation.z = Math.PI / 2;
    wire.position.x = -sx * 0.45;
    pivot.add(wire);
    scene.add(pivot);
    halves.push({ pivot, sx });
  }
  // sparks and dust, driven by the blast
  const sparkCount = 220;
  const sparkPos = new Float32Array(sparkCount * 3);
  const sparkVel = [];
  for (let i = 0; i < sparkCount; i++) sparkVel.push(new THREE.Vector3((r() - 0.5) * 3, r() * 3, (r() - 0.5) * 3 + 1));
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xffb35a, size: 0.05, map: K.glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(sparks);
  const dustCount = 900;
  const dustPos = new Float32Array(dustCount * 3);
  const dustDir = [];
  for (let i = 0; i < dustCount; i++) {
    const side = r() < 0.5 ? -1 : 1;
    const seam = new THREE.Vector3(side * 2.9, 0.2 + r() * 3.6, -1 - r() * 9);
    dustDir.push({ seam, v: new THREE.Vector3(-side * (0.5 + r() * 2.5), (r() - 0.3) * 0.8, (r() - 0.5) * 1.5) });
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustCloud = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xb9ad98, size: 0.06, map: K.glowTexture(), transparent: true, opacity: 0, depthWrite: false }));
  scene.add(dustCloud);

  // ---- the desert valley at dawn ----
  K.terrain(scene, {
    size: 1400,
    depth: 1400,
    seg: 240,
    z: -560,
    height: desert,
    colour: (h, slope, x, z) => {
      const c = new THREE.Color(h > 60 ? 0x7a6050 : 0xa88a68);
      const nearWash = Math.exp(-((x - course(z)) ** 2) / 60);
      if (nearWash > 0.4 && h < 10) c.set(0xc4b08e);
      return c.offsetHSL(0, 0, (K.fbm(x * 0.05, z * 0.05, 3) - 0.5) * 0.12 - slope * 0.15);
    },
    // sand in the wash, stony ground across the valley, bare rock on the mountains
    weights: (h, slope, x, z) => {
      const wash = K.smoothstep(0.3, 0.7, Math.exp(-((x - course(z)) ** 2) / 60)) * (h < 10 ? 1 : 0);
      const rock = (1 - wash) * Math.max(K.smoothstep(40, 80, h), K.smoothstep(0.3, 0.55, slope));
      return [wash, Math.max(0, 1 - wash - rock), rock];
    },
    material: blendedGround([{ id: 'gravelly_sand', scale: 5 }, { id: 'dry_ground_rocks', scale: 9 }, { id: 'aerial_rocks_02', scale: 34, tri: true }], { normalize: true, desat: 0.3 }),
  });
  // boulders and dead wood on the high ground round the shaft, and outcrops down the valley
  const R2 = K.rng(292);
  for (const [bx, bz, sc] of [[-7, -16, 2.2], [9, -24, 2.8], [-14, -34, 3.4], [16, -10, 1.8], [-30, -120, 9], [42, -170, 11]]) {
    model(scene, 'namaqualand_boulder_02', { position: [bx, desert(bx, bz) - 0.4 * sc, bz], rotation: [0, R2() * Math.PI * 2, 0], scale: sc, shadows: sc < 5 });
  }
  for (const [tx, tz, ry] of [[4, -14, 0.6], [-10, -26, 2.1], [12, -36, -0.4]]) {
    model(scene, 'dead_tree_trunk', { position: [tx, desert(tx, tz) - 0.1, tz], rotation: [0, ry, 0.04], scale: 1.6 });
  }
  // dry scrub across the valley floor: sparse, twiggy bushes
  const scrubList = [];
  for (let i = 0; i < 2400; i++) { const x = (r() - 0.5) * 600, z = -40 - r() * 520; scrubList.push([x, desert(x, z) - 0.05, z, 0.7 + r() * 1.3]); }
  F.trees(scene, scrubList, { kind: 'scrub', seed: 29, shadows: false });
  const skyDome = K.sky(scene, { top: '#5b7fb3', horizon: '#f5c79a', glowDir: new THREE.Vector3(0.7, 0.08, -0.7), glowColor: '#ffcf8a', glowPower: 6, glowStrength: 1.1, radius: 1600 });
  const sun = new THREE.DirectionalLight(0xffd3a0, 3.0);
  sun.position.set(380, 50, -420);
  sun.target.position.set(0, 0, -200);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -300, right: 300, top: 300, bottom: -300, near: 10, far: 1200 });
  scene.add(sun, sun.target);
  const skyFill = new THREE.HemisphereLight(0xb9cbe6, 0x8a6a4a, 0.9);
  scene.add(skyFill);
  // the photographed dawn, once the reader is out of the ground
  let dawnHdr = null;
  // underground, a photographed concrete tunnel under work lights (Poly Haven); above, the dawn
  const light = ctx.renderer ? lightZones(scene, ctx.renderer, [
    { sky: 'klippad_dawn_1', intensity: 0.6, rotation: DAWN_SKY_ROT, when: (c) => c.y > 9 },
    { sky: 'concrete_tunnel', intensity: 0.42 },
  ]) : null;
  if (ctx.renderer) {
    sky(scene, ctx.renderer, 'klippad_dawn_1', { background: false, envIntensity: 0, rotation: DAWN_SKY_ROT }).then(({ hdr }) => {
      dawnHdr = hdr;
      scene.backgroundRotation.y = DAWN_SKY_ROT;
    });
  }
  const craft = K.ship(scene, { x: 22, y: 58, z: -125, scale: 3.0, ry: -0.05 });

  const DUSK = new THREE.Color(0xd9b48e);
  const VAULT = new THREE.Color(0x05060a);
  return {
    scene,
    exposure: 1.05,
    beats: [
      { pos: new THREE.Vector3(2.1, 1.7, 2.3), look: new THREE.Vector3(0, 1.4, -6) },
      { pos: new THREE.Vector3(0.6, 1.5, -3.4), look: new THREE.Vector3(0, 1.45, -11) },
      { pos: new THREE.Vector3(-6, 70, -70), look: new THREE.Vector3(30, 30, -460), via: [new THREE.Vector3(0.1, 1.8, -6.4), new THREE.Vector3(0, 4.5, -7.0), new THREE.Vector3(0, 11, -7.0), new THREE.Vector3(-1, 26, -20)] },
    ],
    update(t, dt, s, cam) {
      F.setWind(t);
      // the blast arrives as the reader reaches the passage
      const blast = K.smoothstep(0.75, 1.15, s);
      const settle = K.smoothstep(1.4, 2.0, s);
      for (const L of lamps) {
        const stutter = blast * (1 - settle) * (Math.sin(t * 43 + L.base) > 0.3 ? 0.25 : 1);
        L.l.intensity = L.base * (stutter > 0 ? stutter : 1);
      }
      for (const { pivot, sx } of halves) pivot.rotation.z = sx * -1.35 * K.smoothstep(0.95, 1.25, s);
      // the emergency lamp turns as the blast arrives
      const alarm = blast * (Math.sin(t * 7) > 0 ? 1 : 0.15);
      red.intensity = 9 * alarm;
      emergency.material.color.setRGB(1, 0.16, 0.08).multiplyScalar(0.3 + alarm * 2.2);
      glow.color.setRGB(0.62, 0.91, 1).multiplyScalar(2.2 * (1 - K.smoothstep(1.0, 1.3, s)));
      const st = K.smoothstep(0.95, 1.6, s) * 1.4;
      for (let i = 0; i < sparkCount; i++) {
        const v = sparkVel[i];
        sparkPos[i * 3] = v.x * st * 0.6;
        sparkPos[i * 3 + 1] = 1.35 + v.y * st * 0.5 - 4.9 * st * st * 0.5;
        sparkPos[i * 3 + 2] = -10.6 + v.z * st * 0.4;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparks.material.opacity = st > 0 && st < 1.35 ? 1 - st / 1.4 : 0;
      const dt2 = blast * 1.3;
      for (let i = 0; i < dustCount; i++) {
        const d = dustDir[i];
        dustPos[i * 3] = d.seam.x + d.v.x * dt2;
        dustPos[i * 3 + 1] = Math.max(0.05, d.seam.y + d.v.y * dt2);
        dustPos[i * 3 + 2] = d.seam.z + d.v.z * dt2;
      }
      dustGeo.attributes.position.needsUpdate = true;
      dustCloud.material.opacity = 0.6 * blast * (1 - settle * 0.6);
      // underground the air is dark; above ground it is the morning haze
      const above = K.smoothstep(8, 20, cam.y);
      scene.fog.color.copy(VAULT).lerp(DUSK, above);
      scene.fog.density = 0.06 * (1 - above) + 0.0008 * above;
      vaultBg.copy(scene.fog.color);
      scene.background = dawnHdr && above > 0.02 ? dawnHdr : vaultBg;
      light?.(cam, dt);
      skyFill.intensity = dawnHdr ? 0.5 : 0.9;
      craft.position.z = -120 - s * 4 + Math.sin(t * 0.4) * 0.5;
      skyDome.dome.visible = !dawnHdr && above > 0.02;
    },
  };
}
