import type { Ecl, Matrix } from './qr';

export type DotStyle = 'square' | 'rounded' | 'dots' | 'lines' | 'diamond';
export type EyeOuter = 'square' | 'rounded' | 'circle';
export type EyeInner = 'square' | 'rounded' | 'circle';
export type FrameKind = 'none' | 'label' | 'box';

export interface QrStyle {
  fg: string;
  bg: string;
  transparent: boolean;
  gradient: boolean;
  gradientType: 'linear' | 'radial';
  fg2: string;
  angle: number;
  eyeCustom: boolean;
  eyeColor: string;
  dot: DotStyle;
  eyeOuter: EyeOuter;
  eyeInner: EyeInner;
  margin: number;
  ecl: Ecl;
  logo: string | null;
  logoSize: number;
  logoPlate: boolean;
  frame: FrameKind;
  frameText: string;
  frameColor: string;
  frameTextColor: string;
}

export const DEFAULT_STYLE: QrStyle = {
  fg: '#111111',
  bg: '#ffffff',
  transparent: false,
  gradient: false,
  gradientType: 'linear',
  fg2: '#0b6e4f',
  angle: 45,
  eyeCustom: false,
  eyeColor: '#0b6e4f',
  dot: 'square',
  eyeOuter: 'square',
  eyeInner: 'square',
  margin: 4,
  ecl: 'M',
  logo: null,
  logoSize: 0.22,
  logoPlate: true,
  frame: 'none',
  frameText: 'Pindai di sini',
  frameColor: '#111111',
  frameTextColor: '#ffffff',
};

const HEX = /^#[0-9a-f]{6}$/i;
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
const num = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

/** Style objects come back from storage and imported backups, so never trust their shape. */
export function sanitizeStyle(input: unknown): QrStyle {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const d = DEFAULT_STYLE;
  const color = (k: keyof QrStyle) => (typeof o[k] === 'string' && HEX.test(o[k] as string) ? (o[k] as string) : (d[k] as string));
  const flag = (k: keyof QrStyle) => (typeof o[k] === 'boolean' ? (o[k] as boolean) : (d[k] as boolean));
  const logo = typeof o.logo === 'string' && o.logo.startsWith('data:image/') ? o.logo : null;
  return {
    fg: color('fg'),
    bg: color('bg'),
    transparent: flag('transparent'),
    gradient: flag('gradient'),
    gradientType: oneOf(o.gradientType, ['linear', 'radial'] as const, d.gradientType),
    fg2: color('fg2'),
    angle: num(o.angle, 0, 360, d.angle),
    eyeCustom: flag('eyeCustom'),
    eyeColor: color('eyeColor'),
    dot: oneOf(o.dot, ['square', 'rounded', 'dots', 'lines', 'diamond'] as const, d.dot),
    eyeOuter: oneOf(o.eyeOuter, ['square', 'rounded', 'circle'] as const, d.eyeOuter),
    eyeInner: oneOf(o.eyeInner, ['square', 'rounded', 'circle'] as const, d.eyeInner),
    margin: Math.round(num(o.margin, 0, 10, d.margin)),
    ecl: oneOf(o.ecl, ['L', 'M', 'Q', 'H'] as const, d.ecl),
    logo,
    logoSize: num(o.logoSize, 0.1, 0.3, d.logoSize),
    logoPlate: flag('logoPlate'),
    frame: oneOf(o.frame, ['none', 'label', 'box'] as const, d.frame),
    frameText: typeof o.frameText === 'string' ? o.frameText.slice(0, 40) : d.frameText,
    frameColor: color('frameColor'),
    frameTextColor: color('frameTextColor'),
  };
}

/** A logo hides modules, so it always gets the strongest error correction. */
export const effectiveEcl = (s: QrStyle): Ecl => (s.logo ? 'H' : s.ecl);

export const FONT_STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const f = (v: number) => String(Number(v.toFixed(3)));

const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  r = Math.min(r, w / 2, h / 2);
  if (r <= 0) return `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`;
  const a = (dx: number, dy: number) => `a${f(r)} ${f(r)} 0 0 1 ${f(dx)} ${f(dy)}`;
  return (
    `M${f(x + r)} ${f(y)}h${f(w - 2 * r)}${a(r, r)}v${f(h - 2 * r)}${a(-r, r)}` +
    `h${f(-(w - 2 * r))}${a(-r, -r)}v${f(-(h - 2 * r))}${a(r, -r)}z`
  );
}

