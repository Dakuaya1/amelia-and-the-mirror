// Chapter Thirty-two: The Twelfth Stair, told in the book's own paintings (Visual Samples/artwork):
// the dark stair; the stair that keeps going; the glass goes out; Anna on the sill.
import { paintedWorld, driftBeats, stretches } from './painted.js';

const META = {"stair": {"w": 1774, "h": 887, "box": [0.0079, 0.1567, 0.9893, 0.8129], "core": [0.0653, 0.2342, 0.9302, 0.7613], "c": [0.5043, 0.4964]}, "keeps": {"w": 1536, "h": 1024, "box": [0.1829, 0.002, 0.998, 0.9971], "core": [0.3568, 0.0977, 0.974, 0.9648], "c": [0.7285, 0.6188]}, "glassout": {"w": 1536, "h": 1024, "box": [0.0013, 0.127, 0.998, 0.834], "core": [0.0625, 0.2188, 0.9297, 0.7734], "c": [0.4962, 0.4953]}, "anna": {"w": 1800, "h": 750, "box": [0.0011, 0.2133, 0.9939, 0.776], "core": [0.0578, 0.2766, 0.9333, 0.734], "c": [0.495, 0.506]}};
const S = stretches(4);

export function build() {
  return paintedWorld({
    dir: 'assets/illus/ch32',
    meta: META,
    background: 0x8080b,
    paintings: [
      { name: 'stair', ...S[0] },
      { name: 'keeps', ...S[1] },
      { name: 'glassout', ...S[2] },
      { name: 'anna', subject: [0.3, 0.55], ...S[3] },
    ],
    beats: driftBeats(5),
  });
}
