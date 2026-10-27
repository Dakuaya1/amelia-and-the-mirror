// Chapter Four: The Fourth Row, told in the book's own paintings (Visual Samples/artwork):
// the trunk marked Adam; the photograph on the back step; the hands on the glass; the sky with no horizon.
import { paintedWorld, driftBeats, stretches } from './painted.js';

const META = {"trunk": {"w": 1024, "h": 1536, "box": [0.3184, 0.0013, 0.9971, 0.998], "core": [0.418, 0.0521, 0.9727, 0.9453], "c": [0.7368, 0.5648]}, "photo": {"w": 1024, "h": 1536, "box": [0.002, 0.0423, 0.9971, 0.9798], "core": [0.0273, 0.2734, 0.9063, 0.9297], "c": [0.3958, 0.6807]}, "glass": {"w": 1024, "h": 1536, "box": [0.002, 0.0013, 0.6309, 0.998], "core": [0.0273, 0.0547, 0.5703, 0.9323], "c": [0.2919, 0.4846]}, "sky": {"w": 1774, "h": 887, "box": [0.0011, 0.1691, 0.9983, 0.8388], "core": [0.0541, 0.2252, 0.9437, 0.7793], "c": [0.4995, 0.5023]}};
const S = stretches(4);

export function build() {
  return paintedWorld({
    dir: 'assets/illus/ch04',
    meta: META,
    background: 0xa0a10,
    paintings: [
      { name: 'trunk', ...S[0] },
      { name: 'photo', ...S[1], lights: [{ at: [0.12, 0.5], r: 0.08, amount: 0.5 }] },
      { name: 'glass', ...S[2] },
      { name: 'sky', ...S[3] },
    ],
    beats: driftBeats(5),
  });
}
