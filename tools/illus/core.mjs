// Dev: where each prepared painting's paint really is. Adds to meta.json, per painting:
//   core: [x0, y0, x1, y1], the 5th to 95th percentile of its painted pixels (from the top left),
//   c: [x, y], their centre. Torn-edge strays no longer pull the framing about.
//   node tools/illus/core.mjs ch01 ch04 ...
import { chromium } from '../../../../../../book-3d-reel/node_modules/playwright-core/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const server = http.createServer((req, res) => { const p = path.join(SITE, decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': p.endsWith('.webp') ? 'image/webp' : 'text/html' }); fs.createReadStream(p).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`).catch(() => {});
for (const ch of process.argv.slice(2)) {
  const file = path.join(SITE, 'assets/illus', ch, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const name of Object.keys(meta)) {
    const r = await page.evaluate(async (url) => {
      const img = new Image(); img.src = url; await img.decode();
      const w = Math.round(img.width / 4), h = Math.round(img.height / 4);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data;
      const xs = [], ys = []; let sx = 0, sy = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 128) { xs.push(x); ys.push(y); sx += x; sy += y; }
      xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
      const q = (a, p) => a[Math.floor(a.length * p)];
      return { core: [q(xs, 0.05) / w, q(ys, 0.05) / h, q(xs, 0.95) / w, q(ys, 0.95) / h], c: [sx / xs.length / w, sy / ys.length / h] };
    }, `/assets/illus/${ch}/${name}.webp`);
    meta[name].core = r.core.map((v) => +v.toFixed(4));
    meta[name].c = r.c.map((v) => +v.toFixed(4));
    console.log(ch, name, 'core', meta[name].core.join(','), 'centre', meta[name].c.join(','));
  }
  fs.writeFileSync(file, JSON.stringify(meta, null, 1));
}
await browser.close(); server.close();
