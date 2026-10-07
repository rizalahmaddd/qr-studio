interface DetectedBarcode {
  rawValue: string;
}
export interface BarcodeDetectorLike {
  detect(source: CanvasImageSource | ImageBitmap): Promise<DetectedBarcode[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: {
      new (opts: { formats: string[] }): BarcodeDetectorLike;
      getSupportedFormats(): Promise<string[]>;
    };
  }
}

let detector: BarcodeDetectorLike | null | undefined;

/** The platform QR reader (ML Kit on Android, Vision on macOS) when the browser exposes it. */
export async function getDetector(): Promise<BarcodeDetectorLike | null> {
  if (detector !== undefined) return detector;
  try {
    const BD = window.BarcodeDetector;
    detector = BD && (await BD.getSupportedFormats()).includes('qr_code') ? new BD({ formats: ['qr_code'] }) : null;
  } catch {
    detector = null;
  }
  return detector;
}
