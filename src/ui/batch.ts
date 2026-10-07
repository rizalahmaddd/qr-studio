import { zipSync } from 'fflate';
import { BATCH_LIMIT, parseBatch, uniqueName, type BatchParse } from '../lib/batch';
import { downloadBlob, exportQr, slug, type ExportFormat } from '../lib/export';
import { createMatrix, QrTooLongError } from '../lib/qr';
import { effectiveEcl, renderSvg } from '../lib/render';
import { store } from '../state';
import { h, icon, pageHead, sectionHead, toast } from './dom';

export function mountBatch(root: HTMLElement) {
  const input = h('textarea', {
    id: 'batch-input',
    rows: 12,
    spellcheck: 'false',
    placeholder: 'https://tokoku.com/produk-1\nhttps://tokoku.com/produk-2\nhttps://tokoku.com/produk-3',
  });
  const columns = h('input', { type: 'checkbox', id: 'batch-cols' });
  const mode = h(
    'select',
    { id: 'batch-mode' },
    h('option', { value: 'url' }, 'Tautan (https:// ditambahkan otomatis)'),
    h('option', { value: 'text' }, 'Teks apa adanya'),
  );
  const format = h(
    'select',
    { id: 'batch-format' },
    h('option', { value: 'png' }, 'PNG'),
    h('option', { value: 'svg' }, 'SVG'),
    h('option', { value: 'jpeg' }, 'JPG'),
  );
  const size = h(
    'select',
    { id: 'batch-size' },
    h('option', { value: '512' }, '512 px'),
    h('option', { value: '1024', selected: true }, '1024 px'),
    h('option', { value: '2048' }, '2048 px'),
  );
  const fileInput = h('input', { type: 'file', accept: '.csv,.tsv,.txt,text/csv,text/plain', class: 'visually-hidden' });
  const summary = h('p', { class: 'summary', 'aria-live': 'polite' });
  const problems = h('ul', { class: 'notes' });
  const sample = h('div', { class: 'batch-sample' });
  const progress = h('progress', { max: 100, value: 0, hidden: true });
  const runBtn = h('button', { type: 'button', class: 'btn btn-primary btn-block', onclick: () => run() }, icon('download'), 'Buat & unduh ZIP');
  const cancelBtn = h('button', { type: 'button', class: 'btn', hidden: true, onclick: () => (cancelled = true) }, 'Batal');

  root.append(
    pageHead('Buat banyak QR', 'Satu baris jadi satu kode QR, diunduh sekaligus dalam satu ZIP. Tampilannya mengikuti pengaturan di halaman Buat.'),
    h(
      'div',
      { class: 'split' },
      h(
        'section',
        { class: 'card' },
        sectionHead('Daftar isi', {
          step: 1,
          desc: `Tempel di sini atau unggah CSV/TXT. Maksimal ${BATCH_LIMIT} baris.`,
          actions: [h('button', { type: 'button', class: 'btn btn-sm', onclick: () => fileInput.click() }, icon('upload'), 'Unggah file'), fileInput],
        }),
        h('div', { class: 'field' }, h('label', { for: 'batch-input', class: 'visually-hidden' }, 'Daftar isi'), input),
        h('label', { class: 'check' }, columns, h('span', null, 'Baris berisi kolom nama file (isi, nama)')),
        summary,
        problems,
      ),
      h(
        'div',
        { class: 'stack' },
        h(
          'section',
          { class: 'card' },
          sectionHead('Pengaturan', { step: 2 }),
          h('div', { class: 'field' }, h('label', { for: 'batch-mode' }, 'Jenis isi'), mode),
          h(
            'div',
            { class: 'row-2' },
            h('div', { class: 'field' }, h('label', { for: 'batch-format' }, 'Format'), format),
            h('div', { class: 'field' }, h('label', { for: 'batch-size' }, 'Ukuran'), size),
          ),
          h('div', { class: 'batch-preview' }, sample, h('p', { class: 'hint' }, 'Contoh dari baris pertama, dengan tampilan saat ini.')),
          h('div', { class: 'actions' }, runBtn, cancelBtn),
          progress,
        ),
        h(
          'details',
          { class: 'card help' },
          h('summary', null, 'Contoh format CSV'),
          h('pre', { class: 'mono code-sample' }, 'isi,nama\nhttps://tokoku.com/a,produk-a\nhttps://tokoku.com/b,produk-b'),
          h('p', { class: 'hint' }, 'Kolom kedua dipakai sebagai nama file. File .csv dan .tsv otomatis dibaca dengan kolom.'),
        ),
      ),
    ),
  );

  let parsed: BatchParse = parseBatch('', { columns: false, mode: 'url' });
  let cancelled = false;

  function analyse() {
    parsed = parseBatch(input.value, { columns: columns.checked, mode: mode.value as 'text' | 'url' });
    const n = parsed.rows.length;
    const parts = [n ? `${n} kode QR siap dibuat.` : 'Belum ada isi. Tempel minimal satu baris.'];
    if (parsed.truncated) parts.push(`Hanya ${BATCH_LIMIT} baris pertama yang dipakai.`);
    if (parsed.errors.length) parts.push(`${parsed.errors.length} baris dilewati.`);
    const warnLines = new Set(parsed.warnings.map((w) => w.line)).size;
    if (warnLines) parts.push(`${warnLines} baris perlu dicek.`);
    summary.textContent = parts.join(' ');
    const items = parsed.errors.slice(0, 8).map((e) => h('li', { class: 'note note-warn' }, icon('alert'), h('span', null, `Baris ${e.line}: ${e.message}`)));
    for (const w of parsed.warnings.slice(0, Math.max(0, 8 - items.length))) {
      items.push(h('li', { class: 'note note-info' }, icon('info'), h('span', null, `Baris ${w.line}: ${w.message}`)));
    }
    if (parsed.errors.length > 8) items.push(h('li', { class: 'note note-info' }, h('span', null, `…dan ${parsed.errors.length - 8} lainnya.`)));
    problems.replaceChildren(...items);
    runBtn.disabled = n === 0;
    runBtn.lastChild!.textContent = n ? `Unduh ${n} QR (ZIP)` : 'Unduh ZIP';
    renderSample();
  }

  function renderSample() {
    const first = parsed.rows[0]?.data ?? 'https://contoh.com';
    try {
      const style = store.get().style;
      sample.innerHTML = renderSvg(createMatrix(first, effectiveEcl(style)), style).svg;
    } catch {
      sample.replaceChildren(h('p', { class: 'muted' }, 'Baris pertama terlalu panjang untuk dijadikan QR.'));
    }
  }

  input.addEventListener('input', analyse);
  columns.addEventListener('change', analyse);
  mode.addEventListener('change', analyse);
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast('File terlalu besar. Maksimal 5 MB.', { kind: 'error' });
      return;
    }
    input.value = await file.text();
    if (/\.(csv|tsv)$/i.test(file.name)) columns.checked = true;
    analyse();
  });

  async function run() {
    if (!parsed.rows.length) return;
    const style = store.get().style;
    const fmt = format.value as ExportFormat;
    const px = Number(size.value);
    const files: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
    const used = new Set<string>();
    const failed: string[] = [];
    cancelled = false;
    runBtn.disabled = true;
    cancelBtn.hidden = false;
    progress.hidden = false;
    progress.value = 0;

    for (let i = 0; i < parsed.rows.length; i++) {
      if (cancelled) break;
      const row = parsed.rows[i];
      try {
        const res = await exportQr(row.data, style, fmt, px);
        const base = uniqueName(slug(row.name || row.data, 60), used);
        files[`${base}.${res.ext}`] = [new Uint8Array(await res.blob.arrayBuffer()), { level: res.ext === 'svg' ? 6 : 0 }];
      } catch (e) {
        failed.push(`Baris ${row.line}: ${e instanceof QrTooLongError ? 'isinya terlalu panjang' : 'gagal dibuat'}`);
      }
      progress.value = Math.round(((i + 1) / parsed.rows.length) * 100);
      if (i % 5 === 4) await new Promise((r) => setTimeout(r));
    }

    runBtn.disabled = false;
    cancelBtn.hidden = true;
    progress.hidden = true;
    if (cancelled) {
      toast('Dibatalkan.', { kind: 'info' });
      return;
    }
    const count = Object.keys(files).length;
    if (!count) {
      toast('Tidak ada QR yang berhasil dibuat.', { kind: 'error' });
      return;
    }
    if (failed.length) files['yang-gagal.txt'] = [new TextEncoder().encode(failed.join('\n')), { level: 6 }];
    const zipped = zipSync(files);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(new Blob([zipped as BlobPart], { type: 'application/zip' }), `qr-banyak-${stamp}.zip`);
    toast(failed.length ? `${count} QR dibuat, ${failed.length} gagal (lihat yang-gagal.txt).` : `${count} QR berhasil dibuat.`, { kind: failed.length ? 'info' : 'ok', duration: 5000 });
  }

  analyse();
  return { onShow: renderSample };
}
