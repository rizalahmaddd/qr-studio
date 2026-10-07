const memory = new Map<string, string>();

export function load<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    raw = memory.get(key) ?? null;
  }
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Returns false when the browser refuses (private mode, quota full). */
export function save(key: string, value: unknown): boolean {
  const raw = JSON.stringify(value);
  try {
    localStorage.setItem(key, raw);
    return true;
  } catch {
    memory.set(key, raw);
    return false;
  }
}

export function remove(key: string) {
  memory.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}
