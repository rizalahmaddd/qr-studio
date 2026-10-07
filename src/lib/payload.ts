export type QrType =
  | 'url'
  | 'text'
  | 'wifi'
  | 'vcard'
  | 'email'
  | 'sms'
  | 'phone'
  | 'whatsapp'
  | 'geo'
  | 'event';

export type Values = Record<string, string | boolean>;

export interface BuildResult {
  data: string;
  label: string;
  empty: boolean;
  errors: string[];
  warnings: string[];
}

const str = (v: Values, k: string) => {
  const x = v[k];
  return typeof x === 'string' ? x : '';
};
const bool = (v: Values, k: string) => v[k] === true;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ok(data: string, label: string, warnings: string[] = []): BuildResult {
  return { data, label, empty: false, errors: [], warnings };
}
function fail(errors: string[], warnings: string[] = []): BuildResult {
  return { data: '', label: '', empty: false, errors, warnings };
}
const EMPTY: BuildResult = { data: '', label: '', empty: true, errors: [], warnings: [] };

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:(?!\d)/i;
const BLOCKED_SCHEMES = new Set(['javascript:', 'data:', 'vbscript:', 'file:', 'blob:']);

export function normalizeUrl(input: string): { url: string; error?: string; warnings: string[] } {
  const warnings: string[] = [];
  let s = input.trim();
  if (/\s/.test(s)) warnings.push('Ada spasi di tautan. Spasi otomatis diubah jadi %20.');
  if (!SCHEME_RE.test(s)) s = (s.startsWith('//') ? 'https:' : 'https://') + s;

  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { url: '', error: 'Tautan ini tidak valid. Contoh yang benar: namasitus.com', warnings };
  }
  if (BLOCKED_SCHEMES.has(u.protocol)) {
    return { url: '', error: 'Jenis tautan ini tidak didukung demi keamanan.', warnings };
  }
  if (u.protocol === 'http:' || u.protocol === 'https:') {
    const host = u.hostname;
    if (!host) return { url: '', error: 'Nama situsnya belum diisi.', warnings };
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[');
    if (!host.includes('.') && host !== 'localhost' && !isIp) {
      warnings.push('Alamatnya sepertinya belum lengkap. Contoh: namasitus.com');
    }
    if (u.protocol === 'http:') {
      warnings.push('Tautan ini memakai http (tidak aman). Pakai https kalau situsnya mendukung.');
    }
    if (host.split('.').some((p) => p.startsWith('xn--'))) {
      warnings.push('Alamat ini memakai huruf khusus. Pastikan ejaannya benar.');
    }
  }
  return { url: u.href, warnings };
}

export function normalizePhone(raw: string): { phone: string; error?: string } {
  const phone = raw.trim().replace(/[\s\-().]/g, '');
  if (!phone) return { phone, error: 'Nomornya belum diisi.' };
  if (!/^\+?\d+$/.test(phone)) return { phone, error: 'Nomor hanya boleh berisi angka (dan + di depan).' };
  const digits = phone.replace('+', '').length;
  if (digits < 3 || digits > 15) return { phone, error: 'Panjang nomor tidak wajar. Cek lagi ya.' };
  return { phone };
}

export function whatsappNumber(
  raw: string,
  countryCode: string,
): { number: string; error?: string; warning?: string } {
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D/g, '');
  const cc = countryCode.replace(/\D/g, '') || '62';
  let warning: string | undefined;

  const international = trimmed.startsWith('+');
  if (!international && digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (!international && digits.startsWith('0')) {
    digits = cc + digits.slice(1);
  } else if (!international && !digits.startsWith(cc)) {
    digits = cc + digits;
    warning = `Nomor dianggap memakai kode negara +${cc}.`;
  }
  if (digits.length < 8 || digits.length > 15) {
    return { number: digits, error: 'Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890' };
  }
  return { number: digits, warning };
}

const escWifi = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');

const escVcard = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');

function parseNum(raw: string): number {
  let s = raw.trim().replace(/\s/g, '').replace('−', '-');
  if (!s.includes('.') && (s.match(/,/g) || []).length === 1) s = s.replace(',', '.');
  return s === '' ? NaN : Number(s);
}

