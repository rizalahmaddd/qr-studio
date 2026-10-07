import { describe, expect, it } from 'vitest';
import { parseBatch, splitCsvLine, uniqueName } from '../src/lib/batch';
import { buildPayload, classifyScan, normalizeUrl, parseCoords, parseWifi, whatsappNumber } from '../src/lib/payload';

describe('url', () => {
  it('adds https when the scheme is missing', () => {
    expect(normalizeUrl('example.com/a').url).toBe('https://example.com/a');
    expect(normalizeUrl('example.com:8080/x').url).toBe('https://example.com:8080/x');
    expect(normalizeUrl('//cdn.example.com').url).toBe('https://cdn.example.com/');
  });
  it('keeps other schemes and blocks dangerous ones', () => {
    expect(normalizeUrl('mailto:a@b.co').url).toBe('mailto:a@b.co');
    expect(normalizeUrl('javascript:alert(1)').error).toBeTruthy();
    expect(normalizeUrl('data:text/html,hi').error).toBeTruthy();
  });
  it('warns about http, spaces, incomplete hosts and punycode', () => {
    expect(normalizeUrl('http://example.com').warnings.join()).toMatch(/http/);
    expect(normalizeUrl('example.com/a b').url).toBe('https://example.com/a%20b');
    expect(normalizeUrl('halo').warnings.join()).toMatch(/belum lengkap/);
    expect(normalizeUrl('https://bücher.de').warnings.join()).toMatch(/huruf khusus/);
  });
  it('rejects invalid input', () => {
    expect(normalizeUrl('hello world').error).toBeTruthy();
  });
  it('treats whitespace-only as empty', () => {
    expect(buildPayload('url', { url: '   ' }).empty).toBe(true);
  });
});

describe('wifi', () => {
  it('escapes special characters', () => {
    const r = buildPayload('wifi', { ssid: 'My;Net:"1"', security: 'WPA', password: 'a\\b,c;d12' });
    expect(r.data).toBe('WIFI:T:WPA;S:My\\;Net\\:\\"1\\";P:a\\\\b\\,c\\;d12;;');
  });
  it('omits password for open networks and flags hidden ones', () => {
    const r = buildPayload('wifi', { ssid: 'Cafe', security: 'nopass', password: 'ignored', hidden: true });
    expect(r.data).toBe('WIFI:T:nopass;S:Cafe;H:true;;');
  });
  it('requires a password for secured networks', () => {
    expect(buildPayload('wifi', { ssid: 'X', security: 'WPA', password: '' }).errors.length).toBe(1);
  });
  it('round-trips through the parser', () => {
    const input = { ssid: 'Rumah;Ku\\', security: 'WPA', password: 'p:a;s,s"w', hidden: false };
    const parsed = parseWifi(buildPayload('wifi', input).data);
    expect(parsed).toEqual({ ssid: input.ssid, password: input.password, security: 'WPA', hidden: false });
  });
});

describe('whatsapp', () => {
  it('normalises local Indonesian numbers', () => {
    expect(whatsappNumber('0812-3456-7890', '62').number).toBe('6281234567890');
    expect(whatsappNumber('+62 812 3456 7890', '62').number).toBe('6281234567890');
    expect(whatsappNumber('0062 812 3456 7890', '62').number).toBe('6281234567890');
  });
  it('assumes the country code and warns when it is missing', () => {
    const r = whatsappNumber('81234567890', '62');
    expect(r.number).toBe('6281234567890');
    expect(r.warning).toBeTruthy();
  });
  it('encodes the message', () => {
    const r = buildPayload('whatsapp', { cc: '62', phone: '08123456789', message: 'Halo & salam?' });
    expect(r.data).toBe('https://wa.me/628123456789?text=Halo%20%26%20salam%3F');
  });
});

describe('vcard', () => {
  it('escapes and builds a valid card', () => {
    const r = buildPayload('vcard', { firstName: 'Budi', lastName: 'Santoso, Jr', email: 'budi@contoh.id', note: 'a;b\nc' });
    expect(r.data).toContain('N:Santoso\\, Jr;Budi;;;');
    expect(r.data).toContain('NOTE:a\\;b\\nc');
    expect(r.data.startsWith('BEGIN:VCARD\r\nVERSION:3.0')).toBe(true);
  });
  it('requires a name or organisation', () => {
    expect(buildPayload('vcard', { email: 'x@y.id' }).errors.length).toBe(1);
    expect(buildPayload('vcard', { org: 'PT Maju' }).errors.length).toBe(0);
  });
});

