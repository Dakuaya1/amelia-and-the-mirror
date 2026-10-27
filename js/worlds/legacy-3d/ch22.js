// Chapter Twenty-two: Gladly. "The lake was blue... beyond it the land rose pale
// and spare towards mountains too sharply made to belong to the same world." The
// lamps "set within a low enclosure of stones" by the screened shrine. And "the
// compound occupied a shelf cut into the mountain at five thousand two hundred
// metres": four low buildings round a yard, a generator hall, a fuel store inside
// a bund wall, and an entrance in the rock. Noon at the lake, dusk at the lamps,
// night at the compound.
import * as THREE from 'three';
import * as K from '../kit.js';
import { pbr, model, sky, blendedGround } from '../../assets.js';

const LAKE = { x: 0, z: -70, rx: 60, rz: 40 };
const SHELF = { x0: 58, x1: 86, z0: -46, z1: -18, y: 30 };
// the north face across the lake: a four-sided peak banded with ledges where the snow lies
const PEAK = { x: 40, z: -400, r: 135, h: 240 };
// turns the photographed noon sky so its sun stands where this world's sun does
const DAY_SKY_ROT = 1.64;
const inShelf = (x, z) => x > SHELF.x0 && x < SHELF.x1 && z > SHELF.z0 && z < SHELF.z1;

function peak(x, z) {
  const dx = (x - PEAK.x) / PEAK.r;
  const dz = (z - PEAK.z) / PEAK.r;
  const d = Math.cbrt(Math.abs(dx) ** 3 + Math.abs(dz) ** 3); // a rounded square: four faces
  if (d >= 1) return 0;
  let h = Math.pow(1 - d, 1.1) * PEAK.h;
  h -= K.smoothstep(0.6, 0.9, (h / 15) % 1) * 2.8 * (1 - d); // the strata step back in ledges
  if (dz > 0) h -= Math.max(0, 1 - Math.abs(dx) / 0.09) ** 2 * 16 * K.smoothstep(0.25, 0.45, 1 - d) * (1 - K.smoothstep(0.6, 0.8, 1 - d)); // the gash down the face
  return h + (K.fbm(x * 0.06, z * 0.06, 3) - 0.5) * 5 * (1 - d);
}

// the ranges: domain-warped ridges, broad in the valleys and sharp at the crests
function range(x, z) {
  const wx = x + K.fbm(x * 0.004 + 7.1, z * 0.004, 3) * 140;
  const wz = z + K.fbm(x * 0.004, z * 0.004 + 3.7, 3) * 140;
  return Math.pow(K.ridged(wx * 0.006, wz * 0.006, 5), 1.7) * 230 + 15;
}

function height(x, z) {
  const dx = (x - LAKE.x) / LAKE.rx;
  const dz = (z - LAKE.z) / LAKE.rz;
  const e = Math.sqrt(dx * dx + dz * dz);
  const dist = Math.hypot(x - LAKE.x, z - LAKE.z);
  let h = e < 1 ? -3 * (1 - e) - 0.4 : (e - 1) * 6 + K.fbm(x * 0.05, z * 0.05, 3) * 1.5;
  h = Math.min(h, 3 + K.fbm(x * 0.03, z * 0.03, 3) * 4);
  // the ranges stand back from the peak, so it rises clear of them
  const near = Math.exp(-((x - PEAK.x) ** 2 + (z - PEAK.z) ** 2) / (2 * 180 * 180));
  h += Math.max(K.smoothstep(70, 190, dist) * range(x, z) * (1 - 0.7 * near), peak(x, z));
  // a spur of the mountain to the east, with the shelf cut into it
  // (the spur's low tail is cut off, so it never lifts the lakebed)
  const spur = Math.exp(-((x - 100) ** 2 + (z + 38) ** 2) / (2 * 34 * 34)) * 95 - 10;
  if (spur > 0) h = Math.max(h, spur + K.ridged(x * 0.03, z * 0.03, 3) * 10 * (spur / 85));
  const shelf = K.smoothstep(SHELF.x0 - 4, SHELF.x0, x) * (1 - K.smoothstep(SHELF.x1, SHELF.x1 + 4, x)) *
    K.smoothstep(SHELF.z0 - 4, SHELF.z0, z) * (1 - K.smoothstep(SHELF.z1, SHELF.z1 + 4, z));
  return h * (1 - shelf) + SHELF.y * shelf;
}

