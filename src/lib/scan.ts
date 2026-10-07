import { getDetector } from './detector';
type JsQR = typeof import('jsqr').default;
let jsQR: JsQR | null = null;
const loadJsQR = async () => (jsQR ??= (await import('jsqr')).default);

const work = document.createElement('canvas');
const workCtx = work.getContext('2d', { willReadFrequently: true });

async function jsqrAt(source: CanvasImageSource, w: number, h: number, maxSide: number, invert: boolean): Promise<string | null> {
  if (!workCtx) return null;
  const decode = await loadJsQR();
  const k = Math.min(1, maxSide / Math.max(w, h));
  work.width = Math.max(1, Math.round(w * k));
  work.height = Math.max(1, Math.round(h * k));
  workCtx.drawImage(source, 0, 0, work.width, work.height);
  const img = workCtx.getImageData(0, 0, work.width, work.height);
  return decode(img.data, work.width, work.height, { inversionAttempts: invert ? 'attemptBoth' : 'dontInvert' })?.data ?? null;
}

export async function decodeFrame(video: HTMLVideoElement, invert: boolean): Promise<string | null> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const bd = await getDetector();
  if (bd) {
    try {
      const found = await bd.detect(video);
      if (found[0]?.rawValue) return found[0].rawValue;
      return null;
    } catch {
      /* fall through to jsQR */
    }
  }
  return jsqrAt(video, w, h, 720, invert);
}

export async function decodeImageFile(file: Blob): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w = img.naturalWidth || 1024;
    const h = img.naturalHeight || 1024;
    const bd = await getDetector();
    if (bd) {
      try {
        const found = await bd.detect(img);
        if (found[0]?.rawValue) return found[0].rawValue;
      } catch {
        /* fall through */
      }
    }
    // Small codes in big photos and huge codes both decode better at different scales.
    for (const side of [1600, 900, 500, 2400]) {
      const r = await jsqrAt(img, w, h, side, true);
      if (r) return r;
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function cameraErrorMessage(e: unknown): string {
  if (!window.isSecureContext) return 'Kamera hanya bisa dipakai lewat alamat https.';
  const name = e instanceof DOMException ? e.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Izin kamera ditolak. Izinkan kamera lewat pengaturan browser, lalu coba lagi.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Kamera tidak ditemukan di perangkat ini.';
    case 'NotReadableError':
    case 'AbortError':
      return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.';
    default:
      return 'Kamera tidak bisa dinyalakan. Kamu tetap bisa memindai dari gambar.';
  }
}

export class Camera {
  stream: MediaStream | null = null;

  get supported() {
    return !!navigator.mediaDevices?.getUserMedia;
  }

  async start(video: HTMLVideoElement, deviceId?: string) {
    this.stop();
    const video_: MediaTrackConstraints = deviceId
      ? { deviceId: { exact: deviceId } }
      : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } };
    this.stream = await navigator.mediaDevices.getUserMedia({ video: video_, audio: false });
    video.srcObject = this.stream;
    video.setAttribute('playsinline', '');
    video.muted = true;
    await video.play();
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  get track(): MediaStreamTrack | null {
    return this.stream?.getVideoTracks()[0] ?? null;
  }

  get deviceId(): string | undefined {
    return this.track?.getSettings().deviceId;
  }

  canTorch(): boolean {
    const t = this.track;
    if (!t || typeof t.getCapabilities !== 'function') return false;
    return 'torch' in (t.getCapabilities() as Record<string, unknown>);
  }

  async setTorch(on: boolean) {
    await this.track?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
  }

  async cameras(): Promise<MediaDeviceInfo[]> {
    try {
      return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    } catch {
      return [];
    }
  }
}
