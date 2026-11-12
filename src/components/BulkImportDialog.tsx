import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { fetchAndParse, importWines, type ImportPreview, type ImportReport } from "@/lib/bulk-import";
import type { Wine } from "@/lib/wines";

type Phase = "input" | "preview" | "done";

export function BulkImportDialog({
  onImported,
  trigger,
}: {
  onImported: (list: Wine[]) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  const reset = () => {
    setPhase("input");
    setPreview(null);
    setReport(null);
    setError(null);
    setUrl("");
  };

  const handleFetch = async () => {
    setError(null);
    setLoading(true);
    try {
      const p = await fetchAndParse(url);
      setPreview(p);
      setPhase("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch.");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    if (!preview) return;
    const r = importWines(preview.wines, preview.missingPerWine);
    setReport(r);
    setPhase("done");
    onImported(r.finalList);
  };

  const detected = preview ? Object.keys(preview.headerMap) : [];
  const missing = preview
    ? preview.headers
        .map((h, i) => ({ h, i }))
        .filter(({ i }) => !Object.values(preview.headerMap).includes(i))
        .map(({ h }) => h)
    : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk import winemakers</DialogTitle>
          <DialogDescription>
            Paste a public Google Sheets link (or any CSV URL). The sheet must be shared as
            &ldquo;Anyone with the link&rdquo;. I&rsquo;ll auto-detect columns like{" "}
            <em>producer, name, region, country, year, price, practices, festivals, website</em>.
          </DialogDescription>
        </DialogHeader>

        {phase === "input" && (
          <div className="space-y-3">
            <Label htmlFor="sheet-url">Google Sheets or CSV URL</Label>
            <Input
              id="sheet-url"
              placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=0"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Minimum required column</p>
              <p><code>producer</code> (or <code>winery</code> / <code>domaine</code>)</p>
              <p className="mt-2 font-medium text-foreground mb-1">Recognized headers (any casing)</p>
              <p>
                producer, name/bottling, winemaker, varietal/grape, region/appellation, country,
                year/vintage, type/color, price, notes, practices/farming, festivals, identity,
                website, shop, pairing, description
              </p>
            </div>
          </div>
        )}

        {phase === "preview" && preview && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{preview.wines.length} valid rows</Badge>
              {detected.map((f) => (
                <Badge key={f} variant="outline" className="capitalize">
                  ✓ {f}
                </Badge>
              ))}
              {missing.map((h) => (
                <Badge key={h} variant="outline" className="opacity-60">
                  – {h}
                </Badge>
              ))}
            </div>
            <div className="rounded-md border max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1">Producer</th>
                    <th className="text-left px-2 py-1">Bottling</th>
                    <th className="text-left px-2 py-1">Region</th>
                    <th className="text-left px-2 py-1">Year</th>
                    <th className="text-left px-2 py-1">Practices</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.wines.slice(0, 25).map((w) => (
                    <tr key={w.id} className="border-t">
                      <td className="px-2 py-1 font-medium">{w.producer}</td>
                      <td className="px-2 py-1">{w.name}</td>
                      <td className="px-2 py-1">{w.region}</td>
                      <td className="px-2 py-1">{w.year}</td>
                      <td className="px-2 py-1">{w.practices.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.wines.length > 25 && (
              <p className="text-xs text-muted-foreground">
                Showing first 25 of {preview.wines.length}. All will be imported.
              </p>
            )}
          </div>
        )}

        {phase === "done" && report && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge>{report.added} added</Badge>
              <Badge variant="secondary">{report.merged} merged with existing</Badge>
              {report.duplicates > 0 && (
                <Badge variant="outline">{report.duplicates} skipped duplicates</Badge>
              )}
              {report.invalid > 0 && (
                <Badge variant="destructive">{report.invalid} invalid</Badge>
              )}
              {report.incomplete > 0 && (
                <Badge variant="outline" className="border-amber-500/60 text-amber-700">
                  {report.incomplete} with missing fields
                </Badge>
              )}
            </div>

            {/* Automated post-ingestion integrity check */}
            <div
              className={`rounded-md border p-2 text-xs ${
                report.audit.ok
                  ? "border-emerald-600/40 bg-emerald-500/5"
                  : "border-destructive/50 bg-destructive/5"
              }`}
            >
              <p className="font-medium mb-1">
                {report.audit.ok
                  ? `Integrity check passed — ${report.audit.total} bottlings, no duplicate IDs, no missing fields, dedupe clean.`
                  : "Integrity check found problems"}
              </p>
              {!report.audit.ok && (
                <ul className="space-y-1 text-muted-foreground">
                  {report.audit.duplicateIds.length > 0 && (
                    <li>Duplicate IDs: {report.audit.duplicateIds.slice(0, 8).join(", ")}</li>
                  )}
                  {report.audit.invalid.length > 0 && (
                    <li>
                      {report.audit.invalid.length} row(s) with missing/invalid fields —{" "}
                      {report.audit.invalid[0].id}: {report.audit.invalid[0].errors.join("; ")}
                    </li>
                  )}
                  {report.audit.duplicateBottlings.filter((d) => !d.conflict).length > 0 && (
                    <li>
                      {report.audit.duplicateBottlings.filter((d) => !d.conflict).length} unmerged
                      duplicate bottling(s)
                    </li>
                  )}
                  {report.audit.producerSpellingSplits.length > 0 && (
                    <li>
                      Producer name split:{" "}
                      {report.audit.producerSpellingSplits[0].names.join(" / ")}
                    </li>
                  )}
                </ul>
              )}
              {report.audit.ok && report.audit.duplicateBottlings.length > 0 && (
                <p className="text-muted-foreground">
                  {report.audit.duplicateBottlings.length} bottling pair(s) intentionally kept
                  separate due to type/price conflicts.
                </p>
              )}
            </div>

            {Object.keys(report.missingByField).length > 0 && (
              <div className="rounded-md border bg-muted/40 p-2 text-xs">
                <p className="font-medium mb-1">Missing fields (defaulted)</p>
                <ul className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                  {Object.entries(report.missingByField)
                    .sort((a, b) => b[1] - a[1])
                    .map(([field, count]) => (
                      <li key={field}>
                        <span className="font-medium text-foreground">{field}</span>: {count}
                      </li>
                    ))}
                </ul>
                <p className="mt-2 text-muted-foreground">
                  These rows imported with sensible defaults — edit them individually to fill in the missing data.
                </p>
              </div>
            )}

            {report.errors.length > 0 && (
              <div className="rounded-md border border-destructive/40 p-2 max-h-40 overflow-auto text-xs">
                <p className="font-medium mb-1">Rejected rows</p>
                <ul className="space-y-1">
                  {report.errors.slice(0, 15).map((e) => (
                    <li key={e.row}>
                      <span className="font-medium">Row {e.row}:</span> {e.producer} — {e.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {phase === "input" && (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button disabled={!url.trim() || loading} onClick={handleFetch}>
                {loading ? "Fetching…" : "Preview"}
              </Button>
            </>
          )}
          {phase === "preview" && (
            <>
              <Button variant="ghost" onClick={reset}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={!preview || preview.wines.length === 0}>
                Import {preview?.wines.length ?? 0} winemakers
              </Button>
            </>
          )}
          {phase === "done" && (
            <>
              <Button variant="ghost" onClick={reset}>
                Import another
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