// How much of each photographed surface a patch of ground is: sand and gravel on the
// plateau, rock on the steep faces (wrapped round them), snow on the high ground and ledges.
// the terrain asks about each vertex twice in a row (its colour, then its weights): work it out once
let memo = { x: NaN, z: NaN, m: null };
function groundMix(h, slope, x, z) {
  if (x !== memo.x || z !== memo.z) memo = { x, z, m: groundMixRaw(h, slope, x, z) };
  return memo.m;
}
function groundMixRaw(h, slope, x, z) {
  if (inShelf(x, z)) return [1, 0, 0];
  const line = 105 + (K.fbm(x * 0.02, z * 0.02, 3) - 0.5) * 40;
  let snow = K.smoothstep(line, line + 30, h) * (1 - K.smoothstep(0.55, 0.78, slope));
  const pk = peak(x, z);
  if (pk > 60) {
    const ledge = K.smoothstep(0.55, 0.75, (pk / 15) % 1);
    const cap = K.smoothstep(PEAK.h * 0.78, PEAK.h * 0.9, pk);
    snow = Math.max(cap, ledge * K.smoothstep(90, 130, pk) * (1 - K.smoothstep(0.62, 0.8, slope)), snow * (1 - K.smoothstep(0.3, 0.45, slope)));
  }
  const rock = (1 - snow) * K.smoothstep(0.24, 0.46, slope + (h > 14 ? 0.1 : 0));
  return [Math.max(0, 1 - snow - rock), rock, snow];
}