export function parseCoords(text: string): { lat: number; lng: number } | null {
  const t = text.trim().replace(/−/g, '-');
  const n = '(-?\\d{1,3}(?:\\.\\d+)?)';
  const patterns = [
    new RegExp(`!3d${n}!4d${n}`),
    new RegExp(`@${n},${n}`),
    new RegExp(`[?&](?:q|query|ll|center|destination)=${n}(?:,|%2C)\\s*${n}`, 'i'),
    new RegExp(`^geo:${n},${n}`, 'i'),
    new RegExp(`^${n}\\s*[,;\\s]\\s*${n}$`),
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  return null;
}

function icsUtc(local: string): string | null {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsDate(iso: string, addDays = 0): string | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + addDays));
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function truncate(s: string, n = 40) {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > n ? one.slice(0, n - 1) + '…' : one;
}

const builders: Record<QrType, (v: Values) => BuildResult> = {
  url(v) {
    const raw = str(v, 'url');
    if (!raw.trim()) return EMPTY;
    const r = normalizeUrl(raw);
    if (r.error) return fail([r.error], r.warnings);
    return ok(r.url, truncate(r.url.replace(/^https?:\/\//, '').replace(/\/$/, '')), r.warnings);
  },

  text(v) {
    const raw = str(v, 'text');
    if (!raw.trim()) return EMPTY;
    return ok(raw, truncate(raw));
  },

  wifi(v) {
    const ssid = str(v, 'ssid');
    const security = str(v, 'security') || 'WPA';
    const password = str(v, 'password');
    if (!ssid && !password) return EMPTY;
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!ssid) errors.push('Nama WiFi belum diisi.');
    if (new TextEncoder().encode(ssid).length > 32) {
      warnings.push('Nama WiFi lebih dari 32 karakter. Biasanya nama WiFi tidak sepanjang ini.');
    }
    if (ssid !== ssid.trim()) warnings.push('Nama WiFi diawali/diakhiri spasi. Pastikan memang begitu.');
    if (security !== 'nopass') {
      if (!password) errors.push('Kata sandi belum diisi. Pilih "Tanpa kata sandi" kalau WiFi-nya terbuka.');
      else if (security === 'WPA' && (password.length < 8 || password.length > 63)) {
        warnings.push('Kata sandi WPA biasanya 8–63 karakter. Cek lagi ya.');
      } else if (security === 'WEP' && ![5, 10, 13, 26].includes(password.length)) {
        warnings.push('Kata sandi WEP biasanya 5, 10, 13, atau 26 karakter.');
      }
    }
    if (security === 'WEP') warnings.push('WEP sudah usang dan mudah dibobol. Sebaiknya ganti ke WPA2/WPA3.');
    if (errors.length) return fail(errors, warnings);

    let data = `WIFI:T:${security};S:${escWifi(ssid)};`;
    if (security !== 'nopass') data += `P:${escWifi(password)};`;
    if (bool(v, 'hidden')) data += 'H:true;';
    data += ';';
    return ok(data, truncate(ssid), warnings);
  },

  vcard(v) {
    const first = str(v, 'firstName').trim();
    const last = str(v, 'lastName').trim();
    const org = str(v, 'org').trim();
    const keys = ['firstName', 'lastName', 'org', 'title', 'phoneMobile', 'phoneWork', 'email', 'website', 'street', 'city', 'region', 'postal', 'country', 'note'];
    if (keys.every((k) => !str(v, k).trim())) return EMPTY;

    const errors: string[] = [];
    const warnings: string[] = [];
    const full = [first, last].filter(Boolean).join(' ');
    if (!full && !org) errors.push('Isi nama atau nama perusahaan.');

    const email = str(v, 'email').trim();
    if (email && !EMAIL_RE.test(email)) warnings.push('Format email sepertinya salah.');

    const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${escVcard(last)};${escVcard(first)};;;`, `FN:${escVcard(full || org)}`];
    if (org) lines.push(`ORG:${escVcard(org)}`);
    const title = str(v, 'title').trim();
    if (title) lines.push(`TITLE:${escVcard(title)}`);
    for (const [key, type] of [['phoneMobile', 'CELL'], ['phoneWork', 'WORK']] as const) {
      const raw = str(v, key).trim();
      if (!raw) continue;
      const p = normalizePhone(raw);
      if (p.error) warnings.push(`${key === 'phoneMobile' ? 'No. HP' : 'Telepon kantor'}: ${p.error}`);
      lines.push(`TEL;TYPE=${type}:${p.phone}`);
    }
    if (email) lines.push(`EMAIL:${escVcard(email)}`);
    const site = str(v, 'website').trim();
    if (site) {
      const u = normalizeUrl(site);
      if (u.error) warnings.push(`Situs web: ${u.error}`);
      lines.push(`URL:${escVcard(u.url || site)}`);
    }
    const adr = ['street', 'city', 'region', 'postal', 'country'].map((k) => escVcard(str(v, k).trim()));
    if (adr.some(Boolean)) lines.push(`ADR;TYPE=WORK:;;${adr.join(';')}`);
    const note = str(v, 'note').trim();
    if (note) lines.push(`NOTE:${escVcard(note)}`);
    lines.push('END:VCARD');

    if (errors.length) return fail(errors, warnings);
    return ok(lines.join('\r\n'), truncate(full || org), warnings);
  },

  email(v) {
    const to = str(v, 'to').replace(/\s/g, '');
    const subject = str(v, 'subject');
    const body = str(v, 'body');
    if (!to && !subject.trim() && !body.trim()) return EMPTY;
    if (!to) return fail(['Alamat email tujuan belum diisi.']);
    const bad = to.split(/[,;]/).filter((a) => a && !EMAIL_RE.test(a));
    if (bad.length) return fail([`Email tidak valid: ${bad.join(', ')}`]);
    const params = new URLSearchParams();
    if (subject) params.set('subject', subject);
    if (body) params.set('body', body);
    const q = params.toString().replace(/\+/g, '%20');
    return ok(`mailto:${to.replace(/;/g, ',')}${q ? '?' + q : ''}`, truncate(to));
  },

  sms(v) {
    const raw = str(v, 'phone');
    const message = str(v, 'message');
    if (!raw.trim() && !message.trim()) return EMPTY;
    const p = normalizePhone(raw);
    if (p.error) return fail([p.error]);
    return ok(`SMSTO:${p.phone}:${message}`, p.phone);
  },

  phone(v) {
    const raw = str(v, 'phone');
    if (!raw.trim()) return EMPTY;
    const p = normalizePhone(raw);
    if (p.error) return fail([p.error]);
    return ok(`tel:${p.phone}`, p.phone);
  },

  whatsapp(v) {
    const raw = str(v, 'phone');
    const message = str(v, 'message');
    if (!raw.trim() && !message.trim()) return EMPTY;
    const text = message ? `text=${encodeURIComponent(message)}` : '';
    if (!raw.trim()) {
      return ok(`https://wa.me/?${text}`, truncate(message), [
        'Tanpa nomor: orang yang memindai akan diminta memilih sendiri kontak tujuannya.',
      ]);
    }
    const n = whatsappNumber(raw, str(v, 'cc'));
    if (n.error) return fail([n.error]);
    return ok(`https://wa.me/${n.number}${text ? '?' + text : ''}`, '+' + n.number, n.warning ? [n.warning] : []);
  },

  geo(v) {
    const pasted = str(v, 'paste').trim();
    const latRaw = str(v, 'lat');
    const lngRaw = str(v, 'lng');
    if (!pasted && !latRaw.trim() && !lngRaw.trim()) return EMPTY;

    let lat = parseNum(latRaw);
    let lng = parseNum(lngRaw);
    if ((Number.isNaN(lat) || Number.isNaN(lng)) && pasted) {
      const c = parseCoords(pasted);
      if (!c) {
        const short = /goo\.gl|maps\.app/i.test(pasted);
        return fail([
          short
            ? 'Tautan pendek Google Maps tidak bisa dibaca langsung. Buka tautannya, lalu salin angka koordinatnya (contoh: -6.2, 106.8).'
            : 'Koordinat tidak ditemukan. Contoh yang bisa dibaca: -6.175392, 106.827153',
        ]);
      }
      lat = c.lat;
      lng = c.lng;
    }
    const errors: string[] = [];
    if (Number.isNaN(lat)) errors.push('Lintang (latitude) belum diisi atau bukan angka.');
    else if (Math.abs(lat) > 90) errors.push('Lintang harus di antara -90 dan 90.');
    if (Number.isNaN(lng)) errors.push('Bujur (longitude) belum diisi atau bukan angka.');
    else if (Math.abs(lng) > 180) errors.push('Bujur harus di antara -180 dan 180.');
    if (errors.length) return fail(errors);

    const la = +lat.toFixed(6);
    const ln = +lng.toFixed(6);
    const name = str(v, 'label').trim();
    const label = name || `${la}, ${ln}`;
    if (str(v, 'mode') === 'geo') {
      const q = name ? `?q=${la},${ln}(${encodeURIComponent(name)})` : '';
      return ok(`geo:${la},${ln}${q}`, truncate(label));
    }
    return ok(`https://www.google.com/maps/search/?api=1&query=${la}%2C${ln}`, truncate(label));
  },

  event(v) {
    const title = str(v, 'title').trim();
    const allDay = bool(v, 'allDay');
    const start = str(v, allDay ? 'startDate' : 'start');
    const end = str(v, allDay ? 'endDate' : 'end');
    const location = str(v, 'location').trim();
    const description = str(v, 'description').trim();
    if (!title && !start && !location && !description) return EMPTY;

    const errors: string[] = [];
    if (!title) errors.push('Nama acara belum diisi.');
    if (!start) errors.push('Waktu mulai belum diisi.');

    let dtStart: string | null = null;
    let dtEnd: string | null = null;
    if (start) {
      if (allDay) {
        dtStart = icsDate(start);
        dtEnd = icsDate(end || start, 1);
        if (end && end < start) errors.push('Tanggal selesai tidak boleh sebelum tanggal mulai.');
      } else {
        dtStart = icsUtc(start);
        dtEnd = icsUtc(end || new Date(new Date(start).getTime() + 3600_000).toISOString());
        if (end && new Date(end) < new Date(start)) errors.push('Waktu selesai tidak boleh sebelum waktu mulai.');
      }
      if (!dtStart || !dtEnd) errors.push('Format tanggal tidak dikenali.');
    }
    if (errors.length) return fail(errors);

    const dateProp = allDay ? ';VALUE=DATE' : '';
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `SUMMARY:${escVcard(title)}`,
      `DTSTART${dateProp}:${dtStart}`,
      `DTEND${dateProp}:${dtEnd}`,
    ];
    if (location) lines.push(`LOCATION:${escVcard(location)}`);
    if (description) lines.push(`DESCRIPTION:${escVcard(description)}`);
    lines.push('END:VEVENT', 'END:VCALENDAR');
    return ok(lines.join('\r\n'), truncate(title));
  },
};

