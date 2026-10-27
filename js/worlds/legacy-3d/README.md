# The built 3D chapter worlds (not in use)

Before the chapters were told in the book's own paintings (`../chNNp.js`, `../painted.js`), each
showcased chapter was a place built in three.js: these files. To bring one back, point its import
in `../index.js` here (for example `import * as ch22 from './legacy-3d/ch22.js';`). The build
leaves this folder out of its asset scan, so their Poly Haven models and textures only ship again
once one is imported from `index.js` and this folder is removed from `SKIP` in `tools/build.mjs`.