export function build(ctx = {}) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xa8c4e6, 0.0019);

  const ground = K.terrain(scene, {
    size: 1300,
    depth: 1300,
    seg: 260,
    z: -170,
    height,
    colour: (h, slope, x, z) => {
      const c = new THREE.Color();
      if (inShelf(x, z)) return c.set(0xc9c6c0);
      if (h < 0.2) return c.set(0x6d6656);
      const m = groundMix(h, slope, x, z);
      if (m[2] > 0.5) return c.set(0xf4f6fa).offsetHSL(0, 0, -K.fbm(x * 0.1, z * 0.1, 2) * 0.06);
      if (m[1] > 0.5) return c.set(peak(x, z) > 40 ? 0x5e5248 : 0x74665a).offsetHSL(0, 0, (K.fbm(x * 0.05, z * 0.05, 2) - 0.5) * 0.12);
      return c.set(h < 4 ? 0x9e8f70 : 0x857a60).offsetHSL(0, 0, (K.fbm(x * 0.3, z * 0.3, 2) - 0.5) * 0.08);
    },
    weights: groundMix,
    material: blendedGround([
      { id: 'gravelly_sand', scale: 4 },
      { id: 'aerial_rocks_02', scale: 36, tri: true },
      { id: 'snow_02', scale: 14 },
    ], { normalize: true, desat: 0.6 }),
  });
  ground.castShadow = false; // the valley is too big to draw into the sun's shadow map every frame
  // Manasarovar blue: deep in the middle, turquoise over the shallows, the sky in it at a glance
  const lake = K.water(scene, {
    w: 128, d: 86, x: LAKE.x, y: 0, z: LAKE.z,
    deep: 0x0a3a60, shallow: 0x3c9fa8, scale: 0.22, chop: 0.1,
    shore: { x: LAKE.x, z: LAKE.z, rx: LAKE.rx, rz: LAKE.rz },
  });

  // ---- light: one sun that sets, and a sky that follows it ----
  const skyDome = K.sky(scene, { top: '#1f4fa8', horizon: '#9cc3ee', glowDir: new THREE.Vector3(0.3, 0.8, -0.5), glowColor: '#fff4dc', glowPower: 30, glowStrength: 0.5, radius: 1400 });
  const starField = K.stars(scene, { count: 2500, radius: 1300, size: 1.5 });
  // a real noon sky over the lake, which gives way to the dome as the sun goes down
  let dayHdr = null;
  if (ctx.renderer) {
    sky(scene, ctx.renderer, 'kloofendal_48d_partly_cloudy_puresky', { background: false, envIntensity: 0.8, rotation: DAY_SKY_ROT }).then(({ hdr }) => {
      dayHdr = hdr;
      scene.backgroundRotation.y = DAY_SKY_ROT;
    });
  }
  const sunLight = new THREE.DirectionalLight(0xfff2dc, 3.4);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.radius = 3;
  Object.assign(sunLight.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, near: 1, far: 700 });
  sunLight.target.position.set(10, 0, -40);
  scene.add(sunLight, sunLight.target);
  const hemi = new THREE.HemisphereLight(0xbdd6f5, 0x6b5f4c, 1.0);
  scene.add(hemi);

  // ---- the lamps by the lake ----
  const shrine = { x: -8.5, z: -26 };
  const sy = height(shrine.x, shrine.z);
  const stoneMat = pbr('stone_01', { dir: 'models/stone_01/textures', color: 0xc8c4bc });
  const pebble = new THREE.IcosahedronGeometry(0.16, 2);
  const pp = pebble.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pp, i);
    v.multiplyScalar(0.82 + K.fbm(v.x * 9 + 3, v.z * 9 + v.y * 7, 3) * 0.36);
    pp.setXYZ(i, v.x, v.y, v.z);
  }
  pebble.computeVertexNormals();
  const ring = new THREE.InstancedMesh(pebble, stoneMat, 26);
  const o = new THREE.Object3D();
  const r = K.rng(22);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    o.position.set(shrine.x + Math.cos(a) * 0.85, sy + 0.1, shrine.z + Math.sin(a) * 0.65);
    o.rotation.set(r() * 3, r() * 3, r() * 3);
    o.scale.set(1 + r() * 0.5, 0.8 + r() * 0.6, 1 + r() * 0.5);
    o.updateMatrix();
    ring.setMatrixAt(i, o.matrix);
  }
  ring.castShadow = true;
  scene.add(ring);
  // the shrine: a small stepped chorten of whitewashed stone
  const lime = pbr('chipped_concrete', { color: 0xf2eee6 });
  for (const [w, h, y0] of [[0.78, 0.14, 0], [0.62, 0.12, 0.14], [0.5, 0.3, 0.26]]) K.box(scene, w, h, w * 0.7, lime, shrine.x, sy + y0 + h / 2, shrine.z - 0.95, { uv: 1 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lime);
  dome.position.set(shrine.x, sy + 0.56, shrine.z - 0.95);
  dome.castShadow = true;
  scene.add(dome);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.36, 16), K.metal.brass());
  spire.position.set(shrine.x, sy + 0.92, shrine.z - 0.95);
  scene.add(spire);
  // the cloth screening the little shrine: saffron, hung between two poles, sagging and stirring
  const pole = pbr('oak_wood_planks', { color: 0x6a4a34 });
  for (const dx of [-0.75, 0.75]) K.box(scene, 0.05, 1.6, 0.05, pole, shrine.x + dx, sy + 0.8, shrine.z - 1.25, { uv: 0 });
  const clothGeo = new THREE.PlaneGeometry(1.42, 0.62, 28, 10);
  const cb = clothGeo.attributes.position;
  for (let i = 0; i < cb.count; i++) {
    const x = cb.getX(i);
    const y = cb.getY(i);
    cb.setY(i, y - (1 - (x / 0.71) ** 2) * 0.05 * (0.5 + y / 0.62)); // the top sags between the poles
    cb.setZ(i, Math.sin(x * 26) * 0.025); // and it hangs in folds
  }
  const cloth = new THREE.Mesh(clothGeo, K.std({ color: 0xe0902c, roughness: 0.85, side: THREE.DoubleSide }));
  cloth.position.set(shrine.x, sy + 1.18, shrine.z - 1.25);
  for (const by of [0.3, -0.29]) K.box(scene, 1.46, 0.05, 0.012, K.std({ color: 0x8c1d1d, roughness: 0.7 }), shrine.x, sy + 1.18 + by, shrine.z - 1.22, { uv: 0 });
  cloth.castShadow = true;
  scene.add(cloth);
  const clothBase = clothGeo.attributes.position.array.slice();
  const flames = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const lx = shrine.x + Math.cos(a) * 0.45;
    const lz = shrine.z + Math.sin(a) * 0.32;
    model(scene, 'brass_diya_lantern', {
      position: [lx, sy + 0.01, lz],
      rotation: [0, a * 1.7, 0],
      align: 'bottom',
      onLoad: (obj) => {
        const chain = obj.getObjectByName('brass_diya_lantern_chain');
        if (chain) chain.visible = false;
      },
    });
    flames.push(K.flame(scene, lx, sy + 0.07, lz, { light: i === 0, intensity: 3.2, distance: 6, scale: 0.55 }));
  }
  // prayer flags strung from a tall pole behind the shrine, and cairns of flat stones
  const mastFoot = new THREE.Vector3(-11.2, height(-11.2, -28.6), -28.6);
  K.box(scene, 0.07, 3.2, 0.07, pole, mastFoot.x, mastFoot.y + 1.6, mastFoot.z, { uv: 0 });
  const flagLines = [];
  const top = mastFoot.clone().add(new THREE.Vector3(0, 3.15, 0));
  for (const [ex, ez, eh, n] of [[-3.6, -30.2, 1.7, 26], [-15.5, -24.2, 0.9, 20], [-9.6, -33.6, 1.2, 18]]) {
    const end = new THREE.Vector3(ex, height(ex, ez) + eh, ez);
    K.box(scene, 0.05, eh, 0.05, pole, ex, height(ex, ez) + eh / 2, ez, { uv: 0 });
    flagLines.push(K.prayerFlags(scene, top, end, { count: n, sag: 0.45, size: 0.22, seed: n }));
  }
  for (const [cx, cz, n] of [[-3.6, -30.2, 7], [-15.5, -24.2, 6], [-12.4, -22.8, 5], [-5.2, -23.5, 4]]) {
    K.cairn(scene, cx, height(cx, cz) - 0.04, cz, stoneMat, { stones: n, size: 0.32, seed: Math.round(Math.abs(cx) * 7) });
  }

  // ---- the compound on its shelf ----
  const Y = SHELF.y;
  const wallMat = pbr('chipped_concrete', { color: 0xe6e1d8 });
  const roofMat = pbr('corrugated_iron_02', { color: 0x9aa0a6, metalness: 0.6 });
  const trim = {
    dark: K.std({ color: 0x2b2f35, roughness: 0.6 }),
    plinth: pbr('concrete_floor_worn_001', { color: 0x8c8880 }),
    door: K.std({ color: 0x52606a, roughness: 0.55, metalness: 0.3 }),
  };
  const glass = new THREE.MeshStandardMaterial({ color: 0x16202a, roughness: 0.12, metalness: 0.1, emissive: 0xffc98a, emissiveIntensity: 0 });
  // the yard: a poured slab across the shelf
  K.box(scene, SHELF.x1 - SHELF.x0, 0.12, SHELF.z1 - SHELF.z0, pbr('concrete_floor_worn_001', { color: 0xd8d4cc }), (SHELF.x0 + SHELF.x1) / 2, Y + 0.0, (SHELF.z0 + SHELF.z1) / 2, { uv: 4 });
  for (const [x, z, w, d, door] of [[62, -24, 6, 4, -1], [62, -36, 6, 4, 1], [72, -42, 5, 4, 0], [80, -24, 5, 4, 1]]) {
    K.outbuilding(scene, { x, y: Y + 0.06, z, w, d, h: 3, wall: wallMat, roof: roofMat, trim, glass, windows: w > 5 ? [-1, 1] : [-1], door });
  }
  // the generator hall: taller, with a roller door and louvres
  K.outbuilding(scene, { x: 74, y: Y + 0.06, z: -32, w: 10, d: 6, h: 5, wall: wallMat, roof: roofMat, trim, glass, windows: [-1.6], door: null });
  K.box(scene, 3.2, 3.4, 0.08, pbr('corrugated_iron_02', { color: 0x7d8a92, metalness: 0.5, repeat: [1.5, 1.5] }), 76.2, Y + 1.76, -28.95, { uv: 0, rz: Math.PI / 2 });
  for (let i = 0; i < 5; i++) K.box(scene, 1.4, 0.06, 0.12, trim.dark, 70.2, Y + 3.1 + i * 0.16, -28.95, { uv: 0, rx: 0.5 });
  const tankMat = pbr('rusty_metal_02', { color: 0xd4d0c6, repeat: [3, 1.2] });
  for (const tx of [83, 85.5]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 2.6, 32), tankMat);
    tank.position.set(tx, Y + 1.3, -38);
    tank.castShadow = true;
    scene.add(tank);
  }
  // drums stood inside the bund by the tanks
  const drumR = K.rng(221);
  for (const [bx, bz] of [[82.4, -36.3], [83.2, -36.4], [84.0, -36.2], [82.6, -39.9], [85.9, -36.4]]) {
    model(scene, 'Barrel_01', { position: [bx, Y + 0.08, bz], rotation: [0, drumR() * 6.3, 0], align: 'bottom', scale: 0.95 });
  }
  // the bund wall round the fuel store
  for (const [bx, bz, bw, bd] of [[84.2, -35.6, 5, 0.3], [84.2, -40.4, 5, 0.3], [81.7, -38, 0.3, 5], [86.7, -38, 0.3, 5]]) K.box(scene, bw, 0.7, bd, wallMat, bx, Y + 0.35, bz, { uv: 2 });
  // the entrance in the rock wall behind
  K.box(scene, 4.4, 4.2, 1.2, wallMat, 70, Y + 2.1, -47.2, { uv: 2 });
  K.box(scene, 3.1, 0.3, 1.3, trim.dark, 70, Y + 3.35, -47.0, { uv: 0 });
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 3.2), new THREE.MeshBasicMaterial({ color: 0x0b0c0e }));
  mouth.position.set(70, Y + 1.6, -46.55);
  scene.add(mouth);
  const tunnelGlow = new THREE.PointLight(0xffe0b0, 0, 12, 2);
  tunnelGlow.position.set(70, Y + 2.2, -45.6);
  scene.add(tunnelGlow);
  // the aerials of a place that talks to the world below
  const steel = K.metal.steel();
  const radio = K.mast(scene, { x: 59.6, y: Y + 0.06, z: -43.5, h: 15, mat: steel });
  K.dish(scene, { x: 67.2, y: Y + 0.06, z: -29.2, r: 1.1, ry: 2.4, tilt: 0.75, mat: K.std({ color: 0xe4e4e0, roughness: 0.4 }), frame: steel });
  const floods = [];
  for (const [fx, fz] of [[58.5, -30], [86, -20], [66, -45]]) {
    K.box(scene, 0.15, 7, 0.15, K.metal.iron(), fx, Y + 3.5, fz, { uv: 0 });
    K.box(scene, 0.7, 0.42, 0.42, trim.dark, fx, Y + 7.1, fz, { uv: 0 });
    const head = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.3), new THREE.MeshBasicMaterial({ color: 0xfff5e6, side: THREE.DoubleSide }));
    head.position.set(fx, Y + 6.88, fz);
    head.rotation.x = -Math.PI / 2;
    scene.add(head);
    const fl = new THREE.SpotLight(0xfff1dc, 0, 45, 0.7, 0.5, 1.2);
    fl.position.set(fx, Y + 7, fz);
    fl.target.position.set(72, Y, -32);
    scene.add(fl, fl.target);
    floods.push({ fl, head });
  }

  // palettes for day, dusk and night
  const P = {
    top: [new THREE.Color('#1f4fa8'), new THREE.Color('#3b3f78'), new THREE.Color('#050913')],
    horizon: [new THREE.Color('#9cc3ee'), new THREE.Color('#f29a6a'), new THREE.Color('#1a2440')],
    fog: [new THREE.Color('#a8c4e6'), new THREE.Color('#b98a86'), new THREE.Color('#0d1424')],
    sun: [new THREE.Color('#fff2dc'), new THREE.Color('#ff9a5a'), new THREE.Color('#8fa6d8')],
    hemiSky: [new THREE.Color('#bdd6f5'), new THREE.Color('#c98a8a'), new THREE.Color('#2a3656')],
  };
  const mix3 = (out, arr, a, b, c) => out.copy(arr[0]).multiplyScalar(a).add(arr[1].clone().multiplyScalar(b)).add(arr[2].clone().multiplyScalar(c));
  const sunDir = new THREE.Vector3();

  return {
    scene,
    exposure: 1.0,
    beats: [
      { pos: new THREE.Vector3(6, 14, 22), look: new THREE.Vector3(16, 52, -300) },
      { pos: new THREE.Vector3(-4, 9, -6), look: new THREE.Vector3(16, 44, -300) },
      { pos: new THREE.Vector3(-6.3, sy + 1.25, -22.8), look: new THREE.Vector3(-8.5, sy + 0.45, -26) },
      { pos: new THREE.Vector3(52, Y + 9, -4), look: new THREE.Vector3(72, Y + 1, -34), via: [new THREE.Vector3(6, 10, -24), new THREE.Vector3(30, 24, -14)] },
    ],
    update(t, dt, s) {
      for (const f of flames) f.update(t);
      for (const f of flagLines) f.update(t);
      // the hour, from the reader's place in the chapter
      const day = 1 - K.smoothstep(1.2, 2.0, s);
      const night = K.smoothstep(2.15, 2.85, s);
      const dusk = Math.max(0, 1 - day - night);
      // noon is the photographed sky; the dome fades in over it towards dusk
      const photo = dayHdr ? day : 0;
      scene.background = photo > 0.01 ? dayHdr : null;
      skyDome.uniforms.opacity.value = 1 - photo;
      scene.environmentIntensity = 0.8 * day + 0.25 * dusk + 0.05 * night;
      mix3(skyDome.uniforms.top.value, P.top, day, dusk, night);
      mix3(skyDome.uniforms.horizon.value, P.horizon, day, dusk, night);
      mix3(scene.fog.color, P.fog, day, dusk, night);
      mix3(sunLight.color, P.sun, day, dusk, night);
      mix3(hemi.color, P.hemiSky, day, dusk, night);
      const elev = 0.8 * day + 0.1 * dusk + 0.45 * night; // at night this is the moon
      sunDir.set(0.35, elev, -0.6).normalize();
      skyDome.uniforms.glowDir.value.copy(sunDir);
      skyDome.uniforms.glowColor.value.copy(sunLight.color);
      skyDome.uniforms.glowStrength.value = 0.5 * day + 0.9 * dusk + 0.25 * night;
      sunLight.position.copy(sunDir).multiplyScalar(300).add(sunLight.target.position);
      sunLight.intensity = (dayHdr ? 2.7 : 3.4) * day + 1.6 * dusk + 0.7 * night; // the photographed sky adds its own light
      hemi.intensity = (dayHdr ? 0.45 : 1.0) * day + 0.6 * dusk + 0.5 * night;
      starField.material.opacity = night;
      lake.material.uniforms.uSunDir.value.copy(sunDir);
      lake.material.uniforms.uSunColor.value.copy(sunLight.color).multiplyScalar(day + 0.6 * dusk + 0.15 * night);
      glass.emissiveIntensity = 0.15 * dusk + 2.4 * night;
      radio.beacon.material.color.setRGB(1, 0.16, 0.1).multiplyScalar(night * (Math.sin(t * 3) > 0.4 ? 2.5 : 0.25) + 0.3);
      for (const { fl, head } of floods) {
        fl.intensity = 140 * night;
        head.material.color.setRGB(1, 0.96, 0.9).multiplyScalar(0.2 + night * 2);
      }
      tunnelGlow.intensity = 6 * night;
      // the cloth moves in the wind off the lake
      const p = clothGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = clothBase[i * 3];
        const y = clothBase[i * 3 + 1];
        p.setZ(i, Math.sin(t * 2.2 + x * 3 + y * 2) * 0.05 * (0.75 - y) + Math.sin(t * 3.7 + x * 5) * 0.02);
      }
      p.needsUpdate = true;
    },
  };
}
