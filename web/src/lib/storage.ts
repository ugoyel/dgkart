/**
 * localStorage that never throws (private windows, blocked storage) and
 * falls back to memory, so the site always works.
 */
const memory = new Map<string, string>();

function raw(): Storage | null {
  try {
    const s = window.localStorage;
    s.setItem('dg.probe', '1');
    s.removeItem('dg.probe');
    return s;
  } catch {
    return null;
  }
}

const backend = typeof window === 'undefined' ? null : raw();

export const store = {
  get<T>(key: string): T | null {
    try {
      const v = backend ? backend.getItem(key) : memory.get(key) ?? null;
      return v == null ? null : (JSON.parse(v) as T);
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    const v = JSON.stringify(value);
    try {
      if (backend) backend.setItem(key, v);
      else memory.set(key, v);
    } catch {
      memory.set(key, v);
    }
  },
  remove(key: string) {
    try {
      backend?.removeItem(key);
    } catch {
      /* ignore */
    }
    memory.delete(key);
  },
};
