import type { QrType, Values } from '../lib/payload';

export interface Field {
  key: string;
  label: string;
  kind: 'text' | 'textarea' | 'password' | 'select' | 'checkbox' | 'datetime-local' | 'date' | 'email' | 'tel' | 'url' | 'locate';
  placeholder?: string;
  hint?: string;
  options?: [string, string][];
  half?: boolean;
  inputmode?: string;
  autocomplete?: string;
  maxlength?: number;
  rows?: number;
  showIf?: (v: Values) => boolean;
}

export interface TypeDef {
  type: QrType;
  label: string;
  icon: string;
  intro: string;
  fields: Field[];
  defaults?: Values;
}

export const TYPES: TypeDef[] = [
  {
    type: 'url',
    label: 'Tautan',
    icon: 'link',
    intro: 'Buka situs web saat dipindai.',
    fields: [
      {
        key: 'url',
        label: 'Alamat tautan',
        kind: 'url',
        placeholder: 'namasitus.com/halaman',
        inputmode: 'url',
        autocomplete: 'url',
        hint: 'Tidak perlu menulis https:// — ditambahkan otomatis.',
        maxlength: 2000,
      },
    ],
  },
  {
    type: 'text',
    label: 'Teks',
    icon: 'text',
    intro: 'Tampilkan tulisan apa saja.',
    fields: [{ key: 'text', label: 'Teks', kind: 'textarea', rows: 5, placeholder: 'Tulis pesanmu di sini…', maxlength: 3000 }],
  },
  {
    type: 'wifi',
    label: 'WiFi',
    icon: 'wifi',
    intro: 'Sambung ke WiFi tanpa mengetik kata sandi.',
    defaults: { security: 'WPA' },
    fields: [
      { key: 'ssid', label: 'Nama WiFi', kind: 'text', placeholder: 'Nama jaringan', autocomplete: 'off', maxlength: 64, hint: 'Tulis persis seperti yang muncul di HP, termasuk huruf besar-kecil.' },
      {
        key: 'security',
        label: 'Keamanan',
        kind: 'select',
        options: [
          ['WPA', 'WPA / WPA2 / WPA3 (paling umum)'],
          ['WEP', 'WEP (lama)'],
          ['nopass', 'Tanpa kata sandi'],
        ],
      },
      { key: 'password', label: 'Kata sandi', kind: 'password', autocomplete: 'off', maxlength: 64, showIf: (v) => v.security !== 'nopass' },
      { key: 'hidden', label: 'Jaringan tersembunyi (tidak muncul di daftar WiFi)', kind: 'checkbox' },
    ],
  },
  {
    type: 'vcard',
    label: 'Kontak',
    icon: 'contact',
    intro: 'Simpan kontak langsung ke HP.',
    fields: [
      { key: 'firstName', label: 'Nama depan', kind: 'text', half: true, autocomplete: 'given-name' },
      { key: 'lastName', label: 'Nama belakang', kind: 'text', half: true, autocomplete: 'family-name' },
      { key: 'phoneMobile', label: 'No. HP', kind: 'tel', half: true, inputmode: 'tel', autocomplete: 'tel' },
      { key: 'phoneWork', label: 'Telepon kantor', kind: 'tel', half: true, inputmode: 'tel' },
      { key: 'email', label: 'Email', kind: 'email', inputmode: 'email', autocomplete: 'email', placeholder: 'nama@email.com' },
      { key: 'org', label: 'Perusahaan', kind: 'text', half: true, autocomplete: 'organization' },
      { key: 'title', label: 'Jabatan', kind: 'text', half: true, autocomplete: 'organization-title' },
      { key: 'website', label: 'Situs web', kind: 'url', inputmode: 'url', placeholder: 'namasitus.com' },
      { key: 'street', label: 'Alamat', kind: 'text', autocomplete: 'street-address' },
      { key: 'city', label: 'Kota', kind: 'text', half: true, autocomplete: 'address-level2' },
      { key: 'region', label: 'Provinsi', kind: 'text', half: true, autocomplete: 'address-level1' },
      { key: 'postal', label: 'Kode pos', kind: 'text', half: true, inputmode: 'numeric', autocomplete: 'postal-code' },
      { key: 'country', label: 'Negara', kind: 'text', half: true, autocomplete: 'country-name' },
      { key: 'note', label: 'Catatan', kind: 'textarea', rows: 2 },
    ],
  },
  {
    type: 'email',
    label: 'Email',
    icon: 'mail',
    intro: 'Buka aplikasi email dengan pesan siap kirim.',
    fields: [
      { key: 'to', label: 'Kirim ke', kind: 'email', inputmode: 'email', placeholder: 'nama@email.com', hint: 'Lebih dari satu? Pisahkan dengan koma.' },
      { key: 'subject', label: 'Judul', kind: 'text' },
      { key: 'body', label: 'Isi pesan', kind: 'textarea', rows: 4, maxlength: 2000 },
    ],
  },
  {
    type: 'sms',
    label: 'SMS',
    icon: 'sms',
    intro: 'Siapkan SMS ke nomor tertentu.',
    fields: [
      { key: 'phone', label: 'Nomor tujuan', kind: 'tel', inputmode: 'tel', placeholder: '0812 3456 7890' },
      { key: 'message', label: 'Pesan', kind: 'textarea', rows: 3, maxlength: 1000 },
    ],
  },
  {
    type: 'phone',
    label: 'Telepon',
    icon: 'phone',
    intro: 'Langsung menelepon nomor ini.',
    fields: [{ key: 'phone', label: 'Nomor telepon', kind: 'tel', inputmode: 'tel', placeholder: '0812 3456 7890', hint: 'Untuk nomor luar negeri, awali dengan + dan kode negara.' }],
  },
  {
    type: 'whatsapp',
    label: 'WhatsApp',
    icon: 'whatsapp',
    intro: 'Buka chat WhatsApp ke nomormu.',
    defaults: { cc: '62' },
    fields: [
      { key: 'cc', label: 'Kode negara', kind: 'text', inputmode: 'numeric', half: true, maxlength: 4, hint: 'Indonesia: 62' },
      { key: 'phone', label: 'Nomor WhatsApp', kind: 'tel', inputmode: 'tel', half: true, placeholder: '0812 3456 7890' },
      { key: 'message', label: 'Pesan pembuka (boleh kosong)', kind: 'textarea', rows: 3, maxlength: 1000, placeholder: 'Halo, saya mau tanya…' },
    ],
  },
  {
    type: 'geo',
    label: 'Lokasi',
    icon: 'pin',
    intro: 'Tunjukkan titik lokasi di peta.',
    defaults: { mode: 'maps' },
    fields: [
      { key: 'paste', label: 'Tempel tautan Google Maps atau koordinat', kind: 'text', placeholder: '-6.175392, 106.827153', hint: 'Atau isi lintang & bujur di bawah.' },
      { key: 'lat', label: 'Lintang (latitude)', kind: 'text', inputmode: 'decimal', half: true, placeholder: '-6.175392' },
      { key: 'lng', label: 'Bujur (longitude)', kind: 'text', inputmode: 'decimal', half: true, placeholder: '106.827153' },
      { key: 'locate', label: 'Pakai lokasiku sekarang', kind: 'locate' },
      {
        key: 'mode',
        label: 'Dibuka dengan',
        kind: 'select',
        options: [
          ['maps', 'Google Maps (bisa di semua HP)'],
          ['geo', 'Aplikasi peta bawaan (geo:)'],
        ],
      },
      { key: 'label', label: 'Nama tempat (boleh kosong)', kind: 'text', showIf: (v) => v.mode === 'geo' },
    ],
  },
  {
    type: 'event',
    label: 'Acara',
    icon: 'calendar',
    intro: 'Tambahkan acara ke kalender.',
    fields: [
      { key: 'title', label: 'Nama acara', kind: 'text', maxlength: 200 },
      { key: 'allDay', label: 'Seharian penuh', kind: 'checkbox' },
      { key: 'start', label: 'Mulai', kind: 'datetime-local', half: true, showIf: (v) => !v.allDay },
      { key: 'end', label: 'Selesai', kind: 'datetime-local', half: true, showIf: (v) => !v.allDay, hint: 'Kosong = 1 jam.' },
      { key: 'startDate', label: 'Tanggal mulai', kind: 'date', half: true, showIf: (v) => v.allDay === true },
      { key: 'endDate', label: 'Tanggal selesai', kind: 'date', half: true, showIf: (v) => v.allDay === true },
      { key: 'location', label: 'Tempat', kind: 'text' },
      { key: 'description', label: 'Keterangan', kind: 'textarea', rows: 3, maxlength: 1000 },
    ],
  },
];

export const typeDef = (t: QrType) => TYPES.find((d) => d.type === t) ?? TYPES[0];
