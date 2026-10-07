import type { QrType, Values } from './lib/payload';
import { DEFAULT_STYLE, sanitizeStyle, type QrStyle } from './lib/render';
import { load, save } from './lib/storage';
import { TYPES } from './ui/schema';

export interface GenState {
  type: QrType;
  values: Record<QrType, Values>;
  style: QrStyle;
}

const DRAFT_KEY = 'qr.draft.v1';

function freshValues(): Record<QrType, Values> {
  return Object.fromEntries(TYPES.map((t) => [t.type, { ...(t.defaults ?? {}) }])) as Record<QrType, Values>;
}

function cleanValues(v: unknown): Values {
  if (!v || typeof v !== 'object') return {};
  const out: Values = {};
  for (const [k, x] of Object.entries(v)) if (typeof x === 'string' || typeof x === 'boolean') out[k] = x;
  return out;
}

function restore(): GenState {
  const saved = load<Partial<GenState> | null>(DRAFT_KEY, null);
  const values = freshValues();
  if (saved?.values) for (const t of TYPES) Object.assign(values[t.type], cleanValues(saved.values[t.type]));
  const type = TYPES.some((t) => t.type === saved?.type) ? (saved!.type as QrType) : 'url';
  return { type, values, style: sanitizeStyle(saved?.style) };
}

type Listener = (s: GenState, changed: 'type' | 'values' | 'style') => void;

let state = restore();
const listeners = new Set<Listener>();

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    // A big logo can blow the storage quota; keep the rest of the draft in that case.
    if (!save(DRAFT_KEY, state)) save(DRAFT_KEY, { ...state, style: { ...state.style, logo: null } });
  }, 400);
}

function emit(changed: 'type' | 'values' | 'style') {
  persist();
  for (const l of listeners) l(state, changed);
}

export const store = {
  get: () => state,
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  setType(type: QrType) {
    if (type === state.type) return;
    state = { ...state, type };
    emit('type');
  },
  setValue(key: string, value: string | boolean) {
    const t = state.type;
    state = { ...state, values: { ...state.values, [t]: { ...state.values[t], [key]: value } } };
    emit('values');
  },
  replaceValues(type: QrType, values: Values) {
    const def = TYPES.find((d) => d.type === type);
    state = { ...state, type, values: { ...state.values, [type]: { ...(def?.defaults ?? {}), ...cleanValues(values) } } };
    emit('type');
  },
  clearValues() {
    const def = TYPES.find((d) => d.type === state.type);
    state = { ...state, values: { ...state.values, [state.type]: { ...(def?.defaults ?? {}) } } };
    emit('type');
  },
  setStyle(patch: Partial<QrStyle>) {
    state = { ...state, style: sanitizeStyle({ ...state.style, ...patch }) };
    emit('style');
  },
  resetStyle() {
    state = { ...state, style: { ...DEFAULT_STYLE } };
    emit('style');
  },
};
