import { addHistory } from '../lib/history';
import { contrastRatio, isLighter, parseHex } from '../lib/color';
import { canCopyImage, canShareFiles, copyImage, copyText, downloadBlob, exportQr, shareFile, slug, type ExportFormat } from '../lib/export';
import { buildPayload, parseCoords, type Values } from '../lib/payload';
import { addCustomPreset, BUILTIN_PRESETS, deleteCustomPreset, listCustomPresets, type Preset } from '../lib/presets';
import { byteLength, createMatrix, MAX_BYTES, minPrintCm, QrTooLongError, type Ecl, type Matrix } from '../lib/qr';
import { measureText, verifySvg } from '../lib/raster';
import { DEFAULT_STYLE, dotsPath, effectiveEcl, eyeInnerPath, eyeOuterPath, renderSvg, type DotStyle, type QrStyle } from '../lib/render';
import { load, save } from '../lib/storage';
import { store } from '../state';
import { $, debounce, h, icon, pageHead, sectionHead, toast } from './dom';
import { TYPES, typeDef, type Field } from './schema';

type Note = { level: 'error' | 'warn' | 'info'; text: string };

interface Current {
  data: string;
  label: string;
  matrix: Matrix;
}

const ECL_LABEL: Record<Ecl, string> = { L: 'Rendah', M: 'Sedang', Q: 'Tinggi', H: 'Maksimal' };

const SAMPLE_DATA: Record<string, Values> = {
  url: { url: 'https://antigravity.dev' },
  text: { text: 'Selamat datang di QR Studio!\nSolusi QR code modern, cepat, dan aman tanpa login.' },
  wifi: { ssid: 'KopiSenja-5G', security: 'WPA', password: 'kopienakbanget' },
  vcard: { firstName: 'Budi', lastName: 'Santoso', phoneMobile: '081234567890', email: 'budi.santoso@startup.id', org: 'Studio Kreasi Digital', title: 'Creative Director', website: 'https://studiokreasi.id' },
  email: { to: 'halo@studiokreasi.id', subject: 'Kolaborasi Proyek Baru', body: 'Halo Budi,\nSaya tertarik untuk berdiskusi mengenai proyek kolaborasi desain dan teknologi.' },
  sms: { phone: '081234567890', message: 'Halo! Mohon info jadwal konsultasi studio minggu ini.' },
  phone: { phone: '+6281234567890' },
  whatsapp: { cc: '62', phone: '081234567890', message: 'Halo Kak, saya mau tanya paket pembuatan QR kustom.' },
  geo: { lat: '-6.175392', lng: '106.827153', mode: 'maps', label: 'Monas Jakarta' },
  event: { title: 'Workshop Design & Technology', start: '2026-11-15T09:00', end: '2026-11-15T12:00', location: 'Jakarta Creative Hub', description: 'Sesi workshop interaktif implementasi generative UI dan design engineering.' },
};

const COLOR_PALETTES = [
  { name: 'Obsidian', fg: '#0f172a', bg: '#ffffff', dot: 'square' },
  { name: 'Emerald', fg: '#059669', bg: '#ffffff', fg2: '#047857', gradient: true, angle: 45 },
  { name: 'Royal Indigo', fg: '#4f46e5', bg: '#ffffff', fg2: '#2563eb', gradient: true, angle: 45 },
  { name: 'Sunset', fg: '#ea580c', bg: '#ffffff', fg2: '#dc2626', gradient: true, angle: 135 },
  { name: 'Cyberpunk', fg: '#9333ea', bg: '#ffffff', fg2: '#ec4899', gradient: true, angle: 90 },
  { name: 'Oceanic', fg: '#0284c7', bg: '#ffffff', fg2: '#0f766e', gradient: true, angle: 45 },
  { name: 'Espresso', fg: '#451a03', bg: '#fef3c7', dot: 'rounded' },
];

let current: Current | null = null;
let verifyToken = 0;
let exportPrefs = load<{ format: ExportFormat; size: number }>('qr.export.v1', { format: 'png', size: 1024 });
let previewMode: 'normal' | 'stand' | 'card' = 'normal';

const syncers: Array<(s: QrStyle) => void> = [];

