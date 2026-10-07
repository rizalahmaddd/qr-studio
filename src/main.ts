import '@fontsource-variable/plus-jakarta-sans';
import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { load, save } from './lib/storage';
import { store } from './state';
import { mountBatch } from './ui/batch';
import { $, icon, toast } from './ui/dom';
import { mountGenerator } from './ui/generator';
import { mountHistory } from './ui/history';
import { mountScanner } from './ui/scan';

type Page = 'buat' | 'banyak' | 'pindai' | 'riwayat';
const PAGES: Record<Page, { title: string; icon: string }> = {
  buat: { title: 'Buat', icon: 'grid' },
  banyak: { title: 'Buat banyak', icon: 'stack' },
  pindai: { title: 'Pindai', icon: 'scan' },
  riwayat: { title: 'Riwayat', icon: 'history' },
};

const go = (page: string) => {
  if (location.hash.slice(1) === page) show();
  else location.hash = page;
};

const generator = mountGenerator($('#page-buat'));
const batch = mountBatch($('#page-banyak'));
const scanner = mountScanner($('#page-pindai'), go);
const historyPage = mountHistory($('#page-riwayat'), go);

for (const a of document.querySelectorAll<HTMLAnchorElement>('.tabs a')) {
  const p = PAGES[a.dataset.page as Page];
  if (p) a.prepend(icon(p.icon));
}

let currentPage: Page | null = null;

function show() {
  const raw = location.hash.slice(1) as Page;
  const page: Page = raw in PAGES ? raw : 'buat';
  if (page === currentPage) return;
  if (currentPage === 'pindai') scanner.onHide();
  const first = currentPage === null;
  currentPage = page;
  for (const key of Object.keys(PAGES) as Page[]) {
    $(`#page-${key}`).hidden = key !== page;
  }
  for (const a of document.querySelectorAll<HTMLAnchorElement>('.tabs a')) {
    if (a.dataset.page === page) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  document.title = page === 'buat' ? 'QR Studio — Buat kode QR gratis' : `${PAGES[page].title} · QR Studio`;
  if (page === 'riwayat') historyPage.onShow();
  if (page === 'banyak') batch.onShow();
  if (!first) window.scrollTo({ top: 0 });
}
window.addEventListener('hashchange', show);
show();

type Theme = 'auto' | 'light' | 'dark';
const THEME_LABEL: Record<Theme, string> = { auto: 'Tema: ikut perangkat', light: 'Tema: terang', dark: 'Tema: gelap' };
const themeBtn = $<HTMLButtonElement>('#theme-btn');
let theme = load<Theme>('qr.theme', 'auto');

function applyTheme() {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.dataset.theme = theme;
  themeBtn.replaceChildren(icon(theme === 'auto' ? 'auto' : theme === 'dark' ? 'moon' : 'sun'));
  themeBtn.setAttribute('aria-label', THEME_LABEL[theme]);
  themeBtn.title = THEME_LABEL[theme];
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name="theme-color"]')?.setAttribute('content', dark ? '#121513' : '#f6f5f1');
}
themeBtn.addEventListener('click', () => {
  theme = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
  save('qr.theme', theme);
  applyTheme();
  toast(THEME_LABEL[theme]);
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
applyTheme();

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const installBtn = $<HTMLButtonElement>('#install-btn');
installBtn.prepend(icon('install'));
let deferredInstall: InstallPromptEvent | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e as InstallPromptEvent;
  installBtn.hidden = false;
});
installBtn.addEventListener('click', async () => {
  if (!deferredInstall) return;
  await deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  installBtn.hidden = true;
});
window.addEventListener('appinstalled', () => {
  installBtn.hidden = true;
  toast('Aplikasi terpasang. Bisa dibuka dari layar utama.', { kind: 'ok' });
});

const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone) {
  $('#ios-tip').hidden = false;
}

const params = new URLSearchParams(location.search);
const shared = [params.get('url'), params.get('text'), params.get('title')].find((v) => v && v.trim());
if (shared) {
  const link = shared.match(/https?:\/\/\S+/)?.[0];
  if (link) store.replaceValues('url', { url: link });
  else store.replaceValues('text', { text: shared });
  history.replaceState(null, '', location.pathname + '#buat');
  show();
  toast('Isi dari aplikasi lain sudah dimasukkan.', { kind: 'ok' });
} else if (params.has('jenis')) {
  const t = params.get('jenis');
  if (t === 'wifi' || t === 'url' || t === 'text' || t === 'vcard' || t === 'whatsapp') store.setType(t);
  history.replaceState(null, '', location.pathname + location.hash);
}

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && currentPage === 'buat') {
    e.preventDefault();
    generator.shortcutDownload();
  }
});

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
} else {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      location.reload();
    },
  });
}

window.addEventListener('offline', () => toast('Kamu sedang offline. Semua fitur tetap jalan.'));

