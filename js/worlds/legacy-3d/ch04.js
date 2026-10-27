// Chapter Four: The Fourth Row. The attic at night by lantern light: the tin
// trunk marked ADAM, the photograph at the bottom of it, the mirror, and through
// the glass, "a sky with no horizon. Stars burned above her, below her and at
// every impossible distance between. Rivers of colour passed through darkness,
// violet and gold and deep blue."
import * as THREE from 'three';
import * as K from '../kit.js';
import { pbr, model, sky, lightZones } from '../../assets.js';

export function build(ctx = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020309);
  scene.fog = new THREE.FogExp2(0x07060a, 0.045);

  // Photographed surfaces (Poly Haven, CC0).
  const floor = pbr('old_wooden_floor_02', { color: 0xc9b39a, roughness: 1.35, envMapIntensity: 0.55 });
  const dark = pbr('oak_wood_planks', { color: 0x5a3a24 });
  const plaster = pbr('plastered_wall_03', { color: 0xc4b8a2 });
  const tin = pbr('rusty_metal_02', { color: 0x7e8a96, repeat: [2, 2] }); // dull tin, rust at the seams
  // a photographed timber attic's light (Poly Haven), soft from every side, under the lantern's
  const light = ctx.renderer ? lightZones(scene, ctx.renderer, [{ sky: 'pine_attic', intensity: 0.42 }]) : null;
  const flames = [];

  // ---- the attic ----
  K.box(scene, 5, 0.2, 11, floor, 0, -0.1, -3.5);
  for (const sx of [-1, 1]) {
    K.box(scene, 0.2, 1.2, 11, plaster, sx * 2.6, 0.6, -3.5);
    K.box(scene, 3.2, 0.12, 11, dark, sx * 1.35, 2.25, -3.5, { rz: sx * -0.72 });
  }
  for (let z = 1.5; z > -9; z -= 1.0) {
    for (const sx of [-1, 1]) K.box(scene, 3.1, 0.14, 0.12, dark, sx * 1.3, 2.2, z, { rz: sx * -0.72, uv: 1 });
    K.box(scene, 4.6, 0.12, 0.12, dark, 0, 2.05, z, { uv: 1 });
  }
  K.box(scene, 5.4, 3.4, 0.2, plaster, 0, 1.7, 2.0);

  // A cabinet, and the trunk pushed behind it.
  model(scene, 'GothicCabinet_01', { position: [-1.55, 0, -5.55], rotation: [0, 0.3, 0], scale: 0.72, align: 'bottom' });
  const trunk = new THREE.Group();
  const T = { w: 0.9, h: 0.42, d: 0.5 };
  K.box(trunk, T.w, 0.03, T.d, tin, 0, 0.015, 0, { uv: 0 });
  K.box(trunk, T.w, T.h, 0.03, tin, 0, T.h / 2, T.d / 2, { uv: 0 });
  K.box(trunk, T.w, T.h, 0.03, tin, 0, T.h / 2, -T.d / 2, { uv: 0 });
  for (const sx of [-1, 1]) K.box(trunk, 0.03, T.h, T.d, tin, sx * T.w / 2, T.h / 2, 0, { uv: 0 });
  const black = K.std({ color: 0x111112, roughness: 0.6, metalness: 0.4 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(trunk, 0.07, T.h + 0.01, 0.07, black, sx * (T.w / 2 - 0.02), T.h / 2, sz * (T.d / 2 - 0.02), { uv: 0 });
  // the lid, hinged at the back, with the name across it in a looping hand
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, T.h, -T.d / 2);
  trunk.add(lidPivot);
  const lidTop = K.std({ map: K.tex.lettering('Adam', { bg: '#6e7172', ink: '#f1e8d2', font: 'italic 120px Georgia, serif' }), metalness: 0.6, roughness: 0.5 });
  const lid = new THREE.Mesh(new THREE.BoxGeometry(T.w, 0.05, T.d), [tin, tin, lidTop, tin, tin, tin]);
  lid.position.set(0, 0.025, T.d / 2);
  lid.castShadow = true;
  lidPivot.add(lid);
  // "At the bottom of the trunk lay a photograph."
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.21), K.std({ map: K.tex.photo(), roughness: 0.4 }));
  photo.rotation.x = -Math.PI / 2;
  photo.rotation.z = 0.25;
  photo.position.set(0.05, 0.035, 0.02);
  trunk.add(photo);
  K.books(trunk, [{ x: -0.25, y: 0.06, z: -0.08, w: 0.22, h: 0.05, d: 0.3, ry: 0.3 }, { x: 0.28, y: 0.06, z: 0.1, w: 0.18, h: 0.04, d: 0.26, ry: -0.2 }]);
  trunk.position.set(-1.25, 0, -4.4);
  trunk.rotation.y = 0.35;
  scene.add(trunk);

  // the lantern on the boards beside it
  model(scene, 'Lantern_01', { position: [-0.45, 0, -3.9], scale: 1.4, align: 'bottom' });
  flames.push(K.flame(scene, -0.45, 0.17, -3.9, { intensity: 3.2, distance: 7, scale: 1.1 }));
  const lanternLight = new THREE.PointLight(0xffb15e, 2.5, 6, 2);
  lanternLight.position.set(-0.45, 0.5, -3.9);
  lanternLight.castShadow = true;
  lanternLight.shadow.mapSize.set(512, 512);
  scene.add(lanternLight);
  scene.add(new THREE.HemisphereLight(0x2a3046, 0x120b06, 0.45));

  // The mirror at the far end, standing in an arch cut through the gable.
  const mirror = K.greenMirror(scene, { x: 0, z: -8.6 });
  const gable = new THREE.Shape();
  gable.moveTo(-2.7, 0);
  gable.lineTo(2.7, 0);
  gable.lineTo(2.7, 3.4);
  gable.lineTo(-2.7, 3.4);
  gable.closePath();
  const arch = new THREE.Path();
  arch.moveTo(-0.46, 0.46);
  arch.lineTo(-0.46, 1.4);
  arch.absarc(0, 1.4, 0.46, Math.PI, 0, true);
  arch.lineTo(0.46, 0.46);
  arch.closePath();
  gable.holes.push(arch);
  const gableMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth: 0.2, bevelEnabled: false }), plaster);
  gableMesh.position.set(0, 0, -8.85);
  scene.add(gableMesh);

  // ---- through the glass: the sky with no horizon ----
  const space = new THREE.Group();
  space.position.set(0, 1.5, -40);
  scene.add(space);
  const allStars = K.stars(space, { count: 4000, radius: 220, full: true, size: 1.8, seed: 9 });
  allStars.material.fog = false;
  const near = K.stars(space, { count: 1200, radius: 40, full: true, size: 2.6, color: 0xfff1d0, seed: 4 });
  near.material.fog = false;
  // nebulae: soft clouds of light at every distance
  const neb = [];
  const nebColors = [0x7a4cff, 0xffc66b, 0x2f6dff, 0xff6ab4, 0x52e0c4];
  const r = K.rng(77);
  for (let i = 0; i < 22; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.glowTexture(), color: nebColors[i % nebColors.length], blending: THREE.AdditiveBlending, transparent: true, opacity: 0.18 + r() * 0.2, depthWrite: false, fog: false }));
    const a = r() * Math.PI * 2;
    const b = (r() - 0.5) * Math.PI;
    const d = 30 + r() * 140;
    s.position.set(Math.cos(a) * Math.cos(b) * d, Math.sin(b) * d, Math.sin(a) * Math.cos(b) * d);
    const sc = 30 + r() * 90;
    s.scale.set(sc, sc * (0.5 + r() * 0.6), 1);
    space.add(s);
    neb.push(s);
  }
  // rivers of colour: long flowing ribbons that pass around and beneath the reader
  const riverMat = (c1, c2) => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    uniforms: { uTime: { value: 0 }, c1: { value: new THREE.Color(c1) }, c2: { value: new THREE.Color(c2) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 c1; uniform vec3 c2; varying vec2 vUv;
      void main(){
        float across = sin(vUv.y * 3.14159);
        float flow = 0.55 + 0.45 * sin(vUv.x * 60.0 - uTime * 1.6 + sin(vUv.x * 13.0) * 2.0);
        vec3 col = mix(c1, c2, 0.5 + 0.5 * sin(vUv.x * 9.0 + uTime * 0.3));
        float a = pow(across, 2.5) * flow * 0.55 * smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        gl_FragColor = vec4(col * a, a);
      }`,
  });
  const rivers = [];
  const pairs = [[0x8a5cff, 0x3a6dff], [0xffc56b, 0xff7a3a], [0x2f7dff, 0x7a4cff], [0x55e2c6, 0x2f6dff]];
  for (let i = 0; i < 4; i++) {
    const pts = [];
    for (let j = 0; j < 9; j++) {
      pts.push(new THREE.Vector3((r() - 0.5) * 60, (r() - 0.5) * 30 - (i % 2 ? 8 : -6), 30 - j * 14 + (r() - 0.5) * 6));
    }
    const mat = riverMat(...pairs[i]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 300, 2.2 + r() * 2, 12, false), mat);
    tube.scale.set(1, 1, 1);
    space.add(tube);
    rivers.push(mat);
  }

  return {
    scene,
    exposure: 1.2,
    backScale: 0.25,
    beats: [
      { pos: new THREE.Vector3(1.3, 1.6, 1.2), look: new THREE.Vector3(-0.9, 0.7, -4.4) },
      { pos: new THREE.Vector3(0.1, 1.25, -2.6), look: new THREE.Vector3(-1.25, 0.3, -4.4) },
      { pos: new THREE.Vector3(-1.05, 1.55, -3.9), look: new THREE.Vector3(-1.22, 0.02, -4.4) },
      { pos: new THREE.Vector3(0, 1.4, -6.5), look: new THREE.Vector3(0, 1.3, -8.6), via: [new THREE.Vector3(0.3, 1.35, -5.4)] },
      { pos: new THREE.Vector3(0, 1.5, -26), look: new THREE.Vector3(6, 4, -60), via: [new THREE.Vector3(0, 1.38, -8.2), new THREE.Vector3(0, 1.38, -9.6), new THREE.Vector3(0, 1.45, -15)] },
    ],
    update(t, dt, s, cam) {
      light?.(cam, dt);
      for (const f of flames) f.update(t);
      lanternLight.intensity = 2.5 * (0.9 + Math.sin(t * 9) * 0.05);
      // the lid lifts as the reader moves from the trunk to the photograph
      lidPivot.rotation.x = -1.95 * K.smoothstep(1.15, 1.85, s);
      mirror.update(t, 0.3 + 0.7 * K.smoothstep(2.4, 3.2, s));
      for (const m of rivers) m.uniforms.uTime.value = t;
      space.rotation.y = t * 0.01;
      for (let i = 0; i < neb.length; i++) neb[i].material.rotation = t * 0.02 * (i % 2 ? 1 : -1);
    },
  };
}
