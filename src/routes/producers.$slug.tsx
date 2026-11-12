import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  WINES,
  PRACTICES,
  FESTIVALS,
  IDENTITIES,
  producerSlug,
  winesByProducerSlug,
  learnMoreUrl,
  buyUrl,
  type Wine,
} from "@/lib/wines";
import {
  scoreWine,
  matchReasons,
  loadInitial,
  mergePrefs,
  mergeEnabled,
  DEFAULTS,
  DEFAULT_ENABLED,
  type Prefs,
  type SectionKey,
} from "@/routes/index";

export const Route = createFileRoute("/producers/$slug")({
  loader: ({ params }) => {
    const wines = winesByProducerSlug(params.slug);
    if (wines.length === 0) throw notFound();
    return { wines, producer: wines[0].producer };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.producer ?? "Producer";
    const title = `${name} — Bottle Compass`;
    const desc = loaderData
      ? `Explore wines from ${name} and see why they match your saved characteristics.`
      : "Producer page.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: ProducerPage,
  notFoundComponent: ProducerNotFound,
});

function ProducerNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        Producer
      </p>
      <h1 className="mt-2 font-serif text-3xl italic">Not in the cellar</h1>
      <p className="mt-3 text-muted-foreground">
        We don't have that producer catalogued yet.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-full border border-primary/50 px-5 py-2 text-sm uppercase tracking-widest text-primary hover:bg-primary/10"
      >
        Back to search
      </Link>
    </div>
  );
}

