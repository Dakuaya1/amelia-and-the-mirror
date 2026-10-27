// Builds the site for hosting: node tools/build.mjs [outDir]   (default: ../../dist/amelia-one;
// Vercel runs it with outDir dist, see vercel.json)
//
//   - js/main.js and js/edition.js bundled and minified (three.js included; its MIT notice kept),
//     so the import map and vendor/ are no longer needed
//   - scrollcraft.js and scrollcraft.css minified
//   - only the Poly Haven assets the code uses (scanned from js/, so new ones are picked up),
//     the book's covers and chapter panels, and the reel
//   - nothing from tools/, README.md or the source tree
// Prints the size of the build and what a first visit downloads.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(SITE, process.argv[2] || '../../dist/amelia-one');
const rel = (p) => path.relative(SITE, p);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ---- code ----
await esbuild.build({
  entryPoints: [path.join(SITE, 'js/main.js'), path.join(SITE, 'js/edition.js')],
  bundle: true, minify: true, format: 'esm', target: 'es2020',
  alias: { three: path.join(SITE, 'vendor/three.module.js') },
  legalComments: 'eof',
  outdir: path.join(OUT, 'js'),
  logLevel: 'warning',
});
await esbuild.build({ entryPoints: [path.join(SITE, 'scrollcraft.js')], minify: true, target: 'es2017', outfile: path.join(OUT, 'scrollcraft.js'), logLevel: 'warning' });
await esbuild.build({ entryPoints: [path.join(SITE, 'scrollcraft.css')], minify: true, outfile: path.join(OUT, 'scrollcraft.css'), logLevel: 'warning' });

// ---- page: the bundle needs no import map ----
let html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '');
if (html.includes('importmap')) throw new Error('index.html: import map not removed');
// Share cards need absolute addresses: SITE_URL=https://your-domain npm run build
// (on Vercel the production address is known at build time, so share cards work with no setup)
const SITE_URL = (process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')).replace(/\/+$/, '');
if (SITE_URL) {
  html = html.replace(/content="assets\/meta\//g, `content="${SITE_URL}/assets/meta/`)
    .replace(/"image": "assets\/meta\//, `"image": "${SITE_URL}/assets/meta/`)
    .replace('<meta property="og:type"', `<link rel="canonical" href="${SITE_URL}/">\n<meta property="og:url" content="${SITE_URL}/">\n<meta property="og:type"`)
    .replace('"@type": "Book",', `"@type": "Book",\n  "url": "${SITE_URL}/",`);
}
fs.writeFileSync(path.join(OUT, 'index.html'), html);

// ---- assets the code refers to ----
const SKIP = ['worlds/legacy-3d']; // code kept but not used: its assets stay out of the build
const code = fs.readdirSync(path.join(SITE, 'js'), { recursive: true })
  .filter((f) => f.endsWith('.js') && !SKIP.some((d) => f.startsWith(d))).map((f) => fs.readFileSync(path.join(SITE, 'js', f), 'utf8')).join('\n');
const found = (re) => new Set([...code.matchAll(re)].map((m) => m[1]));
// (terrain layers are written { id: 'name', scale: n }; other { id: ... } objects, such as an SVG
// gradient's, are not textures)
const textures = new Set([...found(/pbr\(\s*'([^']+)'/g), ...found(/\{\s*id:\s*'([^']+)',\s*scale:/g)]);
const models = found(/model\(\s*[\w.]+\s*,\s*'([^']+)'/g);
const skies = found(/(?:sky|hdrSky)\(\s*[\w.]+\s*,\s*[\w.]+\s*,\s*'([^']+)'/g);
const modelTextureDirs = found(/dir:\s*'(models\/[^']+)'/g); // e.g. a model's own textures used as a material

const copy = (from) => {
  const src = path.join(SITE, from), dst = path.join(OUT, from);
  if (!fs.existsSync(src)) throw new Error(`missing asset: ${from}`);
  fs.cpSync(src, dst, { recursive: true });
};
for (const t of textures) {
  const dir = `assets/ph/textures/${t}`;
  if (fs.existsSync(path.join(SITE, dir))) copy(dir);
}
for (const d of modelTextureDirs) copy(`assets/ph/${d}`);
for (const m of models) copy(`assets/ph/models/${m}`);
// the skies the code names anywhere (sky(), lightZones, prepareSkies)
for (const f of fs.readdirSync(path.join(SITE, 'assets/ph/hdri'))) {
  const id = f.replace(/_1k\.hdr$/, '');
  if (code.includes(`'${id}'`)) copy(`assets/ph/hdri/${f}`);
}
copy('assets/ph/manifest.json');
copy('textures');
copy('assets/reel');
copy('assets/meta');
if (fs.existsSync(path.join(SITE, 'assets/illus'))) copy('assets/illus'); // painted chapter worlds

// every texture the code asks for must be in the build, at 1k (and 2k where shipped)
for (const t of textures) {
  const inLib = fs.existsSync(path.join(OUT, `assets/ph/textures/${t}`));
  const inModel = [...modelTextureDirs].some((d) => d.includes(t));
  if (!inLib && !inModel) throw new Error(`texture ${t} is used but not in the build`);
}

// ---- report ----
const sizeOf = (p) => (fs.statSync(p).isDirectory() ? fs.readdirSync(p).reduce((a, f) => a + sizeOf(path.join(p, f)), 0) : fs.statSync(p).size);
const mb = (b) => `${(b / 1e6).toFixed(1)} MB`;
console.log(`built ${rel(OUT)}  (${mb(sizeOf(OUT))})`);
for (const p of ['index.html', 'js', 'scrollcraft.js', 'scrollcraft.css', 'textures', 'assets/reel', 'assets/illus', 'assets/ph/textures', 'assets/ph/models', 'assets/ph/hdri']) if (fs.existsSync(path.join(OUT, p))) console.log(`  ${p.padEnd(20)} ${mb(sizeOf(path.join(OUT, p)))}`);
console.log(`  ${textures.size} texture sets, ${models.size} models, ${skies.size} skies`);
if (!SITE_URL) console.log('  note: share card addresses are relative; build with SITE_URL=https://your-domain once you have one');
