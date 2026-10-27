// Poly Haven assets (CC0, polyhaven.com): photographed PBR textures, glTF
// models and HDR skies, downloaded into assets/ph/. Everything here is cached
// and shared, and nothing blocks: models drop into place when they arrive.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { RGBELoader } from '../vendor/addons/loaders/RGBELoader.js';
import { DESKTOP_CLASS } from './device.js';

const ROOT = 'assets/ph/';
const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
const rgbeLoader = new RGBELoader();
const baseTextures = new Map();
const gltfs = new Map();
const skies = new Map();
const modelHooks = [];
/** Called with (object, holder) whenever a model drops into place, so its shaders can be compiled in the background. */
export function onModelLoaded(fn) { modelHooks.push(fn); }

function baseTexture(path, srgb) {
  if (!baseTextures.has(path)) {
    const t = textureLoader.load(ROOT + path);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    baseTextures.set(path, t);
  }
  return baseTextures.get(path);
}

// Surfaces seen close up (the desk, the study's floor and walls, the manor's stone) also ship at
// 2k, colour and ARM maps recompressed at quality 85; desktop-class screens load those.
const HIRES = new Set(['oak_wood_planks', 'old_wooden_floor_02', 'plastered_wall_03', 'castle_wall_slates']);

// A clone shares the image (uploaded once) but can tile differently.
function textureFor(id, kind, repeat, dir = `textures/${id}`) {
  const res = DESKTOP_CLASS && HIRES.has(id) && dir === `textures/${id}` ? '2k' : '1k';
  const t = baseTexture(`${dir}/${id}_${kind}_${res}.jpg`, kind === 'diff').clone();
  t.repeat.set(repeat[0], repeat[1]);
  t.userData.shared = false;
  return t;
}

/**
 * A physically based material from a photographed surface.
 * repeat: tiling over the geometry's UVs (world-UV boxes tile per uv scale).
 * dir: where the maps live, if not the texture library (e.g. a model's own).
 */
export function pbr(id, { repeat = [1, 1], color, normalScale = 1, dir, ...rest } = {}) {
  const arm = textureFor(id, 'arm', repeat, dir);
  const m = new THREE.MeshStandardMaterial({
    map: textureFor(id, 'diff', repeat, dir),
    normalMap: textureFor(id, 'nor_gl', repeat, dir),
    normalScale: new THREE.Vector2(normalScale, normalScale),
    aoMap: arm,
    roughnessMap: arm,
    metalnessMap: arm,
    roughness: 1,
    metalness: 1,
    ...rest,
  });
  if (color) m.color.set(color);
  return m;
}

/**
 * A model, placed into a group that is returned at once. The glTF loads once
 * and is shared; its meshes are flagged so a world's disposal leaves them alone.
 */
export function model(parent, id, { position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, shadows = true, align, ownMaterials = false, pick, onLoad } = {}) {
  const holder = new THREE.Group();
  holder.position.set(...position);
  holder.rotation.set(...rotation);
  if (Array.isArray(scale)) holder.scale.set(...scale);
  else holder.scale.setScalar(scale);
  parent.add(holder);
  if (!gltfs.has(id)) gltfs.set(id, gltfLoader.loadAsync(`${ROOT}models/${id}/${id}_1k.gltf`));
  gltfs.get(id).then((gltf) => {
    // pick: one named part of a file that lays out several variants side by side
    const obj = pick ? gltf.scene.getObjectByName(pick).clone(true) : gltf.scene.clone(true);
    if (pick) obj.position.set(0, 0, 0);
    // A rigged model's clone keeps pointing at the original's bones, which are never in a
    // scene, so it draws at the world's origin. Stand such meshes in their rest pose instead.
    const skinned = [];
    obj.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
    for (const o of skinned) {
      const m = new THREE.Mesh(o.geometry, o.material);
      m.name = o.name;
      m.position.copy(o.position);
      m.quaternion.copy(o.quaternion);
      m.scale.copy(o.scale);
      o.parent.add(m);
      o.parent.remove(o);
    }
    obj.traverse((o) => {
      o.userData.shared = true;
      if (o.isMesh) {
        o.castShadow = shadows;
        o.receiveShadow = true;
        // a copy that can fade or tint without touching other uses of the model
        if (ownMaterials) o.material = o.material.clone();
      }
    });
    // align: 'bottom' stands it on the holder's origin, 'top' hangs it from it
    if (align) {
      const box = new THREE.Box3().setFromObject(obj);
      const cx = (box.min.x + box.max.x) / 2;
      const cz = (box.min.z + box.max.z) / 2;
      obj.position.set(-cx, align === 'top' ? -box.max.y : -box.min.y, -cz);
    }
    holder.add(obj);
    if (onLoad) onLoad(obj, holder);
    for (const hook of modelHooks) hook(obj, holder);
  });
  return holder;
}

/**
 * An HDR sky: lights the scene (image-based light) and, optionally, is its
 * background. PMREM maps are per renderer, so they are cached per renderer.
 */
