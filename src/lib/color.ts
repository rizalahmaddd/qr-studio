export function parseHex(input: string): string | null {
  const s = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) return '#' + [...s].map((c) => c + c).join('').toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(s)) return '#' + s.toLowerCase();
  return null;
}

function luminance(hex: string): number {
  const h = parseHex(hex) ?? '#000000';
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const isLighter = (a: string, b: string) => luminance(a) > luminance(b);
