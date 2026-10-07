import QRCode from 'qrcode';

export type Ecl = 'L' | 'M' | 'Q' | 'H';

export const MAX_BYTES: Record<Ecl, number> = { L: 2953, M: 2331, Q: 1663, H: 1273 };

export interface Matrix {
  size: number;
  version: number;
  ecl: Ecl;
  get(row: number, col: number): boolean;
}

export class QrTooLongError extends Error {
  constructor(
    public bytes: number,
    public max: number,
  ) {
    super('too long');
  }
}

export const byteLength = (s: string) => new TextEncoder().encode(s).length;

export function createMatrix(data: string, ecl: Ecl): Matrix {
  const bytes = byteLength(data);
  // Guard before calling the encoder: huge pastes make its segment optimiser crawl.
  if (bytes > MAX_BYTES.L) throw new QrTooLongError(bytes, MAX_BYTES[ecl]);
  let qr: ReturnType<typeof QRCode.create>;
  try {
    qr = QRCode.create(data, { errorCorrectionLevel: ecl });
  } catch {
    throw new QrTooLongError(bytes, MAX_BYTES[ecl]);
  }
  const { size, data: bits } = qr.modules;
  return {
    size,
    version: qr.version,
    ecl,
    get: (r, c) => r >= 0 && c >= 0 && r < size && c < size && bits[r * size + c] === 1,
  };
}

/** Smallest comfortable print size: about 0.5 mm per module, never under 2 cm. */
export function minPrintCm(size: number, margin: number): number {
  return Math.max(2, Math.ceil((size + margin * 2) * 0.05 * 10) / 10);
}
