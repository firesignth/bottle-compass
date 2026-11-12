import { WINES, bottlingKey, normalizeProducer, validateWine, type Wine } from "./wines";

const KEY = "cellar:user-wines:v1";

export type AddResult =
  | { status: "added"; list: Wine[]; wine: Wine }
  | { status: "merged"; list: Wine[]; into: Wine; source: "builtin" | "user" }
  | { status: "conflict"; list: Wine[]; against: Wine; source: "builtin" | "user"; reason: string }
  | { status: "duplicate-id"; list: Wine[] }
  | { status: "invalid"; list: Wine[]; errors: string[] };

export function loadUserWines(): Wine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Drop any stored rows that no longer pass validation (schema drift,
    // manually-edited localStorage, etc.) so a bad row can't break rendering.
    return (parsed as unknown[]).filter((row) => validateWine(row).ok) as Wine[];
  } catch {
    return [];
  }
}


export function saveUserWines(list: Wine[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

function mergeUnique<T>(a: T[] | undefined, b: T[] | undefined): T[] | undefined {
  if (!a && !b) return undefined;
  return Array.from(new Set([...(a ?? []), ...(b ?? [])]));
}

function mergeInto(target: Wine, incoming: Wine): Wine {
  // Existing wins on scalars — an incoming duplicate should enrich, never
  // overwrite. Tags/notes union so festival + practice metadata from every
  // source stacks up on the canonical entry.
  return {
    ...target,
    practices: Array.from(new Set([...target.practices, ...incoming.practices])),
    festivals: mergeUnique(target.festivals, incoming.festivals),
    identities: mergeUnique(target.identities, incoming.identities),
    notes: Array.from(new Set([...target.notes, ...incoming.notes])),
    producerUrl: target.producerUrl || incoming.producerUrl,
    shopUrl: target.shopUrl || incoming.shopUrl,
    winemaker: target.winemaker || incoming.winemaker,
    // Producer name/varietal/region/type stay locked to the canonical entry
    // so a sloppy re-import can't rename or reclassify an existing wine.
  };
}

/** Same bottling but with genuinely incompatible scalars — refuse to merge. */
function bottlingScalarConflict(existing: Wine, incoming: Wine): string | null {
  if (existing.type !== incoming.type) return `type ${existing.type} vs ${incoming.type}`;
  const priceGap = Math.abs(existing.price - incoming.price);
  if (priceGap > Math.max(20, existing.price * 0.5)) {
    return `price ${existing.price} vs ${incoming.price}`;
  }
  return null;
}

/**
 * Add a user-entered wine, deduping against both built-in WINES and the
 * existing user list. Uses the same normalized producer + bottling + year
 * key as the master dedupe guard, so "Broc Cellars, Inc." collides with
 * "Broc Cellars" and "Château Margaux 2015" collides with "Chateau Margaux
 * 2015". On collision, tags/URLs from the incoming entry are merged into
 * the existing record instead of creating a duplicate producer.
 */
export function addUserWine(w: Wine): AddResult {
  const list = loadUserWines();

  // Validate the incoming row up front so malformed producer/name/year
  // fields are surfaced to the form instead of poisoning the cellar.
  const check = validateWine(w);
  if (!check.ok) {
    return { status: "invalid", list, errors: check.errors };
  }

  // Reject reuse of an existing ID (built-in or user).
  if (WINES.some((x) => x.id === w.id) || list.some((x) => x.id === w.id)) {
    return { status: "duplicate-id", list };
  }


  // Snap the producer name onto the canonical spelling already in use, so a
  // new bottling from "Martha Stoumen" doesn't split off from the existing
  // "Martha Stoumen Wines" producer entity.
  const prodKey = normalizeProducer(w.producer);
  const canonical =
    WINES.find((x) => normalizeProducer(x.producer) === prodKey)?.producer ??
    list.find((x) => normalizeProducer(x.producer) === prodKey)?.producer;
  if (canonical && canonical !== w.producer) {
    w = { ...w, producer: canonical };
  }

  const key = bottlingKey(w);

  // Collides with a built-in bottling.
  const builtin = WINES.find((x) => bottlingKey(x) === key);
  if (builtin) {
    const conflict = bottlingScalarConflict(builtin, w);
    if (conflict) {
      return { status: "conflict", list, against: builtin, source: "builtin", reason: conflict };
    }
    return { status: "merged", list, into: builtin, source: "builtin" };
  }

  // Collides with a user bottling → merge tags into the existing user entry.
  const userIdx = list.findIndex((x) => bottlingKey(x) === key);
  if (userIdx >= 0) {
    const conflict = bottlingScalarConflict(list[userIdx], w);
    if (conflict) {
      return { status: "conflict", list, against: list[userIdx], source: "user", reason: conflict };
    }
    const merged = mergeInto(list[userIdx], w);
    const next = [...list];
    next[userIdx] = merged;
    saveUserWines(next);
    return { status: "merged", list: next, into: merged, source: "user" };
  }

  const next = [w, ...list];
  saveUserWines(next);
  return { status: "added", list: next, wine: w };
}

export function removeUserWine(id: string): Wine[] {
  const next = loadUserWines().filter((w) => w.id !== id);
  saveUserWines(next);
  return next;
}

/** True if a producer name normalizes to one already in the master list. */
export function producerExistsInMaster(name: string): boolean {
  const key = normalizeProducer(name);
  return WINES.some((w) => normalizeProducer(w.producer) === key);
}
