import type { QrStyle } from './render';
import { load, save } from './storage';

export interface Preset {
  id: string;
  name: string;
  style: Partial<QrStyle>;
}

const base = { gradient: false, eyeCustom: false, transparent: false, bg: '#ffffff' };

export const BUILTIN_PRESETS: Preset[] = [
  { id: 'klasik', name: 'Klasik', style: { ...base, fg: '#0f172a', dot: 'square', eyeOuter: 'square', eyeInner: 'square' } },
  { id: 'emerald', name: 'Emerald', style: { ...base, fg: '#047857', fg2: '#065f46', gradient: true, gradientType: 'linear', angle: 45, dot: 'rounded', eyeOuter: 'rounded', eyeInner: 'rounded' } },
  { id: 'laut', name: 'Samudra', style: { ...base, fg: '#0284c7', fg2: '#1d4ed8', gradient: true, gradientType: 'linear', angle: 45, dot: 'rounded', eyeOuter: 'rounded', eyeInner: 'circle' } },
  { id: 'senja', name: 'Senja', style: { ...base, fg: '#ea580c', fg2: '#c2410c', gradient: true, gradientType: 'linear', angle: 135, dot: 'dots', eyeOuter: 'rounded', eyeInner: 'rounded' } },
  { id: 'cyber', name: 'Cyberpunk', style: { ...base, fg: '#9333ea', fg2: '#db2777', gradient: true, gradientType: 'linear', angle: 90, dot: 'diamond', eyeOuter: 'circle', eyeInner: 'circle' } },
  { id: 'lembut', name: 'Minimalis', style: { ...base, fg: '#334155', dot: 'rounded', eyeOuter: 'rounded', eyeInner: 'rounded' } },
  { id: 'titik', name: 'Bintik', style: { ...base, fg: '#0f766e', dot: 'dots', eyeOuter: 'circle', eyeInner: 'circle' } },
  { id: 'garis', name: 'Monokrom', style: { ...base, fg: '#18181b', dot: 'lines', eyeOuter: 'rounded', eyeInner: 'square' } },
  { id: 'kertas', name: 'Vintage', style: { ...base, fg: '#451a03', bg: '#fef3c7', dot: 'diamond', eyeOuter: 'square', eyeInner: 'square', eyeCustom: true, eyeColor: '#b45309' } },
];

const KEY = 'qr.presets.v1';

export const listCustomPresets = () => load<Preset[]>(KEY, []);

export function addCustomPreset(name: string, style: QrStyle): boolean {
  const { logo: _logo, frameText: _t, ...rest } = style;
  const list = listCustomPresets();
  list.unshift({ id: 'u' + Date.now(), name: name.trim().slice(0, 24) || 'Gaya saya', style: rest });
  return save(KEY, list.slice(0, 12));
}

export const deleteCustomPreset = (id: string) => save(KEY, listCustomPresets().filter((p) => p.id !== id));
