// Renders the diagram artboards from the design (tools/diagrams/*.dc.html) to WebP
// in public/assets/diagrams/. Needs Google Chrome on PATH. Run: npm run diagrams
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'tools/diagrams');
const out = path.join(root, 'public/assets/diagrams');
const tmp = path.join(root, 'node_modules/.cache/diagrams');
const fonts = path.join(root, 'node_modules/@fontsource');
mkdirSync(out, { recursive: true });
mkdirSync(tmp, { recursive: true });

const face = (family, pkg, file, weight, style = 'normal') =>
  `@font-face{font-family:'${family}';font-weight:${weight};font-style:${style};src:url('file://${fonts}/${pkg}/files/${file}') format('woff2')}`;
const fontCss = [
  face('Source Serif 4', 'source-serif-4', 'source-serif-4-latin-600-normal.woff2', 600),
  face('Source Serif 4', 'source-serif-4', 'source-serif-4-latin-600-italic.woff2', 500, 'italic'),
  ...[400, 500, 600].map((w) => face('IBM Plex Sans', 'ibm-plex-sans', `ibm-plex-sans-latin-${w}-normal.woff2`, w)),
  ...[400, 500, 600].map((w) => face('IBM Plex Mono', 'ibm-plex-mono', `ibm-plex-mono-latin-${w}-normal.woff2`, w)),
].join('');

for (const file of readdirSync(src).filter((f) => f.endsWith('.dc.html'))) {
  const name = file.replace('.dc.html', '');
  let html = readFileSync(path.join(src, file), 'utf8');
  const props = JSON.parse(html.match(/data-props='([^']*)'/)[1]);
  const { width, height } = props.$preview;
  const accent = props.accent?.default ?? '#E8A33D';
  html = html
    .replace(/<script src="\.\/support\.js"><\/script>/, '')
    .replace(/<link href="https:\/\/fonts[^>]*>/g, '')
    .replace(/<script type="text\/x-dc"[\s\S]*?<\/script>/, '')
    .replace(/\{\{accent\}\}/g, accent)
    .replace('</head>', `<style>${fontCss}</style></head>`);
  const page = path.join(tmp, `${name}.html`);
  const png = path.join(tmp, `${name}.png`);
  writeFileSync(page, html);
  execFileSync('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--allow-file-access-from-files', '--force-device-scale-factor=2',
    `--window-size=${width},${height}`, '--virtual-time-budget=4000',
    `--screenshot=${png}`, `file://${page}`,
  ], { stdio: 'ignore' });
  await sharp(png).webp({ quality: 88 }).toFile(path.join(out, `${name}.webp`));
  console.log(`${name}: ${width}x${height}`);
}
rmSync(tmp, { recursive: true, force: true });
