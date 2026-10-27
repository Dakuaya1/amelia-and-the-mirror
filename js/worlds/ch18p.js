// Chapter Eighteen: The Best in the Business, told in the book's own paintings (Visual Samples/artwork):
// the workshop; the glass; the ship.
import { paintedWorld, driftBeats, stretches } from './painted.js';

const META = {"workshop": {"w": 1024, "h": 1536, "box": [0.4307, 0.0013, 0.9971, 0.998], "core": [0.4844, 0.0521, 0.9688, 0.9323], "c": [0.7297, 0.4898]}, "glass": {"w": 1536, "h": 1024, "box": [0.0013, 0.1279, 0.998, 0.8721], "core": [0.0547, 0.1719, 0.9453, 0.8242], "c": [0.4991, 0.4981]}, "ship": {"w": 1024, "h": 1024, "box": [0.0527, 0.2061, 0.9463, 0.7959], "core": [0.1055, 0.2344, 0.8867, 0.7539], "c": [0.4939, 0.4933]}};
const S = stretches(3);

export function build() {
  return paintedWorld({
    dir: 'assets/illus/ch18',
    meta: META,
    background: 0xc0b09,
    paintings: [
      { name: 'workshop', ...S[0] },
      { name: 'glass', ...S[1] },
      { name: 'ship', ...S[2] },
    ],
    beats: driftBeats(4),
  });
}
