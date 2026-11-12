import { describe, expect, it } from "vitest";
import {
  WINES,
  WINES_SOURCE,
  auditCatalog,
  bottlingKey,
  dedupeWines,
  validateWine,
} from "../wines";

describe("built-in catalog integrity", () => {
  const audit = auditCatalog(WINES);

  it("has no duplicate ids", () => {
    expect(audit.duplicateIds).toEqual([]);
  });

  it("has no rows with missing or invalid required fields", () => {
    expect(audit.invalid).toEqual([]);
  });

  it("collapses every producer to a single canonical spelling", () => {
    expect(audit.producerSpellingSplits).toEqual([]);
  });

  it("only keeps duplicate bottling keys when they genuinely conflict", () => {
    const unexplained = audit.duplicateBottlings.filter((d) => !d.conflict);
    expect(unexplained).toEqual([]);
  });

  it("passes the full audit", () => {
    expect(audit.ok).toBe(true);
  });

  it("drops nothing valid: every source row is either kept or explainably merged", () => {
    const validSource = WINES_SOURCE.filter((w) => validateWine(w).ok);
    const keptIds = new Set(WINES.map((w) => w.id));
    const droppedKeys = new Set(
      validSource.filter((w) => !keptIds.has(w.id)).map((w) => bottlingKey(w)),
    );
    const keptKeys = new Set(WINES.map((w) => bottlingKey(w)));
    // Anything dropped must have merged into a surviving bottling with the same key.
    for (const key of droppedKeys) expect(keptKeys.has(key)).toBe(true);
  });

  it("is idempotent — re-running dedupe changes nothing", () => {
    const again = dedupeWines(WINES.map((w) => ({ ...w })));
    expect(again.length).toBe(WINES.length);
    expect(again.map((w) => w.id)).toEqual(WINES.map((w) => w.id));
  });
});
