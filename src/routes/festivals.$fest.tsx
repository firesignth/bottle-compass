import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FESTIVALS, WINES, festivalsForProducer, producerSlug, type Festival, type Wine } from "@/lib/wines";

export const Route = createFileRoute("/festivals/$fest")({
  loader: ({ params }) => {
    const meta = FESTIVALS.find((f) => f.value === params.fest);
    if (!meta) throw notFound();
    const wines = WINES.filter((w) => w.festivals?.includes(params.fest as Festival));
    return { meta, wines };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Fair not found — Bottle Compass" }, { name: "robots", content: "noindex" }] };
    }
    const { meta, wines } = loaderData;
    const producerCount = new Set(wines.map((w) => w.producer)).size;
    const title = `${meta.label} — ${producerCount} producers — Bottle Compass`;
    return {
      meta: [
        { title },
        { name: "description", content: meta.blurb },
        { property: "og:title", content: title },
        { property: "og:description", content: meta.blurb },
      ],
    };
  },
  component: FestivalDetail,
  notFoundComponent: () => (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="font-serif text-3xl text-foreground">Fair not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">That festival isn't in our catalog.</p>
      <Link to="/festivals" className="mt-6 inline-block text-sm text-primary hover:underline">
        See all fairs →
      </Link>
    </div>
  ),
});

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function FestivalDetail() {
  const { meta, wines } = Route.useLoaderData() as { meta: (typeof FESTIVALS)[number]; wines: Wine[] };
  const [query, setQuery] = useState("");
  const [activeNotes, setActiveNotes] = useState<string[]>([]);

  // Top tasting notes across this fair (max 24, ranked by frequency)
  const noteOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of wines) for (const n of w.notes) counts.set(n, (counts.get(n) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 24)
      .map(([n, count]) => ({ note: n, count }));
  }, [wines]);

  const q = normalize(query.trim());

  // Filter wines by tasting notes (any-match)
  const noteFiltered = useMemo(() => {
    if (activeNotes.length === 0) return wines;
    return wines.filter((w) => w.notes.some((n) => activeNotes.includes(n)));
  }, [wines, activeNotes]);

  // Group by producer, then filter by producer-name query
  const producers = useMemo(() => {
    const byProducer = new Map<string, Wine[]>();
    for (const w of noteFiltered) {
      const arr = byProducer.get(w.producer) ?? [];
      arr.push(w);
      byProducer.set(w.producer, arr);
    }
    let entries = Array.from(byProducer.entries());
    if (q) entries = entries.filter(([producer]) => normalize(producer).includes(q));
    return entries.sort((a, b) => a[0].localeCompare(b[0]));
  }, [noteFiltered, q]);

  const totalBottles = producers.reduce((s, [, b]) => s + b.length, 0);
  const filtersActive = q.length > 0 || activeNotes.length > 0;

  const toggleNote = (n: string) =>
    setActiveNotes((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

  return (
    <div className="min-h-screen bg-background px-4 py-10 md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <Link to="/festivals" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
            ← All fairs
          </Link>
          <h1 className="mt-3 font-serif text-4xl text-foreground md:text-5xl">{meta.label}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{meta.blurb}</p>
          <p className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">
            {filtersActive ? (
              <>
                {producers.length} of {new Set(wines.map((w) => w.producer)).size} producers ·{" "}
                {totalBottles} of {wines.length} bottles
              </>
            ) : (
              <>
                {producers.length} {producers.length === 1 ? "producer" : "producers"} ·{" "}
                {wines.length} {wines.length === 1 ? "bottle" : "bottles"}
              </>
            )}
          </p>
        </div>

        {/* Search + tasting-note filters */}
        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <label htmlFor="fair-search" className="block text-[11px] uppercase tracking-widest text-muted-foreground">
            Find producer
          </label>
          <input
            id="fair-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by producer name…"
            className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />

          {noteOptions.length > 0 && (
            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Filter by tasting note
                </span>
                {activeNotes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveNotes([])}
                    className="text-[11px] uppercase tracking-widest text-primary hover:underline"
                  >
                    Clear ({activeNotes.length})
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {noteOptions.map(({ note, count }) => {
                  const active = activeNotes.includes(note);
                  return (
                    <button
                      key={note}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleNote(note)}
                      className={
                        "rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-widest transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
                        (active
                          ? "border-primary bg-primary/15 text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/60 hover:text-primary")
                      }
                    >
                      {note}
                      <span className="ml-1 text-muted-foreground/70">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {producers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {filtersActive
                ? "No producers match those filters at this fair."
                : "No producers from this fair are in the catalog yet."}
            </p>
            {filtersActive && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setActiveNotes([]);
                }}
                className="mt-3 text-xs uppercase tracking-widest text-primary hover:underline"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {producers.map(([producer, bottles]) => {
              const regions = Array.from(new Set(bottles.map((b) => b.region)));
              const otherFests = festivalsForProducer(producer).filter((f) => f !== meta.value);
              return (
                <li key={producer} className="p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      to="/producers/$slug"
                      params={{ slug: producerSlug(producer) }}
                      className="font-serif text-xl text-foreground hover:text-primary"
                    >
                      {producer}
                    </Link>
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">
                      {bottles.length} {bottles.length === 1 ? "bottle" : "bottles"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{regions.join(" · ")}</p>
                  {otherFests.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-primary/50 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
                        ✦ Cross-listed
                      </span>
                      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                        Also at
                      </span>
                      {otherFests.map((f) => {
                        const label = FESTIVALS.find((x) => x.value === f)?.label ?? f;
                        return (
                          <Link
                            key={f}
                            to="/festivals/$fest"
                            params={{ fest: f }}
                            className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:border-primary/60 hover:text-primary"
                          >
                            {label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                  <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                    {bottles.map((b) => {
                      const matchedNotes =
                        activeNotes.length > 0 ? b.notes.filter((n) => activeNotes.includes(n)) : [];
                      return (
                        <li key={b.id} className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-foreground">{b.name}</span>
                          <span className="text-muted-foreground/70">
                            {b.year} · ${b.price}
                          </span>
                          {matchedNotes.map((n) => (
                            <span
                              key={n}
                              className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary"
                            >
                              {n}
                            </span>
                          ))}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
