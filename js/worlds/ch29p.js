// Chapter Twenty-nine: Past Tense, told in the book's own paintings (Visual Samples/artwork):
// the blast in the vault; the narha in the valley.
import { paintedWorld, driftBeats, stretches } from './painted.js';

const META = {"vault": {"w": 1800, "h": 740, "box": [0.0011, 0.173, 0.9983, 0.8351], "core": [0.0556, 0.2108, 0.9444, 0.7838], "c": [0.5008, 0.4992]}, "valley": {"w": 1800, "h": 771, "box": [0.0056, 0.1971, 0.9922, 0.8288], "core": [0.06, 0.228, 0.9356, 0.7876], "c": [0.4976, 0.5086]}};
const S = stretches(2);

export function build() {
  return paintedWorld({
    dir: 'assets/illus/ch29',
    meta: META,
    background: 0xc0a09,
    paintings: [
      { name: 'vault', subject: [0.3, 0.5], ...S[0], lights: [{ at: [0.15, 0.6], r: 0.08, amount: 0.4, color: 0xff5a3a }] },
      { name: 'valley', subject: [0.6, 0.5], ...S[1] },
    ],
    beats: driftBeats(3),
  });
}
