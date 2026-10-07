import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { buildPayload } from '../src/lib/payload';
import { createMatrix, MAX_BYTES, QrTooLongError, type Ecl, type Matrix } from '../src/lib/qr';
import { alignmentCenters, DEFAULT_STYLE, renderSvg, sanitizeStyle, type DotStyle, type EyeInner, type EyeOuter } from '../src/lib/render';

function rasterize(m: Matrix, scale = 4, margin = 4) {
  const size = (m.size + margin * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let r = 0; r < m.size; r++)
    for (let c = 0; c < m.size; c++) {
      if (!m.get(r, c)) continue;
      for (let y = 0; y < scale; y++)
        for (let x = 0; x < scale; x++) {
          const i = (((r + margin) * scale + y) * size + (c + margin) * scale + x) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
    }
  return jsQR(data, size, size)?.data;
}

describe('encode → decode', () => {
  const samples = [
    'https://example.com/',
    'Halo dunia! Ümlaut ñ — 日本語 😀',
    buildPayload('wifi', { ssid: 'Kopi;Kenangan', security: 'WPA', password: 'rahasia123' }).data,
    buildPayload('vcard', { firstName: 'Siti', lastName: 'Aminah', phoneMobile: '0812', note: 'baris1\nbaris2' }).data,
    '1234567890'.repeat(30),
  ];
  for (const ecl of ['L', 'M', 'Q', 'H'] as Ecl[]) {
    it(`decodes all samples at ${ecl}`, () => {
      for (const s of samples) expect(rasterize(createMatrix(s, ecl))).toBe(s);
    });
  }

  it('handles data right at the byte limit', () => {
    const s = 'a'.repeat(MAX_BYTES.H);
    expect(createMatrix(s, 'H').version).toBe(40);
    expect(() => createMatrix(s + 'a', 'H')).toThrow(QrTooLongError);
    expect(() => createMatrix('x'.repeat(100_000), 'L')).toThrow(QrTooLongError);
  });
});

describe('renderSvg', () => {
  const m = createMatrix('https://example.com', 'H');
  const dots: DotStyle[] = ['square', 'rounded', 'dots', 'lines', 'diamond'];
  const outers: EyeOuter[] = ['square', 'rounded', 'circle'];
  const inners: EyeInner[] = ['square', 'rounded', 'circle'];

  it('produces finite numbers for every style combination', () => {
    for (const dot of dots)
      for (const eyeOuter of outers)
        for (const eyeInner of inners)
          for (const frame of ['none', 'label', 'box'] as const) {
            const { svg, width, height } = renderSvg(m, { ...DEFAULT_STYLE, dot, eyeOuter, eyeInner, frame, gradient: true, logo: 'data:image/png;base64,AA==' });
            expect(svg).not.toMatch(/NaN|Infinity|undefined/);
            expect(width).toBeGreaterThan(0);
            expect(height).toBeGreaterThanOrEqual(width - 2);
          }
  });

  it('escapes label text and logo href', () => {
    const { svg } = renderSvg(m, { ...DEFAULT_STYLE, frame: 'label', frameText: '<b>&"x"', logo: 'data:x"onload="y' });
    expect(svg).toContain('&lt;b&gt;&amp;&quot;x&quot;');
    expect(svg).not.toContain('"onload=');
  });

  it('uses unique gradient ids', () => {
    const a = renderSvg(m, { ...DEFAULT_STYLE, gradient: true }).svg.match(/id="([^"]+)"/)?.[1];
    const b = renderSvg(m, { ...DEFAULT_STYLE, gradient: true }).svg.match(/id="([^"]+)"/)?.[1];
    expect(a).not.toBe(b);
  });
});

describe('alignmentCenters', () => {
  it('matches the encoder output for every version', () => {
    for (let len = 1; len < 2900; len += 37) {
      const m = createMatrix('a'.repeat(len), 'L');
      for (const [r, c] of alignmentCenters(m.version)) {
        expect(m.get(r, c)).toBe(true);
        expect(m.get(r - 1, c)).toBe(false);
        expect(m.get(r - 2, c - 2)).toBe(true);
        expect(m.get(r + 2, c + 1)).toBe(true);
      }
    }
  });
});

describe('sanitizeStyle', () => {
  it('drops unknown and malformed values', () => {
    const s = sanitizeStyle({ fg: 'red', dot: 'stars', eyeInner: 'diamond', margin: 99, logo: 'javascript:x', frameText: 'x'.repeat(100), ecl: 'Z' });
    expect(s.fg).toBe(DEFAULT_STYLE.fg);
    expect(s.dot).toBe('square');
    expect(s.eyeInner).toBe('square');
    expect(s.margin).toBe(10);
    expect(s.logo).toBeNull();
    expect(s.frameText.length).toBe(40);
    expect(s.ecl).toBe(DEFAULT_STYLE.ecl);
    expect(sanitizeStyle(null)).toEqual(DEFAULT_STYLE);
  });
});