export function mountGenerator(root: HTMLElement) {
  const typeGrid = h('div', { class: 'type-grid', role: 'radiogroup', 'aria-label': 'Jenis kode QR' });
  const intro = h('p');
  const fields = h('form', { class: 'fields', novalidate: true, onsubmit: (e: Event) => e.preventDefault() });

  const sampleBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-ghost btn-sm',
      title: 'Isi dengan contoh data untuk mencoba tampilan',
      onclick: () => {
        const t = store.get().type;
        const sample = SAMPLE_DATA[t];
        if (sample) {
          store.replaceValues(t, sample);
          toast(`Contoh ${typeDef(t).label.toLowerCase()} dimuat.`, { kind: 'ok' });
        }
      },
    },
    icon('spark'),
    'Isi contoh',
  );

  const clearBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => store.clearValues() }, icon('reset'), 'Kosongkan');

  const previewSvg = h('div', { class: 'preview-svg' });
  const stage = h('div', { class: 'preview-stage' }, previewSvg);
  const status = h('div', { class: 'status', 'aria-live': 'polite' });
  const notes = h('ul', { class: 'notes' });
  const meta = h('div', { class: 'meta' });
  const exportBox = buildExport();

  const modeSwitch = h('div', { class: 'mini-seg', role: 'group', 'aria-label': 'Mode pratinjau' });
  const modes: ['normal' | 'stand' | 'card', string][] = [
    ['normal', 'QR'],
    ['stand', 'Stand meja'],
    ['card', 'Kartu nama'],
  ];
  const modeBtns = modes.map(([m, label]) => {
    const b = h('button', { type: 'button', 'aria-pressed': String(m === previewMode), onclick: () => switchPreviewMode(m) }, label);
    modeSwitch.append(b);
    return b;
  });

  function switchPreviewMode(mode: 'normal' | 'stand' | 'card') {
    previewMode = mode;
    modeBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(modes[i][0] === mode)));
    refresh();
  }

  const previewCard = h(
    'section',
    { class: 'card preview-card', id: 'preview-card', 'aria-label': 'Hasil' },
    sectionHead('Hasil', { actions: [modeSwitch] }),
    stage,
    status,
    notes,
    meta,
    exportBox.el,
  );

  const mobileThumb = h('div', { class: 'mobile-thumb', 'aria-hidden': 'true' });
  const mobileBar = h(
    'div',
    { class: 'mobile-bar', hidden: true },
    h('button', { type: 'button', class: 'mobile-peek', onclick: () => previewCard.scrollIntoView({ behavior: 'smooth', block: 'start' }), 'aria-label': 'Lihat hasil' }, mobileThumb, h('span', null, 'Lihat hasil')),
    h('button', { type: 'button', class: 'btn btn-primary', onclick: () => doDownload() }, icon('download'), 'Unduh'),
  );

  root.append(
    pageHead('Buat kode QR', 'Pilih jenis, isi datanya, lalu unduh. Tampilan bisa diatur kapan saja.'),
    h(
      'div',
      { class: 'studio' },
      h(
        'div',
        { class: 'studio-main' },
        h('section', { class: 'card card-type' }, sectionHead('Jenis kode QR', { step: 1 }), typeGrid),
        h('section', { class: 'card card-content' }, sectionHead('Isi', { step: 2, desc: intro, actions: [sampleBtn, clearBtn] }), fields),
        h('section', { class: 'card card-design' }, sectionHead('Tampilan', { step: 3, desc: 'Opsional. Warna, bentuk, logo, dan bingkai.' }), buildCustomizer()),
      ),
      h('aside', { class: 'studio-side' }, previewCard),
    ),
    mobileBar,
  );

  for (const t of TYPES) {
    typeGrid.append(
      h(
        'button',
        { type: 'button', class: 'type-btn', role: 'radio', 'data-type': t.type, onclick: () => store.setType(t.type) },
        icon(t.icon, 'ico ico-lg'),
        h('span', null, t.label),
      ),
    );
  }
  typeGrid.addEventListener('keydown', (e) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const i = TYPES.findIndex((t) => t.type === store.get().type);
    const next = TYPES[(i + (keys.indexOf(e.key) < 2 ? 1 : -1) + TYPES.length) % TYPES.length];
    store.setType(next.type);
    $<HTMLButtonElement>(`[data-type="${next.type}"]`, typeGrid).focus();
  });

  function renderTypes() {
    const t = store.get().type;
    for (const b of typeGrid.querySelectorAll<HTMLButtonElement>('.type-btn')) {
      const on = b.dataset.type === t;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    intro.textContent = typeDef(t).intro;
  }

  function renderForm() {
    const s = store.get();
    const def = typeDef(s.type);
    const values = s.values[s.type];
    fields.replaceChildren(...def.fields.map((f) => fieldEl(f, values)));
    updateVisibility();
  }

  function updateVisibility() {
    const s = store.get();
    const values = s.values[s.type];
    for (const f of typeDef(s.type).fields) {
      if (!f.showIf) continue;
      const el = fields.querySelector<HTMLElement>(`[data-field="${f.key}"]`);
      if (el) el.hidden = !f.showIf(values);
    }
  }

  let previewVisible = true;
  function syncBar() {
    mobileBar.hidden = previewVisible || !current;
  }

  function refresh() {
    const s = store.get();
    const r = buildPayload(s.type, s.values[s.type]);
    current = null;
    verifyToken++;
    const list: Note[] = r.warnings.map((text) => ({ level: 'warn', text }));

    const setEmpty = (title: string, body: string, kind: 'empty' | 'error') => {
      previewSvg.replaceChildren(
        h('div', { class: `placeholder placeholder-${kind}` }, icon(kind === 'error' ? 'alert' : 'grid', 'ico ico-xl'), h('strong', null, title), h('span', null, body)),
      );
      stage.classList.remove('checker');
      status.replaceChildren();
      meta.replaceChildren();
      mobileThumb.replaceChildren();
      exportBox.setEnabled(false);
      syncBar();
    };

    if (r.empty) {
      setEmpty('Kode QR muncul di sini', 'Isi datanya dulu di langkah 2.', 'empty');
      renderNotes(notes, []);
      return;
    }
    if (r.errors.length) {
      setEmpty('Belum bisa dibuat', 'Perbaiki isian yang ditandai.', 'error');
      renderNotes(notes, [...r.errors.map((text) => ({ level: 'error' as const, text })), ...list]);
      return;
    }

    const ecl = effectiveEcl(s.style);
    let matrix: Matrix;
    try {
      matrix = createMatrix(r.data, ecl);
    } catch (e) {
      if (!(e instanceof QrTooLongError)) throw e;
      const tips = ['persingkat isinya'];
      if (ecl !== 'L') tips.push(s.style.logo ? 'hapus logo lalu turunkan ketahanan' : 'turunkan ketahanan di bagian Lanjutan');
      if (s.type === 'url') tips.push('pakai layanan tautan pendek');
      setEmpty('Isinya terlalu panjang', `${e.bytes.toLocaleString('id-ID')} dari maksimal ${MAX_BYTES[ecl].toLocaleString('id-ID')} byte.`, 'error');
      renderNotes(notes, [{ level: 'error', text: `Coba ${tips.join(', atau ')}.` }, ...list]);
      return;
    }

    const { svg, width, height } = renderSvg(matrix, s.style, { measureText, title: `Kode QR: ${r.label}` });
    
    if (previewMode === 'normal') {
      previewSvg.innerHTML = svg;
      stage.classList.toggle('checker', s.style.transparent);
    } else {
      const qr = h('div', { class: 'mockup-qr', html: svg });
      const mock =
        previewMode === 'stand'
          ? h('div', { class: 'mockup-stand' }, h('span', { class: 'mockup-title' }, r.label || 'Pindai di sini'), qr)
          : h('div', { class: 'mockup-card' }, qr, h('div', { class: 'mockup-card-info' }, h('strong', null, r.label || 'Kartu nama'), h('span', null, typeDef(s.type).label)));
      previewSvg.replaceChildren(h('div', { class: 'mockup-wrap' }, mock));
      stage.classList.remove('checker');
    }

    previewSvg.firstElementChild?.setAttribute('role', 'img');
    mobileThumb.innerHTML = svg;
    current = { data: r.data, label: r.label, matrix };
    exportBox.setEnabled(true);
    syncBar();

    list.push(...styleNotes(s.style), ...densityNotes(matrix));
    renderNotes(notes, list);

    const bytes = byteLength(r.data);
    meta.replaceChildren(
      h('span', null, `${matrix.size}×${matrix.size} kotak`),
      h('span', null, `${bytes.toLocaleString('id-ID')} / ${MAX_BYTES[ecl].toLocaleString('id-ID')} byte`),
      h('span', null, `Ketahanan ${ECL_LABEL[ecl].toLowerCase()}`),
      h('span', null, `Cetak min. ${minPrintCm(matrix.size, s.style.margin).toLocaleString('id-ID')} cm`),
    );

    status.replaceChildren(h('span', { class: 'chip chip-wait' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Menguji…'));
    runVerify(verifyToken, svg, r.data, { width, height });
  }

  const runVerify = debounce(async (token: number, svg: string, data: string, units: { width: number; height: number }) => {
    if (token !== verifyToken) return;
    const res = await verifySvg(svg, data, units);
    if (token !== verifyToken) return;
    const chip =
      res.status === 'ok'
        ? h('span', { class: 'chip chip-ok' }, icon('check'), 'Lolos uji pindai')
        : res.status === 'unavailable'
          ? h('span', { class: 'chip' }, icon('info'), 'Uji pindai tidak tersedia di browser ini')
          : h(
              'span',
              { class: 'chip chip-warn' },
              icon('alert'),
              res.status === 'mismatch' ? 'Hasil pindai tidak cocok' : 'Pemindai uji belum bisa membaca',
            );
    status.replaceChildren(chip);
    if (res.status === 'unreadable' || res.status === 'mismatch') {
      status.append(
        h(
          'p',
          { class: 'status-tip' },
          'Coba warna lebih kontras, logo lebih kecil, atau bentuk titik "Kotak". Kamera HP sering tetap bisa membaca — tapi sebaiknya cek dulu sebelum dicetak.',
        ),
      );
    }
  }, 350);

  function buildExport() {
    const formats: [ExportFormat, string][] = [
      ['png', 'PNG'],
      ['svg', 'SVG'],
      ['jpeg', 'JPG'],
      ['webp', 'WebP'],
    ];
    const formatGroup = segmented(
      'Format',
      'export-format',
      formats.map(([v, l]) => [v, l]),
      exportPrefs.format,
      (v) => {
        exportPrefs = { ...exportPrefs, format: v as ExportFormat };
        save('qr.export.v1', exportPrefs);
        sizeRow.hidden = v === 'svg';
      },
    );
    const sizeSelect = h(
      'select',
      {
        id: 'export-size',
        onchange: (e: Event) => {
          exportPrefs = { ...exportPrefs, size: Number((e.target as HTMLSelectElement).value) };
          save('qr.export.v1', exportPrefs);
        },
      },
      ...[
        [512, 'Kecil · 512 px'],
        [1024, 'Sedang · 1024 px'],
        [2048, 'Besar · 2048 px'],
        [4096, 'Cetak · 4096 px'],
      ].map(([v, l]) => h('option', { value: String(v), selected: v === exportPrefs.size }, String(l))),
    );
    const sizeRow = h('div', { class: 'field' }, h('label', { for: 'export-size' }, 'Ukuran gambar'), sizeSelect);
    sizeRow.hidden = exportPrefs.format === 'svg';

    const dl = h('button', { type: 'button', class: 'btn btn-primary btn-block', onclick: () => doDownload() }, icon('download'), 'Unduh');
    const copyImg = h('button', { type: 'button', class: 'btn', onclick: () => doCopyImage() }, icon('copy'), 'Salin gambar');
    const share = h('button', { type: 'button', class: 'btn', onclick: () => doShare() }, icon('share'), 'Bagikan');
    const print = h('button', { type: 'button', class: 'btn', onclick: () => doPrint() }, icon('print'), 'Cetak');
    const copyData = h('button', { type: 'button', class: 'btn', onclick: () => doCopyText() }, icon('text'), 'Salin isi');
    if (!canCopyImage()) copyImg.hidden = true;
    if (!canShareFiles()) share.hidden = true;
    const buttons = [dl, copyImg, share, print, copyData];

    const el = h(
      'div',
      { class: 'export' },
      h('div', { class: 'export-opts' }, formatGroup, sizeRow),
      dl,
      h('div', { class: 'export-more' }, copyImg, share, print, copyData),
      h('p', { class: 'kbd-hint muted' }, 'Pintasan: ', h('kbd', null, navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'), ' + ', h('kbd', null, 'S'), ' untuk unduh'),
    );
    return {
      el,
      setEnabled(on: boolean) {
        for (const b of buttons) b.disabled = !on;
      },
    };
  }

  store.subscribe((_s, changed) => {
    if (changed === 'type') {
      renderTypes();
      renderForm();
    } else if (changed === 'values') {
      updateVisibility();
    } else {
      for (const fn of syncers) fn(store.get().style);
    }
    refresh();
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(([entry]) => {
      previewVisible = entry.isIntersecting;
      syncBar();
    });
    io.observe(previewCard);
  }

  renderTypes();
  renderForm();
  refresh();

  return {
    shortcutDownload: () => doDownload(),
  };
}

function renderNotes(ul: HTMLElement, list: Note[]) {
  ul.replaceChildren(
    ...list.map((n) =>
      h('li', { class: `note note-${n.level}` }, icon(n.level === 'info' ? 'info' : 'alert'), h('span', null, n.text)),
    ),
  );
}

function styleNotes(st: QrStyle): Note[] {
  const out: Note[] = [];
  const bg = st.transparent ? '#ffffff' : st.bg;
  const fgs = [st.fg, st.gradient ? st.fg2 : null, st.eyeCustom ? st.eyeColor : null].filter((c): c is string => !!c);
  const worst = Math.min(...fgs.map((c) => contrastRatio(c, bg)));
  if (worst < 2) out.push({ level: 'error', text: 'Warna kode dan latar terlalu mirip. Kemungkinan besar tidak bisa dipindai.' });
  else if (worst < 3.5) out.push({ level: 'warn', text: 'Kontras warna rendah. Pakai warna kode lebih gelap atau latar lebih terang.' });
  if (!st.transparent && fgs.some((c) => isLighter(c, bg))) {
    out.push({ level: 'warn', text: 'Kode terang di atas latar gelap tidak bisa dibaca sebagian aplikasi pemindai. Paling aman: kode gelap, latar terang.' });
  }
  if (st.transparent) out.push({ level: 'info', text: 'Latar transparan: tempel QR di permukaan yang terang dan polos.' });
  if (st.margin < 2) out.push({ level: 'warn', text: 'Jarak tepi tipis. Saat dicetak, sisakan ruang kosong di sekeliling QR.' });
  if (st.logo && st.ecl !== 'H') out.push({ level: 'info', text: 'Karena ada logo, ketahanan otomatis dinaikkan ke Maksimal.' });
  if (st.logo && !st.logoPlate) out.push({ level: 'info', text: 'Logo tanpa latar menimpa titik-titik QR. Aktifkan "Latar polos di belakang logo" kalau sulit dipindai.' });
  if (st.frame !== 'none' && !st.frameText.trim()) out.push({ level: 'info', text: 'Tulisan bingkai masih kosong.' });
  return out;
}

function densityNotes(m: Matrix): Note[] {
  if (m.version >= 25) return [{ level: 'warn', text: 'QR sangat padat. Persingkat isinya supaya mudah dipindai, atau cetak besar.' }];
  if (m.version >= 15) return [{ level: 'info', text: 'QR cukup padat. Cetak agak besar dan uji dengan beberapa HP.' }];
  return [];
}

function fieldEl(f: Field, values: Values): HTMLElement {
  const id = `f-${f.key}`;
  const val = values[f.key];
  const wrap = h('div', { class: `field${f.half ? ' half' : ''}`, 'data-field': f.key });
  const hint = f.hint ? h('p', { class: 'hint', id: `${id}-hint` }, f.hint) : null;
  const describedBy = hint ? `${id}-hint` : null;

  if (f.kind === 'checkbox') {
    const input = h('input', {
      type: 'checkbox',
      id,
      checked: val === true,
      onchange: (e: Event) => store.setValue(f.key, (e.target as HTMLInputElement).checked),
    });
    wrap.classList.add('field-check');
    wrap.append(h('label', { class: 'check' }, input, h('span', null, f.label)));
    return wrap;
  }

  if (f.kind === 'locate') {
    const btn = h('button', { type: 'button', class: 'btn btn-sm' }, icon('locate'), f.label);
    btn.addEventListener('click', () => locate(btn));
    wrap.append(btn);
    return wrap;
  }

  wrap.append(h('label', { for: id }, f.label));
  const text = typeof val === 'string' ? val : '';
  const onInput = (e: Event) => {
    const v = (e.target as HTMLInputElement).value;
    store.setValue(f.key, v);
    if (f.key === 'paste') fillCoordsFromPaste(v);
  };

  let control: HTMLElement;
  if (f.kind === 'select') {
    control = h(
      'select',
      { id, onchange: onInput, 'aria-describedby': describedBy },
      ...(f.options ?? []).map(([v, l]) => h('option', { value: v, selected: v === text }, l)),
    );
  } else if (f.kind === 'textarea') {
    control = h('textarea', { id, rows: f.rows ?? 3, placeholder: f.placeholder, maxlength: f.maxlength, oninput: onInput, 'aria-describedby': describedBy });
    (control as HTMLTextAreaElement).value = text;
  } else {
    const input = h('input', {
      id,
      type: f.kind,
      placeholder: f.placeholder,
      inputmode: f.inputmode,
      autocomplete: f.autocomplete ?? 'on',
      maxlength: f.maxlength,
      spellcheck: f.kind === 'text' ? null : 'false',
      oninput: onInput,
      'aria-describedby': describedBy,
    });
    input.value = text;
    control = input;
    if (f.kind === 'password') {
      input.autocapitalize = 'off';
      const toggle = h('button', { type: 'button', class: 'input-addon', 'aria-label': 'Tampilkan kata sandi', 'aria-pressed': 'false' }, icon('eye'));
      toggle.addEventListener('click', () => {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        toggle.setAttribute('aria-pressed', String(show));
        toggle.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
        toggle.replaceChildren(icon(show ? 'eyeOff' : 'eye'));
      });
      control = h('div', { class: 'input-group' }, input, toggle);
    }
  }
  wrap.append(control);
  if (hint) wrap.append(hint);
  return wrap;
}

function setFieldValue(key: string, value: string) {
  store.setValue(key, value);
  const el = document.getElementById(`f-${key}`) as HTMLInputElement | null;
  if (el) el.value = value;
}

function fillCoordsFromPaste(text: string) {
  const c = parseCoords(text);
  if (!c) return;
  setFieldValue('lat', String(c.lat));
  setFieldValue('lng', String(c.lng));
}

function locate(btn: HTMLButtonElement) {
  if (!('geolocation' in navigator)) {
    toast('Browser ini tidak mendukung lokasi.', { kind: 'error' });
    return;
  }
  btn.disabled = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      btn.disabled = false;
      setFieldValue('lat', pos.coords.latitude.toFixed(6));
      setFieldValue('lng', pos.coords.longitude.toFixed(6));
      toast(`Lokasi ditemukan (akurasi ±${Math.round(pos.coords.accuracy)} m).`, { kind: 'ok' });
    },
    (err) => {
      btn.disabled = false;
      const msg =
        err.code === err.PERMISSION_DENIED
          ? 'Izin lokasi ditolak. Izinkan lewat pengaturan browser, atau isi koordinat manual.'
          : err.code === err.TIMEOUT
            ? 'Lokasi terlalu lama ditemukan. Coba lagi di tempat terbuka.'
            : 'Lokasi tidak bisa ditemukan.';
      toast(msg, { kind: 'error' });
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

function segmented(label: string, name: string, options: [string, string | Node][], value: string, onChange: (v: string) => void): HTMLElement {
  const group = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label });
  for (const [v, l] of options) {
    const input = h('input', { type: 'radio', name, value: v, checked: v === value, onchange: () => onChange(v) });
    group.append(h('label', { class: 'seg' }, input, typeof l === 'string' ? h('span', null, l) : l));
  }
  return h('div', { class: 'field' }, h('span', { class: 'label' }, label), group);
}

function styleChoice<K extends keyof QrStyle>(label: string, key: K, options: [QrStyle[K], string, Node?][], cls = ''): HTMLElement {
  const name = `s-${String(key)}`;
  const group = h('div', { class: `choice-grid ${cls}`, role: 'radiogroup', 'aria-label': label });
  for (const [v, l, preview] of options) {
    const input = h('input', { type: 'radio', name, value: String(v), onchange: () => store.setStyle({ [key]: v } as Partial<QrStyle>) });
    group.append(h('label', { class: 'choice' }, input, preview ?? null, h('span', null, l)));
  }
  syncers.push((s) => {
    for (const i of group.querySelectorAll<HTMLInputElement>('input')) i.checked = i.value === String(s[key]);
  });
  return h('div', { class: 'field' }, h('span', { class: 'label' }, label), group);
}

function colorControl(label: string, key: 'fg' | 'bg' | 'fg2' | 'eyeColor' | 'frameColor' | 'frameTextColor'): HTMLElement {
  const id = `c-${key}`;
  const picker = h('input', { type: 'color', id, 'aria-label': `${label} (pemilih)` });
  const text = h('input', { type: 'text', class: 'hex', maxlength: 7, spellcheck: 'false', autocomplete: 'off', 'aria-label': `${label} (kode hex)` });
  picker.addEventListener('input', () => {
    text.value = picker.value;
    store.setStyle({ [key]: picker.value });
  });
  text.addEventListener('input', () => {
    const hex = parseHex(text.value);
    text.classList.toggle('invalid', !hex);
    if (hex) {
      picker.value = hex;
      store.setStyle({ [key]: hex });
    }
  });
  text.addEventListener('blur', () => {
    text.value = store.get().style[key];
    text.classList.remove('invalid');
  });
  syncers.push((s) => {
    picker.value = s[key];
    if (document.activeElement !== text) text.value = s[key];
  });
  return h('div', { class: 'field color-field' }, h('label', { for: id }, label), h('div', { class: 'color-input' }, picker, text));
}

function toggleControl(label: string, key: 'transparent' | 'gradient' | 'eyeCustom' | 'logoPlate'): HTMLElement {
  const input = h('input', { type: 'checkbox', onchange: () => store.setStyle({ [key]: input.checked }) });
  syncers.push((s) => (input.checked = s[key]));
  return h('div', { class: 'field field-check' }, h('label', { class: 'check' }, input, h('span', null, label)));
}

function rangeControl(label: string, key: 'margin' | 'angle' | 'logoSize', min: number, max: number, step: number, fmt: (v: number) => string): HTMLElement {
  const id = `r-${key}`;
  const out = h('output', { for: id, class: 'range-out' });
  const input = h('input', { type: 'range', id, min, max, step });
  input.addEventListener('input', () => {
    store.setStyle({ [key]: Number(input.value) });
  });
  syncers.push((s) => {
    input.value = String(s[key]);
    out.textContent = fmt(s[key]);
  });
  return h('div', { class: 'field' }, h('div', { class: 'label-row' }, h('label', { for: id }, label), out), input);
}

function showWhen(el: HTMLElement, cond: (s: QrStyle) => boolean): HTMLElement {
  syncers.push((s) => (el.hidden = !cond(s)));
  return el;
}

function frameTextControl(): HTMLElement {
  const input = h('input', { type: 'text', id: 'frame-text', maxlength: 40, placeholder: 'Pindai di sini' });
  input.addEventListener('input', () => store.setStyle({ frameText: input.value }));
  syncers.push((s) => {
    if (document.activeElement !== input) input.value = s.frameText;
  });
  return h('div', { class: 'field' }, h('label', { for: 'frame-text' }, 'Tulisan'), input);
}

const MAX_LOGO_BYTES = 10 * 1024 * 1024;

async function readLogo(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('File ini bukan gambar.');
  if (file.size > MAX_LOGO_BYTES) throw new Error('Gambar terlalu besar. Maksimal 10 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error('Gambar tidak bisa dibuka. Coba format PNG atau JPG.');
    }
    const w0 = img.naturalWidth || 512;
    const h0 = img.naturalHeight || 512;
    const k = Math.min(1, 512 / Math.max(w0, h0));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w0 * k));
    canvas.height = Math.max(1, Math.round(h0 * k));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Browser tidak bisa memproses gambar.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

const SAMPLE = [
  [1, 1, 0, 1, 0],
  [1, 0, 1, 1, 1],
  [0, 1, 1, 0, 1],
  [1, 1, 0, 0, 1],
  [0, 1, 1, 1, 0],
];

function dotPreview(dot: QrStyle['dot']): SVGSVGElement {
  const d = dotsPath(5, (r, c) => SAMPLE[r]?.[c] === 1, dot);
  return svgEl(`<svg viewBox="-0.5 -0.5 6 6" class="choice-svg" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`);
}

function eyePreview(outer: QrStyle['eyeOuter'] | null, inner: QrStyle['eyeInner'] | null): SVGSVGElement {
  const o = eyeOuterPath(0, 0, outer ?? 'square');
  const i = eyeInnerPath(0, 0, inner ?? 'square');
  return svgEl(
    `<svg viewBox="-0.5 -0.5 8 8" class="choice-svg" aria-hidden="true"><path d="${o}" fill="currentColor" fill-rule="evenodd" opacity="${outer ? 1 : 0.3}"/><path d="${i}" fill="currentColor" opacity="${inner ? 1 : 0.3}"/></svg>`,
  );
}

function svgEl(markup: string): SVGSVGElement {
  const t = document.createElement('template');
  t.innerHTML = markup;
  return t.content.firstElementChild as SVGSVGElement;
}

const presetMatrix = (() => {
  let m: Matrix | null = null;
  return () => (m ??= createMatrix('QR', 'L'));
})();

function presetButton(p: Preset, onDelete?: () => void): HTMLElement {
  const style = { ...DEFAULT_STYLE, ...p.style, margin: 1, logo: null, frame: 'none' as const };
  const thumb = svgEl(renderSvg(presetMatrix(), style).svg);
  thumb.setAttribute('aria-hidden', 'true');
  const btn = h('button', { type: 'button', class: 'preset', onclick: () => store.setStyle(p.style) }, thumb, h('span', null, p.name));
  if (!onDelete) return btn;
  return h(
    'div',
    { class: 'preset-wrap' },
    btn,
    h('button', { type: 'button', class: 'preset-del', 'aria-label': `Hapus gaya ${p.name}`, onclick: onDelete }, icon('close')),
  );
}

function buildCustomizer(): HTMLElement {
  const presetRow = h('div', { class: 'preset-row' });
  const renderPresets = () => {
    const custom = listCustomPresets();
    presetRow.replaceChildren(
      ...BUILTIN_PRESETS.map((p) => presetButton(p)),
      ...custom.map((p) =>
        presetButton(p, () => {
          deleteCustomPreset(p.id);
          renderPresets();
        }),
      ),
    );
  };
  renderPresets();

  const nameInput = h('input', { type: 'text', placeholder: 'Nama gaya', maxlength: 24, 'aria-label': 'Nama gaya' });
  const saveForm = h(
    'form',
    {
      class: 'save-preset',
      hidden: true,
      onsubmit: (e: Event) => {
        e.preventDefault();
        if (!addCustomPreset(nameInput.value, store.get().style)) toast('Gaya tidak bisa disimpan di browser ini.', { kind: 'error' });
        else toast('Gaya disimpan.', { kind: 'ok' });
        nameInput.value = '';
        saveForm.hidden = true;
        renderPresets();
      },
    },
    nameInput,
    h('button', { class: 'btn btn-primary btn-sm' }, 'Simpan'),
  );
  const presetActions = h(
    'div',
    { class: 'preset-actions' },
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn-ghost btn-sm',
        onclick: () => {
          saveForm.hidden = !saveForm.hidden;
          if (!saveForm.hidden) nameInput.focus();
        },
      },
      icon('plus'),
      'Simpan gaya ini',
    ),
    h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => store.resetStyle() }, icon('reset'), 'Kembali ke awal'),
  );

  const swap = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-ghost btn-sm',
      onclick: () => {
        const s = store.get().style;
        store.setStyle({ fg: s.bg, bg: s.fg });
      },
    },
    icon('swap'),
    'Tukar warna',
  );

  const colors = h(
    'div',
    { class: 'custom-tab-panel', 'data-tab': 'colors' },
    h('span', { class: 'label' }, 'Palet warna'),
    buildPaletteGrid(),
    h('div', { class: 'row-2' }, colorControl('Warna kode', 'fg'), showWhen(colorControl('Warna latar', 'bg'), (s) => !s.transparent)),
    h('div', { class: 'row-inline' }, toggleControl('Latar transparan', 'transparent'), swap),
    toggleControl('Gradasi warna', 'gradient'),
    showWhen(
      h(
        'div',
        { class: 'sub' },
        colorControl('Warna kedua', 'fg2'),
        styleChoice('Arah gradasi', 'gradientType', [
          ['linear', 'Lurus'],
          ['radial', 'Melingkar'],
        ], 'choice-text'),
        showWhen(rangeControl('Sudut', 'angle', 0, 360, 15, (v) => `${v}°`), (s) => s.gradientType === 'linear'),
      ),
      (s) => s.gradient,
    ),
    toggleControl('Warna sudut berbeda', 'eyeCustom'),
    showWhen(h('div', { class: 'sub' }, colorControl('Warna sudut', 'eyeColor')), (s) => s.eyeCustom),
  );

  const shapes = h(
    'div',
    { class: 'custom-tab-panel', 'data-tab': 'shapes', hidden: true },
    styleChoice('Titik', 'dot', [
      ['square', 'Kotak', dotPreview('square')],
      ['rounded', 'Halus', dotPreview('rounded')],
      ['dots', 'Bulat', dotPreview('dots')],
      ['lines', 'Garis', dotPreview('lines')],
      ['diamond', 'Wajik', dotPreview('diamond')],
    ]),
    styleChoice('Bingkai sudut', 'eyeOuter', [
      ['square', 'Kotak', eyePreview('square', null)],
      ['rounded', 'Tumpul', eyePreview('rounded', null)],
      ['circle', 'Bulat', eyePreview('circle', null)],
    ]),
    styleChoice('Isi sudut', 'eyeInner', [
      ['square', 'Kotak', eyePreview(null, 'square')],
      ['rounded', 'Tumpul', eyePreview(null, 'rounded')],
      ['circle', 'Bulat', eyePreview(null, 'circle')],
    ]),
  );

  const logo = buildLogoGroup();
  logo.setAttribute('data-tab', 'logo');
  logo.hidden = true;

  const frame = h(
    'div',
    { class: 'custom-tab-panel', 'data-tab': 'frame', hidden: true },
    styleChoice('Bingkai', 'frame', [
      ['none', 'Tanpa'],
      ['label', 'Tulisan di bawah'],
      ['box', 'Kotak berlabel'],
    ], 'choice-text'),
    showWhen(h('div', { class: 'sub' }, frameTextControl(), h('div', { class: 'row-2' }, colorControl('Warna bingkai', 'frameColor'), showWhen(colorControl('Warna tulisan', 'frameTextColor'), (s) => s.frame === 'box'))), (s) => s.frame !== 'none'),
  );

  const eclGroup = styleChoice('Ketahanan terhadap rusak', 'ecl', [
    ['L', 'Rendah · 7%'],
    ['M', 'Sedang · 15%'],
    ['Q', 'Tinggi · 25%'],
    ['H', 'Maksimal · 30%'],
  ], 'choice-text');
  const eclNote = h('p', { class: 'hint' });
  syncers.push((s) => {
    for (const i of eclGroup.querySelectorAll<HTMLInputElement>('input')) {
      i.disabled = !!s.logo;
      if (s.logo) i.checked = i.value === 'H';
    }
    eclNote.textContent = s.logo
      ? 'Terkunci di Maksimal karena ada logo.'
      : 'Makin tinggi, makin tahan kotor atau tergores — tapi titiknya makin rapat.';
  });

  const advanced = h(
    'div',
    { class: 'custom-tab-panel', 'data-tab': 'advanced', hidden: true },
    eclGroup,
    eclNote,
    rangeControl('Jarak tepi (ruang kosong)', 'margin', 0, 10, 1, (v) => `${v} kotak`),
    h('p', { class: 'hint' }, 'Standarnya 4 kotak. Terlalu tipis bisa membuat QR sulit dipindai.'),
  );

  const panels = [colors, shapes, logo, frame, advanced];

  // Tab navigation header
  const tabsNav = h('div', { class: 'custom-tabs', role: 'tablist' });
  const tabDefs = [
    { id: 'colors', label: 'Warna', icon: 'palette' },
    { id: 'shapes', label: 'Bentuk', icon: 'shapes' },
    { id: 'logo', label: 'Logo', icon: 'image' },
    { id: 'frame', label: 'Bingkai', icon: 'frame' },
    { id: 'advanced', label: 'Lanjutan', icon: 'grid' },
  ];

  const tabButtons = tabDefs.map((t, idx) => {
    const btn = h(
      'button',
      {
        type: 'button',
        class: `tab-btn${idx === 0 ? ' active' : ''}`,
        role: 'tab',
        'aria-selected': String(idx === 0),
        onclick: () => selectTab(t.id),
      },
      icon(t.icon),
      t.label,
    );
    tabsNav.append(btn);
    return btn;
  });

  function selectTab(id: string) {
    tabButtons.forEach((b, i) => {
      const active = tabDefs[i].id === id;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
    });
    panels.forEach((p) => {
      p.hidden = p.getAttribute('data-tab') !== id;
    });
  }

  const wrap = h(
    'div',
    { class: 'customizer' },
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Gaya cepat'), presetRow, presetActions, saveForm),
    tabsNav,
    colors,
    shapes,
    logo,
    frame,
    advanced,
  );
  queueMicrotask(() => syncers.forEach((fn) => fn(store.get().style)));
  return wrap;
}

