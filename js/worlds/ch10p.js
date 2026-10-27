// Chapter Ten: The Man Who Does Not Promise, told in the book's own paintings (Visual Samples/artwork):
// the wheel; the back table; the first run; up the one in eight.
import { paintedWorld, driftBeats, stretches } from './painted.js';

const META = {"wheel": {"w": 896, "h": 1200, "box": [0.2455, 0.0017, 0.9967, 0.9975], "core": [0.3616, 0.0667, 0.9688, 0.95], "c": [0.6902, 0.5415]}, "table": {"w": 1024, "h": 1536, "box": [0.002, 0.0078, 0.9854, 0.9948], "core": [0.0313, 0.1458, 0.875, 0.9635], "c": [0.3496, 0.6655]}, "run": {"w": 1774, "h": 887, "box": [0.0062, 0.1815, 0.9944, 0.8151], "core": [0.0631, 0.2252, 0.9324, 0.7613], "c": [0.4976, 0.4921]}, "hill": {"w": 1376, "h": 768, "box": [0.0203, 0.1367, 0.9855, 0.8555], "core": [0.0785, 0.1823, 0.9215, 0.7917], "c": [0.5028, 0.4876]}};
const S = stretches(4);

export function build() {
  return paintedWorld({
    dir: 'assets/illus/ch10',
    meta: META,
    background: 0x111113,
    paintings: [
      { name: 'wheel', ...S[0] },
      { name: 'table', ...S[1] },
      { name: 'run', subject: [0.3, 0.5], ...S[2] },
      { name: 'hill', subject: [0.52, 0.45], ...S[3] },
    ],
    beats: driftBeats(5),
  });
}
