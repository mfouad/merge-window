// Generates every Merge Window brand asset (SVG, PNG, ICO, JPG, manifest).
// Run: npm run brand
// Text is converted to outlines from the brand fonts, so SVGs render
// identically everywhere without the fonts installed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import opentype from 'opentype.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = here;

// ---- Brand tokens (CLAUDE.md > Brand) -------------------------------------
const INK = '#10151C';
const PAPER = '#F4F1EA';
const AMBER = '#E8A33D';
const SOFT = '#D8D4CB';
const MUTE = '#B9B5AC';
const RULE = '#3A4048';

// Edit these two lines to relabel the launch post and cover.
const ISSUE_LABEL = 'ISSUE #1 · SEP 2026';
const TAGLINE = 'Open source signals for technical leaders.';

// ---- Fonts ----------------------------------------------------------------
const fontFile = (pkg, f) => path.join(here, '..', 'node_modules', '@fontsource', pkg, 'files', f);
const FONTS = {
  serif: opentype.loadSync(fontFile('source-serif-4', 'source-serif-4-latin-600-normal.woff')),
  sans: opentype.loadSync(fontFile('ibm-plex-sans', 'ibm-plex-sans-latin-400-normal.woff')),
  sansM: opentype.loadSync(fontFile('ibm-plex-sans', 'ibm-plex-sans-latin-500-normal.woff')),
  mono: opentype.loadSync(fontFile('ibm-plex-mono', 'ibm-plex-mono-latin-400-normal.woff')),
  monoM: opentype.loadSync(fontFile('ibm-plex-mono', 'ibm-plex-mono-latin-500-normal.woff')),
};

const r2 = (n) => Math.round(n * 100) / 100;

function width(font, str, size, ls = 0) {
  return FONTS[font].getAdvanceWidth(str, size, { letterSpacing: ls / size, kerning: true });
}

/** Text as an outlined <path>. ls is letter-spacing in px. anchor: start|end|middle. */
function T(font, str, x, y, size, fill, { ls = 0, anchor = 'start', opacity } = {}) {
  const f = FONTS[font];
  for (const ch of str) if (f.charToGlyph(ch).index === 0) console.warn(`missing glyph ${JSON.stringify(ch)} in ${font}`);
  const w = width(font, str, size, ls);
  const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  const d = f.getPath(str, x0, y, size, { letterSpacing: ls / size, kerning: true }).toPathData(2);
  return `<path d="${d}" fill="${fill}"${opacity != null ? ` fill-opacity="${opacity}"` : ''}/>`;
}

function wrap(font, str, size, maxW, ls = 0) {
  const lines = [];
  let line = '';
  for (const word of str.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && width(font, next, size, ls) > maxW) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// ---- SVG building blocks ----------------------------------------------------
function svg(w, h, body, { title, desc } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}">
<title>${title}</title>${desc ? `\n<desc>${desc}</desc>` : ''}
${body}
</svg>
`;
}

const BRANCH = 'M216 186 V326 M310 216 V232 C310 290 216 278 216 326';

/** The logo: git branch over three radar rings, new-branch node in accent. 512×512 space. */
function mark({ id = 'm', fg = PAPER, accent = AMBER, ringOp = 0.3, ringW = 10 } = {}) {
  return `<defs><mask id="k-${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
<rect width="512" height="512" fill="#fff"/>
<path d="${BRANCH}" fill="none" stroke="#000" stroke-width="48" stroke-linecap="round"/>
<circle cx="216" cy="160" r="44"/><circle cx="216" cy="352" r="44"/><circle cx="310" cy="190" r="44"/>
</mask></defs>
<g mask="url(#k-${id})" fill="none" stroke="${fg}" stroke-opacity="${ringOp}" stroke-width="${ringW}">
<circle cx="256" cy="256" r="70"/><circle cx="256" cy="256" r="130"/><circle cx="256" cy="256" r="190"/>
</g>
<path d="${BRANCH}" fill="none" stroke="${fg}" stroke-width="18" stroke-linecap="round"/>
<circle cx="216" cy="160" r="26" fill="none" stroke="${fg}" stroke-width="16"/>
<circle cx="216" cy="352" r="26" fill="none" stroke="${fg}" stroke-width="16"/>
<circle cx="310" cy="190" r="34" fill="${accent}"/>`;
}

const placeMark = (x, y, size, opts) => `<g transform="translate(${x} ${y}) scale(${r2(size / 512)})">${mark(opts)}</g>`;

const rings = (cx, cy, radii, op, sw = 3, fg = PAPER) =>
  radii.map((r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${fg}" stroke-opacity="${op}" stroke-width="${sw}"/>`).join('');