function buildPaletteGrid(): HTMLElement {
  const grid = h('div', { class: 'palette-grid' });
  for (const pal of COLOR_PALETTES) {
    const bgGrad = pal.gradient ? `linear-gradient(135deg, ${pal.fg}, ${pal.fg2})` : pal.fg;
    const dot = h('span', { class: 'palette-dot', style: `background: ${bgGrad};` });
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'palette-btn',
        onclick: () => {
          store.setStyle({
            fg: pal.fg,
            bg: pal.bg,
            transparent: false,
            gradient: !!pal.gradient,
            fg2: pal.fg2 ?? pal.fg,
            gradientType: 'linear',
            angle: pal.angle ?? 45,
            dot: (pal.dot as DotStyle) ?? store.get().style.dot,
          });
          toast(`Palet ${pal.name} dipakai.`, { kind: 'ok' });
        },
      },
      dot,
      h('span', null, pal.name),
    );
    grid.append(btn);
  }
  return grid;
}

function buildLogoGroup(): HTMLElement {
  const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'visually-hidden', id: 'logo-file' });
  const thumb = h('img', { class: 'logo-thumb', alt: 'Logo terpilih' });
  const pick = h('button', { type: 'button', class: 'btn btn-sm', onclick: () => fileInput.click() }, icon('upload'), 'Pilih gambar');
  const removeBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => store.setStyle({ logo: null }) }, icon('trash'), 'Hapus logo');
  const drop = h(
    'div',
    { class: 'dropzone' },
    thumb,
    h('div', { class: 'dropzone-text' }, h('strong', null, 'Tarik gambar ke sini'), h('span', { class: 'muted' }, 'atau'), pick),
  );

  const take = async (file: File | undefined | null) => {
    if (!file) return;
    try {
      const dataUrl = await readLogo(file);
      store.setStyle({ logo: dataUrl });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal membaca gambar.', { kind: 'error' });
    }
  };
  fileInput.addEventListener('change', () => {
    void take(fileInput.files?.[0]);
    fileInput.value = '';
  });
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    void take(e.dataTransfer?.files?.[0]);
  });

  syncers.push((s) => {
    drop.classList.toggle('has-logo', !!s.logo);
    if (s.logo) thumb.src = s.logo;
    else thumb.removeAttribute('src');
    pick.lastChild!.textContent = s.logo ? 'Ganti gambar' : 'Pilih gambar';
  });

  // Built-in Brand Icons (WA, Instagram, WiFi, Website)
  const brandIcons = [
    {
      name: 'WhatsApp',
      svg: `<svg viewBox="0 0 24 24" fill="#25D366"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.16 12.04 20.16C10.66 20.16 9.3 19.8 8.1 19.09L7.81 18.92L4.7 19.74L5.53 16.71L5.34 16.41C4.56 15.17 4.15 13.56 4.15 11.91C4.15 7.37 7.85 3.67 12.05 3.67M9.27 7.42C9.09 7.42 8.8 7.49 8.56 7.75C8.32 8.01 7.64 8.65 7.64 9.95C7.64 11.25 8.59 12.5 8.72 12.68C8.86 12.86 10.57 15.5 13.2 16.64C13.83 16.91 14.32 17.07 14.7 17.19C15.34 17.39 15.91 17.36 16.38 17.29C16.89 17.21 17.97 16.64 18.2 16C18.43 15.36 18.43 14.81 18.36 14.69C18.29 14.58 18.11 14.51 17.84 14.38C17.57 14.24 16.24 13.59 16 13.5C15.75 13.41 15.57 13.37 15.39 13.64C15.21 13.91 14.7 14.51 14.55 14.69C14.4 14.87 14.25 14.9 13.98 14.76C13.71 14.63 12.84 14.34 11.81 13.42C11.01 12.7 10.46 11.82 10.33 11.55C10.2 11.28 10.32 11.13 10.45 11C10.57 10.88 10.72 10.68 10.86 10.53C11 10.38 11.05 10.26 11.14 10.08C11.23 9.9 11.19 9.75 11.12 9.61C11.05 9.48 10.51 8.16 10.29 7.62C10.07 7.09 9.85 7.17 9.68 7.16C9.52 7.16 9.34 7.16 9.16 7.16L9.27 7.42Z"/></svg>`,
    },
    {
      name: 'Instagram',
      svg: `<svg viewBox="0 0 24 24"><defs><linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#f09433"/><stop offset="25%" stop-color="#e6683c"/><stop offset="50%" stop-color="#dc2743"/><stop offset="75%" stop-color="#cc2366"/><stop offset="100%" stop-color="#bc1888"/></linearGradient></defs><path fill="url(#ig)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`,
    },
    {
      name: 'WiFi',
      svg: `<svg viewBox="0 0 24 24" fill="#0284c7"><path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21L24 8.98C20.93 5.9 16.69 4 12 4M12 8C15.08 8 17.9 9.17 20.08 11.1L12 19.2L3.92 11.1C6.1 9.17 8.92 8 12 8Z"/></svg>`,
    },
    {
      name: 'Tautan Web',
      svg: `<svg viewBox="0 0 24 24" fill="#2563eb"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>`,
    },
  ];

  const brandGrid = h('div', { class: 'brand-grid' });
  for (const item of brandIcons) {
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'brand-btn',
        onclick: () => {
          const encoded = 'data:image/svg+xml;utf8,' + encodeURIComponent(item.svg);
          store.setStyle({ logo: encoded, logoPlate: true });
          toast(`Logo ${item.name} dipasang.`, { kind: 'ok' });
        },
      },
      svgEl(item.svg),
      h('span', null, item.name),
    );
    brandGrid.append(btn);
  }

  return h(
    'div',
    { class: 'custom-tab-panel' },
    h('span', { class: 'label' }, 'Logo siap pakai'),
    brandGrid,
    h('span', { class: 'label' }, 'Atau unggah logo sendiri'),
    fileInput,
    drop,
    h('p', { class: 'hint' }, 'PNG transparan atau SVG hasilnya paling rapi. Semua diproses di perangkatmu.'),
    showWhen(
      h(
        'div',
        { class: 'sub' },
        rangeControl('Ukuran logo', 'logoSize', 0.1, 0.3, 0.01, (v) => `${Math.round(v * 100)}%`),
        toggleControl('Latar polos di belakang logo', 'logoPlate'),
        removeBtn,
      ),
      (s) => !!s.logo,
    ),
  );
}

