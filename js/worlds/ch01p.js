// Chapter One: The Eleven Feet, told in the book's own paintings (Visual Samples/artwork):
// the long table; the chair on the landing; the string across the attic; the mirror in the clean room.
import { paintedWorld, driftBeats, stretches } from './painted.js';

const META = {"table": {"w": 976, "h": 440, "box": [0.0123, 0.0341, 0.9867, 0.9614], "core": [0.0697, 0.1182, 0.9262, 0.8545], "c": [0.4977, 0.4801]}, "landing": {"w": 1024, "h": 1024, "box": [0.4824, 0.0332, 0.9697, 0.9619], "core": [0.5117, 0.0938, 0.9336, 0.9023], "c": [0.7248, 0.4962]}, "attic": {"w": 1024, "h": 896, "box": [0.043, 0.0525, 0.9561, 0.9799], "core": [0.0938, 0.1518, 0.8672, 0.9063], "c": [0.4482, 0.5547]}, "mirror": {"w": 1024, "h": 1536, "box": [0.002, 0.0013, 0.6299, 0.998], "core": [0.0273, 0.0547, 0.5664, 0.9323], "c": [0.2908, 0.4849]}};
const S = stretches(4);

export function build() {
  return paintedWorld({
    dir: 'assets/illus/ch01',
    meta: META,
    background: 0xb0908,
    paintings: [
      { name: 'table', subject: [0.45, 0.5], ...S[0], lights: [{ at: [0.18, 0.67], r: 0.05, amount: 0.5 }, { at: [0.79, 0.67], r: 0.05, amount: 0.5 }, { at: [0.47, 0.88], r: 0.07, amount: 0.35 }] },
      { name: 'landing', ...S[1], lights: [{ at: [0.72, 0.1], r: 0.06, amount: 0.4 }] },
      { name: 'attic', ...S[2] },
      { name: 'mirror', ...S[3] },
    ],
    beats: driftBeats(5),
  });
}