const RINGS = ['ADOPT', 'PILOT', 'WATCH', 'PASS'];
const RING_DESC = {
  ADOPT: 'Proven and ready to build on',
  PILOT: 'Worth experimenting with',
  WATCH: 'Early, worth keeping an eye on',
  PASS: 'Interesting, but with caveats',
};

/** Ring marker; shapes differ so the key works in grayscale. box = outer size in px. */
function ringMarker(ring, cx, cy, box) {
  const h = box / 2;
  if (ring === 'ADOPT') return `<circle cx="${cx}" cy="${cy}" r="${h}" fill="${AMBER}"/>`;
  if (ring === 'PILOT') return `<circle cx="${cx}" cy="${cy}" r="${h - 1}" fill="none" stroke="${PAPER}" stroke-width="2"/>`;
  if (ring === 'WATCH') return `<circle cx="${cx}" cy="${cy}" r="${h - 1}" fill="none" stroke="${MUTE}" stroke-width="2" stroke-dasharray="3 3"/>`;
  return `<rect x="${cx - h}" y="${cy - 1}" width="${box}" height="2" fill="${MUTE}"/>`;
}

const arrowRight = (x, y, len, color, sw = 3) =>
  `<path d="M${x} ${y} H${x + len} M${x + len - len * 0.28} ${y - len * 0.28} L${x + len} ${y} L${x + len - len * 0.28} ${y + len * 0.28}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;

// ---- Icons ------------------------------------------------------------------
/** Square app icon. scale<1 shrinks the mark (maskable safe zone); small = bolder rings for ≤48px. */
function iconSvg({ bg = INK, fg = PAPER, accent = AMBER, radius = 112, scale = 1, small = false, id = 'i' } = {}) {
  const m = mark({ id, fg, accent, ringOp: small ? 0.5 : 0.3, ringW: small ? 22 : 10 });
  const rect = bg ? `<rect width="512" height="512"${radius ? ` rx="${radius}"` : ''} fill="${bg}"/>` : '';
  return svg(512, 512, `${rect}<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${m}</g>`, {
    title: 'Merge Window',
    desc: 'A git branch symbol over three radar rings',
  });
}

// ---- Lockups ----------------------------------------------------------------
function lockup({ fg = PAPER, bg = null, accent = AMBER, id = 'l' } = {}) {
  const H = 160, mk = 128;
  const wm = 104, x = mk + 32;
  const w = Math.ceil(x + width('serif', 'Merge Window', wm, -1.5)) + 16;
  const body = (bg ? `<rect width="${w}" height="${H}" fill="${bg}"/>` : '')
    + placeMark(8, 16, mk, { id, fg, accent })
    + T('serif', 'Merge Window', x, 104, wm, fg, { ls: -1.5 });
  return svg(w, H, body, { title: 'Merge Window' });
}

function wordmark({ fg = PAPER } = {}) {
  const wm = 104;
  const w = Math.ceil(width('serif', 'Merge Window', wm, -1.5)) + 16;
  return svg(w, 140, T('serif', 'Merge Window', 8, 104, wm, fg, { ls: -1.5 }), { title: 'Merge Window' });
}

// ---- Banner 1584×396 --------------------------------------------------------
function banner() {
  const W = 1584, H = 396;
  let b = `<rect width="${W}" height="${H}" fill="${INK}"/>`;
  b += `<g transform="translate(-40 -82)">${rings(280, 280, [90, 170, 250], 0.14)}