function requireCurrent(): Current | null {
  if (!current) {
    toast('Isi datanya dulu supaya kode QR bisa dibuat.', { kind: 'error' });
    return null;
  }
  return current;
}

function filename(c: Current, ext: string) {
  return `qr-${store.get().type}-${slug(c.label)}.${ext}`;
}

function remember(c: Current) {
  const s = store.get();
  if (!addHistory({ type: s.type, label: c.label, data: c.data, values: s.values[s.type], style: s.style })) {
    toast('Riwayat tidak bisa disimpan (penyimpanan browser penuh atau dimatikan).', { kind: 'info' });
  }
}

let busy = false;

async function withBusy(fn: () => Promise<void>) {
  if (busy) return;
  busy = true;
  document.body.classList.add('is-busy');
  try {
    await fn();
  } catch (e) {
    console.error(e);
    toast('Gagal membuat gambar. Coba ukuran yang lebih kecil.', { kind: 'error' });
  } finally {
    busy = false;
    document.body.classList.remove('is-busy');
  }
}

function doDownload() {
  const c = requireCurrent();
  if (!c) return;
  void withBusy(async () => {
    const res = await exportQr(c.data, store.get().style, exportPrefs.format, exportPrefs.size);
    const name = filename(c, res.ext);
    downloadBlob(res.blob, name);
    remember(c);
    if (res.fellBack) toast('Browser ini belum bisa membuat format itu, jadi disimpan sebagai PNG.', { kind: 'info' });
    else if (res.clamped) toast('Ukuran sedikit diperkecil supaya tidak gagal di perangkat ini.', { kind: 'info' });
    else toast(`Tersimpan: ${name}`, { kind: 'ok' });
  });
}

