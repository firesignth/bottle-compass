const KEY = "cellar:ratings:v1";

export type RatingMap = Record<string, number>;

export function loadRatings(): RatingMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as RatingMap) : {};
  } catch {
    return {};
  }
}

export function saveRatings(map: RatingMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
}

export function setRating(id: string, stars: number): RatingMap {
  const cur = loadRatings();
  const next = { ...cur };
  if (stars <= 0) delete next[id];
  else next[id] = Math.max(1, Math.min(5, Math.round(stars)));
  saveRatings(next);
  return next;
}
