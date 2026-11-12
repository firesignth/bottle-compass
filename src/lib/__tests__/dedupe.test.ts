import { describe, expect, it } from "vitest";
import { auditCatalog, bottlingKey, dedupeWines, type Wine } from "../wines";

function wine(over: Partial<Wine> & Pick<Wine, "id">): Wine {
  return {
    producer: "Broc Cellars",
    name: "Love Red",
    varietal: "Valdiguié",
    region: "California",
    year: 2022,
    type: "red",
    body: 3,
    sweetness: 1,
    acidity: 4,
    tannin: 2,
    price: 30,
    notes: ["cranberry"],
    practices: ["natural"],
    pairing: "Roast chicken",
    description: "Bright, juicy, chillable.",
    ...over,
  } as Wine;
}

describe("dedupeWines collision handling", () => {
  it("drops rows that reuse an existing id", () => {
    const out = dedupeWines([
      wine({ id: "a" }),
      wine({ id: "a", name: "Completely Different Cuvee" }),
    ]);
    expect(out.map((w) => w.id)).toEqual(["a"]);
  });

  it("skips rows failing validation instead of crashing", () => {
    const out = dedupeWines([
      wine({ id: "ok" }),
      { ...wine({ id: "bad" }), producer: "" } as Wine,
      { ...wine({ id: "bad2" }), year: 12 } as Wine,
      { ...wine({ id: "bad3" }), type: "purple" as unknown as Wine["type"] },
    ]);
    expect(out.map((w) => w.id)).toEqual(["ok"]);
  });

  it("merges the same bottling written different ways, unioning tags", () => {
    const out = dedupeWines([
      wine({ id: "a", producer: "Broc Cellars", festivals: ["raw"], notes: ["cranberry"] }),
      wine({
        id: "b",
        producer: "Broc Cellars, Inc.",
        name: "Cuvée Love Red 2022 (RAW NY) 750ml",
        festivals: ["wineFare"],
        identities: ["woman"],
        practices: ["organic"],
        notes: ["pomegranate"],
        shopUrl: "https://example.com/shop",
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("a");
    expect(new Set(out[0].festivals)).toEqual(new Set(["raw", "wineFare"]));
    expect(out[0].identities).toEqual(["woman"]);
    expect(new Set(out[0].practices)).toEqual(new Set(["natural", "organic"]));
    expect(new Set(out[0].notes)).toEqual(new Set(["cranberry", "pomegranate"]));
    expect(out[0].shopUrl).toBe("https://example.com/shop");
  });

  it("keeps the canonical scalar values on merge (existing wins)", () => {
    const out = dedupeWines([
      wine({ id: "a", varietal: "Valdiguié", region: "California" }),
      wine({ id: "b", varietal: "Gamay", region: "Beaujolais", price: 32 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].varietal).toBe("Valdiguié");
    expect(out[0].region).toBe("California");
  });

  it("refuses to merge when the wine type conflicts — keeps both", () => {
    const out = dedupeWines([
      wine({ id: "a", type: "red" }),
      wine({ id: "b", type: "white" }),
    ]);
    expect(out.map((w) => w.id)).toEqual(["a", "b"]);
    expect(bottlingKey(out[0])).toBe(bottlingKey(out[1]));
  });

  it("refuses to merge when the price is wildly different — keeps both", () => {
    const out = dedupeWines([wine({ id: "a", price: 30 }), wine({ id: "b", price: 240 })]);
    expect(out.map((w) => w.id)).toEqual(["a", "b"]);
  });

  it("still merges when the price difference is within tolerance", () => {
    const out = dedupeWines([wine({ id: "a", price: 30 }), wine({ id: "b", price: 38 })]);
    expect(out).toHaveLength(1);
    expect(out[0].price).toBe(30);
  });

  it("treats different vintages of the same cuvée as distinct bottlings", () => {
    const out = dedupeWines([wine({ id: "a", year: 2021 }), wine({ id: "b", year: 2022 })]);
    expect(out.map((w) => w.id)).toEqual(["a", "b"]);
  });

  it("propagates festivals and identities across a producer's bottlings", () => {
    const out = dedupeWines([
      wine({ id: "a", name: "Love Red", festivals: ["raw"], identities: ["poc"] }),
      wine({ id: "b", name: "Love White", type: "white", tannin: 1 }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[1].festivals).toEqual(["raw"]);
    expect(out[1].identities).toEqual(["poc"]);
  });

  it("reports conflict-kept pairs through auditCatalog without failing the audit", () => {
    const audit = auditCatalog(
      dedupeWines([wine({ id: "a", type: "red" }), wine({ id: "b", type: "white" })]),
    );
    expect(audit.duplicateBottlings).toHaveLength(1);
    expect(audit.duplicateBottlings[0].conflict).toMatch(/type/);
    expect(audit.ok).toBe(true);
  });

  it("auditCatalog flags a genuinely broken catalog", () => {
    const broken = auditCatalog([
      wine({ id: "dup" }),
      wine({ id: "dup" }),
      { ...wine({ id: "x" }), description: "" } as Wine,
    ]);
    expect(broken.ok).toBe(false);
    expect(broken.duplicateIds).toContain("dup");
    expect(broken.invalid.map((i) => i.id)).toContain("x");
  });
});
