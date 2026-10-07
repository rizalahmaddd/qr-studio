import { copyText, downloadBlob } from '../lib/export';
import { classifyScan, normalizeUrl, parseWifi, type ScanKind } from '../lib/payload';
import { Camera, cameraErrorMessage, decodeFrame, decodeImageFile } from '../lib/scan';
import { store } from '../state';
import { h, icon, pageHead, sectionHead, toast } from './dom';

const KIND_LABEL: Record<ScanKind, string> = {
  url: 'Tautan',
  wifi: 'WiFi',
  email: 'Email',
  phone: 'Nomor telepon',
  sms: 'SMS',
  vcard: 'Kontak',
  event: 'Acara',
  geo: 'Lokasi',
  text: 'Teks',
};

export function mountScanner(root: HTMLElement, go: (page: string) => void) {
  const cam = new Camera();
  const video = h('video', { class: 'scan-video', muted: true, playsinline: true, 'aria-label': 'Tampilan kamera' });
  const overlay = h('div', { class: 'scan-frame', 'aria-hidden': 'true' });
  const idle = h(
    'div',
    { class: 'scan-idle' },
    icon('camera', 'ico ico-xl'),
    h('p', null, 'Nyalakan kamera lalu arahkan ke kode QR.'),
  );
  const viewport = h('div', { class: 'scan-viewport' }, video, overlay, idle);

  const startBtn = h('button', { type: 'button', class: 'btn btn-primary', onclick: () => start() }, icon('camera'), 'Nyalakan kamera');
  const stopBtn = h('button', { type: 'button', class: 'btn', hidden: true, onclick: () => stop() }, 'Matikan');
  const switchBtn = h('button', { type: 'button', class: 'btn', hidden: true, onclick: () => switchCam() }, icon('swap'), 'Ganti kamera');
  const torchBtn = h('button', { type: 'button', class: 'btn', hidden: true, 'aria-pressed': 'false', onclick: () => toggleTorch() }, icon('flash'), 'Senter');

  const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'visually-hidden', id: 'scan-file' });
  const fileBtn = h('button', { type: 'button', class: 'btn', onclick: () => fileInput.click() }, icon('image'), 'Pindai dari gambar');

  const result = h('section', { class: 'card scan-result', 'aria-live': 'polite' });
  const resetResult = () =>
    result.replaceChildren(
      sectionHead('Hasil'),
      h(
        'div',
        { class: 'empty' },
        icon('scan', 'ico ico-xl'),
        h('strong', null, 'Belum ada yang dipindai'),
        h('span', null, 'Isi kode QR akan muncul di sini, lengkap dengan tombol untuk membuka, menyalin, atau mengubahnya.'),
      ),
    );
  resetResult();

  const dropCard = h(
    'section',
    { class: 'card scan-card' },
    viewport,
    h('div', { class: 'actions' }, startBtn, stopBtn, switchBtn, torchBtn, fileBtn, fileInput),
    h('p', { class: 'hint' }, 'Bisa juga tarik gambar ke kotak ini, atau tempel (Ctrl/⌘ + V) tangkapan layar.'),
  );

  root.append(
    pageHead('Pindai kode QR', 'Baca kode QR dari kamera atau gambar. Kamera hanya dipakai di perangkatmu.'),
    h('div', { class: 'split split-even' }, dropCard, result),
  );

  let running = false;
  let torchOn = false;
  let frameCount = 0;

  async function start(deviceId?: string) {
    if (!cam.supported) {
      toast(cameraErrorMessage(null), { kind: 'error' });
      return;
    }
    startBtn.disabled = true;
    try {
      await cam.start(video, deviceId);
    } catch (e) {
      startBtn.disabled = false;
      toast(cameraErrorMessage(e), { kind: 'error', duration: 6000 });
      return;
    }
    startBtn.disabled = false;
    running = true;
    viewport.classList.add('live');
    startBtn.hidden = true;
    stopBtn.hidden = false;
    torchOn = false;
    torchBtn.hidden = !cam.canTorch();
    torchBtn.setAttribute('aria-pressed', 'false');
    switchBtn.hidden = (await cam.cameras()).length < 2;
    loop();
  }

  function stop() {
    running = false;
    cam.stop();
    video.srcObject = null;
    viewport.classList.remove('live');
    startBtn.hidden = false;
    stopBtn.hidden = switchBtn.hidden = torchBtn.hidden = true;
  }

  async function switchCam() {
    const list = await cam.cameras();
    if (list.length < 2) return;
    const i = list.findIndex((d) => d.deviceId === cam.deviceId);
    await start(list[(i + 1) % list.length].deviceId);
  }

  async function toggleTorch() {
    try {
      torchOn = !torchOn;
      await cam.setTorch(torchOn);
      torchBtn.setAttribute('aria-pressed', String(torchOn));
    } catch {
      torchOn = false;
      toast('Senter tidak bisa dinyalakan di kamera ini.', { kind: 'error' });
    }
  }

  async function loop() {
    if (!running) return;
    frameCount++;
    // Inverted codes are rare; checking them every third frame keeps slow phones responsive.
    const found = await decodeFrame(video, frameCount % 3 === 0).catch(() => null);
    if (!running) return;
    if (found != null) {
      navigator.vibrate?.(60);
      stop();
      show(found);
      return;
    }
    setTimeout(() => requestAnimationFrame(loop), 120);
  }

  async function fromFile(file: Blob | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('File ini bukan gambar.', { kind: 'error' });
      return;
    }
    try {
      const data = await decodeImageFile(file);
      if (data == null) toast('Tidak ada kode QR yang terbaca di gambar itu. Coba gambar yang lebih jelas atau lebih dekat.', { kind: 'error', duration: 6000 });
      else {
        stop();
        show(data);
      }
    } catch {
      toast('Gambar tidak bisa dibuka.', { kind: 'error' });
    }
  }

  fileInput.addEventListener('change', () => {
    void fromFile(fileInput.files?.[0]);
    fileInput.value = '';
  });
  dropCard.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropCard.classList.add('over');
  });
  dropCard.addEventListener('dragleave', () => dropCard.classList.remove('over'));
  dropCard.addEventListener('drop', (e) => {
    e.preventDefault();
    dropCard.classList.remove('over');
    void fromFile(e.dataTransfer?.files?.[0]);
  });
  window.addEventListener('paste', (e) => {
    if (root.hidden) return;
    const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
    if (item) void fromFile(item.getAsFile());
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running) stop();
  });

  function show(data: string) {
    const kind = classifyScan(data);
    const body: Node[] = [];
    const actions: Node[] = [];
    const copyBtn = (label: string, text: string) =>
      h(
        'button',
        {
          type: 'button',
          class: 'btn',
          onclick: async () => {
            const ok = await copyText(text);
            toast(ok ? 'Disalin.' : 'Gagal menyalin.', { kind: ok ? 'ok' : 'error' });
          },
        },
        icon('copy'),
        label,
      );
    const editBtn = (run: () => void) =>
      h(
        'button',
        {
          type: 'button',
          class: 'btn',
          onclick: () => {
            run();
            go('buat');
          },
        },
        icon('edit'),
        'Ubah di pembuat',
      );

    if (kind === 'url') {
      const check = normalizeUrl(data);
      body.push(h('p', { class: 'scan-data mono' }, data));
      for (const w of check.warnings) body.push(h('p', { class: 'note note-warn' }, icon('alert'), h('span', null, w)));
      body.push(h('p', { class: 'hint' }, 'Periksa alamatnya dulu sebelum membuka. QR bisa saja mengarah ke situs palsu.'));
      actions.push(
        h('a', { class: 'btn btn-primary', href: data, target: '_blank', rel: 'noopener noreferrer' }, icon('external'), 'Buka tautan'),
        copyBtn('Salin', data),
        editBtn(() => store.replaceValues('url', { url: data })),
      );
    } else if (kind === 'wifi') {
      const w = parseWifi(data);
      if (w) {
        body.push(
          h(
            'dl',
            { class: 'kv' },
            h('dt', null, 'Nama WiFi'),
            h('dd', null, w.ssid || '—'),
            h('dt', null, 'Kata sandi'),
            h('dd', { class: 'mono' }, w.password || '(tanpa kata sandi)'),
            h('dt', null, 'Keamanan'),
            h('dd', null, w.security === 'nopass' ? 'Terbuka' : w.security),
          ),
        );
        if (w.password) actions.push(copyBtn('Salin kata sandi', w.password));
        actions.push(editBtn(() => store.replaceValues('wifi', { ...w })));
      } else body.push(h('pre', { class: 'scan-data mono' }, data));
    } else {
      body.push(h('pre', { class: 'scan-data mono' }, data));
      const open = openable(kind, data);
      if (open) actions.push(h('a', { class: 'btn btn-primary', href: open.href }, icon('external'), open.label));
      if (kind === 'vcard' && /^BEGIN:VCARD/i.test(data.trim())) {
        actions.push(h('button', { type: 'button', class: 'btn btn-primary', onclick: () => downloadBlob(new Blob([data], { type: 'text/vcard' }), 'kontak.vcf') }, icon('download'), 'Simpan kontak'));
      }
      if (kind === 'event') {
        const ics = /BEGIN:VCALENDAR/i.test(data) ? data : `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${data.trim()}\r\nEND:VCALENDAR`;
        actions.push(h('button', { type: 'button', class: 'btn btn-primary', onclick: () => downloadBlob(new Blob([ics], { type: 'text/calendar' }), 'acara.ics') }, icon('calendar'), 'Tambah ke kalender'));
      }
      actions.push(copyBtn('Salin', data), editBtn(() => store.replaceValues('text', { text: data })));
    }

    result.replaceChildren(
      sectionHead(KIND_LABEL[kind], {
        desc: 'Hasil pindai',
        actions: [h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => (resetResult(), void start()) }, icon('scan'), 'Pindai lagi')],
      }),
      ...body,
      h('div', { class: 'actions' }, ...actions),
    );
    if (matchMedia('(max-width: 960px)').matches) result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return {
    onHide: () => stop(),
  };
}

function openable(kind: ScanKind, data: string): { href: string; label: string } | null {
  const t = data.trim();
  if (kind === 'email' && /^mailto:/i.test(t)) return { href: t, label: 'Tulis email' };
  if (kind === 'phone') return { href: t, label: 'Telepon' };
  if (kind === 'geo') return { href: t, label: 'Buka peta' };
  if (kind === 'sms') {
    const m = t.match(/^smsto:([^:]*):?([\s\S]*)$/i);
    if (m) return { href: `sms:${m[1]}${m[2] ? `?body=${encodeURIComponent(m[2])}` : ''}`, label: 'Kirim SMS' };
    return { href: t, label: 'Kirim SMS' };
  }
  return null;
}
