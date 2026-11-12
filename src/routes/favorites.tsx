import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { WINES, producerSlug, learnMoreUrl, buyUrl, type Wine } from "@/lib/wines";
import { loadFavorites, toggleFavorite } from "@/lib/favorites";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "My Favorite Wines · Bottle Compass" },
      { name: "description", content: "Your saved wine favorites — a personal shortlist of producers and bottlings from the discovery results." },
      { property: "og:title", content: "My Favorite Wines · Bottle Compass" },
      { property: "og:description", content: "Your saved wine favorites — a personal shortlist of producers and bottlings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    setIds(loadFavorites());
  }, []);

  const wines = useMemo(() => {
    const set = new Set(ids);
    return WINES.filter((w) => set.has(w.id));
  }, [ids]);

  const grouped = useMemo(() => {
    const map = new Map<string, Wine[]>();
    for (const w of wines) {
      const arr = map.get(w.producer) ?? [];
      arr.push(w);
      map.set(w.producer, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [wines]);

  const remove = (id: string) => setIds(toggleFavorite(id));
  const clearAll = () => {
    if (!confirm("Remove all favorites?")) return;
    for (const id of ids) toggleFavorite(id);
    setIds([]);
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Bottle Compass</p>
          <h1 className="mt-2 font-serif text-4xl text-foreground">My favorites</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {wines.length === 0
              ? "No saved wines yet. Tap the heart on any result to add it here."
              : `${wines.length} saved bottling${wines.length === 1 ? "" : "s"} across ${grouped.length} producer${grouped.length === 1 ? "" : "s"}.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/">
            <Button variant="outline" size="sm">← Back to results</Button>
          </Link>
          {wines.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearAll}>
              Clear all
            </Button>
          )}
        </div>
      </div>

      {wines.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="font-serif text-xl text-foreground">Your list is empty</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Explore the discovery page and press ♡ on any wine to save it.
          </p>
          <Link to="/" className="mt-4 inline-block">
            <Button size="sm">Discover wines</Button>
          </Link>
        </div>
      ) : (
        <ul className="space-y-8">
          {grouped.map(([producer, list]) => (
            <li key={producer}>
              <div className="mb-3 flex items-baseline justify-between border-b border-border pb-2">
                <Link
                  to="/producers/$slug"
                  params={{ slug: producerSlug(producer) }}
                  className="font-serif text-2xl text-foreground hover:text-primary"
                >
                  {producer}
                </Link>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {list.length} bottling{list.length === 1 ? "" : "s"}
                </span>
              </div>
              <ul className="space-y-3">
                {list.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-start justify-between gap-4 rounded-md border border-border bg-card p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-lg text-foreground">
                        {w.name} {w.year ? <span className="text-muted-foreground">· {w.year}</span> : null}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {w.varietal} · {w.region}
                        {typeof w.price === "number" ? ` · $${w.price}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs">
                        {learnMoreUrl(w) && (
                          <a
                            href={learnMoreUrl(w)!}
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-dotted underline-offset-4 hover:text-primary"
                          >
                            Visit winemaker ↗
                          </a>
                        )}
                        {buyUrl(w) && (
                          <a
                            href={buyUrl(w)!}
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-dotted underline-offset-4 hover:text-primary"
                          >
                            Shop the bottle ↗
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(w.id)}
                      aria-label={`Remove ${w.name} from favorites`}
                      title="Remove from favorites"
                      className="shrink-0 rounded-full border border-accent bg-accent/20 p-2 text-lg leading-none text-accent transition hover:bg-accent/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      ♥
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
