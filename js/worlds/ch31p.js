// Chapter Thirty-one: The Armchair, told in the book's own paintings (Visual Samples/artwork/
// Chapter 31): the thing in her mother's armchair; Vivrant stepping over the fallen door; the
// long-case clock, broken on the flags; her father in the kitchen doorway.
import { paintedWorld } from './painted.js';
import * as THREE from 'three';

const META = {"armchair": {"w": 1774, "h": 887, "box": [0.0011, 0.0958, 0.9915, 0.8241], "core": [0.0541, 0.2252, 0.9369, 0.7838], "c": [0.4944, 0.5033]}, "door": {"w": 1024, "h": 1536, "box": [0.3525, 0.0013, 0.9971, 0.9837], "core": [0.3945, 0.0521, 0.9648, 0.9219], "c": [0.6809, 0.4871]}, "clock": {"w": 1536, "h": 1024, "box": [0.002, 0.002, 0.9551, 0.9902], "core": [0.0313, 0.1133, 0.7604, 0.9531], "c": [0.3011, 0.617]}, "father": {"w": 1024, "h": 620, "box": [0.0195, 0.0274, 0.9814, 0.971], "core": [0.0898, 0.0903, 0.918, 0.9032], "c": [0.5051, 0.4975]}};

export function build() {
  return paintedWorld({
    dir: 'assets/illus/ch31',
    meta: META,
    background: 0x0b0908,
    paintings: [
      { name: 'armchair', subject: [0.45, 0.45], from: 0, to: 1.5, lights: [{ at: [0.275, 0.65], r: 0.06, amount: 0.55 }, { at: [0.7, 0.37], r: 0.07, amount: 0.35, color: 0xff7a3a }] },
      { name: 'door', from: 1.5, to: 2.5, focus: [0.6, 0.46], showH: 0.82, sweep: 0.03, lights: [{ at: [0.42, 0.62], r: 0.08, amount: 0.3 }] },
      { name: 'clock', from: 2.5, to: 3.5, focus: [0.32, 0.56], show: 0.56, sweep: 0.05, reverse: true, lights: [{ at: [0.36, 0.65], r: 0.06, amount: 0.45 }] },
      { name: 'father', subject: [0.8, 0.5], from: 3.5, to: 99, focus: [0.6, 0.5], show: 0.74, sweep: 0.05, lights: [{ at: [0.685, 0.68], r: 0.05, amount: 0.5 }, { at: [0.8, 0.45], r: 0.14, amount: 0.22 }] },
    ],
    // small drifts round the paintings: the parallax comes from these
    beats: [
      { pos: new THREE.Vector3(-0.3, 0.05, 3.3), look: new THREE.Vector3(-0.1, 0, 0) },
      { pos: new THREE.Vector3(0.28, 0.08, 2.9), look: new THREE.Vector3(0.12, 0.02, 0) },
      { pos: new THREE.Vector3(-0.25, -0.05, 3.0), look: new THREE.Vector3(-0.08, 0, 0) },
      { pos: new THREE.Vector3(0.25, 0.04, 3.0), look: new THREE.Vector3(0.1, 0, 0) },
      { pos: new THREE.Vector3(-0.2, 0.0, 2.9), look: new THREE.Vector3(-0.05, 0, 0) },
    ],
  });
}
