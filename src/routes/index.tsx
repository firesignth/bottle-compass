import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FESTIVALS,
  FLAVOR_NOTES,
  IDENTITIES,
  PRACTICES,
  WINES,
  buyUrl,
  festivalLabel,
  festivalsForProducer,
  learnMoreUrl,
  producerSlug,
  type Festival,
  type Identity,
  type Practice,
  type Wine,
  type WineType,
} from "@/lib/wines";
import {
  FOODS,
  OCCASIONS,
  SEASONS,
  WEATHERS,
  foodTagsFor,
  occasionsFor,
  seasonsFor,
  weatherFor,
  type FoodTag,
  type Occasion,
  type Season,
  type Weather,
} from "@/lib/wine-context";
import { loadUserWines } from "@/lib/user-wines";
import { AddWineDialog } from "@/components/AddWineDialog";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { loadFavorites, toggleFavorite as toggleFavoriteStore } from "@/lib/favorites";
import { loadTried, toggleTried as toggleTriedStore } from "@/lib/tried";
import { loadRatings, setRating as setRatingStore } from "@/lib/ratings";
import { exportMatchesCSV, exportMatchesPDF } from "@/lib/export-matches";
import {
  loadPresets,
  savePreset,
  deletePreset,
  type SearchPreset,
} from "@/lib/presets";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  RADIUS_OPTIONS,
  coordsForRegion,
  distanceToWineMiles,
  haversineMiles,
  loadStoredCoords,
  requestBrowserLocation,
  storeCoords,
  type LatLng,
  type RadiusMiles,
} from "@/lib/geo";




export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bottle Compass — Know what's in your glass." },
      {
        name: "description",
        content:
          "Filter wines by taste and by how they're made — organic, biodynamic, natural, low-intervention, native-yeast — and get a personal shortlist.",
      },
      { property: "og:title", content: "Bottle Compass — Know what's in your glass." },
      {
        property: "og:description",
        content:
          "Filter by taste and by how the wine is made — organic, biodynamic, natural, native-yeast.",
      },
    ],
  }),
  component: Index,
});

const TYPES: { value: WineType | "any"; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "red", label: "Red" },
  { value: "white", label: "White" },
  { value: "orange", label: "Orange / skin-contact" },
  { value: "rosé", label: "Rosé" },
  { value: "sparkling", label: "Sparkling" },
  { value: "dessert", label: "Dessert" },
];

export type Importance = "must" | "curious";

export const IMPORTANCE: {
  value: Importance;
  label: string;
  short: string;
  blurb: string;
}[] = [
  { value: "must", label: "Very important", short: "Must", blurb: "Hard filter — exclude anything that doesn't match." },
  { value: "curious", label: "Just curious", short: "Curious", blurb: "Tiny nudge only — don't shape the results much." },
];

const IMP_WEIGHT: Record<Importance, number> = { must: 1, curious: 0.2 };

export interface Prefs {
  type: WineType | "any";
  body: number;
  sweetness: number;
  acidity: number;
  tannin: number;
  minPrice: number;
  maxPrice: number;
  minYear: number;
  maxYear: number;
  varietals: string[];
  notes: string[];
  practices: Practice[];
  practicesMode: "any" | "all";
  appellations: string[];
  countries: string[];
  festivals: Festival[];
  identities: Identity[];
  seasons: Season[];
  weathers: Weather[];
  occasions: Occasion[];
  foods: FoodTag[];
  producers: string[];
  search: string;
  radiusMiles: RadiusMiles;
  nearMeCoords: LatLng | null;
  tasteImp: Importance;
  notesImp: Importance;
  varietalsImp: Importance;
  practicesImp: Importance;
  regionImp: Importance;
  festivalsImp: Importance;
  identitiesImp: Importance;
  contextImp: Importance;
  producersImp: Importance;
}


export const parseRegion = (r: string) => {
  const parts = r.split(",").map((s) => s.trim());
  return { appellation: parts[0], country: parts[parts.length - 1] };
};

const ALL_APPELLATIONS = Array.from(
  new Set(WINES.map((w) => parseRegion(w.region).appellation)),
).sort();
const ALL_COUNTRIES = Array.from(
  new Set(WINES.map((w) => parseRegion(w.region).country)),
).sort();
const ALL_PRODUCERS = Array.from(new Set(WINES.map((w) => w.producer))).sort(
  (a, b) => a.localeCompare(b),
);
export const ALL_VARIETALS = Array.from(new Set(WINES.map((w) => w.varietal))).sort(
  (a, b) => a.localeCompare(b),
);

const YEARS = WINES.map((w) => w.year).filter((y) => Number.isFinite(y));
export const YEAR_MIN = YEARS.length ? Math.min(...YEARS) : 1990;
export const YEAR_MAX = YEARS.length ? Math.max(...YEARS) : new Date().getFullYear();

export const DEFAULTS: Prefs = {
  type: "any",
  body: 3,
  sweetness: 2,
  acidity: 3,
  tannin: 3,
  minPrice: 0,
  maxPrice: 200,
  minYear: YEAR_MIN,
  maxYear: YEAR_MAX,
  varietals: [],
  notes: [],
  practices: [],
  practicesMode: "all",
  appellations: [],
  countries: [],
  festivals: [],
  identities: [],
  seasons: [],
  weathers: [],
  occasions: [],
  foods: [],
  producers: [],
  search: "",
  radiusMiles: 40,
  nearMeCoords: null,
  tasteImp: "curious",
  notesImp: "curious",
  varietalsImp: "must",
  practicesImp: "must",
  regionImp: "curious",
  festivalsImp: "curious",
  identitiesImp: "curious",
  contextImp: "curious",
  producersImp: "must",
};

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

// Typo-tolerant token match: each query token must approximately match
// some token in the haystack (substring OR edit distance within a
// length-scaled threshold: 1 typo up to 4 chars, 2 up to 7, else 3).
function fuzzyMatch(haystack: string, query: string): boolean {
  const hay = haystack.toLowerCase();
  const qTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!qTokens.length) return true;
  const hayTokens = hay.split(/[^a-z0-9]+/).filter(Boolean);
  return qTokens.every((qt) => {
    if (hay.includes(qt)) return true;
    const tol = qt.length <= 4 ? 1 : qt.length <= 7 ? 2 : 3;
    return hayTokens.some((ht) => {
      if (Math.abs(ht.length - qt.length) > tol) return false;
      return editDistance(ht, qt) <= tol;
    });
  });
}

export function scoreWine(w: Wine, p: Prefs, en: Record<string, boolean>) {
  if (en.type && p.type !== "any" && w.type !== p.type) return -1;
  if (en.price && (w.price < p.minPrice || w.price > p.maxPrice)) return -1;
  if (en.vintage && (w.year < p.minYear || w.year > p.maxYear)) return -1;

  if (en.search) {
    const query = p.search.trim();
    if (query) {
      const hay = `${w.name} ${w.producer} ${w.winemaker ?? ""}`;
      if (!fuzzyMatch(hay, query)) return -1;
    }
  }

  if (en.nearMe && p.nearMeCoords) {
    const d = distanceToWineMiles(p.nearMeCoords, w.region);
    if (d == null || d > p.radiusMiles) return -1;
  }


  const { appellation, country } = parseRegion(w.region);
  const regionActive =
    en.region && (p.appellations.length > 0 || p.countries.length > 0);
  const regionMatch =
    regionActive &&
    (p.appellations.includes(appellation) || p.countries.includes(country));
  if (regionActive && p.regionImp === "must" && !regionMatch) return -1;

  const practicesActive = en.practices && p.practices.length > 0;
  const practiceMatchCount = practicesActive
    ? p.practices.filter((x) => w.practices.includes(x)).length
    : 0;
  const practicesFullMatch = practiceMatchCount === p.practices.length;
  const practicesAnyMatch = practiceMatchCount > 0;
  if (practicesActive && p.practicesImp === "must") {
    if (p.practicesMode === "all" && !practicesFullMatch) return -1;
    if (p.practicesMode === "any" && !practicesAnyMatch) return -1;
  }

  const notesActive = en.notes && p.notes.length > 0;
  const noteMatched = notesActive
    ? p.notes.filter((n) => w.notes.includes(n)).length
    : 0;
  if (notesActive && p.notesImp === "must" && noteMatched === 0) return -1;

  const wFestivals = w.festivals ?? [];
  const wIdentities = w.identities ?? [];

  const festivalsActive = en.festivals && p.festivals.length > 0;
  const festivalMatchCount = festivalsActive
    ? p.festivals.filter((f) => wFestivals.includes(f)).length
    : 0;
  if (festivalsActive && p.festivalsImp === "must" && festivalMatchCount === 0)
    return -1;

  const identitiesActive = en.identities && p.identities.length > 0;
  const identityMatchCount = identitiesActive
    ? p.identities.filter((i) => wIdentities.includes(i)).length
    : 0;
  if (identitiesActive && p.identitiesImp === "must" && identityMatchCount === 0)
    return -1;

  const producersActive = en.producers && p.producers.length > 0;
  const producerMatch = producersActive && p.producers.includes(w.producer);
  if (producersActive && p.producersImp === "must" && !producerMatch) return -1;

  const varietalsActive = en.varietal && p.varietals.length > 0;
  const varietalMatch =
    varietalsActive &&
    p.varietals.some((v) => {
      const a = w.varietal.toLowerCase();
      const b = v.toLowerCase();
      return a === b || a.includes(b) || b.includes(a);
    });
  if (varietalsActive && p.varietalsImp === "must" && !varietalMatch) return -1;

  const wSeasons = seasonsFor(w);
  const wWeather = weatherFor(w);
  const wOccasions = occasionsFor(w);
  const wFoods = foodTagsFor(w);

  const seasonsActive = en.context && p.seasons.length > 0;
  const seasonMatchCount = seasonsActive
    ? p.seasons.filter((s) => wSeasons.includes(s)).length
    : 0;
  const weathersActive = en.context && p.weathers.length > 0;
  const weatherMatchCount = weathersActive
    ? p.weathers.filter((s) => wWeather.includes(s)).length
    : 0;
  const occasionsActive = en.context && p.occasions.length > 0;
  const occasionMatchCount = occasionsActive
    ? p.occasions.filter((s) => wOccasions.includes(s)).length
    : 0;
  const foodsActive = en.context && p.foods.length > 0;
  const foodMatchCount = foodsActive
    ? p.foods.filter((s) => wFoods.includes(s)).length
    : 0;

  if (en.context && p.contextImp === "must") {
    if (seasonsActive && seasonMatchCount === 0) return -1;
    if (weathersActive && weatherMatchCount === 0) return -1;
    if (occasionsActive && occasionMatchCount === 0) return -1;
    if (foodsActive && foodMatchCount < p.foods.length) return -1;
  }

  const traitDiff = en.taste
    ? Math.abs(w.body - p.body) +
      Math.abs(w.sweetness - p.sweetness) +
      Math.abs(w.acidity - p.acidity) +
      (w.type === "red" ? Math.abs(w.tannin - p.tannin) : 0)
    : 0;

  const tasteScore = en.taste ? (20 - traitDiff) * IMP_WEIGHT[p.tasteImp] : 0;
  const noteBonus = notesActive
    ? (noteMatched / p.notes.length) * 10 * IMP_WEIGHT[p.notesImp]
    : 0;
  const practiceBonus = practicesActive
    ? practiceMatchCount * 2 * IMP_WEIGHT[p.practicesImp]
    : 0;
  const regionBonus = regionActive && regionMatch ? 6 * IMP_WEIGHT[p.regionImp] : 0;
  const festivalBonus = festivalsActive
    ? festivalMatchCount * 4 * IMP_WEIGHT[p.festivalsImp]
    : 0;
  const identityBonus = identitiesActive
    ? identityMatchCount * 5 * IMP_WEIGHT[p.identitiesImp]
    : 0;
  const contextBonus = en.context
    ? (seasonMatchCount + weatherMatchCount + occasionMatchCount + foodMatchCount) *
      3 *
      IMP_WEIGHT[p.contextImp]
    : 0;
  const producerBonus = producerMatch ? 8 * IMP_WEIGHT[p.producersImp] : 0;
  const varietalBonus = varietalMatch ? 7 * IMP_WEIGHT[p.varietalsImp] : 0;

  return (
    tasteScore +
    noteBonus +
    practiceBonus +
    regionBonus +
    festivalBonus +
    identityBonus +
    contextBonus +
    producerBonus +
    varietalBonus
  );
}

