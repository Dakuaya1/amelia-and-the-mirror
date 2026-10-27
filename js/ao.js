// Ambient occlusion: the soft darkening where things meet (the book on the desk, a chair on the
// floor, a hedge on the lawn) that real light has and a rasteriser leaves out. Ground-truth AO
// (GTAO), denoised, blended into the frame before bloom.
// On for desktop-class screens; off with ?lite, on touch devices and on narrow screens.
//
// Glows, flames, rain, stars, dust and sky domes take no part: they are moved to their own layer,
// which the scene's camera still draws but the AO pass's camera does not. (Seen by AO, a flame's
// glow sprite reads as a solid card and casts a dark box round the candle.)
import * as THREE from 'three';
import { GTAOPass } from '../vendor/addons/postprocessing/GTAOPass.js';
import { DESKTOP_CLASS } from './device.js';

export const AO_ON = DESKTOP_CLASS;

const NO_AO = 2; // the layer for things AO must not see
const tagged = new WeakSet();

const transparentish = (o) => {
  if (o.isPoints || o.isSprite || o.isLine) return true;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  return mats.some((m) => m && (m.transparent || m.depthWrite === false || m.side === THREE.BackSide || m.blending === THREE.AdditiveBlending));
};

// Move a scene's see-through things to the NO_AO layer (once per object; models that load later
// are picked up the next time the scene is aimed at).
function tag(scene) {
  scene.traverse((o) => {
    if (tagged.has(o) || !(o.isMesh || o.isPoints || o.isSprite || o.isLine)) return;
    tagged.add(o);
    if (transparentish(o)) o.layers.set(NO_AO);
  });
}

/** A GTAO pass for scene + camera, or null when AO is off. radius is in the scene's own units. */
export function makeAO(scene, camera, width, height, radius) {
  if (!AO_ON) return null;
  const aoCamera = camera.clone();
  // computed at half resolution (a quarter of the pixels) and blended up onto the full frame
  const ao = new GTAOPass(scene, aoCamera, Math.ceil(width / 2), Math.ceil(height / 2));
  const fullSize = ao.setSize.bind(ao);
  ao.setSize = (w, h) => fullSize(Math.ceil(w / 2), Math.ceil(h / 2));
  ao.output = GTAOPass.OUTPUT.Default;
  ao.blendIntensity = 0.75;
  ao.updateGtaoMaterial({ radius, distanceExponent: 1.5, thickness: 1, scale: 1, samples: 10 });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 8 });
  ao.aoRadius = radius;
  ao.aoCamera = aoCamera;
  ao.lastTag = 0;
  return ao;
}

/** Point the pass at whichever scene and camera are being drawn this frame. */
export function aimAO(ao, scene, camera, radius) {
  if (!ao) return;
  camera.layers.enable(NO_AO); // the scene's own camera still draws glows, rain and sky
  ao.aoCamera.copy(camera);
  ao.aoCamera.layers.set(0); // the AO camera sees only solid things
  ao.scene = scene;
  ao.camera = ao.aoCamera;
  const now = performance.now();
  if (now - ao.lastTag > 1000 || ao.lastScene !== scene) { tag(scene); ao.lastTag = now; ao.lastScene = scene; }
  if (ao.aoRadius !== radius) {
    ao.updateGtaoMaterial({ radius });
    ao.aoRadius = radius;
  }
}
