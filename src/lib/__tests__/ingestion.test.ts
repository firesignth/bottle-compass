import { beforeEach, describe, expect, it } from "vitest";
import { importWines, parseCSV, rowToWine } from "../bulk-import";
import { WINES, auditCatalog, type Wine } from "../wines";

/** Minimal localStorage so the user-cellar layer behaves like in the browser. */
function installStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  (globalThis as unknown as { window: unknown }).window = { localStorage };
}

const CSV = [
  "Producer,Wine,Varietal,Region,Vintage,Type,Price,Notes,Practices,Festivals",
  "Broc Cellars,Love Red,Valdiguié,California,2022,red,30,cranberry;herb,natural,raw",
  // Same bottling, messier spelling — must merge, not duplicate.
  "Broc Cellars Inc.,Cuvée Love Red 2022 (RAW NY),Valdiguié,California,2022,red,32,pomegranate,organic,wineFare",
  // Same bottling but a different type — must be refused as a conflict.
  "Broc Cellars,Love Red,Valdiguié,California,2022,white,30,lemon,natural,",
  "Martha Stoumen,Post Flirtation,Zinfandel,Mendocino,2023,red,34,strawberry,low-intervention,raw",
].join("\n");

function csvToWines(csv: string): Wine[] {
  const rows = parseCSV(csv);
  const headers = rows[0];
  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    const key = h.trim().toLowerCase();
    const map: Record<string, string> = {
      producer: "producer",
      wine: "name",
      varietal: "varietal",
      region: "region",
      vintage: "year",
      type: "type",
      price: "price",
      notes: "notes",
      practices: "practices",
      festivals: "festivals",
    };
    if (map[key]) headerMap[map[key]] = i;
  });
  return rows
    .slice(1)
    .map((r, i) => rowToWine(r, i + 1, headerMap))
    .filter((b): b is NonNullable<typeof b> => Boolean(b))
    .map((b) => b.wine);
}

describe("post-ingestion audit", () => {
  beforeEach(() => {
    installStorage();
  });

  it("imports a batch and leaves the catalog clean", () => {
    const report = importWines(csvToWines(CSV));

    expect(report.total).toBe(4);
    expect(report.invalid).toBe(0);
    // The messy re-spelling merged; the type mismatch was refused.
    expect(report.merged).toBeGreaterThanOrEqual(1);
    expect(report.conflicts).toBeGreaterThanOrEqual(1);

    const audit = report.audit;
    expect(audit.duplicateIds).toEqual([]);
    expect(audit.invalid).toEqual([]);
    expect(audit.producerSpellingSplits).toEqual([]);
    expect(audit.duplicateBottlings.filter((d) => !d.conflict)).toEqual([]);
    expect(audit.ok).toBe(true);
  });

  it("re-importing the same batch adds nothing new and stays clean", () => {
    importWines(csvToWines(CSV));
    const second = importWines(csvToWines(CSV));
    expect(second.added).toBe(0);
    expect(second.audit.ok).toBe(true);
  });

  it("rejects rows with missing required fields at ingestion time", () => {
    // A producer-less CSV row never even becomes a wine…
    const fromCsv = csvToWines(
      ["Producer,Wine,Varietal,Region,Vintage,Type,Price", ",Nameless,Gamay,Loire,2022,red,25"].join("\n"),
    );
    expect(fromCsv).toHaveLength(0);

    // …and a hand-built row missing required fields is rejected by importWines.
    const [good] = csvToWines(CSV);
    const report = importWines([
      { ...good, id: "bad-1", description: "" },
      { ...good, id: "bad-2", year: 12 },
    ]);
    expect(report.added).toBe(0);
    expect(report.invalid).toBe(2);
    expect(report.errors).toHaveLength(2);
    expect(report.audit.ok).toBe(true);
  });

  it("audits the merged built-in + imported catalog, not just the import", () => {
    const report = importWines(csvToWines(CSV));
    expect(report.audit.total).toBe(WINES.length + report.finalList.length);
    expect(auditCatalog(WINES).ok).toBe(true);
  });
});
