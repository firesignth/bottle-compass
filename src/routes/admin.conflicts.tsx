import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  WINES_SOURCE,
  analyzeMerges,
  producerSlug,
  type MergeRecord,
  type Wine,
} from "@/lib/wines";
import { loadUserWines } from "@/lib/user-wines";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/conflicts")({
  head: () => ({
    meta: [
      { title: "Merge Conflicts Admin · Bottle Compass" },
      {
        name: "description",
        content:
          "Review every wine merge decision: conflicting fields, rows kept apart, producer spelling variants, and invalid entries with before/after values.",
      },
      { property: "og:title", content: "Merge Conflicts Admin · Bottle Compass" },
      {
        property: "og:description",
        content: "Audit wine catalog merges with before/after values for every conflicting field.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConflictsAdmin,
});

type Tab = "conflicts" | "keptBoth" | "spellings" | "invalid" | "all";

function ConflictsAdmin() {
  const [userWines, setUserWines] = useState<Wine[]>([]);
  const [tab, setTab] = useState<Tab>("conflicts");
  const [q, setQ] = useState("");

  useEffect(() => {
    setUserWines(loadUserWines());
  }, []);

  const analysis = useMemo(
    () => analyzeMerges([...WINES_SOURCE, ...userWines]),
    [userWines],
  );

  const rows = useMemo(() => {
    const list: MergeRecord[] =
      tab === "conflicts"
        ? analysis.conflictedMerges
        : tab === "keptBoth"
          ? analysis.keptBoth
          : tab === "all"
            ? analysis.merges
            : [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((m) =>
      `${m.producer} ${m.name} ${m.canonicalId} ${m.incomingId}`.toLowerCase().includes(needle),
    );
  }, [analysis, tab, q]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "conflicts", label: "Field conflicts", count: analysis.conflictedMerges.length },
    { id: "keptBoth", label: "Kept apart", count: analysis.keptBoth.length },
    { id: "spellings", label: "Producer spellings", count: analysis.producerSpellings.length },
    { id: "invalid", label: "Invalid rows", count: analysis.invalid.length + analysis.duplicateIds.length },
    { id: "all", label: "All merges", count: analysis.merges.length },
  ];

  return (
    <div className="mx-auto max-w-[100rem] px-6 py-10 sm:px-10">
      <header className="mb-8">
        <div className="mb-2 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Bottle Compass
          </Link>
          <span>/</span>
          <span>Admin</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl">Wine merge conflicts</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every duplicate detected during catalog ingestion, with the value kept, the incoming value,
          and the result after merging. {analysis.merges.length} merge decisions across{" "}
          {WINES_SOURCE.length + userWines.length} source rows.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`rounded-full border px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              tab === t.id
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            <span className="ml-2 opacity-70">{t.count}</span>
          </button>
        ))}
        {(tab === "conflicts" || tab === "keptBoth" || tab === "all") && (
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by producer, wine, or id…"
            className="ml-auto w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm sm:w-72"
          />
        )}
      </div>

      {tab === "spellings" && (
        <ul className="space-y-2">
          {analysis.producerSpellings.length === 0 && <Empty label="No producer spelling variants." />}
          {analysis.producerSpellings.map((s) => (
            <li key={s.key} className="rounded-lg border border-border bg-card p-4 text-sm">
              <div className="font-medium">{s.canonical}</div>
              <div className="mt-1 text-muted-foreground">
                Normalized as <code className="text-xs">{s.key}</code> — also seen as{" "}
                {s.ignored.join(", ")}
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === "invalid" && (
        <div className="space-y-4">
          {analysis.duplicateIds.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-card p-4 text-sm">
              <div className="font-medium">Duplicate ids ({analysis.duplicateIds.length})</div>
              <div className="mt-1 text-muted-foreground">{analysis.duplicateIds.join(", ")}</div>
            </div>
          )}
          {analysis.invalid.map((i) => (
            <div key={i.id} className="rounded-lg border border-destructive/40 bg-card p-4 text-sm">
              <div className="font-medium">{i.id}</div>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {i.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ))}
          {analysis.invalid.length === 0 && analysis.duplicateIds.length === 0 && (
            <Empty label="No invalid rows or duplicate ids." />
          )}
        </div>
      )}

      {(tab === "conflicts" || tab === "keptBoth" || tab === "all") && (
        <div className="space-y-4">
          {rows.length === 0 && <Empty label="Nothing to review here." />}
          {rows.map((m) => (
            <article
              key={`${m.canonicalId}-${m.incomingId}`}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <Link
                    to="/producers/$slug"
                    params={{ slug: producerSlug(m.producer) }}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {m.producer}
                  </Link>
                  <span className="text-muted-foreground">
                    {" "}
                    — {m.name} {m.year}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                    m.kind === "kept-both"
                      ? "bg-destructive/10 text-destructive"
                      : m.changes.some((c) => c.conflict)
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {m.kind === "kept-both" ? "Kept apart" : m.changes.some((c) => c.conflict) ? "Conflict" : "Clean merge"}
                </span>
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                kept <code>{m.canonicalId}</code> · incoming <code>{m.incomingId}</code>
                {m.reason ? ` · ${m.reason}` : ""}
              </div>

              {m.changes.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Identical rows — nothing changed on merge.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-1 pr-4 font-normal">Field</th>
                        <th className="py-1 pr-4 font-normal">Before (kept)</th>
                        <th className="py-1 pr-4 font-normal">Incoming</th>
                        <th className="py-1 font-normal">After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.changes.map((c) => (
                        <tr key={c.field} className="border-t border-border/60 align-top">
                          <td className="py-1.5 pr-4 font-medium">
                            {c.field}
                            {c.conflict && <span className="ml-1 text-destructive">*</span>}
                          </td>
                          <td className="py-1.5 pr-4 text-muted-foreground">{c.before}</td>
                          <td className="py-1.5 pr-4 text-muted-foreground">{c.incoming}</td>
                          <td className="py-1.5">{c.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <div className="mt-10">
        <Button asChild variant="outline">
          <Link to="/">Back to discovery</Link>
        </Button>
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