export function matchReasons(w: Wine, p: Prefs, en: Record<string, boolean>): string[] {
  const reasons: string[] = [];
  if (en.type && p.type !== "any" && w.type === p.type) {
    reasons.push(`Style · ${p.type}`);
  }
  if (en.price && w.price >= p.minPrice && w.price <= p.maxPrice) {
    reasons.push(p.minPrice > 0 ? `$${p.minPrice}–$${p.maxPrice}` : `Under $${p.maxPrice}`);
  }
  if (en.vintage && w.year >= p.minYear && w.year <= p.maxYear) {
    reasons.push(p.minYear === p.maxYear ? `Vintage · ${p.minYear}` : `Vintage · ${p.minYear}–${p.maxYear}`);
  }
  if (en.varietal && p.varietals.length > 0) {
    const hit = p.varietals.find((v) => {
      const a = w.varietal.toLowerCase();
      const b = v.toLowerCase();
      return a === b || a.includes(b) || b.includes(a);
    });
    if (hit) reasons.push(`Varietal · ${hit}`);
  }
  if (en.search && p.search.trim()) {
    reasons.push(`Matches "${p.search.trim()}"`);
  }
  if (en.taste) {
    const diff =
      Math.abs(w.body - p.body) +
      Math.abs(w.sweetness - p.sweetness) +
      Math.abs(w.acidity - p.acidity) +
      (w.type === "red" ? Math.abs(w.tannin - p.tannin) : 0);
    if (diff <= 4) reasons.push("Taste profile aligned");
  }
  if (en.notes && p.notes.length > 0) {
    const hits = p.notes.filter((n) => w.notes.includes(n));
    if (hits.length > 0) reasons.push(`Notes · ${hits.join(", ")}`);
  }
  if (en.region && (p.appellations.length > 0 || p.countries.length > 0)) {
    const { appellation, country } = parseRegion(w.region);
    if (p.appellations.includes(appellation)) reasons.push(`Region · ${appellation}`);
    else if (p.countries.includes(country)) reasons.push(`Region · ${country}`);
  }
  if (en.nearMe && p.nearMeCoords) {
    const d = distanceToWineMiles(p.nearMeCoords, w.region);
    if (d != null && d <= p.radiusMiles) {
      reasons.push(`Near you · ${Math.round(d)} mi`);
    }
  }

  if (en.practices && p.practices.length > 0) {
    const hits = p.practices.filter((x) => w.practices.includes(x));
    if (hits.length > 0) {
      const labels = hits.map(
        (v) => PRACTICES.find((x) => x.value === v)?.label ?? v,
      );
      reasons.push(`Practices · ${labels.join(", ")}`);
    }
  }
  if (en.festivals && p.festivals.length > 0) {
    const hits = p.festivals.filter((f) => (w.festivals ?? []).includes(f));
    if (hits.length > 0) {
      const labels = hits.map(
        (v) => FESTIVALS.find((x) => x.value === v)?.label ?? v,
      );
      reasons.push(`Festival · ${labels.join(", ")}`);
    }
  }
  if (en.identities && p.identities.length > 0) {
    const hits = p.identities.filter((i) => (w.identities ?? []).includes(i));
    if (hits.length > 0) {
      const labels = hits.map(
        (v) => IDENTITIES.find((x) => x.value === v)?.label ?? v,
      );
      reasons.push(`Winemaker · ${labels.join(", ")}`);
    }
  }
  if (en.context) {
    const seasonHits = p.seasons.filter((s) => seasonsFor(w).includes(s));
    if (seasonHits.length) reasons.push(`Season · ${seasonHits.join(", ")}`);
    const weatherHits = p.weathers.filter((s) => weatherFor(w).includes(s));
    if (weatherHits.length) reasons.push(`Weather · ${weatherHits.join(", ")}`);
    const occHits = p.occasions.filter((s) => occasionsFor(w).includes(s));
    if (occHits.length) reasons.push(`Occasion · ${occHits.join(", ")}`);
    const foodHits = p.foods.filter((s) => foodTagsFor(w).includes(s));
    if (foodHits.length) reasons.push(`Food · ${foodHits.join(", ")}`);
  }
  if (en.producers && p.producers.length > 0 && p.producers.includes(w.producer)) {
    reasons.push(`Producer · ${w.producer}`);
  }
  return reasons;
}




type SortMode = "match" | "price-asc" | "price-desc" | "rating-desc" | "year-desc" | "year-asc";

export type SectionKey =
  | "search"
  | "type"
  | "taste"
  | "price"
  | "vintage"
  | "varietal"
  | "notes"
  | "region"
  | "nearMe"
  | "practices"
  | "festivals"
  | "identities"
  | "context"
  | "producers";

export const DEFAULT_ENABLED: Record<SectionKey, boolean> = {
  search: false,
  type: false,
  taste: false,
  price: false,
  vintage: false,
  varietal: false,
  notes: false,
  region: false,
  nearMe: false,
  practices: false,
  festivals: false,
  identities: false,
  context: false,
  producers: false,
};


export type PersistedState = {
  prefs: Prefs;
  enabled: Record<SectionKey, boolean>;
  sortMode: SortMode;
};

// Legacy base64 blob (kept for backward compatibility with old shared links).
function decodeLegacyState(raw: string): Partial<PersistedState> | null {
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(b64)));
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {}
  return null;
}

const isImportance = (v: string): v is Importance =>
  v === "must" || v === "curious";

const isSortMode = (v: string): v is SortMode =>
  v === "match" || v === "price-asc" || v === "price-desc" || v === "rating-desc" || v === "year-desc" || v === "year-asc";

const isWineType = (v: string): v is WineType | "any" =>
  v === "any" || v === "red" || v === "white" || v === "orange" || v === "rosé" || v === "sparkling" || v === "dessert";

const isPractice = (v: string): v is Practice =>
  PRACTICES.some((p) => p.value === v);

const isFestival = (v: string): v is Festival =>
  FESTIVALS.some((f) => f.value === v);

const isIdentity = (v: string): v is Identity =>
  IDENTITIES.some((i) => i.value === v);

const isSectionKey = (v: string): v is SectionKey =>
  v in DEFAULT_ENABLED;

const isSeason = (v: string): v is Season =>
  SEASONS.some((s) => s.value === v);

const isWeather = (v: string): v is Weather =>
  WEATHERS.some((w) => w.value === v);

const isOccasion = (v: string): v is Occasion =>
  OCCASIONS.some((o) => o.value === v);

const isFoodTag = (v: string): v is FoodTag =>
  FOODS.some((f) => f.value === v);

function getArrayParam(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key);
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => decodeURIComponent(s.trim()))
    .filter(Boolean);
}

function setArrayParam(params: URLSearchParams, key: string, values: string[]) {
  if (!values.length) return;
  params.set(key, values.map(encodeURIComponent).join(","));
}

