import {
  PRACTICES,
  FESTIVALS,
  IDENTITIES,
  WINES,
  auditCatalog,
  producerSlug,
  type CatalogAudit,
  type Wine,
  type WineType,
  type Practice,
  type Festival,
  type Identity,
} from "./wines";
import { addUserWine, type AddResult } from "./user-wines";

/**
 * Convert any Google-Sheets-ish share URL into a CSV export URL.
 * Supported inputs:
 *  - https://docs.google.com/spreadsheets/d/<ID>/edit#gid=<GID>
 *  - https://docs.google.com/spreadsheets/d/<ID>/view
 *  - https://docs.google.com/spreadsheets/d/e/<PUBID>/pubhtml?gid=<GID>
 *  - a raw CSV URL (returned unchanged)
 */
export function toCsvUrl(input: string): string | null {
  const url = input.trim();
  if (!url) return null;

  // Already CSV / TSV
  if (/\.(csv|tsv)(\?|$)/i.test(url)) return url;
  if (/[?&]output=csv\b/i.test(url)) return url;
  if (/\/export\?[^#]*format=csv/i.test(url)) return url;

  // Published sheet: /d/e/<PUBID>/pubhtml
  const pub = url.match(/docs\.google\.com\/spreadsheets\/d\/e\/([^/]+)\/pub/i);
  if (pub) {
    const gid = url.match(/[?&#]gid=(\d+)/)?.[1];
    return `https://docs.google.com/spreadsheets/d/e/${pub[1]}/pub?output=csv${gid ? `&gid=${gid}` : ""}`;
  }

  // Standard sheet: /d/<ID>/…
  const std = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
  if (std) {
    const gid = url.match(/[?&#]gid=(\d+)/)?.[1] ?? "0";
    return `https://docs.google.com/spreadsheets/d/${std[1]}/export?format=csv&gid=${gid}`;
  }

  return null;
}

/** Minimal CSV parser supporting quoted fields and commas / newlines inside quotes. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  const src = text.replace(/\r\n?/g, "\n");
  while (i < src.length) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i += 2;
        continue;
      }
      if (c === '"') {
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }
    cell += c;
    i += 1;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim().length > 0));
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

/** Fuzzy header → canonical field name. */
const HEADER_ALIASES: Record<string, string[]> = {
  producer: ["producer", "winery", "domaine", "estate", "vineyard", "brand"],
  name: ["name", "bottling", "cuvee", "cuvée", "wine", "label"],
  winemaker: ["winemaker", "maker", "vigneron"],
  varietal: ["varietal", "grape", "grapes", "variety", "cepage"],
  region: ["region", "appellation", "aoc", "ava", "place", "area"],
  country: ["country", "nation"],
  year: ["year", "vintage"],
  type: ["type", "color", "colour", "style"],
  price: ["price", "cost", "usd", "srp"],
  notes: ["notes", "tastingnotes", "flavors", "flavours", "aromas"],
  practices: ["practices", "practice", "farming", "certification", "certifications", "howitsmade"],
  festivals: ["festivals", "festival", "fair", "fairs", "event"],
  identities: ["identity", "identities", "ownership"],
  producerUrl: ["url", "website", "site", "producerurl", "web"],
  shopUrl: ["shop", "shopurl", "buy", "buyurl", "ecommerce", "store"],
  pairing: ["pairing", "pairs", "food", "pairswith"],
  description: ["description", "notesdescription", "about", "summary", "blurb"],
};

function mapHeaders(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, idx) => {
    const n = norm(h);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[field] !== undefined) continue;
      if (aliases.some((a) => n === norm(a) || n.includes(norm(a)))) {
        map[field] = idx;
        return;
      }
    }
  });
  return map;
}

function pickEnum<T extends string>(raw: string, allowed: readonly T[]): T[] {
  if (!raw) return [];
  const parts = raw
    .split(/[,;/|]/)
    .map((p) => norm(p))
    .filter(Boolean);
  const out: T[] = [];
  for (const v of allowed) {
    const nv = norm(v);
    if (parts.some((p) => p === nv || p.includes(nv) || nv.includes(p))) out.push(v);
  }
  return out;
}

function pickType(raw: string): WineType {
  const n = norm(raw);
  if (n.includes("spark") || n.includes("pet") || n.includes("champ")) return "sparkling";
  if (n.includes("rose") || n.includes("rosé")) return "rosé";
  if (n.includes("orange") && !n.includes("orange muscat")) return "orange";
  if (n.includes("skin contact") || n.includes("skin-contact") || n.includes("amber") || n.includes("ramato")) return "orange";
  if (n.includes("dessert") || n.includes("sweet") || n.includes("port")) return "dessert";
  if (n.includes("white") || n.includes("blanc")) return "white";
  return "red";
}

function toNum(raw: string, fallback: number): number {
  const m = raw.replace(/[$,]/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : fallback;
}

const PRACTICE_VALUES = PRACTICES.map((p) => p.value) as readonly Practice[];
const FESTIVAL_VALUES = FESTIVALS.map((f) => f.value) as readonly Festival[];
const IDENTITY_VALUES = IDENTITIES.map((i) => i.value) as readonly Identity[];

/** Turn one row into a Wine + list of fields that were missing (defaulted). */
export function rowToWine(
  row: string[],
  idx: number,
  headerMap: Record<string, number>,
): { wine: Wine; missing: string[] } | null {
  const get = (k: string) => (headerMap[k] !== undefined ? (row[headerMap[k]] ?? "").trim() : "");
  const producer = get("producer");
  const name = get("name") || producer;
  if (!producer) return null;

  const missing: string[] = [];
  if (!get("name")) missing.push("name");
  const regionRaw = get("region");
  const countryRaw = get("country");
  if (!regionRaw && !countryRaw) missing.push("region");
  const region = [regionRaw, countryRaw].filter(Boolean).join(", ") || "Unknown";
  if (!get("year")) missing.push("year");
  const year = Math.round(toNum(get("year"), new Date().getFullYear() - 1));
  if (!get("type")) missing.push("type");
  const type = pickType(get("type"));
  if (!get("price")) missing.push("price");
  const price = Math.max(0, toNum(get("price"), 35));
  const notes = get("notes")
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (!notes.length) missing.push("notes");
  const practices = pickEnum(get("practices"), PRACTICE_VALUES);
  if (!practices.length) missing.push("practices");
  const festivals = pickEnum(get("festivals"), FESTIVAL_VALUES);
  const identities = pickEnum(get("identities"), IDENTITY_VALUES);
  const url = (u: string) => (u && /^https?:\/\//i.test(u) ? u : undefined);

  const slug = producerSlug(producer).slice(0, 40) || "row";
  const id = `import-${slug}-${year}-${idx}`;

  const wine: Wine = {
    id,
    producer,
    name,
    winemaker: get("winemaker") || undefined,
    varietal: get("varietal") || "Blend",
    region,
    year,
    type,
    body: 5,
    sweetness: 2,
    acidity: 6,
    tannin: type === "red" ? 5 : 2,
    price,
    notes: notes.length ? notes : ["balanced"],
    practices: practices.length ? practices : ["low-intervention"],
    festivals: festivals.length ? festivals : undefined,
    identities: identities.length ? identities : undefined,
    pairing: get("pairing") || "Versatile with a shared table.",
    description: get("description") || `${producer} — imported from your sheet.`,
    producerUrl: url(get("producerUrl")),
    shopUrl: url(get("shopUrl")),
  };
  return { wine, missing };
}

export interface ImportReport {
  total: number;
  added: number;
  merged: number;
  duplicates: number;
  /** Rows rejected because they conflict with an existing bottling on type/price. */
  conflicts: number;
  invalid: number;
  skipped: number;
  /** How many imported rows had at least one defaulted/missing field. */
  incomplete: number;
  /** Field name → number of imported rows that were missing it. */
  missingByField: Record<string, number>;
  errors: { row: number; producer: string; reason: string }[];
  finalList: Wine[];
  /** Post-ingestion integrity audit of built-in catalog + imported cellar. */
  audit: CatalogAudit;
}

export interface ImportPreview {
  rows: string[][];
  headers: string[];
  headerMap: Record<string, number>;
  wines: Wine[];
  /** Aligned with `wines`: fields defaulted per row. */
  missingPerWine: string[][];
  /** Aggregate: field → number of rows missing it. */
  missingByField: Record<string, number>;
}

export async function fetchAndParse(url: string): Promise<ImportPreview> {
  const csvUrl = toCsvUrl(url);
  if (!csvUrl) throw new Error("That doesn't look like a Google Sheets or CSV link.");
  const res = await fetch(csvUrl, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(
      `Couldn't fetch the sheet (HTTP ${res.status}). Make sure sharing is set to "Anyone with the link" — Viewer.`,
    );
  }
  const text = await res.text();
  if (/<html/i.test(text.slice(0, 200))) {
    throw new Error(
      'Google returned an HTML page instead of CSV — the sheet is likely private. Share it "Anyone with the link".',
    );
  }
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error("Sheet is empty or has no data rows.");
  const headers = rows[0];
  const headerMap = mapHeaders(headers);
  if (headerMap.producer === undefined) {
    throw new Error(
      `Couldn't find a "Producer" column. Detected headers: ${headers.join(", ")}`,
    );
  }
  const wines: Wine[] = [];
  const missingPerWine: string[][] = [];
  const missingByField: Record<string, number> = {};
  rows.slice(1).forEach((r, i) => {
    const built = rowToWine(r, i + 1, headerMap);
    if (!built) return;
    wines.push(built.wine);
    missingPerWine.push(built.missing);
    for (const f of built.missing) missingByField[f] = (missingByField[f] ?? 0) + 1;
  });
  return { rows, headers, headerMap, wines, missingPerWine, missingByField };
}

export function importWines(
  wines: Wine[],
  missingPerWine: string[][] = [],
): ImportReport {
  const report: ImportReport = {
    total: wines.length,
    added: 0,
    merged: 0,
    duplicates: 0,
    conflicts: 0,
    invalid: 0,
    skipped: 0,
    incomplete: 0,
    missingByField: {},
    errors: [],
    finalList: [],
    audit: auditCatalog([]),
  };
  let last: AddResult | null = null;
  for (let i = 0; i < wines.length; i += 1) {
    const w = wines[i];
    const res = addUserWine(w);
    last = res;
    if (res.status === "added") report.added += 1;
    else if (res.status === "merged") report.merged += 1;
    else if (res.status === "duplicate-id") {
      report.duplicates += 1;
    } else if (res.status === "conflict") {
      report.conflicts += 1;
      report.errors.push({
        row: i + 1,
        producer: w.producer,
        reason: `conflicts with “${res.against.producer} — ${res.against.name} ${res.against.year}” (${res.reason})`,
      });
      continue;
    } else {
      report.invalid += 1;
      report.errors.push({ row: i + 1, producer: w.producer, reason: res.errors.join("; ") });
      continue;
    }
    const miss = missingPerWine[i] ?? [];
    if (miss.length) {
      report.incomplete += 1;
      for (const f of miss) report.missingByField[f] = (report.missingByField[f] ?? 0) + 1;
    }
  }
  if (last && "list" in last) report.finalList = last.list;
  // Run the integrity audit on the catalog as the app will actually see it.
  report.audit = auditCatalog([...WINES, ...report.finalList]);
  return report;
}
