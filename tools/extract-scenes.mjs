import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Usage: node tools/extract-scenes.mjs <unzipped-epub>/OEBPS/text js/scenes.js
const TEXT = process.argv[2];
const out = process.argv[3];
const decode = (s) => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&nbsp;/g, ' ');
const clean = (html) => decode(html.replace(/<span[^>]*>|<\/span>/g, '').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());

// Trim to whole sentences, at most ~max characters.
function trimSentences(text, max) {
  if (text.length <= max) return text;
  const parts = text.split(/(?<=[.!?…’”])\s+/);
  let acc = '';
  for (const p of parts) {
    if ((acc + ' ' + p).trim().length > max) break;
    acc = (acc + ' ' + p).trim();
  }
  return acc || text.slice(0, max - 1).trimEnd() + '…';
}

const scenes = {};
for (const f of readdirSync(TEXT).filter((f) => /^ch\d{2}\.xhtml$/.test(f)).sort()) {
  const num = Number(f.slice(2, 4));
  const x = readFileSync(join(TEXT, f), 'utf8');
  // Walk block elements in order so we know what follows each figure.
  const blocks = [...x.matchAll(/<(div|p)(\s[^>]*)?>([\s\S]*?)<\/\1>/g)].map((m) => ({ tag: m[1], attrs: m[2] || '', inner: m[3] }));
  const list = [];
  blocks.forEach((b, i) => {
    if (b.tag !== 'div' || !/class="fig/.test(b.attrs)) return;
    const m = b.inner.match(/src="\.\.\/img\/(c\d{2}_\d+\.jpg)"\s+alt="([^"]*)"/);
    if (!m) return;
    let text = '';
    for (let j = i + 1; j < blocks.length && text.length < 150; j++) {
      const nb = blocks[j];
      if (nb.tag === 'div' && /class="fig/.test(nb.attrs)) break;
      if (nb.tag !== 'p') continue;
      const t = clean(nb.inner);
      if (t) text = text ? `${text} ${t}` : t;
    }
    list.push({ img: m[1], title: decode(m[2]), text: trimSentences(text, 300) });
  });
  scenes[num] = list;
}
writeFileSync(out, `// Illustrations per chapter, in reading order, with the passage that follows each one.\nexport default ${JSON.stringify(scenes, null, 2)};\n`);
console.log(Object.entries(scenes).map(([k, v]) => `${k}:${v.length}`).join(' '));
