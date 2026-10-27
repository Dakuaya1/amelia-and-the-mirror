// The chapter worlds. For each showcased chapter: which of the book's passages
// (indices into scenes.js for that chapter) are told inside it, in order, and
// the function that builds the place. A world's beats are: an establishing
// camera, then one camera per caption, in this order.
import * as ch01 from './ch01p.js'; // the book's paintings (the built 3D version is ch01.js)
import * as ch04 from './ch04p.js'; // the book's paintings (the built 3D version is ch04.js)
import * as ch10 from './ch10p.js'; // the book's paintings (the built 3D version is ch10.js)
import * as ch18 from './ch18p.js'; // the book's paintings (the built 3D version is ch18.js)
import * as ch22 from './ch22p.js'; // the book's paintings (the built 3D version is ch22.js)
import * as ch29 from './ch29p.js'; // the book's paintings (the built 3D version is ch29.js)
import * as ch31 from './ch31p.js'; // the book's paintings (the built 3D version is ch31.js)
import * as ch32 from './ch32p.js'; // the book's paintings (the built 3D version is ch32.js)

export const WORLDS = {
  // the long table, the chair on the landing, the string across the attic, the mirror
  1: { captions: [2, 1, 4, 5], build: ch01.build },
  // the trunk marked Adam, the photograph, the hands on the glass, the sky with no horizon
  4: { captions: [0, 1, 4, 5], build: ch04.build },
  // the wheel, the back table, the first run, up the one in eight
  10: { captions: [0, 1, 2, 4], build: ch10.build },
  // the workshop, the glass, the ship
  18: { captions: [1, 2, 4], build: ch18.build },
  // the lake, the lamps by the lake, the shelf of the compound
  22: { captions: [0, 3, 4], build: ch22.build },
  // the blast in the vault, the narha in the valley
  29: { captions: [0, 6], build: ch29.build },
  // the armchair, the fallen door, the long-case clock, her father in the doorway
  31: { captions: [0, 1, 2, 3], build: ch31.build },
  // the dark stair, the stair that keeps going, the glass goes out, Anna on the sill
  32: { captions: [0, 2, 3, 6], build: ch32.build },
};