export function buildPayload(type: QrType, values: Values): BuildResult {
  return builders[type](values);
}

const unescWifi = (s: string) => s.replace(/\\(.)/g, '$1');

/** Splits on `;` that are not escaped by a backslash. */
function splitUnescaped(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && i + 1 < s.length) {
      cur += ch + s[i + 1];
      i++;
    } else if (ch === ';') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

export function parseWifi(data: string): { ssid: string; password: string; security: string; hidden: boolean } | null {
  if (!/^WIFI:/i.test(data)) return null;
  const fields: Record<string, string> = {};
  for (const part of splitUnescaped(data.slice(5))) {
    const idx = part.indexOf(':');
    if (idx < 1) continue;
    fields[part.slice(0, idx).toUpperCase()] = unescWifi(part.slice(idx + 1));
  }
  if (!('S' in fields)) return null;
  const t = (fields.T || 'nopass').toUpperCase();
  return {
    ssid: fields.S,
    password: fields.P || '',
    security: t === 'NOPASS' || t === '' ? 'nopass' : t === 'WEP' ? 'WEP' : 'WPA',
    hidden: (fields.H || '').toLowerCase() === 'true',
  };
}

export type ScanKind = 'url' | 'wifi' | 'email' | 'phone' | 'sms' | 'vcard' | 'event' | 'geo' | 'text';

export function classifyScan(data: string): ScanKind {
  const t = data.trim();
  if (/^https?:\/\//i.test(t)) return 'url';
  if (/^WIFI:/i.test(t)) return 'wifi';
  if (/^mailto:/i.test(t) || /^MATMSG:/i.test(t)) return 'email';
  if (/^tel:/i.test(t)) return 'phone';
  if (/^(smsto|sms):/i.test(t)) return 'sms';
  if (/^BEGIN:VCARD/i.test(t) || /^MECARD:/i.test(t)) return 'vcard';
  if (/BEGIN:VEVENT/i.test(t)) return 'event';
  if (/^geo:/i.test(t)) return 'geo';
  return 'text';
}
