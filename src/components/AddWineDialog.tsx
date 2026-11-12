import { useState } from "react";
import { z } from "zod";
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
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  FESTIVALS,
  FLAVOR_NOTES,
  IDENTITIES,
  PRACTICES,
  type Festival,
  type Identity,
  type Practice,
  type Wine,
  type WineType,
} from "@/lib/wines";
import { addUserWine } from "@/lib/user-wines";

const TYPES: WineType[] = ["red", "white", "orange", "rosé", "sparkling", "dessert"];

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  producer: z.string().trim().min(1, "Producer is required").max(120),
  winemaker: z.string().trim().max(120).optional().or(z.literal("")),
  varietal: z.string().trim().min(1, "Varietal is required").max(120),
  region: z.string().trim().min(1, "Region is required").max(160),
  year: z
    .number({ invalid_type_error: "Year must be a number" })
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1),
  price: z.number().min(0).max(100000),
  pairing: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(800).optional().or(z.literal("")),
  producerUrl: z.string().trim().url("Must be a valid URL").max(500).optional().or(z.literal("")),
  shopUrl: z.string().trim().url("Must be a valid URL").max(500).optional().or(z.literal("")),
});

type Props = {
  onAdded: (w: Wine) => void;
  trigger?: React.ReactNode;
};