function doCopyImage() {
  const c = requireCurrent();
  if (!c) return;
  const blob = exportQr(c.data, store.get().style, 'png', 1024).then((r) => r.blob);
  copyImage(blob)
    .then(() => {
      remember(c);
      toast('Gambar disalin. Tinggal tempel (paste).', { kind: 'ok' });
    })
    .catch(() => toast('Browser tidak mengizinkan menyalin gambar. Pakai tombol Unduh saja.', { kind: 'error' }));
}

function doShare() {
  const c = requireCurrent();
  if (!c) return;
  void withBusy(async () => {
    const res = await exportQr(c.data, store.get().style, 'png', 1024);
    try {
      const out = await shareFile(res.blob, filename(c, 'png'), c.label);
      if (out === 'shared') remember(c);
    } catch {
      toast('Gagal membagikan. Coba Unduh lalu bagikan manual.', { kind: 'error' });
    }
  });
}

function doPrint() {
  const c = requireCurrent();
  if (!c) return;
  const area = document.getElementById('print-area');
  if (!area) return;
  const { svg } = renderSvg(c.matrix, store.get().style, { measureText });
  area.innerHTML = svg;
  area.append(h('p', { class: 'print-caption' }, c.label));
  remember(c);
  const cleanup = () => {
    area.replaceChildren();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

async function doCopyText() {
  const c = requireCurrent();
  if (!c) return;
  const ok = await copyText(c.data);
  toast(ok ? 'Isi QR disalin.' : 'Gagal menyalin.', { kind: ok ? 'ok' : 'error' });
}