describe('email / sms / phone', () => {
  it('builds mailto with %20 spaces', () => {
    expect(buildPayload('email', { to: 'a@b.co', subject: 'Hai kamu', body: '' }).data).toBe('mailto:a@b.co?subject=Hai%20kamu');
  });
  it('rejects bad addresses', () => {
    expect(buildPayload('email', { to: 'nope' }).errors.length).toBe(1);
  });
  it('cleans phone numbers', () => {
    expect(buildPayload('phone', { phone: '(021) 555-1234' }).data).toBe('tel:0215551234');
    expect(buildPayload('phone', { phone: '12ab' }).errors.length).toBe(1);
    expect(buildPayload('sms', { phone: '0812 1', message: 'hi' }).data).toBe('SMSTO:08121:hi');
  });
});

describe('geo', () => {
  it('parses Google Maps links and plain coordinates', () => {
    expect(parseCoords('https://www.google.com/maps/place/Monas/@-6.1753924,106.8271528,17z')).toEqual({ lat: -6.1753924, lng: 106.8271528 });
    expect(parseCoords('https://maps.google.com/?q=-6.2,106.8')).toEqual({ lat: -6.2, lng: 106.8 });
    expect(parseCoords('-6.2, 106.8')).toEqual({ lat: -6.2, lng: 106.8 });
    expect(parseCoords('geo:1.5,2.5')).toEqual({ lat: 1.5, lng: 2.5 });
    expect(parseCoords('Jakarta')).toBeNull();
  });
  it('accepts comma decimals and validates ranges', () => {
    expect(buildPayload('geo', { lat: '-6,2', lng: '106,8', mode: 'maps' }).data).toContain('query=-6.2%2C106.8');
    expect(buildPayload('geo', { lat: '91', lng: '0' }).errors.length).toBe(1);
  });
  it('explains short links', () => {
    expect(buildPayload('geo', { paste: 'https://maps.app.goo.gl/abc' }).errors[0]).toMatch(/pendek/);
  });
});

describe('event', () => {
  it('converts local time to UTC', () => {
    const r = buildPayload('event', { title: 'Rapat', start: '2026-10-07T09:30', end: '2026-10-07T11:00' });
    expect(r.data).toContain('DTSTART:20261007T093000Z');
    expect(r.data).toContain('DTEND:20261007T110000Z');
  });
  it('defaults to one hour and handles all-day events', () => {
    expect(buildPayload('event', { title: 'A', start: '2026-12-31T23:30' }).data).toContain('DTEND:20270101T003000Z');
    const d = buildPayload('event', { title: 'Libur', allDay: true, startDate: '2026-12-31', endDate: '2026-12-31' });
    expect(d.data).toContain('DTSTART;VALUE=DATE:20261231');
    expect(d.data).toContain('DTEND;VALUE=DATE:20270101');
  });
  it('rejects an end before the start', () => {
    expect(buildPayload('event', { title: 'A', start: '2026-10-07T10:00', end: '2026-10-07T09:00' }).errors.length).toBe(1);
  });
});

describe('classifyScan', () => {
  it('detects kinds', () => {
    expect(classifyScan('https://a.co')).toBe('url');
    expect(classifyScan('WIFI:S:x;;')).toBe('wifi');
    expect(classifyScan('BEGIN:VCALENDAR\r\nBEGIN:VEVENT')).toBe('event');
    expect(classifyScan('halo')).toBe('text');
  });
});

describe('batch', () => {
  it('parses quoted CSV and skips a header row', () => {
    expect(splitCsvLine('"a,b","say ""hi""",c', ',')).toEqual(['a,b', 'say "hi"', 'c']);
    const r = parseBatch('isi;nama\ntokoku.com/a;Produk A\n\n;kosong\njavascript:x;bad\nsaas;x', { columns: true, mode: 'url' });
    expect(r.rows.map((x) => x.data)).toEqual(['https://tokoku.com/a', 'https://saas/']);
    expect(r.rows[0].name).toBe('Produk A');
    expect(r.errors.map((e) => e.line)).toEqual([4, 5]);
    expect(r.warnings.map((w) => w.line)).toEqual([6]);
  });
  it('keeps plain lines intact in text mode and caps the row count', () => {
    expect(parseBatch('a, b, c', { columns: false, mode: 'text' }).rows[0].data).toBe('a, b, c');
    const many = parseBatch(Array.from({ length: 600 }, (_, i) => `r${i}`).join('\n'), { columns: false, mode: 'text' });
    expect(many.rows.length).toBe(500);
    expect(many.truncated).toBe(true);
  });
  it('dedupes file names', () => {
    const used = new Set<string>();
    expect([uniqueName('a', used), uniqueName('a', used), uniqueName('a', used)]).toEqual(['a', 'a-2', 'a-3']);
  });
});
