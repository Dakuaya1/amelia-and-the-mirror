// Dev: stills of chapter worlds at given beats, tiled into one sheet.
//   node tools/worldshots.mjs out.jpg 29:0,29:1,29:2:2.4 [1280x720] [waitMs]   (k:s[:pull-back])
import { chromium } from '../../../../../book-3d-reel/node_modules/playwright-core/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [out = '/tmp/worlds.jpg', list = '29:0', size = '1280x720', wait = '6000'] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.hdr': 'application/octet-stream', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream' };
const server = http.createServer((req, res) => { const p = path.join(SITE, decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (!p.startsWith(SITE) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': T[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const dir = fs.mkdtempSync('/tmp/worldshots-');
const shots = list.split(',');
for (let i = 0; i < shots.length; i++) {
  const [k, s, b = 0] = shots[i].split(':');
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/tools/worldview.html?k=${k}&s=${s}&b=${b}${process.env.QUERY ? '&' + process.env.QUERY : ''}`);
  await page.waitForTimeout(+wait);
  await page.screenshot({ path: `${dir}/${String(i).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 85 });
  if (errs.length) console.log(`${k}:${s} errors:`, errs.slice(0, 3).join(' | '));
  await page.close();
}
await browser.close(); server.close();
const cols = Math.min(3, shots.length), rows = Math.ceil(shots.length / cols);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', `${dir}/%02d.jpg`, '-vf', `scale=${Math.min(W, 960)}:-2,tile=${cols}x${rows}:padding=4:color=gray`, '-frames:v', '1', out]);
fs.rmSync(dir, { recursive: true });
console.log('->', out);