function ProducerPage() {
  const { wines, producer } = Route.useLoaderData() as { wines: Wine[]; producer: string };
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [enabled, setEnabled] = useState<Record<SectionKey, boolean>>(DEFAULT_ENABLED);
  const [hydrated, setHydrated] = useState(false);
  const [noteQuery, setNoteQuery] = useState("");
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);

  useEffect(() => {
    const init = loadInitial();
    if (init) {
      setPrefs(mergePrefs(DEFAULTS, init.prefs));
      setEnabled(mergeEnabled(DEFAULT_ENABLED, init.enabled));
    }
    setHydrated(true);
  }, []);

  const scored = wines
    .map((w) => ({ w, score: scoreWine(w, prefs, enabled), reasons: matchReasons(w, prefs, enabled) }))
    .sort((a, b) => b.score - a.score);

  const matchCount = scored.filter((s) => s.score >= 0).length;
  const first = wines[0];
  const winemakers = Array.from(new Set(wines.map((w) => w.winemaker).filter(Boolean)));
  const allPractices = Array.from(new Set(wines.flatMap((w) => w.practices)));
  const allIdentities = Array.from(new Set(wines.flatMap((w) => w.identities ?? [])));
  const allFestivals = Array.from(new Set(wines.flatMap((w) => w.festivals ?? [])));
  const regions = Array.from(new Set(wines.map((w) => w.region)));

  // Tasting highlights: aggregate top notes, style mix, price range, vintages
  const noteCounts = new Map<string, number>();
  wines.forEach((w) => w.notes.forEach((n) => noteCounts.set(n, (noteCounts.get(n) ?? 0) + 1)));
  const topNotes = Array.from(noteCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([n]) => n);

  const styleCounts = new Map<string, number>();
  wines.forEach((w) => styleCounts.set(w.type, (styleCounts.get(w.type) ?? 0) + 1));
  const styleMix = Array.from(styleCounts.entries()).sort((a, b) => b[1] - a[1]);

  const prices = wines.map((w) => w.price).sort((a, b) => a - b);
  const priceRange =
    prices.length === 0
      ? null
      : prices[0] === prices[prices.length - 1]
        ? `$${prices[0]}`
        : `$${prices[0]}–$${prices[prices.length - 1]}`;

  const years = wines.map((w) => w.year).sort((a, b) => a - b);
  const vintageRange =
    years.length === 0
      ? null
      : years[0] === years[years.length - 1]
        ? `${years[0]}`
        : `${years[0]}–${years[years.length - 1]}`;

  const avg = (k: "body" | "sweetness" | "acidity" | "tannin") =>
    wines.reduce((s, w) => s + w[k], 0) / wines.length;

  // Derived bio narrative
  const practiceLabels = allPractices
    .map((p) => PRACTICES.find((x) => x.value === p)?.label ?? p)
    .slice(0, 4);
  const identityLabels = allIdentities.map(
    (i) => IDENTITIES.find((x) => x.value === i)?.label ?? i,
  );
  const bioBits: string[] = [];
  if (winemakers.length > 0) {
    bioBits.push(`Led by ${winemakers.join(" and ")}`);
  }
  if (regions.length > 0) {
    bioBits.push(
      regions.length === 1
        ? `working out of ${regions[0]}`
        : `sourcing across ${regions.slice(0, 2).join(" and ")}${regions.length > 2 ? " and beyond" : ""}`,
    );
  }
  if (practiceLabels.length > 0) {
    bioBits.push(
      `their cellar leans ${practiceLabels.slice(0, 3).join(", ").toLowerCase()}`,
    );
  }
  const styleWord =
    styleMix.length === 1
      ? `all ${styleMix[0][0]}`
      : `a mix of ${styleMix.map(([t, n]) => `${n} ${t}`).join(", ")}`;
  bioBits.push(
    `The cellar shows ${wines.length} bottle${wines.length === 1 ? "" : "s"} — ${styleWord}`,
  );
  if (identityLabels.length > 0) {
    bioBits.push(`Recognized as ${identityLabels.join(" · ").toLowerCase()}`);
  }
  const bio = bioBits.join(". ") + ".";


  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          to="/"
          className="text-xs uppercase tracking-widest text-muted-foreground hover:text-primary"
        >
          ← Back to search
        </Link>

        <header className="mt-6 border-b border-border pb-8">
          <p className="text-xs uppercase tracking-widest text-accent">Producer</p>
          <h1 className="mt-2 font-serif text-4xl italic sm:text-5xl md:text-6xl">
            {producer}
          </h1>
          {winemakers.length > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="uppercase tracking-widest text-foreground/60">Winemaker</span>{" "}
              · {winemakers.join(", ")}
            </p>
          )}
          {regions.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {regions.join(" · ")}
            </p>
          )}

          {(allPractices.length > 0 || allIdentities.length > 0 || allFestivals.length > 0) && (
            <div className="mt-5 flex flex-wrap items-center gap-1.5">
              {allIdentities.map((id) => (
                <span
                  key={id}
                  className="rounded-full border border-accent/40 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-accent/90"
                >
                  {IDENTITIES.find((x) => x.value === id)?.label ?? id}
                </span>
              ))}
              {allFestivals.length > 1 && (
                <span
                  className="rounded-full border border-primary/50 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary"
                  title={`Cross-listed across ${allFestivals.length} fairs: ${allFestivals.map((f) => FESTIVALS.find((x) => x.value === f)?.label ?? f).join(", ")}`}
                >
                  ✦ Cross-listed · {allFestivals.length} fairs
                </span>
              )}
              {allFestivals.map((f) => (
                <span
                  key={f}
                  className="rounded-full border border-accent/40 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-accent/90"
                >
                  @ {FESTIVALS.find((x) => x.value === f)?.label ?? f}
                </span>
              ))}
              {allPractices.map((pr) => (
                <span
                  key={pr}
                  className="rounded-full border border-primary/30 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-primary/90"
                >
                  {PRACTICES.find((x) => x.value === pr)?.label ?? pr}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={learnMoreUrl(first)}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-full border border-primary/60 px-4 py-2 text-xs uppercase tracking-widest text-primary hover:bg-primary/10"
            >
              Visit winemaker →
            </a>
          </div>

          {hydrated && (
            <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">
              {matchCount === 0
                ? "None of these wines match your saved characteristics right now."
                : `${matchCount} of ${wines.length} bottle${wines.length === 1 ? "" : "s"} match your saved characteristics.`}
            </p>
          )}
        </header>

        <section className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 rounded-xl border border-border bg-card/50 p-5 sm:p-6">
            <div className="text-[10px] uppercase tracking-widest text-accent">Bio</div>
            <p className="mt-2 font-serif text-lg italic leading-relaxed text-foreground/90 sm:text-xl">
              {bio}
            </p>
          </div>
          <aside className="rounded-xl border border-border bg-card/50 p-5 sm:p-6">
            <div className="text-[10px] uppercase tracking-widest text-accent">At a glance</div>
            <dl className="mt-3 space-y-2 text-sm">
              {priceRange && (
                <div className="flex justify-between gap-3">
                  <dt className="uppercase tracking-widest text-muted-foreground text-[11px]">Price</dt>
                  <dd className="font-serif text-accent">{priceRange}</dd>
                </div>
              )}
              {vintageRange && (
                <div className="flex justify-between gap-3">
                  <dt className="uppercase tracking-widest text-muted-foreground text-[11px]">Vintages</dt>
                  <dd>{vintageRange}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="uppercase tracking-widest text-muted-foreground text-[11px]">Bottles</dt>
                <dd>{wines.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="uppercase tracking-widest text-muted-foreground text-[11px]">Style mix</dt>
                <dd className="text-right">{styleMix.map(([t, n]) => `${n} ${t}`).join(" · ")}</dd>
              </div>
            </dl>
          </aside>
        </section>

        <section className="mt-6 rounded-xl border border-border bg-card/50 p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-accent">Tasting notes</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Search or tap notes to filter the bottles below.
              </p>
            </div>
            {selectedNotes.length > 0 && (
              <button
                onClick={() => setSelectedNotes([])}
                className="text-[11px] uppercase tracking-widest text-muted-foreground hover:text-primary"
              >
                Clear ({selectedNotes.length})
              </button>
            )}
          </div>

          <input
            type="search"
            value={noteQuery}
            onChange={(e) => setNoteQuery(e.target.value)}
            placeholder="Search notes (e.g. cherry, saline, smoke)"
            className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />

          {(() => {
            const q = noteQuery.trim().toLowerCase();
            const allNotes = Array.from(noteCounts.entries()).sort(
              (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
            );
            const visible = q ? allNotes.filter(([n]) => n.toLowerCase().includes(q)) : allNotes;
            if (visible.length === 0) {
              return (
                <p className="mt-3 text-sm text-muted-foreground">
                  No notes match "{noteQuery}".
                </p>
              );
            }
            return (
              <>
                {topNotes.length > 0 && !q && selectedNotes.length === 0 && (
                  <div className="mt-4">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Highlights
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {topNotes.map((n) => (
                        <button
                          key={n}
                          onClick={() => setSelectedNotes([n])}
                          className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[11px] uppercase tracking-widest text-primary hover:bg-primary/20"
                        >
                          {n} · {noteCounts.get(n)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {visible.map(([n, c]) => {
                    const active = selectedNotes.includes(n);
                    return (
                      <button
                        key={n}
                        aria-pressed={active}
                        onClick={() =>
                          setSelectedNotes((prev) =>
                            prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n],
                          )
                        }
                        className={
                          "rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-widest transition " +
                          (active
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-border bg-background text-muted-foreground hover:border-primary/60 hover:text-primary")
                        }
                      >
                        {n} · {c}
                      </button>
                    );
                  })}
                </div>
              </>
            );
          })()}

          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Avg body" value={Math.round(avg("body"))} />
            <Stat label="Avg sweetness" value={Math.round(avg("sweetness"))} />
            <Stat label="Avg acidity" value={Math.round(avg("acidity"))} />
            <Stat label="Avg tannin" value={Math.round(avg("tannin"))} />
          </div>
        </section>

        <h2 className="mt-10 font-serif text-2xl italic sm:text-3xl">
          The bottles
          {selectedNotes.length > 0 && (
            <span className="ml-2 text-sm not-italic text-muted-foreground">
              · filtered by {selectedNotes.join(", ")}
            </span>
          )}
        </h2>
        <ol className="mt-4 space-y-5">

          {scored
            .filter(({ w }) =>
              selectedNotes.length === 0
                ? true
                : selectedNotes.every((sn) =>
                    w.notes.some((n) => n.toLowerCase() === sn.toLowerCase()),
                  ),
            )
            .map(({ w, score, reasons }, i) => {
            const excluded = score < 0;
            return (
              <li
                key={w.id}
                className={
                  "rounded-xl border p-5 transition sm:p-6 " +
                  (excluded
                    ? "border-border/60 bg-card/30 opacity-70"
                    : "border-border bg-card/60 hover:border-primary/60")
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                      <span className="text-accent">{String(i + 1).padStart(2, "0")}</span>
                      <span>·</span>
                      <span>{w.type}</span>
                      <span>·</span>
                      <span>{w.year}</span>
                      {excluded && hydrated && (
                        <>
                          <span>·</span>
                          <span className="text-destructive/80">Excluded by your filters</span>
                        </>
                      )}
                    </div>
                    <h2 className="mt-1 font-serif text-2xl italic sm:text-3xl">{w.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {w.varietal} · {w.region}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-serif text-2xl text-accent">${w.price}</div>
                    <a
                      href={buyUrl(w)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-1 inline-block text-[11px] uppercase tracking-widest text-muted-foreground hover:text-primary"
                    >
                      Shop the bottle →
                    </a>
                  </div>
                </div>

                <p className="mt-4 text-[15px] leading-relaxed text-foreground/85">
                  {w.description}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Body" value={w.body} />
                  <Stat label="Sweetness" value={w.sweetness} />
                  <Stat label="Acidity" value={w.acidity} />
                  {w.type === "red" && <Stat label="Tannin" value={w.tannin} />}
                </div>

                <div className="mt-4">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Tasting notes
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {w.notes.map((n) => {
                      const active = selectedNotes.some(
                        (sn) => sn.toLowerCase() === n.toLowerCase(),
                      );
                      return (
                        <span
                          key={n}
                          className={
                            "rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-widest " +
                            (active
                              ? "border-accent bg-accent/20 text-accent-foreground font-semibold"
                              : "border-border text-muted-foreground")
                          }
                        >
                          {n}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {w.pairing && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    <span className="uppercase tracking-widest text-foreground/60">Pairs with</span>{" "}
                    · {w.pairing}
                  </p>
                )}

                {hydrated && reasons.length > 0 && (
                  <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 p-3">
                    <div className="text-[10px] uppercase tracking-widest text-accent">
                      Why it matches your saved characteristics
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
                )}
                {hydrated && reasons.length === 0 && !excluded && (
                  <p className="mt-4 text-xs italic text-muted-foreground">
                    No direct reasons from your active filters — enable more sections on the search page to see specific matches.
                  </p>
                )}
              </li>
            );
          })}
        </ol>
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
              "h-1.5 w-4 rounded-full " +
              (n <= value ? "bg-primary" : "bg-border")
            }
          />
        ))}
      </div>
    </div>
  );
}
