type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else if (k === 'class') {
        el.className = String(v);
      } else if (k === 'html') {
        el.innerHTML = String(v);
      } else if (k in el && typeof v !== 'string') {
        (el as unknown as Record<string, unknown>)[k] = v;
      } else {
        el.setAttribute(k, v === true ? '' : String(v));
      }
    }
  }
  append(el, children);
  return el;
}

export function append(el: Element, children: Child[]) {
  for (const c of children) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
}

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

const ICONS: Record<string, string> = {
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  text: '<path d="M5 6h14M5 12h14M5 18h9"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.7 16a5 5 0 0 1 6.6 0"/><circle cx="12" cy="19.2" r="1" fill="currentColor" stroke="none"/>',
  contact: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 17a3.5 3.5 0 0 1 7 0M15 10h3M15 14h3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
  sms: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  phone: '<path d="M6.6 3.5h2.6l1.5 4-2 1.3a11 11 0 0 0 6.5 6.5l1.3-2 4 1.5v2.6a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z"/>',
  whatsapp: '<path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.4 18.6z"/><path d="M9.2 8.6c.2 2.6 2.4 5 5 5.6l1-1.2-1.6-1-.8.6a4 4 0 0 1-2-2l.6-.8-1-1.6z" fill="currentColor" stroke="none"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  download: '<path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
  share: '<path d="M12 15V4m0 0L8 8m4-4 4 4"/><path d="M6 11H5v9h14v-9h-1"/>',
  print: '<path d="M7 9V4h10v5M7 17H4.5v-8h15v8H17"/><rect x="7" y="14" width="10" height="6"/>',
  camera: '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.7"/><path d="m4 18 5-5 4 4 2.5-2.5L20 19"/>',
  trash: '<path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l1 13h9l1-13"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="8" r=".6" fill="currentColor"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  auto: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  eyeOff: '<path d="M4 4l16 16M10 6a9 9 0 0 1 2-.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 7.6A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4-.9"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  upload: '<path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M5 20h14"/>',
  swap: '<path d="M7 4 4 7l3 3M4 7h12M17 14l3 3-3 3M20 17H8"/>',
  flash: '<path d="M13 3 6 13h5l-1 8 7-10h-5z"/>',
  locate: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  install: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 8v6m0 0-2.5-2.5M12 14l2.5-2.5M10.5 18.5h3"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><path d="M13.5 13.5h3v3h-3zM17 17h3v3h-3z"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5M12 8v4.5l3 2"/>',
  scan: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M4 12h16"/>',
  stack: '<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4.5V9H9"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5.5H4.5V6H10"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12c0 3.6 2.4 4.5 3.5 4.5 1 0 1.5.5 1.5 1.5 0 1.6 1.4 3 3 3 6.6 0 12-5.4 12-12 0-5.5-4.5-10-10-10z"/>',
  shapes: '<path d="M8.5 3.5 3 13h11L8.5 3.5z"/><circle cx="16.5" cy="7.5" r="4"/><rect x="12" y="14" width="8" height="8" rx="1.5"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3z"/>',
  frame: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 17h8"/>',
  mockup: '<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
};

export function icon(name: keyof typeof ICONS | string, cls = 'ico'): SVGSVGElement {
  const wrap = document.createElement('span');
  wrap.innerHTML = `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;
  return wrap.firstChild as SVGSVGElement;
}

export function pageHead(title: string, desc: string, ...actions: Child[]): HTMLElement {
  return h(
    'header',
    { class: 'page-head' },
    h('div', { class: 'page-head-text' }, h('h1', null, title), h('p', null, desc)),
    actions.some(Boolean) ? h('div', { class: 'page-head-actions' }, ...actions) : null,
  );
}

export function sectionHead(title: string, opts: { step?: number; desc?: Node | string; actions?: Child[] } = {}): HTMLElement {
  return h(
    'div',
    { class: 'section-head' },
    opts.step ? h('span', { class: 'step', 'aria-hidden': 'true' }, opts.step) : null,
    h('div', { class: 'section-head-text' }, h('h2', null, title), opts.desc ? (typeof opts.desc === 'string' ? h('p', null, opts.desc) : opts.desc) : null),
    opts.actions?.some(Boolean) ? h('div', { class: 'section-head-actions' }, ...opts.actions) : null,
  );
}

let toastHost: HTMLElement | null = null;

export function toast(message: string, opts: { kind?: 'ok' | 'error' | 'info'; action?: { label: string; run: () => void }; duration?: number } = {}) {
  toastHost ??= document.getElementById('toasts');
  if (!toastHost) return;
  const el = h('div', { class: `toast toast-${opts.kind ?? 'info'}`, role: opts.kind === 'error' ? 'alert' : 'status' }, h('span', null, message));
  const close = () => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 200);
  };
  if (opts.action) {
    const a = opts.action;
    el.append(h('button', { class: 'toast-action', type: 'button', onclick: () => (a.run(), close()) }, a.label));
  }
  toastHost.append(el);
  while (toastHost.children.length > 3) toastHost.firstElementChild?.remove();
  setTimeout(close, opts.duration ?? (opts.action ? 10000 : 3200));
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...a: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export function confirmDialog(message: string, confirmLabel = 'Ya, lanjut', danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    const dlg = h(
      'dialog',
      { class: 'dialog' },
      h('p', null, message),
      h(
        'form',
        { method: 'dialog', class: 'dialog-actions' },
        h('button', { class: 'btn btn-ghost', value: 'no' }, 'Batal'),
        h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, value: 'yes' }, confirmLabel),
      ),
    );
    dlg.addEventListener('close', () => {
      resolve(dlg.returnValue === 'yes');
      dlg.remove();
    });
    document.body.append(dlg);
    dlg.showModal();
  });
}
