// Dev: paintings -> transparent WebP + depth PNG + bounds (assets/illus/<chapter>/).
//   node tools/illus/make.mjs ch31 "<artwork dir>" "armchair=1 the armchair.png" ...
//   node tools/illus/make.mjs tools/illus/jobs.json      (several chapters, one model load)
import { chromium } from '../../../../../../book-3d-reel/node_modules/playwright-core/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '../..');
const argv = process.argv.slice(2);
const JOBS = argv[0].endsWith('.json')
  ? JSON.parse(fs.readFileSync(argv[0], 'utf8'))
  : [{ chapter: argv[0], dir: argv[1], items: Object.fromEntries(argv.slice(2).map((p) => p.split('='))) }];
let artDir = JOBS[0].dir;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const p = u.startsWith('/art/') ? path.join(artDir, u.slice(5)) : path.join(HERE, u);
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'image/png', 'access-control-allow-origin': '*' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (m) => console.log('page:', m.text().slice(0, 160)));
page.on('requestfailed', (r) => console.log('failed:', r.url().slice(0, 120), r.failure()?.errorText));
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));
await page.goto(`http://127.0.0.1:${server.address().port}/depth.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 600000 });
for (const job of JOBS) {
  artDir = job.dir;
  const out = path.join(SITE, 'assets/illus', job.chapter);
  fs.mkdirSync(out, { recursive: true });
  const meta = {};
  for (const [name, file] of Object.entries(job.items)) {
    const t0 = Date.now();
    const r = await page.evaluate(([u]) => window.process(u, 1800), [`/art/${encodeURIComponent(file)}`]);
    fs.writeFileSync(path.join(out, `${name}.webp`), Buffer.from(r.colour.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(out, `${name}_depth.png`), Buffer.from(r.depth.split(',')[1], 'base64'));
    meta[name] = { w: r.w, h: r.h, box: r.box.map((v) => +v.toFixed(4)) };
    console.log(`${job.chapter} ${name}: ${r.w}x${r.h} box ${meta[name].box.join(',')} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 1));
}
await browser.close(); server.close();
