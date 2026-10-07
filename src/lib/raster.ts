import { getDetector } from './detector';
import { FONT_STACK } from './render';

export type RasterFormat = 'png' | 'jpeg' | 'webp';

// iOS Safari refuses canvases above ~16.7 million pixels and returns a blank image.
const MAX_PIXELS = 16_000_000;

export function clampSize(width: number, height: number): { width: number; height: number; clamped: boolean } {
  const px = width * height;
  if (px <= MAX_PIXELS) return { width, height, clamped: false };
  const k = Math.sqrt(MAX_PIXELS / px);
  return { width: Math.floor(width * k), height: Math.floor(height * k), clamped: true };
}

let measureCtx: CanvasRenderingContext2D | null = null;

export function measureText(text: string, fontSize: number): number {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * fontSize * 0.58;
  // Measure at a fixed size; canvas fonts misbehave below 1px.
  measureCtx.font = `700 100px ${FONT_STACK}`;
  return (measureCtx.measureText(text).width / 100) * fontSize;
}

async function loadSvg(svg: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function svgToCanvas(svg: string, width: number, height: number, fill?: string): Promise<HTMLCanvasElement> {
  const img = await loadSvg(svg);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, format: RasterFormat, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), `image/${format}`, quality);
  });
}

export type VerifyResult = { status: 'ok' } | { status: 'mismatch' | 'unreadable' | 'unavailable' };

/** Decodes the rendered image like a scanner would, to catch designs that look fine but don't scan. */
export async function verifySvg(svg: string, expected: string, units: { width: number; height: number }): Promise<VerifyResult> {
  try {
    const w = Math.min(1400, Math.max(480, Math.ceil(units.width * 5)));
    const h = Math.round((w * units.height) / units.width);
    const canvas = await svgToCanvas(svg, w, h, '#ffffff');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { status: 'unavailable' };
    let mismatch = false;
    const bd = await getDetector();
    if (bd) {
      const found = await bd.detect(canvas).catch(() => []);
      if (found.some((f) => f.rawValue === expected)) return { status: 'ok' };
      mismatch = found.length > 0;
    }
    const img = ctx.getImageData(0, 0, w, h);
    const { default: jsQR } = await import('jsqr');
    const res = jsQR(img.data, w, h, { inversionAttempts: 'attemptBoth' });
    if (res?.data === expected) return { status: 'ok' };
    return { status: mismatch || res ? 'mismatch' : 'unreadable' };
  } catch {
    return { status: 'unavailable' };
  }
}
