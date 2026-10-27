// Draws every page of the book onto a canvas. Each canvas becomes a texture on a 3D leaf.
import chapterData from './chapters.js';

export const PAGE_W = 720;
export const PAGE_H = 1080;
export const LAST_PAGE = 66;

const SERIF = '"Cormorant Garamond", "Iowan Old Style", Palatino, Georgia, serif';
const DISPLAY = '"Cinzel", "Trajan Pro", Georgia, serif';
const PAPER = '#f4ecda';
const INK = '#2a2016';
const MUTED = '#6b5843';
const GOLD = '#a9803d';
const NAVY = '#0d1729';
const STAR_GOLD = '#e2c283';

const MARGIN = 80;
const TOP = 130;
const BOTTOM = PAGE_H - 130;

// "Chapter One: The Eleven Feet" -> label "Chapter One", heading "The Eleven Feet"
export const CHAPTERS = chapterData.chapters.map((c) => {
  const [label, ...rest] = c.title.split(': ');
  return { ...c, label, heading: rest.join(': ') || c.title, paragraphs: c.excerpt.split('\n\n') };
});
export const CAST = chapterData.cast;

/**
 * Page map. Page 0 is the inside of the front board; leaf s has its front on
 * page 2s+1 (right-hand page) and its back on page 2s+2 (left-hand page).
 */
export function describePage(page) {
  if (page === 'blank' || page === 'endpaper') return { kind: page };
  if (page === 0) return { kind: 'title' };
  if (page === 1) return { kind: 'cast', groups: CAST.slice(0, 2) };
  if (page === LAST_PAGE) return { kind: 'closing', groups: CAST.slice(2) };
  const chapter = CHAPTERS[Math.floor((page - 2) / 2)];
  return { kind: page % 2 === 0 ? 'art' : 'text', chapter };
}

/** scale: canvas pixels per page unit (2 for the spread being read, so its type and plates stay sharp close up). */
export function renderPage(page, assets = {}, scale = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PAGE_W * scale);
  canvas.height = Math.round(PAGE_H * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.imageSmoothingQuality = 'high';
  const spec = describePage(page);

  if (spec.kind === 'title') {
    drawTitle(ctx);
    return canvas;
  }
  if (spec.kind === 'endpaper') {
    drawEndpaper(ctx);
    return canvas;
  }

  paper(ctx, typeof page === 'number' ? page : 0);
  if (spec.kind === 'art') {
    const plate = assets.plates?.get(spec.chapter.num);
    if (plate) drawPlate(ctx, plate, spec.chapter);
    else drawArt(ctx, assets.panels?.get(spec.chapter.num));
  }
  if (spec.kind === 'text') drawText(ctx, spec.chapter);
  if (spec.kind === 'cast') drawCast(ctx, spec.groups, false);
  if (spec.kind === 'closing') drawCast(ctx, spec.groups, true);
  gutter(ctx, page % 2 === 1);
  return canvas;
}

/* ---------- page furniture ---------- */

