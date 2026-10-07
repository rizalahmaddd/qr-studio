import { createMatrix } from './qr';
import { canvasToBlob, clampSize, measureText, svgToCanvas, type RasterFormat } from './raster';
import { effectiveEcl, renderSvg, type QrStyle } from './render';

export type ExportFormat = 'png' | 'svg' | 'jpeg' | 'webp';

export const FORMAT_EXT: Record<ExportFormat, string> = { png: 'png', svg: 'svg', jpeg: 'jpg', webp: 'webp' };

export function slug(s: string, max = 40): string {
  const out = s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^https?:\/\/(www\.)?/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, max)
    .replace(/-+$/, '');
  return out || 'kode';
}

export interface Exported {
  blob: Blob;
  ext: string;
  /** The browser could not produce the requested raster format and fell back to PNG. */
  fellBack: boolean;
  clamped: boolean;
}

export async function exportQr(data: string, style: QrStyle, format: ExportFormat, px: number): Promise<Exported> {
  const matrix = createMatrix(data, effectiveEcl(style));
  const probe = renderSvg(matrix, style, { measureText });
  const want = clampSize(px, Math.round((px * probe.height) / probe.width));
  const { svg } = renderSvg(matrix, style, { px: want.width, measureText });

  if (format === 'svg') {
    const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', svg], { type: 'image/svg+xml' });
    return { blob, ext: 'svg', fellBack: false, clamped: false };
  }
  const fill = format === 'jpeg' && style.transparent ? '#ffffff' : undefined;
  const canvas = await svgToCanvas(svg, want.width, want.height, fill);
  const blob = await canvasToBlob(canvas, format as RasterFormat);
  const actual = blob.type.split('/')[1];
  const fellBack = actual !== format;
  return { blob, ext: fellBack ? 'png' : FORMAT_EXT[format], fellBack, clamped: want.clamped };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const canCopyImage = () => typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;

/** The blob is passed as a promise so Safari still sees the click as the user gesture. */
export async function copyImage(blob: Promise<Blob>): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export function canShareFiles(): boolean {
  if (!navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [new File([new Uint8Array(1)], 'x.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}

export async function shareFile(blob: Blob, filename: string, text: string): Promise<'shared' | 'cancelled'> {
  const file = new File([blob], filename, { type: blob.type });
  try {
    await navigator.share({ files: [file], title: 'Kode QR', text });
    return 'shared';
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    throw e;
  }
}
