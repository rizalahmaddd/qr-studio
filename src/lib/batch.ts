import { normalizeUrl } from './payload';

export interface BatchRow {
  line: number;
  data: string;
  name: string;
}

export interface BatchParse {
  rows: BatchRow[];
  errors: { line: number; message: string }[];
  warnings: { line: number; message: string }[];
  skippedBlank: number;
  truncated: boolean;
}

export const BATCH_LIMIT = 500;

const HEADER_WORDS = new Set(['isi', 'data', 'url', 'link', 'tautan', 'teks', 'text', 'content', 'konten', 'value']);

export function detectDelimiter(line: string): string {
  const counts = [',', ';', '\t'].map((d) => [d, splitCsvLine(line, d).length] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 1 ? counts[0][0] : ',';
}

export function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"' && cur === '') quoted = true;
    else if (ch === delim) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseBatch(text: string, opts: { columns: boolean; mode: 'text' | 'url' }): BatchParse {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const delim = opts.columns ? detectDelimiter(lines.find((l) => l.trim()) ?? '') : '';
  const rows: BatchRow[] = [];
  const errors: BatchParse['errors'] = [];
  const warnings: BatchParse['warnings'] = [];
  let skippedBlank = 0;
  let truncated = false;

  lines.forEach((raw, i) => {
    const line = i + 1;
    if (!raw.trim()) {
      if (i < lines.length - 1) skippedBlank++;
      return;
    }
    let data = raw;
    let name = '';
    if (opts.columns) {
      const cols = splitCsvLine(raw, delim);
      data = cols[0] ?? '';
      name = cols[1] ?? '';
      if (rows.length === 0 && errors.length === 0 && HEADER_WORDS.has(data.toLowerCase())) return;
    }
    if (!data.trim()) {
      errors.push({ line, message: 'Kolom isi kosong.' });
      return;
    }
    if (opts.mode === 'url') {
      const u = normalizeUrl(data);
      if (u.error) {
        errors.push({ line, message: u.error });
        return;
      }
      data = u.url;
      for (const message of u.warnings) warnings.push({ line, message });
    }
    if (rows.length >= BATCH_LIMIT) {
      truncated = true;
      return;
    }
    rows.push({ line, data, name });
  });
  return { rows, errors, warnings, skippedBlank, truncated };
}

export function uniqueName(base: string, used: Set<string>): string {
  let name = base;
  let n = 2;
  while (used.has(name)) name = `${base}-${n++}`;
  used.add(name);
  return name;
}