function paper(ctx, page = 0) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  // Deterministic grain so every render of a page looks identical.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(90, 60, 30, ${0.02 + rand() * 0.03})`;
    ctx.fillRect(rand() * PAGE_W, rand() * PAGE_H, 1 + rand(), 1 + rand());
  }
  // Age: the paper toned a little warmer towards its edges, and a few faint foxing spots,
  // different on every page.
  const tone = ctx.createRadialGradient(PAGE_W / 2, PAGE_H / 2, PAGE_H * 0.32, PAGE_W / 2, PAGE_H / 2, PAGE_H * 0.72);
  tone.addColorStop(0, 'rgba(150, 105, 50, 0)');
  tone.addColorStop(1, 'rgba(150, 105, 50, 0.16)');
  ctx.fillStyle = tone;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  let spot = 11 + page * 131;
  const r2 = () => ((spot = (spot * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 7; i++) {
    const x = r2() * PAGE_W;
    const y = r2() * PAGE_H;
    const rad = 3 + r2() * 9;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(140, 90, 40, ${0.06 + r2() * 0.08})`);
    g.addColorStop(1, 'rgba(140, 90, 40, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

// Soft shadow where the page bends into the spine.
function gutter(ctx, onRight) {
  const x0 = onRight ? 0 : PAGE_W;
  const x1 = onRight ? 120 : PAGE_W - 120;
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, 'rgba(40, 25, 10, 0.3)');
  g.addColorStop(1, 'rgba(40, 25, 10, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
}

function star(ctx, cx, cy, r, color) {
  const k = r * 0.15;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + k, cy - k, cx + r, cy);
  ctx.quadraticCurveTo(cx + k, cy + k, cx, cy + r);
  ctx.quadraticCurveTo(cx - k, cy + k, cx - r, cy);
  ctx.quadraticCurveTo(cx - k, cy - k, cx, cy - r);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/* ---------- special pages ---------- */

function drawTitle(ctx) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  ctx.strokeStyle = STAR_GOLD;
  ctx.lineWidth = 3;
  ctx.strokeRect(34, 34, PAGE_W - 68, PAGE_H - 68);
  ctx.lineWidth = 1;
  ctx.strokeRect(46, 46, PAGE_W - 92, PAGE_H - 92);

  star(ctx, PAGE_W / 2, 230, 34, STAR_GOLD);
  flow(
    ctx,
    [
      { text: 'Amelia and the Mirror', family: 'display', size: 58, color: STAR_GOLD, align: 'center', lh: 1.18, gap: 0.5 },
      { text: 'The Origin', style: 'italic', size: 40, color: '#cdd6ea', align: 'center', gap: 0.9 },
      { text: 'Book One', family: 'display', size: 20, color: STAR_GOLD, align: 'center', gap: 0 },
    ],
    MARGIN,
    300,
    PAGE_W - 2 * MARGIN,
    420,
  );
  centerLine(ctx, 'PRIYANSHU SHARMA', PAGE_H - 200, `400 26px ${DISPLAY}`, STAR_GOLD);
  star(ctx, PAGE_W / 2, PAGE_H - 250, 14, STAR_GOLD);
}

function drawEndpaper(ctx) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  ctx.fillStyle = 'rgba(226, 194, 131, 0.22)';
  for (let y = 30; y < PAGE_H; y += 36) {
    for (let x = (y / 36) % 2 ? 18 : 36; x < PAGE_W; x += 36) {
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  star(ctx, PAGE_W / 2, PAGE_H / 2, 40, 'rgba(226, 194, 131, 0.55)');
}

/* ---------- content pages ---------- */

// The illustrations already carry the chapter title, so the page is image plus a small ornament.
function drawArt(ctx, img) {
  const frame = { x: MARGIN, y: 110, w: PAGE_W - 2 * MARGIN, h: 760 };
  if (img) {
    const s = Math.min(frame.w / img.naturalWidth, frame.h / img.naturalHeight);
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    const x = frame.x + (frame.w - w) / 2;
    const y = frame.y + (frame.h - h) / 2;
    ctx.drawImage(img, x, y, w, h);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 6, y - 6, w + 12, h + 12);
  }
  star(ctx, PAGE_W / 2, PAGE_H - 170, 12, GOLD);
}

// A showcased chapter's plate: its painting printed on the paper (multiplied, so the paper's
// tone shows through its lights), centred where the portal opens, with a small caption.
// plate: { img, caption }
function drawPlate(ctx, plate, chapter) {
  ctx.letterSpacing = '5px'; // (where the canvas supports it)
  centerLine(ctx, 'AMELIA AND THE MIRROR', 62, `400 13px ${DISPLAY}`, MUTED);
  const img = plate.img;
  const box = { w: 664, h: 540 }; // a little into the margins, as a plate printed to bleed would
  const s = Math.min(box.w / img.naturalWidth, box.h / img.naturalHeight);
  const w = img.naturalWidth * s;
  const h = img.naturalHeight * s;
  const cy = 490; // the centre of the dive into the page (see main.js, the art point)
  const x = (PAGE_W - w) / 2;
  const y = cy - h / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
  // the caption under the plate: an ornament, the moment, the chapter
  ctx.letterSpacing = '0px';
  const capY = Math.max(y + h + 34, 640);
  star(ctx, PAGE_W / 2, capY, 9, GOLD);
  centerLine(ctx, plate.caption, capY + 22, `italic 400 30px ${SERIF}`, INK);
  ctx.letterSpacing = '4px';
  centerLine(ctx, chapter.label.toUpperCase(), capY + 68, `400 14px ${DISPLAY}`, GOLD);
  ctx.letterSpacing = '0px';
}

function drawText(ctx, chapter) {
  const head = [
    { text: chapter.label, family: 'display', size: 17, color: GOLD, align: 'center', gap: 0.35 },
    { text: chapter.heading, family: 'display', size: 44, color: INK, align: 'center', lh: 1.18, gap: 0.3 },
  ];
  if (chapter.subtitle) {
    head.push({ text: chapter.subtitle, style: 'italic', size: 25, color: MUTED, align: 'center', gap: 0.8 });
  }
  head.push({ text: '✦', size: 18, color: GOLD, align: 'center', gap: 0.8 });

  const body = chapter.paragraphs.map((text) => ({ text, size: 26, color: INK, indent: true, lh: 1.46, gap: 0.5 }));
  flow(ctx, [...head, ...body], MARGIN, TOP, PAGE_W - 2 * MARGIN, BOTTOM - TOP);

  centerLine(ctx, 'Excerpt · the full chapter is in the book', PAGE_H - 74, `italic 400 17px ${SERIF}`, MUTED);
}

function drawCast(ctx, groups, closing) {
  const blocks = [
    {
      text: closing ? 'The People of This Story, continued' : 'The People of This Story',
      family: 'display',
      size: 28,
      color: INK,
      align: 'center',
      gap: 1,
    },
  ];
  for (const group of groups) {
    blocks.push({ text: group.name.toUpperCase(), family: 'display', size: 16, color: GOLD, gap: 0.5 });
    for (const line of group.lines) {
      const dot = line.indexOf('. ');
      const runs = dot > 0
        ? [{ text: line.slice(0, dot + 1), style: 'bold' }, { text: line.slice(dot + 1), style: 'normal' }]
        : [{ text: line, style: 'normal' }];
      blocks.push({ runs, size: 21, color: INK, lh: 1.38, gap: 0.45 });
    }
    blocks[blocks.length - 1].gap = 1;
  }
  if (closing) {
    blocks.push({ text: 'Amelia and the Mirror: The Origin', style: 'italic', size: 24, color: MUTED, align: 'center', gap: 0.3 });
    blocks.push({ text: 'Book One', family: 'display', size: 16, color: GOLD, align: 'center', gap: 0 });
  }
  flow(ctx, blocks, MARGIN, TOP, PAGE_W - 2 * MARGIN, BOTTOM - TOP);
}

/* ---------- text layout ---------- */

function centerLine(ctx, text, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(text, PAGE_W / 2, y);
  ctx.textAlign = 'left';
}

function fontFor(style, size, family) {
  const fam = family === 'display' ? DISPLAY : SERIF;
  const st = style === 'italic' ? 'italic ' : style === 'bold' ? '600 ' : '';
  return `${st}${size}px ${fam}`;
}

// Shrinks the whole flow (down to 60%) until it fits the box, then draws it.
function flow(ctx, blocks, x, y, w, maxH) {
  let scale = 1;
  while (scale > 0.6 && layout(ctx, blocks, 0, 0, w, scale, false) > maxH) scale -= 0.02;
  layout(ctx, blocks, x, y, w, scale, true);
  return scale;
}

function layout(ctx, blocks, x, y, w, scale, draw) {
  let cy = y;
  for (const b of blocks) {
    const size = b.size * scale;
    const lineH = size * (b.lh ?? 1.42);
    const lines = wrap(ctx, tokenize(b), b, size, w);
    lines.forEach((line, i) => {
      if (draw) drawLine(ctx, line, b, x, cy, w, size, i === 0);
      cy += lineH;
    });
    cy += size * (b.gap ?? 0.4);
  }
  return cy - y;
}

function tokenize(b) {
  const runs = b.runs || [{ text: b.text, style: b.style }];
  const tokens = [];
  for (const run of runs) {
    for (const word of run.text.split(/\s+/)) {
      if (word) tokens.push({ w: word, style: run.style || b.style });
    }
  }
  return tokens;
}

function wrap(ctx, tokens, b, size, w) {
  const lines = [];
  let line = { items: [], width: 0 };
  ctx.font = fontFor(b.style, size, b.family);
  const space = ctx.measureText(' ').width;
  for (const tok of tokens) {
    const font = fontFor(tok.style, size, b.family);
    ctx.font = font;
    const tw = ctx.measureText(tok.w).width;
    const avail = w - (lines.length === 0 && b.indent ? size * 1.4 : 0);
    if (line.items.length && line.width + space + tw > avail) {
      lines.push(line);
      line = { items: [], width: 0 };
    }
    const gap = line.items.length ? space : 0;
    line.items.push({ w: tok.w, font, width: tw, gap });
    line.width += gap + tw;
  }
  if (line.items.length) lines.push(line);
  return lines;
}

function drawLine(ctx, line, b, x, y, w, size, first) {
  const indent = first && b.indent ? size * 1.4 : 0;
  let cx = b.align === 'center' ? x + (w - line.width) / 2 : x + indent;
  ctx.fillStyle = b.color || INK;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (const item of line.items) {
    cx += item.gap;
    ctx.font = item.font;
    ctx.fillText(item.w, cx, y);
    cx += item.width;
  }
}
