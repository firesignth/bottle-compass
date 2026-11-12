const KEY = "cellar:tried:v1";

export function loadTried(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function saveTried(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {}
}

export function toggleTried(id: string): string[] {
  const cur = loadTried();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  saveTried(next);
  return next;
}