const skyReady = new Map(); // renderer -> id -> { hdr, env }, once prepared
function loadSky(renderer, id) {
  let perRenderer = skies.get(renderer);
  if (!perRenderer) skies.set(renderer, (perRenderer = new Map()));
  if (!perRenderer.has(id)) {
    perRenderer.set(id, rgbeLoader.loadAsync(`${ROOT}hdri/${id}_1k.hdr`).then((hdr) => {
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromEquirectangular(hdr).texture;
      pmrem.dispose();
      hdr.userData.shared = true;
      env.userData.shared = true;
      const res = { hdr, env };
      if (!skyReady.has(renderer)) skyReady.set(renderer, new Map());
      skyReady.get(renderer).set(id, res);
      return res;
    }));
  }
  return perRenderer.get(id);
}

/** Load and prepare skies ahead of time, so a world built later gets its light at once. */
export function prepareSkies(renderer, ids) {
  return Promise.all(ids.map((id) => loadSky(renderer, id).catch(() => null)));
}

/** A prepared sky's light (PMREM texture), once ready: null until then. */
export function skyEnv(renderer, id) {
  return skyReady.get(renderer)?.get(id)?.env || null;
}

/**
 * Image-based light that follows the camera through a world's rooms. Each zone names a
 * Poly Haven sky and a strength (and when(cam), true while the camera is in it). Crossing
 * into another zone, the light dips and comes back up with the new sky: a scene has one
 * environment at a time, and a quick dip at a doorway reads as the eye adjusting.
 * zones: [{ sky, intensity, rotation?, when?(cam) }] (the last zone is the fallback).
 * Returns update(cam, dt, scale = 1); scale lets a world dim it further (night, a blast).
 */
export function lightZones(scene, renderer, zones) {
  for (const z of zones) loadSky(renderer, z.sky);
  let sky = null; // the sky now lighting the scene
  let level = 0; // 0..1: dips to swap one sky for another
  let strength = 0; // eases towards the zone's strength
  const pick = (cam) => zones.find((z) => !z.when || (cam && z.when(cam))) || zones[zones.length - 1];
  // ready already (prepared after the loading screen): light the scene before it compiles
  const first = pick(null);
  const env0 = skyEnv(renderer, first.sky);
  if (env0) {
    scene.environment = env0;
    scene.environmentRotation.y = first.rotation || 0;
    sky = first.sky;
    level = 1;
    strength = scene.environmentIntensity = first.intensity;
  }
  return (cam, dt = 1 / 60, scale = 1) => {
    const zone = pick(cam);
    const env = skyEnv(renderer, zone.sky);
    if (!env) return;
    if (zone.sky !== sky) {
      level = sky ? Math.max(0, level - dt * 6) : 0;
      if (level === 0) {
        scene.environment = env;
        scene.environmentRotation.y = zone.rotation || 0;
        sky = zone.sky;
      }
    } else level = Math.min(1, level + dt * 4);
    strength += (zone.intensity - strength) * Math.min(1, dt * 3);
    scene.environmentIntensity = strength * level * scale;
  };
}

export function sky(scene, renderer, id, { background = true, envIntensity = 1, backgroundIntensity = 1, blur = 0, rotation = 0 } = {}) {
  const apply = (res) => {
    const { hdr, env } = res;
    scene.environment = env;
    scene.environmentIntensity = envIntensity;
    scene.environmentRotation.y = rotation;
    if (background) {
      scene.background = hdr;
      scene.backgroundIntensity = backgroundIntensity;
      scene.backgroundBlurriness = blur;
      scene.backgroundRotation.y = rotation;
    }
    return res; // a world that swaps skies by the hour keeps hold of the HDR
  };
  // Prepared already: light the scene now, before its shaders are compiled. (Set later, the
  // environment would change every material's shader and force a recompile on first sight.)
  const ready = skyReady.get(renderer)?.get(id);
  if (ready) return Promise.resolve(apply(ready));
  return loadSky(renderer, id).then(apply);
}

/**
 * Terrain that blends up to three photographed surfaces by a per-vertex
 * `weights` attribute (see kit.terrain), sampled in world space so they tile
 * at a real scale across hundreds of metres. Vertex colours tint the result.
 *
 * normalize: the photographs only add detail. Each is divided by its own
 * average colour (its smallest mip), so the vertex colours are the ground's
 * real colour; desat (0..1) greys the detail so it carries no hue of its own.
 */
