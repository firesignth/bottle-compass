/**
 * Saved search presets — a named snapshot of the current filter state
 * (prefs + enabled sections + sort mode), persisted in localStorage.
 */

export const PRESETS_KEY = "cellar:presets:v1";

export interface SearchPreset<S = unknown> {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  state: S;
}

function readRaw(): SearchPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is SearchPreset =>
        !!p && typeof p === "object" && typeof p.id === "string" && typeof p.name === "string",
    );
  } catch {
    return [];
  }
}

function write(list: SearchPreset[]): SearchPreset[] {
  if (typeof window === "undefined") return list;
  try {
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
  } catch {}
  return list;
}

export function loadPresets<S = unknown>(): SearchPreset<S>[] {
  return readRaw().sort((a, b) => a.name.localeCompare(b.name)) as SearchPreset<S>[];
}

function makeId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Save a preset. If a preset with the same (case-insensitive) name exists,
 * it is overwritten in place so re-saving updates rather than duplicates.
 */
export function savePreset<S>(name: string, state: S): SearchPreset<S>[] {
  const clean = name.trim();
  if (!clean) return loadPresets<S>();
  const list = readRaw();
  const now = Date.now();
  const idx = list.findIndex((p) => p.name.trim().toLowerCase() === clean.toLowerCase());
  if (idx >= 0) {
    list[idx] = { ...list[idx], name: clean, state, updatedAt: now };
  } else {
    list.push({ id: makeId(), name: clean, createdAt: now, updatedAt: now, state });
  }
  write(list);
  return loadPresets<S>();
}

export function deletePreset<S = unknown>(id: string): SearchPreset<S>[] {
  write(readRaw().filter((p) => p.id !== id));
  return loadPresets<S>();
}

export function renamePreset<S = unknown>(id: string, name: string): SearchPreset<S>[] {
  const clean = name.trim();
  if (!clean) return loadPresets<S>();
  const list = readRaw().map((p) => (p.id === id ? { ...p, name: clean, updatedAt: Date.now() } : p));
  write(list);
  return loadPresets<S>();
}

export function getPreset<S = unknown>(id: string): SearchPreset<S> | undefined {
  return readRaw().find((p) => p.id === id) as SearchPreset<S> | undefined;
}
