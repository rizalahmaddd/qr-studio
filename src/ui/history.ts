import { clearHistory, deleteHistory, isHistoryItem, listHistory, saveHistory, type HistoryItem } from '../lib/history';
import { downloadBlob, exportQr, slug } from '../lib/export';
import { createMatrix } from '../lib/qr';
import { effectiveEcl, renderSvg, sanitizeStyle } from '../lib/render';
import { store } from '../state';
import { confirmDialog, h, icon, pageHead, toast } from './dom';
import { typeDef } from './schema';

const fmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

export function mountHistory(root: HTMLElement, go: (page: string) => void) {
  const search = h('input', { type: 'search', placeholder: 'Cari riwayat…', 'aria-label': 'Cari riwayat' });
  const list = h('ul', { class: 'history-list' });
  const importInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden' });
  const exportBtn = h('button', { type: 'button', class: 'btn btn-sm', onclick: () => exportAll() }, icon('download'), 'Cadangkan');
  const importBtn = h('button', { type: 'button', class: 'btn btn-sm', onclick: () => importInput.click() }, icon('upload'), 'Pulihkan');
  const clearBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm btn-danger-text', 'aria-label': 'Hapus semua riwayat', title: 'Hapus semua riwayat', onclick: () => clearAll() }, icon('trash'), 'Hapus semua');

  const searchWrap = h('div', { class: 'search' }, icon('search'), search);

  root.append(
    pageHead('Riwayat', 'QR yang kamu unduh, salin, bagikan, atau cetak tersimpan di sini, hanya di perangkat ini.', exportBtn, importBtn, clearBtn, importInput),
    h('section', { class: 'card' }, searchWrap, list),
  );

  search.addEventListener('input', () => render());

  function render() {
    const items = listHistory();
    const q = search.value.trim().toLowerCase();
    const shown = q ? items.filter((it) => (it.label + ' ' + it.data).toLowerCase().includes(q)) : items;
    exportBtn.hidden = clearBtn.hidden = items.length === 0;
    searchWrap.hidden = items.length < 4;

    if (!items.length) {
      list.replaceChildren(
        h(
          'li',
          { class: 'empty' },
          icon('history', 'ico ico-xl'),
          h('strong', null, 'Belum ada riwayat'),
          h('span', null, 'Setiap kode QR yang kamu unduh, salin, bagikan, atau cetak akan muncul di sini.'),
          h('button', { type: 'button', class: 'btn btn-primary', onclick: () => go('buat') }, 'Buat kode QR'),
        ),
      );
      return;
    }
    if (!shown.length) {
      list.replaceChildren(
        h('li', { class: 'empty' }, h('strong', null, 'Tidak ditemukan'), h('span', null, `Tidak ada riwayat yang cocok dengan "${search.value}".`)),
      );
      return;
    }
    list.replaceChildren(...shown.map(row));
  }

  function row(it: HistoryItem): HTMLElement {
    const style = sanitizeStyle(it.style);
    const thumb = h('div', { class: 'history-thumb', 'aria-hidden': 'true' });
    try {
      thumb.innerHTML = renderSvg(createMatrix(it.data, effectiveEcl(style)), style).svg;
    } catch {
      thumb.append(icon('alert'));
    }
    const def = typeDef(it.type);
    const label = it.label || def.label;
    return h(
      'li',
      { class: 'history-item' },
      thumb,
      h('div', { class: 'history-info' }, h('strong', null, label), h('span', { class: 'muted' }, `${def.label} · ${fmt.format(it.at)}`)),
      h(
        'div',
        { class: 'history-actions' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-sm',
            onclick: () => {
              store.replaceValues(it.type, it.values ?? {});
              store.setStyle(style);
              go('buat');
              toast('Dibuka di halaman Buat.', { kind: 'ok' });
            },
          },
          icon('edit'),
          'Buka',
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-sm btn-icon',
            'aria-label': `Unduh ${label}`,
            title: 'Unduh PNG',
            onclick: async () => {
              try {
                const res = await exportQr(it.data, style, 'png', 1024);
                downloadBlob(res.blob, `qr-${it.type}-${slug(label)}.png`);
              } catch {
                toast('Gagal mengunduh.', { kind: 'error' });
              }
            },
          },
          icon('download'),
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-ghost btn-sm btn-icon',
            'aria-label': `Hapus ${label}`,
            title: 'Hapus',
            onclick: () => {
              deleteHistory(it.id);
              render();
            },
          },
          icon('trash'),
        ),
      ),
    );
  }

  function exportAll() {
    const items = listHistory();
    const blob = new Blob([JSON.stringify({ app: 'qr-studio', version: 1, items }, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `riwayat-qr-${new Date().toISOString().slice(0, 10)}.json`);
  }

  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    importInput.value = '';
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const incoming = (Array.isArray(json) ? json : json?.items) as unknown;
      if (!Array.isArray(incoming)) throw new Error();
      const valid = incoming.filter(isHistoryItem);
      if (!valid.length) throw new Error();
      const existing = listHistory();
      const ids = new Set(existing.map((i) => i.id));
      const merged = [...existing, ...valid.filter((i) => !ids.has(i.id))].sort((a, b) => b.at - a.at).slice(0, 60);
      if (!saveHistory(merged)) toast('Penyimpanan browser penuh. Sebagian riwayat mungkin tidak tersimpan.', { kind: 'error' });
      else toast(`${valid.length} riwayat dipulihkan.`, { kind: 'ok' });
      render();
    } catch {
      toast('File ini bukan cadangan riwayat yang valid.', { kind: 'error' });
    }
  });

  async function clearAll() {
    if (!(await confirmDialog('Hapus semua riwayat? Ini tidak bisa dibatalkan.', 'Hapus semua', true))) return;
    clearHistory();
    render();
  }

  return { onShow: render };
}
