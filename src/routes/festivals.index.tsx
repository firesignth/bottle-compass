import { createFileRoute, Link } from "@tanstack/react-router";
import { FESTIVALS, WINES, type Festival } from "@/lib/wines";

export const Route = createFileRoute("/festivals/")({
  head: () => ({
    meta: [
      { title: "Fairs & Festivals — Bottle Compass" },
      { name: "description", content: "Browse producers by the natural-wine fair that features them: RAW Wine, The Vinguard's WINeFare, Unfiltered, Big West." },
      { property: "og:title", content: "Fairs & Festivals — Bottle Compass" },
      { property: "og:description", content: "Browse producers by the natural-wine fair that features them." },
    ],
  }),
  component: FestivalsIndex,
});

function FestivalsIndex() {
  const stats = FESTIVALS.map((f) => {
    const wines = WINES.filter((w) => w.festivals?.includes(f.value));
    const producers = new Set(wines.map((w) => w.producer)).size;
    return { ...f, wineCount: wines.length, producerCount: producers };
  });

  return (
    <div className="min-h-screen bg-background px-4 py-10 md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <Link to="/" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
            ← Back to search
          </Link>
          <h1 className="mt-3 font-serif text-4xl text-foreground md:text-5xl">Fairs & Festivals</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Pick a fair to see the producers it features and every bottle in our catalog from that lineup.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {stats.map((f) => (
            <Link
              key={f.value}
              to="/festivals/$fest"
              params={{ fest: f.value }}
              className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary hover:bg-accent/40"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-2xl text-foreground group-hover:text-primary">{f.label}</h2>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {f.producerCount} {f.producerCount === 1 ? "producer" : "producers"}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{f.blurb}</p>
              <p className="mt-3 text-xs text-muted-foreground/80">
                {f.wineCount} {f.wineCount === 1 ? "bottle" : "bottles"} in catalog
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export type FestivalMeta = (typeof FESTIVALS)[number] & { key: Festival };