<circle cx="360" cy="190" r="10" fill="${AMBER}"/>${[[200, 360], [410, 330], [170, 200]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="${PAPER}" fill-opacity="0.35"/>`).join('')}</g>`;
  b += placeMark(520, 81, 88, { id: 'bn' });
  b += T('serif', 'Merge Window', 632, 150, 76, PAPER, { ls: -1 });
  b += T('sans', TAGLINE, 520, 217, 28, SOFT);
  b += T('mono', 'Emerging open source worth experimenting with.', 520, 262, 18, MUTE, { ls: 1 });
  b += T('mono', 'A newsletter for technical leaders.', 520, 309, 18, MUTE, { ls: 1 });
  RINGS.forEach((r, i) => {
    const cy = 138 + i * 40;
    b += ringMarker(r, 1388 + 8, cy, 16);
    b += T('mono', r, 1388 + 30, cy + 7, 20, r === 'PASS' ? MUTE : r === 'WATCH' ? SOFT : PAPER, { ls: 2 });
  });
  return svg(W, H, b, { title: 'Merge Window: open source signals for technical leaders' });
}

// ---- Shared slide pieces ------------------------------------------------------
const PW = 1080, PH = 1350, PAD = 88;

function frame(body, { decor = true } = {}) {
  return `<rect width="${PW}" height="${PH}" fill="${INK}"/>`
    + (decor ? rings(960, 150, [150, 280, 410], 0.1) : '') + body;
}

function slideHeader(n, total, id) {
  return placeMark(PAD, PAD, 56, { id })
    + T('serif', 'Merge Window', PAD + 76, PAD + 38, 30, PAPER)
    + T('mono', `${String(n).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, PW - PAD, PAD + 36, 20, MUTE, { ls: 2, anchor: 'end' });
}

function slideFooter(last = false) {
  const y = PH - 80;
  let b = `<rect x="${PAD}" y="${y - 52}" width="${PW - PAD * 2}" height="2" fill="${RULE}"/>`;
  b += T('mono', 'Open source signals for technical leaders.', PAD, y, 20, MUTE, { ls: 0.5 });
  if (!last) b += arrowRight(PW - PAD - 44, y - 7, 44, PAPER, 3);
  return b;
}

/** Headline block; returns [svg, nextY]. */
function headline(str, y, size = 84) {
  const lines = wrap('serif', str, size, PW - PAD * 2, -1.5);
  let b = '';
  lines.forEach((l, i) => { b += T('serif', l, PAD, y + 66 + i * size * 1.06, size, PAPER, { ls: -1.5 }); });
  return [b, y + lines.length * size * 1.06];
}

// ---- Announcement / carousel slide 1 (1080×1350) -------------------------------
function announcement() {
  let b = frame('');
  b += placeMark(PAD, PAD, 72, { id: 'an' });
  b += T('serif', 'Merge Window', PAD + 92, 123, 40, PAPER);
  b += T('mono', ISSUE_LABEL, PAD + 92, 153, 18, MUTE, { ls: 2 });
  let y = 208;
  const h1 = wrap('serif', 'What open source tech is worth exploring next?', 80, PW - PAD * 2, -1.5);
  h1.forEach((l, i) => { b += T('serif', l, PAD, y + 66 + i * 83.2, 80, PAPER, { ls: -1.5 }); });
  y += h1.length * 83.2 + 28;
  const p = wrap('sans', 'A tech radar for CTOs, architects and technical leaders who are looking for technical edge to help their teams innovate and deliver.', 32, 860);
  p.forEach((l, i) => { b += T('sans', l, PAD, y + 33 + i * 44.8, 32, SOFT); });
  y += p.length * 44.8 + 48;
  b += `<rect x="${PAD}" y="${y}" width="${PW - PAD * 2}" height="2" fill="${RULE}"/>`;
  RINGS.forEach((r, i) => {
    const top = y + 2 + i * 80, cy = top + 39;
    b += ringMarker(r, PAD + 11, cy, 22);
    b += T('monoM', r, PAD + 50, cy + 9, 26, PAPER, { ls: 2 });
    b += T('sans', RING_DESC[r], PAD + 228, cy + 9, 26, SOFT);
    b += `<rect x="${PAD}" y="${top + 78}" width="${PW - PAD * 2}" height="2" fill="${RULE}"/>`;
  });
  const tableEnd = y + 322;
  const fy = PH - 80;
  b += T('mono', 'EVERY ENTRY COVERS', PAD, 1102, 20, MUTE, { ls: 2 });
  b += T('sans', 'Maturity & risk · License · Adoption cost · Lock-in & exit', PAD, 1155, 28, PAPER);
  b += `<rect x="${PAD}" y="${fy - 67}" width="${PW - PAD * 2}" height="2" fill="${RULE}"/>`;
  b += T('mono', 'Subscribe on LinkedIn', PAD, fy - 18, 22, PAPER, { ls: 1 });
  b += T('mono', 'Mohammad Hassan', PW - PAD, fy - 18, 22, MUTE, { ls: 1, anchor: 'end' });
  if (tableEnd > 1060) console.warn('announcement: table collides with footer block', tableEnd);
  return svg(PW, PH, b, { title: 'Merge Window launch post: What open source tech is worth exploring next?' });
}

// ---- Carousel slides 2–5 ---------------------------------------------------------
const TOTAL = 5;

function slideEvidence() {
  let b = frame('') + slideHeader(2, TOTAL, 's2');
  let [h, y] = headline('Every entry carries an evidence tag.', 220);
  b += h;
  y += 28;
  b += T('sans', 'So you know how a view was formed.', PAD, y + 36, 32, SOFT);
  y += 110;
  const rows = [
    ['hands-on', 'I used it'],
    ['community', 'Someone in my network runs it'],
    ['researched', 'Read and assessed, not yet used'],
  ];
  b += `<rect x="${PAD}" y="${y}" width="${PW - PAD * 2}" height="2" fill="${RULE}"/>`;
  rows.forEach(([tag, d], i) => {
    const top = y + 2 + i * 150;
    const tw = width('monoM', tag, 30, 2) + 40;
    b += `<rect x="${PAD}" y="${top + 38}" width="${tw}" height="56" rx="28" fill="none" stroke="${i === 0 ? AMBER : PAPER}" stroke-width="2"${i === 2 ? ' stroke-dasharray="6 5"' : ''}/>`;
    b += T('monoM', tag, PAD + 20, top + 76, 30, PAPER, { ls: 2 });
    b += T('sans', d, PAD, top + 128, 30, SOFT);
    b += `<rect x="${PAD}" y="${top + 148}" width="${PW - PAD * 2}" height="2" fill="${RULE}"/>`;
  });
  return svg(PW, PH, b + slideFooter(), { title: 'Merge Window carousel 2 of 5: evidence tags' });
}

function slideDiff() {
  let b = frame('') + slideHeader(3, TOTAL, 's3');
  let [h, y] = headline('Read the radar like a diff.', 220);
  b += h;
  y += 28;
  b += T('sans', 'Each post shows what changed, in three marks.', PAD, y + 36, 32, SOFT);
  y += 110;
  const f = 30, lh = 140;
  const lines = [
    { sign: '+', col: AMBER, parts: [' Added: [tool] (RING · evidence)'] },
    { sign: '~', col: PAPER, parts: [' Moved: [tool], RING', '>', 'RING'] },
    { sign: '-', col: MUTE, parts: [' Removed: [tool], reason'] },
  ];
  b += `<rect x="${PAD}" y="${y}" width="${PW - PAD * 2}" height="${lh * 3 + 4}" rx="12" fill="#161C25" stroke="${RULE}" stroke-width="2"/>`;
  lines.forEach((ln, i) => {
    const base = y + 2 + i * lh + lh / 2 + 10;
    let x = PAD + 40;
    b += T('monoM', ln.sign, x, base, f, ln.col);
    x += width('monoM', ln.sign, f);
    ln.parts.forEach((p) => {
      if (p === '>') { b += arrowRight(x + 14, base - 10, 40, PAPER, 3); x += 68; return; }
      b += T('mono', p, x, base, f, ln.col === AMBER || ln.col === PAPER ? PAPER : MUTE);
      x += width('mono', p, f);
    });
  });
  y += lh * 3 + 60;
  b += T('sans', 'Square brackets are placeholders for the tool and its ring.', PAD, y, 26, MUTE);
  return svg(PW, PH, b + slideFooter(), { title: 'Merge Window carousel 3 of 5: the diff notation' });
}

function slideCovers() {
  let b = frame('') + slideHeader(4, TOTAL, 's4');
  let [h, y] = headline('One short page for every tool.', 220);
  b += h;
  y += 28;
  const items = [
    ['What it is', 'One line, plus what it replaces'],
    ['Why it’s interesting now', 'The reason it’s on the radar'],
    ['Maturity & risk', 'Governance, license, release cadence'],
    ['Adoption cost', 'What it takes to try it'],
    ['Lock-in & exit', 'How hard it is to leave'],
    ['Where it fits', 'Teams and stacks it suits'],
  ];
  b += `<rect x="${PAD}" y="${y}" width="${PW - PAD * 2}" height="2" fill="${RULE}"/>`;
  items.forEach(([t, d], i) => {
    const top = y + 2 + i * 100;
    b += T('mono', String(i + 1).padStart(2, '0'), PAD, top + 60, 24, i === 2 ? AMBER : MUTE, { ls: 2 });
    b += T('sansM', t, PAD + 80, top + 52, 32, PAPER);
    b += T('sans', d, PAD + 80, top + 86, 24, MUTE);
    b += `<rect x="${PAD}" y="${top + 98}" width="${PW - PAD * 2}" height="2" fill="${RULE}"/>`;
  });
  return svg(PW, PH, b + slideFooter(), { title: 'Merge Window carousel 4 of 5: what every entry covers' });
}

function slideCta() {
  let b = frame('') + slideHeader(5, TOTAL, 's5');
  b += placeMark(PW / 2 - 160, 330, 320, { id: 'cta' });
  const [h] = headline('Know a tool we should look at?', 700);
  b += h;
  const y = 700 + wrap('serif', 'Know a tool we should look at?', 84, PW - PAD * 2, -1.5).length * 84 * 1.06 + 28;
  b += T('sans', 'Send a suggestion. Contributors are credited by name.', PAD, y + 36, 30, SOFT);
  const by = PH - 80 - 52 - 100;
  b += `<rect x="${PAD}" y="${by}" width="${PW - PAD * 2}" height="80" rx="40" fill="${AMBER}"/>`;
  b += T('monoM', 'SUBSCRIBE ON LINKEDIN', PW / 2, by + 50, 26, INK, { ls: 2, anchor: 'middle' });
  return svg(PW, PH, b + slideFooter(true), { title: 'Merge Window carousel 5 of 5: subscribe and suggest tools' });
}

// ---- Cover / OG (parametric) ---------------------------------------------------------
function cover(W, H, label) {
  const s = H / 1080;
  const cx = W - 500 * s, cy = H / 2, lx = 140 * s;
  let b = `<rect width="${W}" height="${H}" fill="${INK}"/>`;
  b += rings(cx, cy, [330 * s, 450 * s], 0.12, 3 * s);
  b += placeMark(cx - 310 * s, cy - 310 * s, 620 * s, { id: 'cv' });
  b += `<circle cx="${cx + 400 * s}" cy="${cy + 190 * s}" r="${7 * s}" fill="${PAPER}" fill-opacity="0.35"/><circle cx="${cx - 360 * s}" cy="${cy - 250 * s}" r="${7 * s}" fill="${PAPER}" fill-opacity="0.35"/>`;
  b += T('mono', 'TECH RADAR · OPEN SOURCE', lx, 330 * s, 24 * s, MUTE, { ls: 3 * s });
  const wm = 128 * s;
  const lines = ['Merge', 'Window'];
  lines.forEach((l, i) => { b += T('serif', l, lx, 330 * s + 130 * s + i * wm * 1.02, wm, PAPER, { ls: -2 * s }); });
  const ty = 330 * s + 130 * s + wm * 2.04 + 36 * s;
  wrap('sans', TAGLINE, 40 * s, 760 * s).forEach((l, i) => { b += T('sans', l, lx, ty + i * 54 * s, 40 * s, SOFT); });
  const ry = H - 150 * s;
  let x = lx;
  RINGS.forEach((r) => {
    b += ringMarker(r, x + 8 * s, ry, 16 * s);
    b += T('mono', r, x + 28 * s, ry + 7 * s, 20 * s, r === 'PASS' ? MUTE : PAPER, { ls: 2 * s });
    x += 28 * s + width('mono', r, 20 * s, 2 * s) + 44 * s;
  });
  return svg(W, H, b, { title: label });
}

// ---- Output ---------------------------------------------------------------------------
const written = [];
function save(rel, data) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
  written.push(rel);
}
async function png(rel, svgStr, w, h, { jpg = false, flatten = null, round = null } = {}) {
  let img = sharp(Buffer.from(svgStr), { density: Math.max(72, Math.ceil(72 * (w / Number(svgStr.match(/ width="(\d+)"/)[1])) * 1.01)) })
    .resize(w, h);
  if (flatten) img = img.flatten({ background: flatten });
  save(rel, jpg ? await img.jpeg({ quality: 92, mozjpeg: true }).toBuffer() : await img.png({ compressionLevel: 9 }).toBuffer());
}

function ico(buffers, sizes) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2); head.writeUInt16LE(buffers.length, 4);
  let offset = 6 + 16 * buffers.length;
  const dir = buffers.map((buf, i) => {
    const e = Buffer.alloc(16);
    e[0] = sizes[i] >= 256 ? 0 : sizes[i]; e[1] = e[0];
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12);
    offset += buf.length;
    return e;
  });
  return Buffer.concat([head, ...dir, ...buffers]);
}

async function main() {
  fs.rmSync(path.join(OUT, 'svg'), { recursive: true, force: true });
  for (const d of ['png', 'icons', 'social', 'carousel']) fs.rmSync(path.join(OUT, d), { recursive: true, force: true });

  // Logo marks and lockups (SVG + PNG)
  const marks = {
    'mark-dark': { svg: iconSvg({ bg: INK, radius: 0, id: 'a' }), note: 'ink background, square' },
    'mark-light': { svg: iconSvg({ bg: PAPER, fg: INK, accent: AMBER, radius: 0, id: 'b' }) },
    'mark-color-transparent': { svg: iconSvg({ bg: null, id: 'c' }) },
    'mark-ink-transparent': { svg: iconSvg({ bg: null, fg: INK, id: 'd' }) },
    'mark-grayscale': { svg: iconSvg({ bg: INK, accent: PAPER, radius: 0, id: 'e' }) },
    'mark-currentcolor': { svg: iconSvg({ bg: null, fg: 'currentColor', id: 'f' }) },
  };
  for (const [name, { svg: s }] of Object.entries(marks)) save(`svg/${name}.svg`, s);
  for (const n of ['mark-dark', 'mark-light', 'mark-color-transparent', 'mark-ink-transparent', 'mark-grayscale'])
    await png(`png/${n}-1024.png`, marks[n].svg, 1024, 1024);

  const lockups = {
    'logo-horizontal-dark': lockup({ fg: PAPER, bg: INK, id: 'g' }),
    'logo-horizontal-light': lockup({ fg: INK, bg: PAPER, id: 'h' }),
    'logo-horizontal-on-dark-transparent': lockup({ fg: PAPER, id: 'i' }),
    'logo-horizontal-on-light-transparent': lockup({ fg: INK, id: 'j' }),
    'wordmark-paper': wordmark({ fg: PAPER }),
    'wordmark-ink': wordmark({ fg: INK }),
  };
  for (const [n, s] of Object.entries(lockups)) {
    save(`svg/${n}.svg`, s);
    const w = Number(s.match(/ width="(\d+)"/)[1]), h = Number(s.match(/ height="(\d+)"/)[1]);
    await png(`png/${n}@3x.png`, s, w * 3, h * 3);
  }

  // Favicons and app icons
  const small = iconSvg({ radius: 112, small: true, id: 'fs' });
  const full = iconSvg({ radius: 112, id: 'ff' });
  save('icons/favicon.svg', small);
  save('icons/icon.svg', full);
  save('icons/safari-pinned-tab.svg', iconSvg({ bg: null, fg: '#000', accent: '#000', ringOp: 0.5, id: 'sp' }));
  const sq = iconSvg({ radius: 0, id: 'sq' });
  const sqSmall = iconSvg({ radius: 0, small: true, id: 'sqs' });

  const icoSizes = [16, 32, 48];
  const icoBufs = [];
  for (const s of icoSizes) {
    icoBufs.push(await sharp(Buffer.from(small), { density: Math.ceil(72 * s / 512 * 4) }).resize(s, s).png().toBuffer());
  }
  save('icons/favicon.ico', ico(icoBufs, icoSizes));
  for (const s of [16, 32, 48]) await png(`icons/favicon-${s}x${s}.png`, small, s, s);
  for (const s of [64, 96, 128, 256, 384, 1024]) await png(`icons/icon-${s}.png`, full, s, s);
  await png('icons/apple-touch-icon.png', sq, 180, 180);                 // iOS rounds the corners itself
  await png('icons/android-chrome-192x192.png', full, 192, 192);
  await png('icons/android-chrome-512x512.png', full, 512, 512);
  const maskable = iconSvg({ radius: 0, scale: 0.72, id: 'mk' });         // mark stays inside the 80% safe zone
  save('icons/maskable-icon.svg', maskable);
  await png('icons/maskable-icon-512x512.png', maskable, 512, 512);
  await png('icons/mstile-150x150.png', iconSvg({ radius: 0, scale: 0.8, id: 'ms' }), 150, 150);
  save('icons/site.webmanifest', JSON.stringify({
    name: 'Merge Window',
    short_name: 'Merge Window',
    description: 'Open source signals for technical leaders.',
    icons: [
      { src: 'android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    theme_color: INK,
    background_color: INK,
    display: 'standalone',
  }, null, 2) + '\n');
  save('icons/browserconfig.xml', `<?xml version="1.0" encoding="utf-8"?>
<browserconfig><msapplication><tile><square150x150logo src="mstile-150x150.png"/><TileColor>${INK}</TileColor></tile></msapplication></browserconfig>
`);
  save('icons/head-snippet.html', `<!-- Merge Window: paste into <head>; adjust the base path -->
<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/icons/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="manifest" href="/icons/site.webmanifest">
<link rel="mask-icon" href="/icons/safari-pinned-tab.svg" color="${AMBER}">
<meta name="theme-color" content="${INK}">
<meta property="og:image" content="/social/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
`);

  // Banners and social images
  const bn = banner();
  save('social/linkedin-banner-1584x396.svg', bn);
  await png('social/linkedin-banner-1584x396.png', bn, 1584, 396);
  await png('social/linkedin-banner-1584x396.jpg', bn, 1584, 396, { jpg: true });
  await png('social/linkedin-banner-3168x792@2x.png', bn, 3168, 792);

  const cv = cover(1920, 1080, 'Merge Window newsletter cover');
  save('social/newsletter-cover-1920x1080.svg', cv);
  await png('social/newsletter-cover-1920x1080.png', cv, 1920, 1080);
  const og = cover(1200, 630, 'Merge Window: open source signals for technical leaders');
  save('social/og-image-1200x630.svg', og);
  await png('social/og-image.png', og, 1200, 630);
  await png('social/og-image.jpg', og, 1200, 630, { jpg: true });

  const avatar = iconSvg({ radius: 0, scale: 0.86, id: 'av' });          // platforms crop to a circle
  save('social/profile-avatar.svg', avatar);
  await png('social/profile-avatar-400x400.png', avatar, 400, 400);

  const post = announcement();
  save('social/linkedin-post-launch-1080x1350.svg', post);
  await png('social/linkedin-post-launch-1080x1350.png', post, 1080, 1350);

  // Carousel (LinkedIn document / Instagram style), 1080×1350
  const slides = [post, slideEvidence(), slideDiff(), slideCovers(), slideCta()];
  for (let i = 0; i < slides.length; i++) {
    const n = String(i + 1).padStart(2, '0');
    save(`carousel/slide-${n}.svg`, slides[i]);
    await png(`carousel/slide-${n}.png`, slides[i], 1080, 1350);
  }

  console.log(`wrote ${written.length} files under brand/`);
}

main();