export function AddWineDialog({ onAdded, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [producer, setProducer] = useState("");
  const [winemaker, setWinemaker] = useState("");
  const [varietal, setVarietal] = useState("");
  const [region, setRegion] = useState("");
  const [year, setYear] = useState<string>(String(new Date().getFullYear() - 1));
  const [type, setType] = useState<WineType>("red");
  const [price, setPrice] = useState<string>("25");
  const [body, setBody] = useState(3);
  const [sweetness, setSweetness] = useState(2);
  const [acidity, setAcidity] = useState(3);
  const [tannin, setTannin] = useState(3);
  const [notes, setNotes] = useState<string[]>([]);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [pairing, setPairing] = useState("");
  const [description, setDescription] = useState("");
  const [producerUrl, setProducerUrl] = useState("");
  const [shopUrl, setShopUrl] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setName(""); setProducer(""); setWinemaker(""); setVarietal(""); setRegion("");
    setYear(String(new Date().getFullYear() - 1)); setType("red"); setPrice("25");
    setBody(3); setSweetness(2); setAcidity(3); setTannin(3);
    setNotes([]); setPractices([]); setFestivals([]); setIdentities([]);
    setPairing(""); setDescription(""); setProducerUrl(""); setShopUrl("");
    setErrors({});
  };

  const toggle = <T,>(arr: T[], setArr: (v: T[]) => void, v: T) =>
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      name, producer, winemaker, varietal, region,
      year: Number(year), price: Number(price),
      pairing, description, producerUrl, shopUrl,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errs[String(issue.path[0])] = issue.message;
      }
      setErrors(errs);
      return;
    }
    const d = parsed.data;
    const wine: Wine = {
      id: `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: d.name,
      producer: d.producer,
      winemaker: d.winemaker || undefined,
      varietal: d.varietal,
      region: d.region,
      year: d.year,
      type,
      body, sweetness, acidity, tannin,
      price: d.price,
      notes,
      practices,
      festivals: festivals.length ? festivals : undefined,
      identities: identities.length ? identities : undefined,
      pairing: d.pairing || "Versatile with everyday meals.",
      description: d.description || `${d.producer} ${d.name} — added to your cellar.`,
      producerUrl: d.producerUrl || undefined,
      shopUrl: d.shopUrl || undefined,
    };
    const result = addUserWine(wine);
    if (result.status === "invalid") {
      setErrors({ name: `Won't import — ${result.errors.join("; ")}.` });
      return;
    }
    if (result.status === "duplicate-id") {
      setErrors({ name: "That ID is already in use — try again." });
      return;
    }
    if (result.status === "merged") {
      const where = result.source === "builtin" ? "the catalog" : "your cellar";
      setErrors({
        name: `Already in ${where} as “${result.into.producer} — ${result.into.name} ${result.into.year}.” Tags merged, no duplicate added.`,
      });
      onAdded(result.into);
      return;
    }
    if (result.status === "conflict") {
      const where = result.source === "builtin" ? "the catalog" : "your cellar";
      setErrors({
        name: `Conflicts with ${where} entry “${result.against.producer} — ${result.against.name} ${result.against.year}” (${result.reason}). Rename or adjust and try again.`,
      });
      return;
    }
    onAdded(result.wine);
    reset();
    setOpen(false);


  };

  const field = (id: string, label: string, err?: string, hint?: string) => (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
      {err && <p className="text-[11px] text-destructive">{err}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setErrors({}); }}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline">Add wine</Button>}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Add a wine</DialogTitle>
          <DialogDescription>
            Add a bottle to your personal cellar. Saved in this browser.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              {field("w-name", "Name", errors.name)}
              <Input id="w-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </div>
            <div>
              {field("w-producer", "Producer", errors.producer)}
              <Input id="w-producer" value={producer} onChange={(e) => setProducer(e.target.value)} maxLength={120} />
            </div>
            <div>
              {field("w-winemaker", "Winemaker (optional)")}
              <Input id="w-winemaker" value={winemaker} onChange={(e) => setWinemaker(e.target.value)} maxLength={120} />
            </div>
            <div>
              {field("w-varietal", "Varietal", errors.varietal)}
              <Input id="w-varietal" value={varietal} onChange={(e) => setVarietal(e.target.value)} maxLength={120} />
            </div>
            <div className="sm:col-span-2">
              {field("w-region", "Region", errors.region, "Format: Appellation, Country — e.g. \"Barolo, Italy\"")}
              <Input id="w-region" value={region} onChange={(e) => setRegion(e.target.value)} maxLength={160} />
            </div>
            <div>
              {field("w-year", "Vintage", errors.year)}
              <Input id="w-year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <div>
              {field("w-price", "Price (USD)", errors.price)}
              <Input id="w-price" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              {field("w-type", "Type")}
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className={"rounded-full border px-3 py-1 text-xs capitalize transition " +
                      (type === t ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {([
              ["Body", body, setBody],
              ["Sweetness", sweetness, setSweetness],
              ["Acidity", acidity, setAcidity],
              ["Tannin", tannin, setTannin],
            ] as const).map(([label, val, set]) => (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">{val}/5</span>
                </div>
                <Slider min={1} max={5} step={1} value={[val]} onValueChange={(v) => set(v[0])} />
              </div>
            ))}
          </div>

          <div>
            {field("", "Flavor notes")}
            <div className="flex flex-wrap gap-1.5">
              {FLAVOR_NOTES.map((n) => (
                <button key={n} type="button" onClick={() => toggle(notes, setNotes, n)}
                  className={"rounded-full border px-2.5 py-1 text-xs capitalize transition " +
                    (notes.includes(n) ? "border-primary bg-primary/15" : "border-border text-muted-foreground hover:text-foreground")}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            {field("", "How it's made")}
            <div className="flex flex-wrap gap-1.5">
              {PRACTICES.map((p) => (
                <button key={p.value} type="button" onClick={() => toggle(practices, setPractices, p.value)}
                  title={p.blurb}
                  className={"rounded-full border px-2.5 py-1 text-xs transition " +
                    (practices.includes(p.value) ? "border-primary bg-primary/15" : "border-border text-muted-foreground hover:text-foreground")}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              {field("", "Festivals")}
              <div className="flex flex-wrap gap-1.5">
                {FESTIVALS.map((f) => (
                  <button key={f.value} type="button" onClick={() => toggle(festivals, setFestivals, f.value)}
                    className={"rounded-full border px-2.5 py-1 text-xs transition " +
                      (festivals.includes(f.value) ? "border-primary bg-primary/15" : "border-border text-muted-foreground hover:text-foreground")}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              {field("", "Winemaker identity")}
              <div className="flex flex-wrap gap-1.5">
                {IDENTITIES.map((i) => (
                  <button key={i.value} type="button" onClick={() => toggle(identities, setIdentities, i.value)}
                    className={"rounded-full border px-2.5 py-1 text-xs transition " +
                      (identities.includes(i.value) ? "border-primary bg-primary/15" : "border-border text-muted-foreground hover:text-foreground")}>
                    {i.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              {field("w-purl", "Producer URL (optional)", errors.producerUrl)}
              <Input id="w-purl" type="url" value={producerUrl} onChange={(e) => setProducerUrl(e.target.value)} placeholder="https://" />
            </div>
            <div>
              {field("w-surl", "Shop URL (optional)", errors.shopUrl)}
              <Input id="w-surl" type="url" value={shopUrl} onChange={(e) => setShopUrl(e.target.value)} placeholder="https://" />
            </div>
          </div>

          <div>
            {field("w-pair", "Pairing (optional)", errors.pairing)}
            <Input id="w-pair" value={pairing} onChange={(e) => setPairing(e.target.value)} maxLength={200} />
          </div>
          <div>
            {field("w-desc", "Description (optional)", errors.description)}
            <Textarea id="w-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={800} rows={3} />
          </div>

          <DialogFooter>
            <Badge variant="secondary" className="mr-auto text-[11px]">Saved locally</Badge>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Add to cellar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