export function blendedGround(layers, { normalize = false, desat = 0, normalScale = 1 } = {}) {
  const tex = layers.map((l) => ({
    map: textureFor(l.id, 'diff', [1, 1]),
    arm: textureFor(l.id, 'arm', [1, 1]),
    nor: textureFor(l.id, 'nor_gl', [1, 1]),
    scale: l.scale,
    tri: Boolean(l.tri),
  }));
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  m.userData.textures = tex.flatMap((t) => [t.map, t.arm, t.nor]); // for warming ahead of first sight
  m.onBeforeCompile = (shader) => {
    tex.forEach((t, i) => {
      shader.uniforms[`gMap${i}`] = { value: t.map };
      shader.uniforms[`gArm${i}`] = { value: t.arm };
      shader.uniforms[`gNor${i}`] = { value: t.nor };
      shader.uniforms[`gScale${i}`] = { value: t.scale };
    });
    shader.uniforms.gNormalScale = { value: normalScale };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 weights;\nvarying vec3 vWeights;\nvarying vec3 vGroundPos;\nvarying vec3 vGroundN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWeights = weights;\nvGroundPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvGroundN = normalize(mat3(modelMatrix) * objectNormal);');
    const decl = tex.map((_, i) => `uniform sampler2D gMap${i};\nuniform sampler2D gArm${i};\nuniform sampler2D gNor${i};\nuniform float gScale${i};`).join('\n');
    // A layer marked `tri` (rock) is projected from all three axes and blended by the
    // surface's facing, so it wraps a cliff instead of smearing down it. The rest are
    // projected from above, which is how flat ground is seen.
    // each layer is sampled only where it has weight: most of the ground is one surface
    const layerCode = tex.map((t, i) => `
        if (w[${i}] > 0.002) {
          gCol += ${t.tri ? `triColor(gMap${i}, gScale${i}, bw)` : `groundTex(gMap${i}, vGroundPos.xz / gScale${i})`} * w[${i}];
          gRough += ${t.tri ? `triRough(gArm${i}, gScale${i}, bw)` : `texture2D(gArm${i}, vGroundPos.xz / gScale${i}).g`} * w[${i}];
          gNor += ${t.tri ? `triNormal(gNor${i}, gScale${i}, gn, bw)` : `topNormal(gNor${i}, gScale${i}, gn)`} * w[${i}];
        }`).join('');
    // Each surface is sampled twice, at its own scale and at a larger, offset
    // one, so the repeat of a single photograph never shows across a valley.
    const helpers = `
      vec3 groundTex(sampler2D m, vec2 uv) {
        vec3 c = mix(texture2D(m, uv).rgb, texture2D(m, uv * 0.27 + vec2(0.31, 0.57)).rgb, 0.45);
        ${normalize ? `c /= max(textureLod(m, vec2(0.5), 16.0).rgb, vec3(0.002));
        c = mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), ${desat.toFixed(3)});` : ''}
        return c;
      }
      vec3 triColor(sampler2D m, float s, vec3 bw) {
        return groundTex(m, vGroundPos.zy / s) * bw.x + groundTex(m, vGroundPos.xz / s) * bw.y + groundTex(m, vGroundPos.xy / s) * bw.z;
      }
      float triRough(sampler2D m, float s, vec3 bw) {
        return texture2D(m, vGroundPos.zy / s).g * bw.x + texture2D(m, vGroundPos.xz / s).g * bw.y + texture2D(m, vGroundPos.xy / s).g * bw.z;
      }
      // whiteout-blended normal maps, in world space
      vec3 topNormal(sampler2D m, float s, vec3 n) {
        vec3 t = texture2D(m, vGroundPos.xz / s).xyz * 2.0 - 1.0;
        return normalize(vec3(t.x + n.x, abs(t.z) * n.y, t.y + n.z));
      }
      vec3 triNormal(sampler2D m, float s, vec3 n, vec3 bw) {
        vec3 tx = texture2D(m, vGroundPos.zy / s).xyz * 2.0 - 1.0;
        vec3 ty = texture2D(m, vGroundPos.xz / s).xyz * 2.0 - 1.0;
        vec3 tz = texture2D(m, vGroundPos.xy / s).xyz * 2.0 - 1.0;
        vec3 sg = sign(n);
        tx.z *= sg.x; ty.z *= sg.y; tz.z *= sg.z;
        tx = vec3(tx.xy + n.zy, abs(tx.z) * n.x);
        ty = vec3(ty.xy + n.xz, abs(ty.z) * n.y);
        tz = vec3(tz.xy + n.xy, abs(tz.z) * n.z);
        return normalize(tx.zyx * bw.x + ty.xzy * bw.y + tz.xyz * bw.z);
      }`;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${decl}\nuniform float gNormalScale;\nvarying vec3 vWeights;\nvarying vec3 vGroundPos;\nvarying vec3 vGroundN;\n${helpers}`)
      .replace('#include <map_fragment>', `
        float wsum = max(vWeights.x + vWeights.y + vWeights.z, 0.0001);
        float w[3];
        w[0] = vWeights.x / wsum; w[1] = vWeights.y / wsum; w[2] = vWeights.z / wsum;
        vec3 gn = normalize(vGroundN);
        vec3 bw = pow(abs(gn), vec3(4.0)); bw /= bw.x + bw.y + bw.z;
        vec3 gCol = vec3(0.0); float gRough = 0.0; vec3 gNor = vec3(0.0);
        ${layerCode}
        diffuseColor.rgb *= gCol;`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness * gRough;`)
      .replace('#include <normal_fragment_maps>', `
        vec3 gWorldN = normalize(mix(gn, normalize(gNor + gn * 0.001), gNormalScale));
        normal = normalize((viewMatrix * vec4(gWorldN, 0.0)).xyz);`);
  };
  m.customProgramCacheKey = () => `ground3-${layers.map((l) => l.id + (l.tri ? 't' : '')).join('-')}-${normalize}-${desat}-${normalScale}`;
  return m;
}