function getNumberParam(params: URLSearchParams, key: string, fallback: number): number {
  const raw = params.get(key);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function getImportanceParam(params: URLSearchParams, key: string, fallback: Importance): Importance {
  const raw = params.get(key);
  return raw && isImportance(raw) ? raw : fallback;
}

// Encode the full filter state as readable query parameters so the URL can be
// copied, shared, and inspected without an opaque blob.
function encodeQueryParams(s: PersistedState): string {
  const params = new URLSearchParams();
  const { prefs, enabled, sortMode } = s;

  // Enabled sections drive which values matter; always write them first.
  const enabledKeys = (Object.keys(enabled) as SectionKey[]).filter((k) => enabled[k]);
  setArrayParam(params, "on", enabledKeys);

  if (sortMode !== "match") params.set("sort", sortMode);

  if (enabled.search && prefs.search.trim()) params.set("q", prefs.search.trim());
  if (enabled.type && prefs.type !== "any") params.set("type", prefs.type);

  if (enabled.taste) {
    params.set("body", String(prefs.body));
    params.set("sweetness", String(prefs.sweetness));
    params.set("acidity", String(prefs.acidity));
    params.set("tannin", String(prefs.tannin));
    params.set("tasteImp", prefs.tasteImp);
  }

  if (enabled.price) {
    params.set("minPrice", String(prefs.minPrice));
    params.set("maxPrice", String(prefs.maxPrice));
  }

  if (enabled.vintage) {
    params.set("minYear", String(prefs.minYear));
    params.set("maxYear", String(prefs.maxYear));
  }

  if (enabled.varietal && prefs.varietals.length) {
    setArrayParam(params, "varietals", prefs.varietals);
    params.set("varietalsImp", prefs.varietalsImp);
  }

  if (enabled.notes && prefs.notes.length) {
    setArrayParam(params, "notes", prefs.notes);
    params.set("notesImp", prefs.notesImp);
  }

  if (enabled.region) {
    setArrayParam(params, "countries", prefs.countries);
    setArrayParam(params, "appellations", prefs.appellations);
    params.set("regionImp", prefs.regionImp);
  }

  if (enabled.nearMe) {
    params.set("nearMe", "1");
    params.set("radius", String(prefs.radiusMiles));
  }



  if (enabled.practices) {
    setArrayParam(params, "practices", prefs.practices);
    params.set("practicesMode", prefs.practicesMode);
    params.set("practicesImp", prefs.practicesImp);
  }

  if (enabled.festivals) {
    setArrayParam(params, "festivals", prefs.festivals);
    params.set("festivalsImp", prefs.festivalsImp);
  }

  if (enabled.identities) {
    setArrayParam(params, "identities", prefs.identities);
    params.set("identitiesImp", prefs.identitiesImp);
  }

  if (enabled.context) {
    setArrayParam(params, "seasons", prefs.seasons);
    setArrayParam(params, "weathers", prefs.weathers);
    setArrayParam(params, "occasions", prefs.occasions);
    setArrayParam(params, "foods", prefs.foods);
    params.set("contextImp", prefs.contextImp);
  }

  if (enabled.producers && prefs.producers.length) {
    setArrayParam(params, "producers", prefs.producers);
    params.set("producersImp", prefs.producersImp);
  }


  const out = params.toString();
  return out ? `?${out}` : "";
}

function decodeQueryParams(search: string): Partial<PersistedState> | null {
  if (!search || search === "?") return null;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  const enabled: Partial<Record<SectionKey, boolean>> = {};
  const enabledKeys = getArrayParam(params, "on").filter(isSectionKey);
  enabledKeys.forEach((k) => (enabled[k] = true));

  const prefs: Partial<Prefs> = {};

  const searchQ = params.get("q");
  if (searchQ !== null) {
    prefs.search = searchQ;
    enabled.search = true;
  }

  const type = params.get("type");
  if (type && isWineType(type) && type !== "any") {
    prefs.type = type;
    enabled.type = true;
  }

  prefs.body = getNumberParam(params, "body", DEFAULTS.body);
  prefs.sweetness = getNumberParam(params, "sweetness", DEFAULTS.sweetness);
  prefs.acidity = getNumberParam(params, "acidity", DEFAULTS.acidity);
  prefs.tannin = getNumberParam(params, "tannin", DEFAULTS.tannin);
  prefs.tasteImp = getImportanceParam(params, "tasteImp", DEFAULTS.tasteImp);
  if (
    params.has("body") ||
    params.has("sweetness") ||
    params.has("acidity") ||
    params.has("tannin") ||
    params.has("tasteImp")
  ) {
    enabled.taste = true;
  }

  prefs.minPrice = getNumberParam(params, "minPrice", DEFAULTS.minPrice);
  prefs.maxPrice = getNumberParam(params, "maxPrice", DEFAULTS.maxPrice);
  if (params.has("maxPrice") || params.has("minPrice")) enabled.price = true;

  prefs.minYear = getNumberParam(params, "minYear", DEFAULTS.minYear);
  prefs.maxYear = getNumberParam(params, "maxYear", DEFAULTS.maxYear);
  if (params.has("minYear") || params.has("maxYear")) enabled.vintage = true;

  prefs.varietals = getArrayParam(params, "varietals");
  prefs.varietalsImp = getImportanceParam(params, "varietalsImp", DEFAULTS.varietalsImp);
  if (params.has("varietals")) enabled.varietal = true;

  prefs.notes = getArrayParam(params, "notes");
  prefs.notesImp = getImportanceParam(params, "notesImp", DEFAULTS.notesImp);
  if (params.has("notes")) enabled.notes = true;

  prefs.countries = getArrayParam(params, "countries");
  prefs.appellations = getArrayParam(params, "appellations");
  prefs.regionImp = getImportanceParam(params, "regionImp", DEFAULTS.regionImp);
  if (params.has("countries") || params.has("appellations") || params.has("regionImp")) {
    enabled.region = true;
  }

  if (params.has("nearMe")) {
    enabled.nearMe = true;
    const r = Number(params.get("radius"));
    if ([10, 20, 40, 100].includes(r)) prefs.radiusMiles = r as RadiusMiles;
  }



  prefs.practices = getArrayParam(params, "practices").filter(isPractice);
  const practicesMode = params.get("practicesMode");
  if (practicesMode === "all" || practicesMode === "any") prefs.practicesMode = practicesMode;
  prefs.practicesImp = getImportanceParam(params, "practicesImp", DEFAULTS.practicesImp);
  if (params.has("practices")) enabled.practices = true;

  prefs.festivals = getArrayParam(params, "festivals").filter(isFestival);
  prefs.festivalsImp = getImportanceParam(params, "festivalsImp", DEFAULTS.festivalsImp);
  if (params.has("festivals")) enabled.festivals = true;

  prefs.identities = getArrayParam(params, "identities").filter(isIdentity);
  prefs.identitiesImp = getImportanceParam(params, "identitiesImp", DEFAULTS.identitiesImp);
  if (params.has("identities")) enabled.identities = true;

  prefs.seasons = getArrayParam(params, "seasons").filter(isSeason);
  prefs.weathers = getArrayParam(params, "weathers").filter(isWeather);
  prefs.occasions = getArrayParam(params, "occasions").filter(isOccasion);
  prefs.foods = getArrayParam(params, "foods").filter(isFoodTag);
  prefs.contextImp = getImportanceParam(params, "contextImp", DEFAULTS.contextImp);
  if (
    params.has("seasons") ||
    params.has("weathers") ||
    params.has("occasions") ||
    params.has("foods") ||
    params.has("contextImp")
  ) {
    enabled.context = true;
  }

  prefs.producers = getArrayParam(params, "producers");
  prefs.producersImp = getImportanceParam(params, "producersImp", DEFAULTS.producersImp);
  if (params.has("producers")) enabled.producers = true;


  const sortRaw = params.get("sort");
  const sortMode: SortMode | undefined = sortRaw && isSortMode(sortRaw) ? sortRaw : undefined;

  const hasEnabled = Object.keys(enabled).length > 0;
  return {
    prefs: prefs as Prefs,
    enabled: hasEnabled ? (enabled as Record<SectionKey, boolean>) : undefined,
    sortMode,
  };
}

export function loadInitial(): Partial<PersistedState> | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);

  // Prefer the new readable query params.
  const fromQuery = decodeQueryParams(url.search);
  if (fromQuery) return fromQuery;

  // Fall back to the legacy base64 blob for old shared links.
  const s = url.searchParams.get("s");
  if (s) {
    const fromUrl = decodeLegacyState(s);
    if (fromUrl) return fromUrl;
  }

  return null;
}

export function mergePrefs(base: Prefs, override: unknown): Prefs {
  if (!override || typeof override !== "object") return base;
  const merged = { ...base, ...(override as Partial<Prefs>) };
  const sanitize = (v: Importance): Importance =>
    v === "must" || v === "curious" ? v : "curious";
  merged.tasteImp = sanitize(merged.tasteImp);
  merged.notesImp = sanitize(merged.notesImp);
  merged.varietalsImp = sanitize(merged.varietalsImp);
  merged.practicesImp = sanitize(merged.practicesImp);
  merged.regionImp = sanitize(merged.regionImp);
  merged.festivalsImp = sanitize(merged.festivalsImp);
  merged.identitiesImp = sanitize(merged.identitiesImp);
  merged.contextImp = sanitize(merged.contextImp);
  merged.producersImp = sanitize(merged.producersImp);
  return merged;
}

export function mergeEnabled(
  base: Record<SectionKey, boolean>,
  override: unknown,
): Record<SectionKey, boolean> {
  if (!override || typeof override !== "object") return base;
  return { ...base, ...(override as Record<SectionKey, boolean>) };
}