export function circle(cx: number, cy: number, r: number): string {
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0z`;
}

const diamond = (x: number, y: number, s: number) =>
  `M${f(x + s / 2)} ${f(y)}L${f(x + s)} ${f(y + s / 2)}L${f(x + s / 2)} ${f(y + s)}L${f(x)} ${f(y + s / 2)}z`;

function moduleCorners(x: number, y: number, tl: number, tr: number, br: number, bl: number): string {
  const arc = (r: number, dx: number, dy: number) => (r ? `a${r} ${r} 0 0 1 ${dx} ${dy}` : '');
  return (
    `M${f(x + tl)} ${y}H${f(x + 1 - tr)}${arc(tr, tr, tr)}V${f(y + 1 - br)}${arc(br, -br, br)}` +
    `H${f(x + bl)}${arc(bl, -bl, -bl)}V${f(y + tl)}${arc(tl, tl, -tl)}z`
  );
}

type Getter = (r: number, c: number) => boolean;

/** Centres of the 5×5 alignment patterns (same table the encoder uses). */
export function alignmentCenters(version: number): [number, number][] {
  if (version < 2) return [];
  const size = version * 4 + 17;
  const count = Math.floor(version / 7) + 2;
  const step = size === 145 ? 26 : Math.ceil((size - 13) / (2 * count - 2)) * 2;
  const pos = [size - 7];
  for (let i = 1; i < count - 1; i++) pos[i] = pos[i - 1] - step;
  pos.push(6);
  pos.reverse();
  const out: [number, number][] = [];
  for (const r of pos)
    for (const c of pos) {
      const nearFinder = (r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6);
      if (!nearFinder) out.push([r, c]);
    }
  return out;
}

export function dotsPath(n: number, dark: Getter, style: DotStyle): string {
  const out: string[] = [];
  if (style === 'square') {
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        if (!dark(r, c)) {
          c++;
          continue;
        }
        const start = c;
        while (c < n && dark(r, c)) c++;
        out.push(`M${start} ${r}h${c - start}v1h${start - c}z`);
      }
    }
  } else if (style === 'lines') {
    for (let c = 0; c < n; c++) {
      let r = 0;
      while (r < n) {
        if (!dark(r, c)) {
          r++;
          continue;
        }
        const start = r;
        while (r < n && dark(r, c)) r++;
        out.push(roundedRect(c + 0.07, start + 0.04, 0.86, r - start - 0.08, 0.43));
      }
    }
  } else {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!dark(r, c)) continue;
        if (style === 'dots') out.push(circle(c + 0.5, r + 0.5, 0.46));
        else if (style === 'diamond') out.push(diamond(c, r, 1));
        else {
          const t = dark(r - 1, c);
          const b = dark(r + 1, c);
          const l = dark(r, c - 1);
          const rt = dark(r, c + 1);
          const R = 0.5;
          out.push(moduleCorners(c, r, !t && !l ? R : 0, !t && !rt ? R : 0, !b && !rt ? R : 0, !b && !l ? R : 0));
        }
      }
    }
  }
  return out.join('');
}

export function eyeOuterPath(x: number, y: number, style: EyeOuter): string {
  if (style === 'circle') return circle(x + 3.5, y + 3.5, 3.5) + circle(x + 3.5, y + 3.5, 2.5);
  if (style === 'rounded') return roundedRect(x, y, 7, 7, 2.2) + roundedRect(x + 1, y + 1, 5, 5, 1.3);
  return roundedRect(x, y, 7, 7, 0) + roundedRect(x + 1, y + 1, 5, 5, 0);
}

export function eyeInnerPath(x: number, y: number, style: EyeInner): string {
  if (style === 'circle') return circle(x + 3.5, y + 3.5, 1.6);
  if (style === 'rounded') return roundedRect(x + 2, y + 2, 3, 3, 0.9);
  return roundedRect(x + 2, y + 2, 3, 3, 0);
}

export interface RenderOptions {
  /** Output width in px; omit to let CSS size the SVG. */
  px?: number;
  idPrefix?: string;
  title?: string;
  measureText?: (text: string, fontSize: number) => number;
}

export interface RenderResult {
  svg: string;
  width: number;
  height: number;
}

let seq = 0;

export function renderSvg(matrix: Matrix, style: QrStyle, opts: RenderOptions = {}): RenderResult {
  const n = matrix.size;
  const m = Math.max(0, Math.round(style.margin));
  const Q = n + 2 * m;
  const uid = opts.idPrefix ?? `qr${++seq}`;
  const label = style.frame !== 'none' ? style.frameText.trim() : '';

  let W = Q;
  let H = Q;
  let ox = 0;
  let oy = 0;
  let back = '';
  let front = '';
  let textBox: { x: number; y: number; w: number; h: number; color: string } | null = null;
  const bgFill = style.transparent ? null : style.bg;

  if (style.frame === 'box') {
    const b = Math.max(0.8, Q * 0.03);
    const bar = label ? Q * 0.18 : 0;
    W = Q + 2 * b;
    H = Q + 2 * b + bar;
    ox = b;
    oy = b;
    const outer = roundedRect(0, 0, W, H, b * 2);
    const inner = roundedRect(b, b, Q, Q, b);
    if (bgFill) {
      back += `<path d="${outer}" fill="${style.frameColor}"/><path d="${inner}" fill="${bgFill}"/>`;
    } else {
      back += `<path d="${outer}${inner}" fill="${style.frameColor}" fill-rule="evenodd"/>`;
    }
    if (label) textBox = { x: 0, y: b + Q, w: W, h: bar, color: style.frameTextColor };
  } else {
    if (style.frame === 'label' && label) {
      const gap = Math.max(0, 1.5 - m);
      const lh = Q * 0.16;
      H = Q + gap + lh;
      textBox = { x: 0, y: Q + gap - lh * 0.12, w: W, h: lh, color: style.frameColor };
    }
    if (bgFill) back += `<rect width="${f(W)}" height="${f(H)}" fill="${bgFill}"/>`;
  }

  const defs: string[] = [];
  let paint = style.fg;
  if (style.gradient) {
    const id = `${uid}g`;
    const stops = `<stop offset="0" stop-color="${style.fg}"/><stop offset="1" stop-color="${style.fg2}"/>`;
    if (style.gradientType === 'radial') {
      defs.push(
        `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${f(n / 2)}" cy="${f(n / 2)}" r="${f(n * 0.72)}">${stops}</radialGradient>`,
      );
    } else {
      const a = (style.angle * Math.PI) / 180;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const half = (n / 2) * (Math.abs(dx) + Math.abs(dy));
      defs.push(
        `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(n / 2 - dx * half)}" y1="${f(n / 2 - dy * half)}" x2="${f(n / 2 + dx * half)}" y2="${f(n / 2 + dy * half)}">${stops}</linearGradient>`,
      );
    }
    paint = `url(#${id})`;
  }

  const finder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

  let clear: ((r: number, c: number) => boolean) | null = null;
  let logoSvg = '';
  if (style.logo) {
    const size = Math.min(0.3, Math.max(0.1, style.logoSize));
    if (style.logoPlate) {
      let L = Math.round(n * size);
      if ((n - L) % 2) L += 1;
      const s = (n - L) / 2;
      clear = (r, c) => r >= s && r < s + L && c >= s && c < s + L;
      const plate = style.transparent ? '#ffffff' : style.bg;
      const pad = 0.6;
      logoSvg =
        `<path d="${roundedRect(s, s, L, L, 1)}" fill="${plate}"/>` +
        `<image href="${xml(style.logo)}" x="${f(s + pad)}" y="${f(s + pad)}" width="${f(L - 2 * pad)}" height="${f(L - 2 * pad)}" preserveAspectRatio="xMidYMid meet"/>`;
    } else {
      const L = n * size;
      const s = (n - L) / 2;
      logoSvg = `<image href="${xml(style.logo)}" x="${f(s)}" y="${f(s)}" width="${f(L)}" height="${f(L)}" preserveAspectRatio="xMidYMid meet"/>`;
    }
  }

  // Scanners lock onto alignment patterns; breaking them into dots or diamonds makes decoding unreliable.
  const centers = style.dot === 'square' || style.dot === 'rounded' ? [] : alignmentCenters(matrix.version);
  const inAlign = (r: number, c: number) => centers.some(([ar, ac]) => Math.abs(r - ar) <= 2 && Math.abs(c - ac) <= 2);
  const visible: Getter = (r, c) => matrix.get(r, c) && !finder(r, c) && !(clear && clear(r, c));
  const dark: Getter = (r, c) => visible(r, c) && !inAlign(r, c);
  const alignPath = centers.length ? dotsPath(n, (r, c) => visible(r, c) && inAlign(r, c), 'rounded') : '';
  const corners = [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ];
  const outer = corners.map(([x, y]) => eyeOuterPath(x, y, style.eyeOuter)).join('');
  const inner = corners.map(([x, y]) => eyeInnerPath(x, y, style.eyeInner)).join('');
  const eyePaint = style.eyeCustom ? style.eyeColor : paint;

  front +=
    `<g transform="translate(${f(ox + m)} ${f(oy + m)})">` +
    `<path d="${dotsPath(n, dark, style.dot)}${alignPath}" fill="${paint}"/>` +
    `<path d="${outer}" fill="${eyePaint}" fill-rule="evenodd"/>` +
    `<path d="${inner}" fill="${eyePaint}"/>` +
    logoSvg +
    `</g>`;

  if (textBox && label) {
    const maxW = textBox.w * 0.88;
    let fs = textBox.h * 0.55;
    const measured = opts.measureText ? opts.measureText(label, fs) : label.length * fs * 0.58;
    if (measured > maxW) fs *= maxW / measured;
    front +=
      `<text x="${f(textBox.x + textBox.w / 2)}" y="${f(textBox.y + textBox.h / 2)}" dy="0.35em" text-anchor="middle" ` +
      `font-family="${FONT_STACK}" font-weight="700" font-size="${f(fs)}" fill="${textBox.color}">${xml(label)}</text>`;
  }

  const size = opts.px ? ` width="${Math.round(opts.px)}" height="${Math.round((opts.px * H) / W)}"` : '';
  const title = opts.title ? `<title>${xml(opts.title)}</title>` : '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(W)} ${f(H)}"${size}>` +
    title +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
    back +
    front +
    `</svg>`;
  return { svg, width: W, height: H };
}
