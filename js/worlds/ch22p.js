// Chapter Twenty-two: Gladly, told in the book's own paintings (Visual Samples/artwork):
// the lake; the lamps by the lake; the shelf of the compound.
import { paintedWorld, driftBeats, stretches } from './painted.js';

const META = {"lake": {"w": 1774, "h": 887, "box": [0.0186, 0.2266, 0.9791, 0.8005], "core": [0.0788, 0.2748, 0.9122, 0.7523], "c": [0.5001, 0.5193]}, "lamps": {"w": 1774, "h": 887, "box": [0.0107, 0.1826, 0.9921, 0.841], "core": [0.0743, 0.2297, 0.9212, 0.7838], "c": [0.4973, 0.504]}, "shelf": {"w": 1024, "h": 1024, "box": [0.0156, 0.043, 0.9688, 0.9678], "core": [0.0508, 0.2227, 0.8477, 0.9219], "c": [0.3858, 0.6341]}};
const S = stretches(3);

export function build() {
  return paintedWorld({
    dir: 'assets/illus/ch22',
    meta: META,
    background: 0xa0f18,
    paintings: [
      { name: 'lake', ...S[0] },
      { name: 'lamps', ...S[1], lights: [{ at: [0.2, 0.55], r: 0.05, amount: 0.45 }, { at: [0.45, 0.55], r: 0.05, amount: 0.45 }, { at: [0.7, 0.55], r: 0.05, amount: 0.45 }] },
      { name: 'shelf', ...S[2] },
    ],
    beats: driftBeats(4),
  });
}
