import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const GREEN = '#0b6e4f';

const mark = (fg, hole) => {
  const eye = (x, y) =>
    `<rect x="${x}" y="${y}" width="15" height="15" rx="3.5" fill="${fg}"/>` +
    `<rect x="${x + 3}" y="${y + 3}" width="9" height="9" rx="1.8" fill="${hole}"/>` +
    `<rect x="${x + 5.5}" y="${y + 5.5}" width="4" height="4" rx="1" fill="${fg}"/>`;
  const dots = [
    [37, 37],
    [47, 37],
    [42, 42],
    [37, 47],
    [47, 47],
  ]
    .map(([x, y]) => `<rect x="${x}" y="${y}" width="5" height="5" rx="1.2" fill="${fg}"/>`)
    .join('');
  return eye(12, 12) + eye(37, 12) + eye(12, 37) + dots;
};

const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${GREEN}"/>${mark('#ffffff', GREEN)}</svg>`;
const square = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${GREEN}"/>${mark('#ffffff', GREEN)}</svg>`;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${GREEN}"/><g transform="translate(32 32) scale(0.82) translate(-32 -32)">${mark('#ffffff', GREEN)}</g></svg>`;

writeFileSync('public/favicon.svg', rounded + '\n');

const tmp = mkdtempSync(join(tmpdir(), 'qr-icons-'));
const files = { rounded, square, maskable };
for (const [k, v] of Object.entries(files)) writeFileSync(join(tmp, `${k}.svg`), v);

const render = (src, size, out) =>
  execFileSync('magick', ['-background', 'none', '-density', '1200', join(tmp, `${src}.svg`), '-resize', `${size}x${size}`, out]);

render('rounded', 192, 'public/pwa-192x192.png');
render('rounded', 512, 'public/pwa-512x512.png');
render('maskable', 512, 'public/maskable-512x512.png');
render('square', 180, 'public/apple-touch-icon.png');
render('rounded', 64, join(tmp, 'fav64.png'));
execFileSync('magick', [join(tmp, 'fav64.png'), '-define', 'icon:auto-resize=32,16', 'public/favicon.ico']);

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#f4f3ee"/>
<g transform="translate(90 155) scale(5)"><rect width="64" height="64" rx="14" fill="${GREEN}"/>${mark('#ffffff', GREEN)}</g>
<text x="500" y="285" font-family="Helvetica, Arial, sans-serif" font-size="76" font-weight="700" fill="#18201c">QR Studio</text>
<text x="500" y="360" font-family="Helvetica, Arial, sans-serif" font-size="36" fill="#59605c">Buat kode QR gratis, tanpa login.</text>
<text x="500" y="410" font-family="Helvetica, Arial, sans-serif" font-size="36" fill="#59605c">Semua diproses di perangkatmu.</text>
</svg>`;
// ImageMagick here has no font support, so og.png is captured from this SVG in a browser.
writeFileSync('scripts/og.svg', og);
console.log('icons written; render scripts/og.svg to public/og.png (1200x630)');
