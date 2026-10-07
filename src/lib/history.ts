import type { QrType, Values } from './payload';
import type { QrStyle } from './render';
import { load, remove, save } from './storage';

export interface HistoryItem {
  id: string;
  at: number;
  type: QrType;
  label: string;
  data: string;
  values: Values;
  style: QrStyle;
}

const KEY = 'qr.history.v1';
const TYPES = new Set(['url', 'text', 'wifi', 'vcard', 'email', 'sms', 'phone', 'whatsapp', 'geo', 'event']);
const MAX = 60;

export const listHistory = () => load<HistoryItem[]>(KEY, []);

export function saveHistory(items: HistoryItem[]): boolean {
  if (save(KEY, items)) return true;
  // Out of space: logos are by far the largest part, drop them from older entries first.
  const slim = items.map((it, i) => (i < 5 ? it : { ...it, style: { ...it.style, logo: null } }));
  if (save(KEY, slim)) return true;
  return save(KEY, slim.slice(0, 20).map((it) => ({ ...it, style: { ...it.style, logo: null } })));
}

const sameStyle = (a: QrStyle, b: QrStyle) => JSON.stringify(a) === JSON.stringify(b);

export function addHistory(entry: Omit<HistoryItem, 'id' | 'at'>): boolean {
  const items = listHistory();
  const existing = items.findIndex((it) => it.data === entry.data && sameStyle(it.style, entry.style));
  if (existing >= 0) items.splice(existing, 1);
  const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
  items.unshift({ ...entry, id, at: Date.now() });
  return saveHistory(items.slice(0, MAX));
}

export const deleteHistory = (id: string) => saveHistory(listHistory().filter((it) => it.id !== id));
export const clearHistory = () => remove(KEY);

export function isHistoryItem(x: unknown): x is HistoryItem {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.data === 'string' &&
    o.data.length > 0 &&
    o.data.length <= 4000 &&
    typeof o.type === 'string' &&
    TYPES.has(o.type) &&
    typeof o.at === 'number' &&
    typeof o.label === 'string' &&
    !!o.style &&
    typeof o.style === 'object'
  );
}