function Index() {
  // Start from a clean slate so the app always opens with nothing selected.
  // URL query params are read synchronously so the server and client render
  // the same initial state and avoid hydration mismatches.
  const initialState = (() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const init = decodeQueryParams(search);
    return {
      prefs: mergePrefs(DEFAULTS, init?.prefs),
      enabled: mergeEnabled(DEFAULT_ENABLED, init?.enabled),
      sortMode: init?.sortMode && isSortMode(init.sortMode) ? init.sortMode : "match",
    };
  })();

  const [prefs, rawSetPrefs] = useState<Prefs>(initialState.prefs);
  const [enabled, rawSetEnabled] = useState<Record<SectionKey, boolean>>(initialState.enabled);
  const [submitted, setSubmitted] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [sortMode, rawSetSortMode] = useState<SortMode>(initialState.sortMode);
  const [hydrated, setHydrated] = useState(false);

  const sidebarRef = useRef<HTMLElement | null>(null);
  // Capture the user's scroll position before any preference change and
  // restore it after React commits, so toggling sections or clicking chips
  // doesn't yank them back to the top of the page or sidebar.
  const scrollAnchorRef = useRef<{ win: number; aside: number } | null>(null);

  const captureScroll = () => {
    if (typeof window === "undefined") return;
    // Keep the first captured position for an interaction so that any
    // browser-initiated scroll that happens before the state setter runs
    // doesn't overwrite the user's original position.
    if (scrollAnchorRef.current) return;
    const aside = sidebarRef.current;
    scrollAnchorRef.current = {
      win: window.scrollY || window.pageYOffset || 0,
      aside: aside?.scrollTop ?? 0,
    };
  };

  const restoreScroll = () => {
    const anchor = scrollAnchorRef.current;
    if (!anchor || typeof window === "undefined") return;
    const aside = sidebarRef.current;
    if (Math.abs((window.scrollY || 0) - anchor.win) > 2) {
      window.scrollTo({ top: anchor.win, left: 0, behavior: "auto" });
    }
    if (aside && Math.abs(aside.scrollTop - anchor.aside) > 2) {
      aside.scrollTop = anchor.aside;
    }
  };

  useLayoutEffect(restoreScroll);

  // Capture scroll position as early as possible and aggressively restore it
  // across the next few animation frames to defeat the browser's tendency to
  // auto-scroll a partially-visible focused control into view when a section
  // expands or collapses.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const aside = sidebarRef.current;
    if (!aside) return;
    let rafId = 0;
    let clearTimer: ReturnType<typeof setTimeout> | null = null;
    const endGuard = () => {
      scrollAnchorRef.current = null;
      if (rafId) cancelAnimationFrame(rafId);
      if (clearTimer) clearTimeout(clearTimer);
    };
    const guardLoop = () => {
      restoreScroll();
      rafId = requestAnimationFrame(guardLoop);
    };
    const handleBefore = () => {
      captureScroll();
      endGuard();
      guardLoop();
      clearTimer = setTimeout(endGuard, 450);
    };
    const handleScroll = () => restoreScroll();
    aside.addEventListener("pointerdown", handleBefore, true);
    aside.addEventListener("keydown", handleBefore, true);
    aside.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      aside.removeEventListener("pointerdown", handleBefore, true);
      aside.removeEventListener("keydown", handleBefore, true);
      aside.removeEventListener("scroll", handleScroll);
      endGuard();
    };
  }, []);

  const setPrefs: React.Dispatch<React.SetStateAction<Prefs>> = (update) => {
    captureScroll();
    rawSetPrefs(update);
  };

  const setEnabled: React.Dispatch<React.SetStateAction<Record<SectionKey, boolean>>> = (update) => {
    captureScroll();
    rawSetEnabled(update);
  };

  const setSortMode: React.Dispatch<React.SetStateAction<SortMode>> = (update) => {
    captureScroll();
    rawSetSortMode(update);
  };

  // Load browser-only personal data after hydration so the initial server
  // render matches the first client render.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setUserWines(loadUserWines());
    setFavorites(loadFavorites());
    setTried(loadTried());
    setRatings(loadRatings());
    const stored = loadStoredCoords();
    if (stored) rawSetPrefs((p) => ({ ...p, nearMeCoords: stored }));
    setHydrated(true);
  }, []);

  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const shareLocation = async () => {
    setLocError(null);
    setLocLoading(true);
    try {
      const c = await requestBrowserLocation();
      storeCoords(c);
      setPrefs((p) => ({ ...p, nearMeCoords: c }));
      setEnabled((e) => ({ ...e, nearMe: true }));
    } catch (err) {
      setLocError(err instanceof Error ? err.message : "Couldn't get location.");
    } finally {
      setLocLoading(false);
    }
  };
  const clearLocation = () => {
    storeCoords(null);
    setPrefs((p) => ({ ...p, nearMeCoords: null }));
    setLocError(null);
  };


  // Keep the URL in sync with the current filter state for easy sharing.
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const state: PersistedState = { prefs, enabled, sortMode };
    const query = encodeQueryParams(state);
    const url = new URL(window.location.href);
    url.search = query;
    window.history.replaceState(null, "", url.toString());
  }, [prefs, enabled, sortMode, hydrated]);

  const toggleSection = (k: SectionKey) => {
    setEnabled((e) => ({ ...e, [k]: !e[k] }));
  };

  // ---- Saved search presets -------------------------------------------
  const [presets, setPresets] = useState<SearchPreset<PersistedState>[]>([]);
  const [presetId, setPresetId] = useState("");
  const [presetName, setPresetName] = useState("");
  const [presetSaving, setPresetSaving] = useState(false);
  const [presetMsg, setPresetMsg] = useState<string | null>(null);

  useEffect(() => {
    setPresets(loadPresets<PersistedState>());
  }, []);

  const applyPreset = (id: string) => {
    setPresetId(id);
    if (!id) return;
    const preset = presets.find((p) => p.id === id);
    if (!preset?.state) return;
    captureScroll();
    rawSetPrefs(mergePrefs(DEFAULTS, preset.state.prefs));
    rawSetEnabled(mergeEnabled(DEFAULT_ENABLED, preset.state.enabled));
    rawSetSortMode(isSortMode(preset.state.sortMode) ? preset.state.sortMode : "match");
    setPresetMsg(`Loaded “${preset.name}”`);
  };

  const commitPreset = () => {
    const name = presetName.trim();
    if (!name) return;
    const next = savePreset<PersistedState>(name, { prefs, enabled, sortMode });
    setPresets(next);
    const saved = next.find((p) => p.name.toLowerCase() === name.toLowerCase());
    setPresetId(saved?.id ?? "");
    setPresetName("");
    setPresetSaving(false);
    setPresetMsg(`Saved “${name}”`);
  };

  const removePreset = () => {
    if (!presetId) return;
    const gone = presets.find((p) => p.id === presetId);
    setPresets(deletePreset<PersistedState>(presetId));
    setPresetId("");
    setPresetMsg(gone ? `Deleted “${gone.name}”` : null);
  };


  const [userWines, setUserWines] = useState<Wine[]>([]);
  const allWines = useMemo(() => [...userWines, ...WINES], [userWines]);

  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesOnly, rawSetFavoritesOnly] = useState(false);
  const setFavoritesOnly: React.Dispatch<React.SetStateAction<boolean>> = (update) => {
    captureScroll();
    rawSetFavoritesOnly(update);
  };
  const favSet = useMemo(() => new Set(favorites), [favorites]);
  const handleToggleFavorite = (id: string) => setFavorites(toggleFavoriteStore(id));

  const [tried, setTried] = useState<string[]>([]);
  const [triedFilter, rawSetTriedFilter] = useState<"all" | "tried" | "untried">("all");
  const setTriedFilter: React.Dispatch<React.SetStateAction<"all" | "tried" | "untried">> = (update) => {
    captureScroll();
    rawSetTriedFilter(update);
  };
  const triedSet = useMemo(() => new Set(tried), [tried]);
  const handleToggleTried = (id: string) => setTried(toggleTriedStore(id));

  const [ratings, setRatings] = useState<Record<string, number>>({});
  const handleSetRating = (id: string, stars: number) => setRatings(setRatingStore(id, stars));



  const results = useMemo(() => {
    const scored = allWines
      .map((w) => ({ w, score: scoreWine(w, prefs, enabled) }))
      .filter((x) => x.score >= 0)
      .filter((x) => (favoritesOnly ? favSet.has(x.w.id) : true))
      .filter((x) => {
        if (triedFilter === "tried") return triedSet.has(x.w.id);
        if (triedFilter === "untried") return !triedSet.has(x.w.id);
        return true;
      });
    const sorted = [...scored].sort((a, b) => {
      switch (sortMode) {
        case "price-asc":
          return a.w.price - b.w.price;
        case "price-desc":
          return b.w.price - a.w.price;
        case "year-desc":
          return b.w.year - a.w.year;
        case "year-asc":
          return a.w.year - b.w.year;
        case "rating-desc": {
          const ra = ratings[a.w.id] ?? -1;
          const rb = ratings[b.w.id] ?? -1;
          if (rb !== ra) return rb - ra;
          return b.score - a.score;
        }
        case "match":
        default:
          return b.score - a.score;
      }
    });
    return sorted;
  }, [prefs, enabled, sortMode, allWines, favoritesOnly, favSet, triedFilter, triedSet, ratings]);


  // Per-section producer counts: how many unique producers match if ONLY that
  // section's filter is applied. Helps convey each chip's individual impact.
  const sectionCounts = useMemo(() => {
    const out: Partial<Record<SectionKey, number>> = {};
    (Object.keys(DEFAULT_ENABLED) as SectionKey[]).forEach((k) => {
      if (!enabled[k]) return;
      const soloEnabled = Object.fromEntries(
        (Object.keys(DEFAULT_ENABLED) as SectionKey[]).map((sk) => [sk, sk === k]),
      ) as Record<SectionKey, boolean>;
      const producers = new Set<string>();
      for (const w of allWines) {
        if (scoreWine(w, prefs, soloEnabled) >= 0) producers.add(w.producer);
      }
      out[k] = producers.size;
    });
    return out;
  }, [prefs, enabled, allWines]);

  const toggleNote = (n: string) =>
    setPrefs((p) => ({
      ...p,
      notes: p.notes.includes(n) ? p.notes.filter((x) => x !== n) : [...p.notes, n],
    }));

  const togglePractice = (n: Practice) =>
    setPrefs((p) => ({
      ...p,
      practices: p.practices.includes(n)
        ? p.practices.filter((x) => x !== n)
        : [...p.practices, n],
    }));

  const toggleIn = (key: "appellations" | "countries", v: string) =>
    setPrefs((p) => ({
      ...p,
      [key]: p[key].includes(v) ? p[key].filter((x) => x !== v) : [...p[key], v],
    }));

  const setAll = (key: "appellations" | "countries", values: string[]) =>
    setPrefs((p) => ({ ...p, [key]: values }));

  const reset = () => {
    setPrefs(DEFAULTS);
    setEnabled(DEFAULT_ENABLED);
    setSubmitted(false);
  };

  const clearAll = () => {
    setPrefs(DEFAULTS);
    setEnabled(
      Object.fromEntries(
        (Object.keys(DEFAULT_ENABLED) as SectionKey[]).map((k) => [k, false]),
      ) as Record<SectionKey, boolean>,
    );
  };


  return (
    <div className="min-h-screen gradient-vino">
      <div className="mx-auto max-w-[100rem] px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <header className="border-b border-border bg-foreground px-6 py-8 sm:px-10 sm:py-12 md:px-14 md:py-16 lg:px-20 lg:py-20">
          <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6 md:mb-8">
            <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground shadow-sm sm:text-xs">
              Bottle Compass · Est. 2026
            </span>
            <Link
              to="/festivals"
              className="text-[10px] uppercase tracking-[0.28em] text-background/70 hover:text-background sm:text-xs"
            >
              Browse fairs →
            </Link>
          </div>

          <h1 className="font-serif text-[26px] italic leading-[1] tracking-tight text-background sm:text-4xl md:text-5xl lg:text-6xl">
            Know what's in your glass.
          </h1>
          <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-background/85 sm:mt-6 md:mt-8 sm:text-sm md:text-base">
            Discover wines that are authentic, thoughtfully made, and genuinely delicious—without requiring you to be a wine expert. Tell us what you like and we'll pour you a list. Whether you're standing in a wine shop or planning dinner, Bottle Compass helps you find bottles you'll love.
          </p>
          <Button
            size="lg"
            className="mt-6 rounded-full px-6 text-sm font-semibold shadow-sm sm:mt-8"
            onClick={() =>
              sidebarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            Tell us what you like
          </Button>
        </header>

        {/* Subtle transition divider between hero and content */}
        <div
          className="relative h-8 w-full overflow-hidden bg-gradient-to-b from-foreground to-background sm:h-10"
          aria-hidden="true"
        >
          <div className="absolute inset-x-0 top-1/2 mx-auto h-px w-24 max-w-[60%] -translate-y-1/2 bg-gradient-to-r from-transparent via-background/40 to-transparent sm:w-32" />
          <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background/50 sm:h-2 sm:w-2" />
        </div>

        <main className="grid gap-5 py-4 sm:gap-6 sm:py-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-8 lg:py-8 xl:grid-cols-[24rem_minmax(0,1fr)]">
        {/* Preferences */}
        <section
          ref={sidebarRef as React.RefObject<HTMLElement>}
          aria-label="Your preferences"
          className="rounded-xl border border-border bg-card/70 p-4 backdrop-blur sm:p-6 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto"
          style={{ overflowAnchor: "none", overscrollBehavior: "contain" }}
        >

          <h2 className="font-serif text-xl sm:text-2xl md:text-3xl">Your palate</h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Adjust the dials. Results update as you go.
          </p>

          {/* Saved search presets */}
          <div className="mt-4 rounded-lg border border-border/80 bg-background/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Saved searches
              </span>
              {!presetSaving && (
                <button
                  type="button"
                  onClick={() => {
                    setPresetSaving(true);
                    setPresetMsg(null);
                  }}
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-foreground/80 transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Save current
                </button>
              )}
            </div>

            {presetSaving ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input
                  autoFocus
                  value={presetName}
                  placeholder="Preset name (e.g. Summer natural reds)"
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitPreset();
                    }
                    if (e.key === "Escape") {
                      setPresetSaving(false);
                      setPresetName("");
                    }
                  }}
                  className="h-9 flex-1 border-border bg-transparent text-sm placeholder:text-muted-foreground/60"
                />
                <Button size="sm" onClick={commitPreset} disabled={!presetName.trim()}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPresetSaving(false);
                    setPresetName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <select
                  aria-label="Load a saved search preset"
                  value={presetId}
                  onChange={(e) => applyPreset(e.target.value)}
                  className="h-9 flex-1 rounded-md border border-border bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">
                    {presets.length ? "Load a preset…" : "No saved presets yet"}
                  </option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {presetId && (
                  <Button size="sm" variant="ghost" onClick={removePreset}>
                    Delete
                  </Button>
                )}
              </div>
            )}

            {presetMsg && (
              <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
                {presetMsg}
              </p>
            )}
          </div>


          <Section
            title="Search"
            hint="Filter by wine name or producer."
            enabled={enabled.search}
            sectionKey="search"
            onToggle={() => toggleSection("search")}
            spacing="mt-6"
          >
            <Input
              type="text"
              placeholder="Wine, producer, or winemaker"
              value={prefs.search}
              onChange={(e) => setPrefs((p) => ({ ...p, search: e.target.value }))}
              className="mt-2 border-border bg-transparent placeholder:text-muted-foreground/60"
            />
          </Section>

          <Section
            title="Style"
            hint="Red, white, sparkling…"
            enabled={enabled.type}
            sectionKey="type"
            onToggle={() => toggleSection("type")}
          >
            <div className="mt-3 flex flex-wrap gap-2">
              {TYPES.map((t) => {
                const active = prefs.type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setPrefs((p) => ({ ...p, type: t.value }))}
                    className={
                      "rounded-full border px-3.5 py-1.5 text-sm transition " +
                      (active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-transparent text-foreground/80 hover:border-primary/60")
                    }
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section
            title="Taste dials"
            hint="Body, sweetness, acidity, tannin."
            enabled={enabled.taste}
            sectionKey="taste"
            onToggle={() => toggleSection("taste")}
          >
            <div className="mt-3">
              <ImportanceRow
                label="Importance"
                value={prefs.tasteImp}
                onChange={(v) => setPrefs((p) => ({ ...p, tasteImp: v }))}
                inline
              />
            </div>
            <Dial
              label="Body"
              value={prefs.body}
              onChange={(v) => setPrefs((p) => ({ ...p, body: v }))}
              min="Light"
              max="Full"
            />
            <Dial
              label="Sweetness"
              value={prefs.sweetness}
              onChange={(v) => setPrefs((p) => ({ ...p, sweetness: v }))}
              min="Bone dry"
              max="Sweet"
            />
            <Dial
              label="Acidity"
              value={prefs.acidity}
              onChange={(v) => setPrefs((p) => ({ ...p, acidity: v }))}
              min="Soft"
              max="Zippy"
            />
            <Dial
              label="Tannin"
              value={prefs.tannin}
              onChange={(v) => setPrefs((p) => ({ ...p, tannin: v }))}
              min="Silky"
              max="Grippy"
            />
          </Section>

          <Section
            title="Price range"
            hint="Set the bottle price window."
            enabled={enabled.price}
            sectionKey="price"
            onToggle={() => toggleSection("price")}
            headerRight={
              <span className="font-serif text-lg italic text-accent">
                ${prefs.minPrice}–${prefs.maxPrice}
              </span>
            }
          >
            <div className="mt-4 space-y-4">
              <Slider
                value={[prefs.minPrice, prefs.maxPrice]}
                min={0}
                max={300}
                step={1}
                onValueChange={(v) =>
                  setPrefs((p) => ({
                    ...p,
                    minPrice: v[0],
                    maxPrice: v[1],
                  }))
                }
              />
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={300}
                    value={prefs.minPrice}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isNaN(n)) return;
                      setPrefs((p) => ({
                        ...p,
                        minPrice: Math.min(Math.max(n, 0), p.maxPrice),
                      }));
                    }}
                    className="h-8 pl-6 text-sm"
                  />
                </div>
                <span className="text-xs text-muted-foreground">–</span>
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={300}
                    value={prefs.maxPrice}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isNaN(n)) return;
                      setPrefs((p) => ({
                        ...p,
                        maxPrice: Math.max(Math.min(n, 300), p.minPrice),
                      }));
                    }}
                    className="h-8 pl-6 text-sm"
                  />
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="Vintage range"
            hint="Filter by bottling year."
            enabled={enabled.vintage}
            sectionKey="vintage"
            onToggle={() => toggleSection("vintage")}
            headerRight={
              <span className="font-serif text-lg italic text-accent">
                {prefs.minYear === prefs.maxYear
                  ? prefs.minYear
                  : `${prefs.minYear}–${prefs.maxYear}`}
              </span>
            }
          >
            <div className="mt-4 space-y-4">
              <Slider
                value={[prefs.minYear, prefs.maxYear]}
                min={YEAR_MIN}
                max={YEAR_MAX}
                step={1}
                onValueChange={(v) =>
                  setPrefs((p) => ({
                    ...p,
                    minYear: v[0],
                    maxYear: v[1],
                  }))
                }
              />
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={YEAR_MIN}
                  max={YEAR_MAX}
                  value={prefs.minYear}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isNaN(n)) return;
                    setPrefs((p) => ({
                      ...p,
                      minYear: Math.min(Math.max(n, YEAR_MIN), p.maxYear),
                    }));
                  }}
                  className="h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">–</span>
                <Input
                  type="number"
                  min={YEAR_MIN}
                  max={YEAR_MAX}
                  value={prefs.maxYear}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isNaN(n)) return;
                    setPrefs((p) => ({
                      ...p,
                      maxYear: Math.max(Math.min(n, YEAR_MAX), p.minYear),
                    }));
                  }}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </Section>

          <Section
            title="Varietal"
            hint="Match one or more grape varieties."
            enabled={enabled.varietal}
            sectionKey="varietal"
            onToggle={() => toggleSection("varietal")}
          >
            <div className="mt-3">
              <ImportanceRow
                label="Importance"
                value={prefs.varietalsImp}
                onChange={(v) => setPrefs((p) => ({ ...p, varietalsImp: v }))}
                inline
              />
            </div>
            <VarietalPicker
              options={ALL_VARIETALS}
              selected={prefs.varietals}
              onToggle={(v) =>
                setPrefs((p) => ({
                  ...p,
                  varietals: p.varietals.includes(v)
                    ? p.varietals.filter((x) => x !== v)
                    : [...p.varietals, v],
                }))
              }
              onClear={() => setPrefs((p) => ({ ...p, varietals: [] }))}
            />
          </Section>

          <Section
            title="Flavor notes"
            hint="Pick the notes you love."
            enabled={enabled.notes}
            sectionKey="notes"
            onToggle={() => toggleSection("notes")}
          >
            <div className="mt-3">
              <ImportanceRow
                label="Importance"
                value={prefs.notesImp}
                onChange={(v) => setPrefs((p) => ({ ...p, notesImp: v }))}
                inline
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {FLAVOR_NOTES.map((n) => {
                const active = prefs.notes.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggleNote(n)}
                    className={
                      "rounded-full border px-3 py-1 text-xs uppercase tracking-wider transition " +
                      (active
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border text-muted-foreground hover:border-accent/60 hover:text-foreground")
                    }
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section
            title="Region"
            hint="Country and/or appellation."
            enabled={enabled.region}
            sectionKey="region"
            onToggle={() => toggleSection("region")}
          >
            <RegionFilter
              countries={prefs.countries}
              appellations={prefs.appellations}
              importance={prefs.regionImp}
              onImportance={(v) => setPrefs((p) => ({ ...p, regionImp: v }))}
              onToggleCountry={(v) => toggleIn("countries", v)}
              onToggleAppellation={(v) => toggleIn("appellations", v)}
              onSetCountries={(v) => setAll("countries", v)}
              onSetAppellations={(v) => setAll("appellations", v)}
            />
          </Section>

          <Section
            title="Near me"
            hint="Show producers within a radius of your location."
            enabled={enabled.nearMe}
            sectionKey="nearMe"
            onToggle={() => toggleSection("nearMe")}
          >
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                {RADIUS_OPTIONS.map((r) => {
                  const active = prefs.radiusMiles === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setPrefs((p) => ({ ...p, radiusMiles: r }))}
                      className={
                        "rounded-full border px-3.5 py-1.5 text-sm transition " +
                        (active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-transparent text-foreground/80 hover:border-primary/60")
                      }
                    >
                      {r} mi
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={prefs.nearMeCoords ? "outline" : "default"}
                  onClick={shareLocation}
                  disabled={locLoading}
                >
                  {locLoading
                    ? "Locating…"
                    : prefs.nearMeCoords
                    ? "Update location"
                    : "Use my location"}
                </Button>
                {prefs.nearMeCoords && (
                  <Button size="sm" variant="ghost" onClick={clearLocation}>
                    Clear
                  </Button>
                )}
              </div>
              {prefs.nearMeCoords ? (
                <p className="text-xs text-muted-foreground">
                  Location shared · showing producers within {prefs.radiusMiles} mi.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Share your location to see nearby producers. Kept in this
                  browser session only.
                </p>
              )}
              {locError && (
                <p className="text-xs text-destructive">{locError}</p>
              )}
            </div>
          </Section>



          <Section
            title="How it's made"
            hint="Farming and cellar practices."
            enabled={enabled.practices}
            sectionKey="practices"
            onToggle={() => toggleSection("practices")}
            headerRight={
              <div className="flex overflow-hidden rounded-full border border-border text-[10px] uppercase tracking-widest">
                {(["all", "any"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPrefs((p) => ({ ...p, practicesMode: m }));
                    }}
                    className={
                      "px-2.5 py-1 transition " +
                      (prefs.practicesMode === m
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground")
                    }
                    aria-pressed={prefs.practicesMode === m}
                  >
                    Match {m}
                  </button>
                ))}
              </div>
            }
          >
            <div className="mt-4 flex flex-wrap gap-2">
              {PRACTICES.map((pr) => {
                const active = prefs.practices.includes(pr.value);
                return (
                  <button
                    key={pr.value}
                    type="button"
                    title={pr.blurb}
                    onClick={() => togglePractice(pr.value)}
                    className={
                      "rounded-full border px-3 py-1 text-xs transition " +
                      (active
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground")
                    }
                  >
                    {active ? "✓ " : ""}
                    {pr.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-4">
              <ImportanceRow
                label="Importance"
                value={prefs.practicesImp}
                onChange={(v) => setPrefs((p) => ({ ...p, practicesImp: v }))}
                inline
              />
            </div>
          </Section>

          <Section
            title="Festivals"
            hint="Poured at these natural-wine fairs."
            enabled={enabled.festivals}
            sectionKey="festivals"
            onToggle={() => toggleSection("festivals")}
          >
            <div className="mt-3 flex flex-wrap gap-2">
              {FESTIVALS.map((f) => {
                const active = prefs.festivals.includes(f.value);
                return (
                  <button
                    key={f.value}
                    type="button"
                    title={f.blurb}
                    onClick={() =>
                      setPrefs((p) => ({
                        ...p,
                        festivals: p.festivals.includes(f.value)
                          ? p.festivals.filter((x) => x !== f.value)
                          : [...p.festivals, f.value],
                      }))
                    }
                    className={
                      "rounded-full border px-3 py-1 text-xs transition " +
                      (active
                        ? "border-accent bg-accent/15 text-foreground"
                        : "border-border text-muted-foreground hover:border-accent/60 hover:text-foreground")
                    }
                  >
                    {active ? "✓ " : ""}
                    {f.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-4">
              <ImportanceRow
                label="Importance"
                value={prefs.festivalsImp}
                onChange={(v) => setPrefs((p) => ({ ...p, festivalsImp: v }))}
                inline
              />
            </div>
          </Section>

          <Section
            title="Winemaker"
            hint="Lift up underrepresented winemakers."
            enabled={enabled.identities}
            sectionKey="identities"
            onToggle={() => toggleSection("identities")}
          >
            <div className="mt-3 flex flex-wrap gap-2">
              {IDENTITIES.map((i) => {
                const active = prefs.identities.includes(i.value);
                return (
                  <button
                    key={i.value}
                    type="button"
                    title={i.blurb}
                    onClick={() =>
                      setPrefs((p) => ({
                        ...p,
                        identities: p.identities.includes(i.value)
                          ? p.identities.filter((x) => x !== i.value)
                          : [...p.identities, i.value],
                      }))
                    }
                    className={
                      "rounded-full border px-3 py-1 text-xs transition " +
                      (active
                        ? "border-accent bg-accent/15 text-foreground"
                        : "border-border text-muted-foreground hover:border-accent/60 hover:text-foreground")
                    }
                  >
                    {active ? "✓ " : ""}
                    {i.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-4">
              <ImportanceRow
                label="Importance"
                value={prefs.identitiesImp}
                onChange={(v) => setPrefs((p) => ({ ...p, identitiesImp: v }))}
                inline
              />
            </div>
          </Section>

          <Section
            title="Producers"
            hint="Narrow to one or more specific producers."
            enabled={enabled.producers}
            sectionKey="producers"
            onToggle={() => toggleSection("producers")}
          >
            <ProducerFilter
              options={ALL_PRODUCERS}
              selected={prefs.producers}
              importance={prefs.producersImp}
              onImportance={(v) => setPrefs((p) => ({ ...p, producersImp: v }))}
              onToggle={(v) =>
                setPrefs((p) => ({
                  ...p,
                  producers: p.producers.includes(v)
                    ? p.producers.filter((x) => x !== v)
                    : [...p.producers, v],
                }))
              }
              onClear={() => setPrefs((p) => ({ ...p, producers: [] }))}
            />
          </Section>



          <Section
            title="Context"
            hint="What are you drinking with, and when?"
            enabled={enabled.context}
            sectionKey="context"
            onToggle={() => toggleSection("context")}
          >
            <ContextChips
              title="Season"
              options={SEASONS}
              selected={prefs.seasons}
              onToggle={(v) =>
                setPrefs((p) => ({
                  ...p,
                  seasons: p.seasons.includes(v)
                    ? p.seasons.filter((x) => x !== v)
                    : [...p.seasons, v],
                }))
              }
            />
            <ContextChips
              title="How hot is it out?"
              options={WEATHERS}
              selected={prefs.weathers}
              onToggle={(v) =>
                setPrefs((p) => ({
                  ...p,
                  weathers: p.weathers.includes(v)
                    ? p.weathers.filter((x) => x !== v)
                    : [...p.weathers, v],
                }))
              }
            />
            <ContextChips
              title="Occasion"
              options={OCCASIONS}
              selected={prefs.occasions}
              onToggle={(v) =>
                setPrefs((p) => ({
                  ...p,
                  occasions: p.occasions.includes(v)
                    ? p.occasions.filter((x) => x !== v)
                    : [...p.occasions, v],
                }))
              }
            />
            <ContextChips
              title="What's on the plate?"
              options={FOODS}
              selected={prefs.foods}
              onToggle={(v) =>
                setPrefs((p) => ({
                  ...p,
                  foods: p.foods.includes(v)
                    ? p.foods.filter((x) => x !== v)
                    : [...p.foods, v],
                }))
              }
            />
            <div className="mt-5">
              <ImportanceRow
                label="Importance"
                value={prefs.contextImp}
                onChange={(v) => setPrefs((p) => ({ ...p, contextImp: v }))}
                inline
              />
            </div>
          </Section>



          <div className="mt-8 flex gap-3">
            <Button className="flex-1" onClick={() => setSubmitted(true)}>
              Pour matches
            </Button>
            <Button variant="ghost" onClick={reset}>
              Reset
            </Button>
          </div>
        </section>

        {/* Results */}
        <section aria-label="Recommended wines">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2 sm:mb-6 sm:gap-4">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <h2 className="font-serif text-xl sm:text-2xl md:text-3xl">

                {submitted ? "Your flight" : "Suggested for you"}
              </h2>
              <span
                className="rounded-full border border-border bg-card px-3 py-1 text-sm font-medium text-foreground tabular-nums"
                aria-live="polite"
                aria-atomic="true"
              >
                {results.length} {results.length === 1 ? "match" : "matches"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <label htmlFor="sort-mode" className="text-xs uppercase tracking-widest text-muted-foreground">
                Sort
              </label>
              <select
                id="sort-mode"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                <option value="match">Best overall match</option>
                <option value="rating-desc">Your rating · high to low</option>
                <option value="price-asc">Price · low to high</option>
                <option value="price-desc">Price · high to low</option>
                <option value="year-desc">Vintage · newest</option>
                <option value="year-asc">Vintage · oldest</option>
              </select>
              <Button
                variant={favoritesOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setFavoritesOnly((v) => !v)}
                aria-pressed={favoritesOnly}
                title={`${favorites.length} saved favorite${favorites.length === 1 ? "" : "s"}`}
              >
                ♥ Favorites {favorites.length > 0 && `(${favorites.length})`}
              </Button>
              <Link to="/favorites">
                <Button variant="outline" size="sm" title="View your saved favorites">
                  View list
                </Button>
              </Link>
              <select
                value={triedFilter}
                onChange={(e) => setTriedFilter(e.target.value as "all" | "tried" | "untried")}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
                title={`${tried.length} marked as tried`}
                aria-label="Filter by tasted status"
              >
                <option value="all">All wines</option>
                <option value="tried">Tried {tried.length > 0 && `(${tried.length})`}</option>
                <option value="untried">Not tried yet</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    setShareCopied(true);
                    window.setTimeout(() => setShareCopied(false), 1600);
                  } catch {}
                }}
                title="Copy a link that opens this app with your current filters"
              >
                {shareCopied ? "Link copied" : "Share link"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={results.length === 0}
                onClick={async () => {
                  try {
                    const url = window.location.href;
                    const producers = Array.from(new Set(results.map((r) => r.w.producer)));
                    const activeFilters = Object.entries(enabled)
                      .filter(([, v]) => v)
                      .map(([k]) => k)
                      .join(", ");
                    const lines: string[] = [];
                    lines.push("My wine picks");
                    if (activeFilters) lines.push(`Filters: ${activeFilters}`);
                    lines.push(`${results.length} matching wines · ${producers.length} producers`);
                    lines.push("");
                    lines.push("Top matches:");
                    results.slice(0, 15).forEach(({ w, score }, i) => {
                      lines.push(
                        `${i + 1}. ${w.producer} — ${w.name}${w.year ? ` (${w.year})` : ""} · ${w.region} · match ${Math.round(score)}`
                      );
                    });
                    if (results.length > 15) lines.push(`…and ${results.length - 15} more`);
                    lines.push("");
                    lines.push(`Open with these filters: ${url}`);
                    await navigator.clipboard.writeText(lines.join("\n"));
                    setSummaryCopied(true);
                    window.setTimeout(() => setSummaryCopied(false), 1600);
                  } catch {}
                }}
                title="Copy a shareable summary of your matches plus the link"
              >
                {summaryCopied ? "Summary copied" : "Copy summary"}
              </Button>
              <AddWineDialog
                onAdded={(w) => setUserWines((prev) => [w, ...prev])}
                trigger={<Button size="sm">+ Add wine</Button>}
              />
              <BulkImportDialog
                onImported={(list) => setUserWines(list)}
                trigger={<Button size="sm" variant="outline">Bulk import</Button>}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={results.length === 0}>
                    Download ▾
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      const rows = results.map(({ w, score }) => ({
                        wine: w, score, reasons: matchReasons(w, prefs, enabled),
                      }));
                      exportMatchesCSV(rows);
                    }}
                  >
                    Download as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      const rows = results.map(({ w, score }) => ({
                        wine: w, score, reasons: matchReasons(w, prefs, enabled),
                      }));
                      exportMatchesPDF(rows);
                    }}
                  >
                    Download as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

            </div>

          </div>

          <ActiveFiltersBar
            prefs={prefs}
            enabled={enabled}
            counts={sectionCounts}
            onDisable={toggleSection}
            onClearAll={clearAll}
          />




          {results.length === 0 ? (
            (() => {
              const restrictive = (Object.keys(SECTION_LABELS) as SectionKey[])
                .filter((k) => enabled[k] && summarizeSection(k, prefs) !== null)
                .map((k) => ({ k, count: sectionCounts[k] ?? 0 }))
                .sort((a, b) => a.count - b.count)
                .slice(0, 3);
              return (
                <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center md:p-10">
                  <div className="font-serif text-3xl italic text-foreground">
                    No bottles fit every constraint.
                  </div>
                  <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    Loosen a filter below or clear them all to widen the cellar.
                  </p>

                  {(favoritesOnly || triedFilter !== "all") && (
                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                      {favoritesOnly && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setFavoritesOnly(false)}
                        >
                          Turn off favorites-only
                        </Button>
                      )}
                      {triedFilter !== "all" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTriedFilter("all")}
                        >
                          Show all (not just {triedFilter === "tried" ? "tried" : "untried"})
                        </Button>
                      )}
                    </div>
                  )}

                  {restrictive.length > 0 && (
                    <div className="mt-6">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">
                        Try relaxing
                      </div>
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        {restrictive.map(({ k, count }) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => toggleSection(k)}
                            className="rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground transition hover:border-primary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            title={`Currently matches ${count} producer${count === 1 ? "" : "s"} in isolation`}
                          >
                            Disable {SECTION_LABELS[k]}
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              ({count})
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-6">
                    <Button variant="default" size="sm" onClick={clearAll}>
                      Reset all filters
                    </Button>
                  </div>
                </div>
              );
            })()
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {results.map(({ w }, i) => (
                <li
                  key={w.id}
                  className="group rounded-xl border border-border bg-card/60 p-4 transition hover:border-primary/60 hover:bg-card sm:p-5 md:p-6"
                >
                  <div className="flex items-start justify-between gap-3 sm:gap-4">

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                        <span className="text-accent">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span>·</span>
                        <span>{w.type}</span>
                        <span>·</span>
                        <span>{w.year}</span>
                      </div>
                      <h3 className="mt-1 font-serif text-xl italic sm:text-2xl md:text-3xl">
                        {w.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        <Link
                          to="/producers/$slug"
                          params={{ slug: producerSlug(w.producer) }}
                          className="underline decoration-dotted underline-offset-4 hover:text-primary"
                        >
                          {w.producer}
                        </Link>
                        {" "}— {w.varietal} · {w.region}
                      </p>
                      {w.winemaker && (
                        <p className="mt-0.5 text-xs text-muted-foreground/80">
                          <span className="uppercase tracking-widest text-foreground/60">
                            Winemaker
                          </span>{" "}
                          · {w.winemaker}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleTried(w.id)}
                          aria-pressed={triedSet.has(w.id)}
                          aria-label={triedSet.has(w.id) ? `Mark ${w.name} as not tried` : `Mark ${w.name} as tried`}
                          title={triedSet.has(w.id) ? "You've had this — click to unmark" : "Mark as tried"}
                          className={
                            "rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-widest leading-none transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
                            (triedSet.has(w.id)
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/60 hover:text-primary")
                          }
                        >
                          {triedSet.has(w.id) ? "✓ Tried" : "Tried?"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(w.id)}
                          aria-pressed={favSet.has(w.id)}
                          aria-label={favSet.has(w.id) ? `Remove ${w.name} from favorites` : `Save ${w.name} to favorites`}
                          title={favSet.has(w.id) ? "Remove from favorites" : "Save to favorites"}
                          className={
                            "rounded-full border p-2 text-lg leading-none transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
                            (favSet.has(w.id)
                              ? "border-accent bg-accent/20 text-accent"
                              : "border-border text-muted-foreground hover:border-accent/60 hover:text-accent")
                          }
                        >
                          {favSet.has(w.id) ? "♥" : "♡"}
                        </button>
                      </div>
                      <div
                        className="flex items-center gap-0.5"
                        role="radiogroup"
                        aria-label={`Rate ${w.name}`}
                      >
                        {[1, 2, 3, 4, 5].map((n) => {
                          const active = (ratings[w.id] ?? 0) >= n;
                          return (
                            <button
                              key={n}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              aria-label={`${n} star${n === 1 ? "" : "s"}`}
                              onClick={() =>
                                handleSetRating(w.id, ratings[w.id] === n ? 0 : n)
                              }
                              className={
                                "text-base leading-none transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm " +
                                (active
                                  ? "text-accent"
                                  : "text-muted-foreground/40 hover:text-accent/70")
                              }
                              title={
                                ratings[w.id] === n
                                  ? "Clear rating"
                                  : `Rate ${n} star${n === 1 ? "" : "s"}`
                              }
                            >
                              ★
                            </button>
                          );
                        })}
                      </div>
                      <div className="font-serif text-2xl text-accent">${w.price}</div>
                    </div>

                  </div>

                  <p className="mt-4 text-[15px] leading-relaxed text-foreground/85">
                    {w.description}
                  </p>

                  {(() => {
                    const reasons = matchReasons(w, prefs, enabled);
                    if (reasons.length === 0) return null;
                    return (
                      <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 p-3">
                        <div className="text-[10px] uppercase tracking-widest text-accent">
                          Why it matched
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {reasons.map((r) => (
                            <span
                              key={r}
                              className="rounded-full border border-accent/40 bg-background px-2.5 py-0.5 text-[11px] text-foreground/85"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {w.notes.map((n) => (
                      <Badge
                        key={n}
                        variant="outline"
                        className="border-border text-xs font-normal uppercase tracking-wider text-muted-foreground"
                      >
                        {n}
                      </Badge>
                    ))}
                  </div>

                  {w.practices.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {w.practices.map((pr) => {
                        const highlighted = prefs.practices.includes(pr);
                        return (
                          <span
                            key={pr}
                            className={
                              "rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-widest transition " +
                              (highlighted
                                ? "border-primary bg-primary/15 text-foreground"
                                : "border-primary/30 text-primary/90")
                            }
                          >
                            {PRACTICES.find((x) => x.value === pr)?.label ?? pr}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {(() => {
                    const wFests = w.festivals ?? [];
                    const producerFests = festivalsForProducer(w.producer);
                    const identities = w.identities ?? [];
                    if (producerFests.length === 0 && identities.length === 0) return null;
                    const crossListed = producerFests.length > 1;
                    return (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {identities.map((id) => {
                          const highlighted = prefs.identities.includes(id);
                          return (
                            <span
                              key={id}
                              className={
                                "rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-widest transition " +
                                (highlighted
                                  ? "border-accent bg-accent/20 text-foreground"
                                  : "border-accent/40 text-accent/90")
                              }
                            >
                              {IDENTITIES.find((x) => x.value === id)?.label ?? id}
                            </span>
                          );
                        })}
                        {crossListed && (
                          <span
                            className="rounded-full border border-primary/50 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary"
                            title={`${w.producer} pours at ${producerFests.length} fairs: ${producerFests.map(festivalLabel).join(", ")}`}
                          >
                            ✦ Cross-listed · {producerFests.length} fairs
                          </span>
                        )}
                        {producerFests.map((f) => {
                          const onThisBottle = wFests.includes(f);
                          const highlighted = prefs.festivals.includes(f);
                          return (
                            <span
                              key={f}
                              title={
                                onThisBottle
                                  ? `This bottling is poured at ${festivalLabel(f)}`
                                  : `${w.producer} also pours another bottling at ${festivalLabel(f)}`
                              }
                              className={
                                "rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-widest transition " +
                                (highlighted
                                  ? "border-foreground bg-foreground/10 text-foreground"
                                  : onThisBottle
                                    ? "border-border text-muted-foreground"
                                    : "border-dashed border-border/70 text-muted-foreground/70")
                              }
                            >
                              {onThisBottle ? "@" : "also @"} {festivalLabel(f)}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })()}


                  <dl className="mt-5 grid grid-cols-4 gap-3 border-t border-border pt-4 text-xs">
                    <Stat label="Body" value={w.body} />
                    <Stat label="Sweet" value={w.sweetness} />
                    <Stat label="Acid" value={w.acidity} />
                    <Stat label="Tannin" value={w.tannin} />
                  </dl>

                  <p className="mt-4 text-xs text-muted-foreground">
                    <span className="uppercase tracking-widest text-foreground/60">
                      Pair with
                    </span>{" "}
                    · {w.pairing}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                    <a
                      href={learnMoreUrl(w)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] uppercase tracking-widest text-foreground transition hover:bg-primary/20"
                    >
                      {w.producerUrl ? "Visit winemaker" : "About the winemaker"}
                      <span aria-hidden>↗</span>
                    </a>
                    <a
                      href={buyUrl(w)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent/10 px-3 py-1.5 text-[11px] uppercase tracking-widest text-foreground transition hover:bg-accent/20"
                    >
                      {w.shopUrl ? "Shop the bottle" : "Where to buy"}
                      <span aria-hidden>↗</span>
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      </div>

      <footer className="border-t border-border py-8 text-center text-xs uppercase tracking-[0.25em] text-muted-foreground">
        Drink thoughtfully · Bottle Compass
      </footer>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
      {children}
    </span>
  );
}

function Dial({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: string;
  max: string;
}) {
  return (
    <div className="mt-8">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="font-serif text-lg italic text-accent">{value}/5</span>
      </div>
      <Slider
        className="mt-4"
        value={[value]}
        min={1}
        max={5}
        step={1}
        onValueChange={(v) => onChange(v[0])}
      />
      <div className="mt-2 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground/70">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={
              "h-1.5 flex-1 rounded-full " +
              (n <= value ? "bg-primary" : "bg-border")
            }
          />
        ))}
      </div>
    </div>
  );
}

function RegionFilter({
  countries,
  appellations,
  importance,
  onImportance,
  onToggleCountry,
  onToggleAppellation,
  onSetCountries,
  onSetAppellations,
}: {
  countries: string[];
  appellations: string[];
  importance: Importance;
  onImportance: (v: Importance) => void;
  onToggleCountry: (v: string) => void;
  onToggleAppellation: (v: string) => void;
  onSetCountries: (v: string[]) => void;
  onSetAppellations: (v: string[]) => void;
}) {
  const [scope, setScope] = useState<"country" | "appellation">("country");
  const isCountry = scope === "country";
  const options = isCountry ? ALL_COUNTRIES : ALL_APPELLATIONS;
  const selected = isCountry ? countries : appellations;
  const toggle = isCountry ? onToggleCountry : onToggleAppellation;
  const setAllValues = isCountry ? onSetCountries : onSetAppellations;
  const allOn = selected.length === options.length;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label>Region</Label>
          <p className="mt-1 text-xs text-muted-foreground/80">
            Include by country and/or appellation.
          </p>
        </div>
        <div className="flex overflow-hidden rounded-full border border-border text-[10px] uppercase tracking-widest">
          {(["country", "appellation"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={
                "px-2.5 py-1 transition " +
                (scope === s
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground")
              }
              aria-pressed={scope === s}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <ImportanceRow
          label="Region importance"
          value={importance}
          onChange={onImportance}
          inline
        />
      </div>


      <div className="mt-3 flex gap-2 text-[10px] uppercase tracking-widest">
        <button
          type="button"
          onClick={() => setAllValues(allOn ? [] : [...options])}
          className="rounded-full border border-border px-2.5 py-1 text-muted-foreground transition hover:border-accent/60 hover:text-foreground"
        >
          {allOn ? "Clear all" : "Select all"}
        </button>
        {selected.length > 0 && (
          <span className="self-center text-muted-foreground/70">
            {selected.length} selected
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => {
          const active = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => toggle(o)}
              className={
                "rounded-full border px-3 py-1 text-xs transition " +
                (active
                  ? "border-accent bg-accent/15 text-foreground"
                  : "border-border text-muted-foreground hover:border-accent/60 hover:text-foreground")
              }
            >
              {active ? "✓ " : ""}
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ImportanceRow({
  label,
  hint,
  value,
  onChange,
  inline,
}: {
  label: string;
  hint?: string;
  value: Importance;
  onChange: (v: Importance) => void;
  inline?: boolean;
}) {
  return (
    <div className={inline ? "flex items-center justify-between gap-3" : "mt-8"}>
      <div>
        <Label>{label}</Label>
        {hint && (
          <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p>
        )}
      </div>
      <div
        role="radiogroup"
        aria-label={`${label} importance`}
        className="flex overflow-hidden rounded-full border border-border text-[10px] uppercase tracking-widest"
      >
        {IMPORTANCE.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={opt.blurb}
              onClick={() => onChange(opt.value)}
              className={
                "px-2.5 py-1 transition " +
                (active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {opt.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ContextChips<T extends string>({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: { value: T; label: string; blurb: string }[];
  selected: T[];
  onToggle: (v: T) => void;
}) {
  return (
    <div className="mt-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground/80">
        {title}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const active = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              title={o.blurb}
              onClick={() => onToggle(o.value)}
              className={
                "rounded-full border px-3 py-1 text-xs transition " +
                (active
                  ? "border-accent bg-accent/15 text-foreground"
                  : "border-border text-muted-foreground hover:border-accent/60 hover:text-foreground")
              }
            >
              {active ? "✓ " : ""}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProducerFilter({
  options,
  selected,
  importance,
  onToggle,
  onImportance,
  onClear,
}: {
  options: string[];
  selected: string[];
  importance: Importance;
  onToggle: (v: string) => void;
  onImportance: (v: Importance) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.toLowerCase().includes(q))
    : options;
  const shown = filtered.slice(0, 60);
  return (
    <div className="mt-4">
      <ImportanceRow
        label="Importance"
        value={importance}
        onChange={onImportance}
        inline
      />
      <Input
        type="text"
        placeholder={`Search ${options.length} producers…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-3 border-border bg-transparent placeholder:text-muted-foreground/60"
      />
      <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-widest">
        <span className="text-muted-foreground/70">
          {selected.length} selected
        </span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-border px-2.5 py-1 text-muted-foreground transition hover:border-accent/60 hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
      {selected.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onToggle(s)}
              className="rounded-full border border-accent bg-accent/15 px-2.5 py-1 text-xs text-foreground"
              title="Click to remove"
            >
              ✓ {s} ×
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-border/60 bg-background/30 p-2">
        {shown.length === 0 ? (
          <div className="px-2 py-1 text-xs text-muted-foreground">
            No producers match "{query}".
          </div>
        ) : (
          <ul className="space-y-0.5">
            {shown.map((o) => {
              const active = selected.includes(o);
              return (
                <li key={o}>
                  <button
                    type="button"
                    onClick={() => onToggle(o)}
                    className={
                      "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm transition " +
                      (active
                        ? "bg-accent/15 text-foreground"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground")
                    }
                  >
                    <span
                      aria-hidden
                      className={
                        "inline-block h-3.5 w-3.5 shrink-0 rounded-sm border " +
                        (active
                          ? "border-accent bg-accent"
                          : "border-border")
                      }
                    />
                    <span className="truncate">{o}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {filtered.length > shown.length && (
          <div className="mt-2 px-2 text-[11px] text-muted-foreground/70">
            {filtered.length - shown.length} more — refine your search.
          </div>
        )}
      </div>
    </div>
  );
}




const SECTION_LABELS: Record<SectionKey, string> = {
  search: "Search",
  type: "Style",
  taste: "Taste",
  price: "Price",
  vintage: "Vintage",
  varietal: "Varietal",
  notes: "Notes",
  region: "Region",
  nearMe: "Near me",

  practices: "Practices",
  festivals: "Festivals",
  identities: "Winemaker",
  context: "Context",
  producers: "Producers",
};

function summarizeSection(key: SectionKey, p: Prefs): string | null {
  switch (key) {
    case "search":
      return p.search.trim() ? `"${p.search.trim()}"` : null;
    case "type":
      return p.type === "any" ? null : p.type;
    case "taste":
      return `body ${p.body} · acid ${p.acidity} · sweet ${p.sweetness} · tannin ${p.tannin}`;
    case "price":
      return p.minPrice > 0 ? `$${p.minPrice}–$${p.maxPrice}` : `≤ $${p.maxPrice}`;
    case "vintage":
      return p.minYear === p.maxYear ? `${p.minYear}` : `${p.minYear}–${p.maxYear}`;
    case "varietal":
      return p.varietals.length ? `${p.varietals.length} selected` : null;
    case "notes":
      return p.notes.length ? `${p.notes.length} selected` : null;
    case "region": {
      const n = p.appellations.length + p.countries.length;
      return n ? `${n} selected` : null;
    }
    case "nearMe":
      return p.nearMeCoords
        ? `within ${p.radiusMiles} mi`
        : `share location · ${p.radiusMiles} mi`;

    case "practices":
      return p.practices.length ? `${p.practices.length} selected` : null;
    case "festivals":
      return p.festivals.length ? `${p.festivals.length} selected` : null;
    case "identities":
      return p.identities.length ? `${p.identities.length} selected` : null;
    case "context": {
      const n =
        p.seasons.length + p.weathers.length + p.occasions.length + p.foods.length;
      return n ? `${n} selected` : null;
    }
    case "producers":
      return p.producers.length ? `${p.producers.length} selected` : null;
  }
}

function ActiveFiltersBar({
  prefs,
  enabled,
  counts,
  onDisable,
  onClearAll,
}: {
  prefs: Prefs;
  enabled: Record<SectionKey, boolean>;
  counts: Partial<Record<SectionKey, number>>;
  onDisable: (k: SectionKey) => void;
  onClearAll: () => void;
}) {
  const active = (Object.keys(SECTION_LABELS) as SectionKey[])
    .filter((k) => enabled[k])
    .map((k) => ({ k, summary: summarizeSection(k, prefs), count: counts[k] }));

  if (active.length === 0) {
    return (
      <div className="mb-6 text-xs uppercase tracking-widest text-muted-foreground/70">
        No filters active — showing everything.
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div
      className="mb-6 flex flex-wrap items-center gap-2"
      role="toolbar"
      aria-label="Active filters"
    >

      <span className="text-xs uppercase tracking-widest text-muted-foreground/70">
        Filters
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClearAll}
        className="h-6 border-border/70 bg-card/50 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        Reset all filters
      </Button>

      {active.map(({ k, summary, count }) => {
        const label = SECTION_LABELS[k];
        const jumpToSection = () => {
          const el = document.getElementById(`section-${k}`);
          if (!el) return;
          const reduce = window.matchMedia?.(
            "(prefers-reduced-motion: reduce)",
          ).matches;
          el.scrollIntoView({
            behavior: reduce ? "auto" : "smooth",
            block: "center",
          });
          el.classList.remove("highlight-target");
          void el.offsetWidth;
          el.classList.add("highlight-target");
          window.setTimeout(
            () => el.classList.remove("highlight-target"),
            1700,
          );
          const focusable = el.querySelector<HTMLElement>(
            'input, [role="slider"], button[role="switch"], [tabindex]:not([tabindex="-1"])',
          );
          focusable?.focus?.({ preventScroll: true });
          // Escape from within the section returns focus to the chip's edit button
          const chipBtn = document.getElementById(`chip-edit-${k}`);
          const onKey = (ev: KeyboardEvent) => {
            if (ev.key === "Escape") {
              ev.stopPropagation();
              chipBtn?.focus();
              el.removeEventListener("keydown", onKey, true);
            }
          };
          el.addEventListener("keydown", onKey, true);
        };
        const onChipKeyDown = (e: React.KeyboardEvent) => {
          if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            onDisable(k);
          }
        };
        return (
          <span
            key={k}
            role="group"
            aria-label={`${label} filter`}
            className="group inline-flex items-stretch overflow-hidden rounded-full border border-border/70 bg-card/50 text-xs text-foreground/90 transition hover:border-primary/60 hover:bg-card focus-within:ring-2 focus-within:ring-primary/60"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  id={`chip-edit-${k}`}
                  type="button"
                  onClick={jumpToSection}
                  onKeyDown={onChipKeyDown}
                  aria-label={`Edit ${label} filter${
                    summary ? `, ${summary}` : ""
                  }${count !== undefined ? `, ${count} matching producers` : ""}. Press Delete to remove.`}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-left outline-none focus-visible:bg-primary/10"
                >
                  <span className="font-medium">{label}</span>
                  {summary && (
                    <span className="text-muted-foreground">· {summary}</span>
                  )}
                  {count !== undefined && (
                    <span
                      className={
                        "ml-1 rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] font-medium tabular-nums " +
                        (count === 0
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : "bg-muted/40 text-muted-foreground")
                      }
                    >
                      {count}
                    </span>
                  )}
                  <span aria-hidden className="ml-0.5 text-muted-foreground/60">
                    ✎
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-widest opacity-80">
                    {label}
                  </div>
                  <div className="text-xs leading-snug">
                    {summary || "No value set"}
                  </div>
                  {count !== undefined && (
                    <div
                      className={
                        "text-[11px] " +
                        (count === 0 ? "opacity-90" : "opacity-80")
                      }
                    >
                      {count} matching {count === 1 ? "producer" : "producers"}
                      {count === 0 && " — try loosening this filter"}
                    </div>
                  )}
                  <div className="pt-1 text-[10px] opacity-70">
                    Enter to edit · Delete to remove
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onDisable(k)}
                  onKeyDown={onChipKeyDown}
                  aria-label={`Turn off ${label} filter`}
                  className="border-l border-border/60 px-2 text-muted-foreground/70 outline-none transition hover:bg-destructive/10 hover:text-foreground focus-visible:bg-destructive/10 focus-visible:text-foreground"
                >
                  ×
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Turn off {label} filter
              </TooltipContent>
            </Tooltip>
          </span>
        );
      })}
    </div>
    </TooltipProvider>
  );
}




function Section({
  sectionKey,
  title,
  hint,
  enabled,
  onToggle,
  headerRight,
  spacing = "mt-8",
  children,
}: {
  sectionKey?: SectionKey;
  title: string;
  hint?: string;
  enabled: boolean;
  onToggle: () => void;
  headerRight?: React.ReactNode;
  spacing?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={sectionKey ? `section-${sectionKey}` : undefined}
      className={
        spacing +
        " scroll-mt-24 rounded-lg border px-3 py-2.5 transition sm:px-4 sm:py-3 " +
        (enabled
          ? "border-border/70 bg-background/20"
          : "border-border/40 bg-transparent")
      }

    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={enabled}
          className="flex flex-1 items-start gap-3 text-left"
        >
          <span
            aria-hidden
            className={
              "mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition " +
              (enabled
                ? "border-accent bg-accent/70 justify-end"
                : "border-border bg-transparent justify-start")
            }
          >
            <span
              className={
                "mx-0.5 h-3.5 w-3.5 rounded-full transition " +
                (enabled ? "bg-accent-foreground" : "bg-muted-foreground/60")
              }
            />
          </span>
          <span className="min-w-0">
            <span
              className={
                "block text-xs uppercase tracking-[0.25em] " +
                (enabled ? "text-foreground" : "text-muted-foreground/70")
              }
            >
              {title}
            </span>
            {hint && (
              <span className="mt-1 block text-xs text-muted-foreground/70">
                {hint}
              </span>
            )}
          </span>
        </button>
        {enabled && headerRight}
      </div>
      {enabled && <div>{children}</div>}
    </div>
  );
}


function VarietalPicker({
  options,
  selected,
  onToggle,
  onClear,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = t ? options.filter((o) => o.toLowerCase().includes(t)) : options;
    // Show selected first, then up to 40 options for browsing.
    const sel = base.filter((o) => selected.includes(o));
    const rest = base.filter((o) => !selected.includes(o));
    return [...sel, ...rest].slice(0, 40);
  }, [options, selected, q]);

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search varietals…"
          className="flex-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
        />
        {selected.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {filtered.map((v) => {
          const active = selected.includes(v);
          return (
            <button
              key={v}
              type="button"
              onClick={() => onToggle(v)}
              className={
                "rounded-full border px-3 py-1 text-xs uppercase tracking-wider transition " +
                (active
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:border-accent/60 hover:text-foreground")
              }
            >
              {v}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <span className="text-xs text-muted-foreground">No matching varietals.</span>
        )}
      </div>
      {selected.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground/70">
          {selected.length} selected
        </p>
      )}
    </div>
  );
}
