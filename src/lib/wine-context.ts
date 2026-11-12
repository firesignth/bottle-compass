import type { Wine } from "./wines";

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Weather = "hot" | "warm" | "mild" | "cold";
export type Occasion =
  | "celebration"
  | "dinner-party"
  | "date-night"
  | "casual"
  | "picnic"
  | "holiday-feast"
  | "aperitif";
export type FoodTag =
  | "vegan"
  | "meat"
  | "seafood"
  | "cheese"
  | "pasta"
  | "spicy"
  | "dessert"
  | "brunch"
  | "vegetable";

export const SEASONS: { value: Season; label: string; blurb: string }[] = [
  { value: "spring", label: "Spring", blurb: "Bright, floral, higher-acid pours." },
  { value: "summer", label: "Summer", blurb: "Chillable, refreshing, low-tannin." },
  { value: "autumn", label: "Autumn", blurb: "Savory reds, earth, spice." },
  { value: "winter", label: "Winter", blurb: "Rich, warming, structured." },
];

export const WEATHERS: { value: Weather; label: string; blurb: string }[] = [
  { value: "hot", label: "Hot out", blurb: "90°F+ — light, cold, thirst-quenching." },
  { value: "warm", label: "Warm", blurb: "70–85°F — patio wines, chillable reds." },
  { value: "mild", label: "Mild", blurb: "Shoulder weather — anything goes." },
  { value: "cold", label: "Cold", blurb: "Below 50°F — bigger reds, warming pours." },
];

export const OCCASIONS: { value: Occasion; label: string; blurb: string }[] = [
  { value: "celebration", label: "Celebration", blurb: "Bubbles and a bang." },
  { value: "dinner-party", label: "Dinner party", blurb: "Structured, food-friendly." },
  { value: "date-night", label: "Date night", blurb: "Silky, perfumed, romantic." },
  { value: "casual", label: "Casual night in", blurb: "Easy, gluggable, unfussy." },
  { value: "picnic", label: "Picnic / outdoors", blurb: "Bright, chillable, forgiving." },
  { value: "holiday-feast", label: "Holiday feast", blurb: "Big table, big pours." },
  { value: "aperitif", label: "Aperitif", blurb: "Low-abv-ish, appetite-opening." },
];

export const FOODS: { value: FoodTag; label: string; blurb: string }[] = [
  { value: "vegan", label: "Vegan", blurb: "Plant-based plates — and vegan-friendly in the cellar (no fining with egg/isinglass)." },
  { value: "meat", label: "Meat", blurb: "Beef, lamb, pork, duck, game." },
  { value: "seafood", label: "Seafood", blurb: "Oysters, ceviche, whole fish, shellfish." },
  { value: "cheese", label: "Cheese board", blurb: "Aged, washed-rind, blue." },
  { value: "pasta", label: "Pasta / pizza", blurb: "Tomato, ragù, wood-fired." },
  { value: "spicy", label: "Spicy", blurb: "Thai, Sichuan, curry heat." },
  { value: "dessert", label: "Dessert", blurb: "Sweet finishers." },
  { value: "brunch", label: "Brunch", blurb: "Eggs, pastry, late-morning fizz." },
  { value: "vegetable", label: "Veggie-forward", blurb: "Roasted roots, salads, grains." },
];

// -- Derivations from the existing wine data (no need to hand-tag every wine) --

const contains = (s: string, ...needles: string[]) => {
  const l = s.toLowerCase();
  return needles.some((n) => l.includes(n));
};

const MEAT_WORDS = ["steak", "ribeye", "duck", "pork", "lamb", "burger", "chicken", "ragù", "ragu", "beef", "charcuterie", "foie", "empanad", "game"];
const SEAFOOD_WORDS = ["oyster", "ceviche", "lobster", "trout", "snapper", "shrimp", "fish", "caviar", "seafood", "salmon", "tuna"];
const CHEESE_WORDS = ["cheese", "comté", "comte", "cheddar", "pecorino", "goat cheese", "blue", "brie"];
const PASTA_WORDS = ["pizza", "pasta", "pappardelle", "risotto", "ragù", "ragu"];
const SPICY_WORDS = ["curry", "thai", "spicy", "sichuan"];
const VEGGIE_WORDS = ["salad", "vegetable", "veg", "mushroom", "lentil", "root", "grain", "tart", "bean"];
const BRUNCH_WORDS = ["brunch", "egg"];

export function foodTagsFor(w: Wine): FoodTag[] {
  const p = w.pairing;
  const tags: FoodTag[] = [];
  if (contains(p, ...MEAT_WORDS)) tags.push("meat");
  if (contains(p, ...SEAFOOD_WORDS)) tags.push("seafood");
  if (contains(p, ...CHEESE_WORDS)) tags.push("cheese");
  if (contains(p, ...PASTA_WORDS)) tags.push("pasta");
  if (contains(p, ...SPICY_WORDS)) tags.push("spicy");
  if (contains(p, ...VEGGIE_WORDS)) tags.push("vegetable");
  if (contains(p, ...BRUNCH_WORDS)) tags.push("brunch");
  if (w.type === "dessert" || contains(p, "tarte", "dessert", "tatin")) tags.push("dessert");
  if (w.type === "orange") tags.push("spicy", "cheese", "vegetable");

  // Vegan-friendly: no fining with animal products AND no explicit meat/seafood/cheese-only pairing.
  const veganCellar =
    w.practices.includes("unfined") ||
    w.practices.includes("natural") ||
    w.practices.includes("no-added-sulfites");
  const nonVeganPairing =
    contains(p, ...MEAT_WORDS) ||
    contains(p, ...SEAFOOD_WORDS) ||
    contains(p, "cheese", "comté", "comte", "cheddar", "pecorino", "brie", "foie");
  if (veganCellar && (!nonVeganPairing || tags.includes("vegetable"))) {
    tags.push("vegan");
  }
  return tags;
}

export function seasonsFor(w: Wine): Season[] {
  const s: Season[] = [];
  const light = w.body <= 2;
  const zippy = w.acidity >= 4;
  const bigRed = w.type === "red" && w.body >= 4;
  if (w.type === "sparkling") s.push("spring", "summer", "winter");
  if (w.type === "rosé" || (light && w.type === "white")) s.push("spring", "summer");
  if (w.type === "white" && zippy) s.push("spring", "summer");
  if (w.type === "white" && w.body >= 4) s.push("autumn", "winter");
  if (w.type === "red" && w.body <= 3) s.push("spring", "autumn");
  if (bigRed) s.push("autumn", "winter");
  if (w.type === "orange") s.push("autumn", "winter", "spring");
  if (w.type === "dessert") s.push("autumn", "winter");
  return Array.from(new Set(s));
}

export function weatherFor(w: Wine): Weather[] {
  const wx: Weather[] = [];
  const light = w.body <= 2;
  if (w.type === "sparkling" || w.type === "rosé") wx.push("hot", "warm", "mild");
  if (w.type === "white" && light) wx.push("hot", "warm", "mild");
  if (w.type === "white" && w.body >= 3) wx.push("warm", "mild", "cold");
  if (w.type === "red" && w.body <= 3) wx.push("warm", "mild", "cold");
  if (w.type === "red" && w.body >= 4) wx.push("mild", "cold");
  if (w.type === "orange") wx.push("warm", "mild", "cold");
  if (w.type === "dessert") wx.push("cold");
  return Array.from(new Set(wx));
}

export function occasionsFor(w: Wine): Occasion[] {
  const o: Occasion[] = [];
  if (w.type === "sparkling") o.push("celebration", "aperitif");
  if (w.type === "rosé") o.push("picnic", "aperitif", "casual");
  if (w.type === "white" && w.body <= 3) o.push("aperitif", "picnic", "casual");
  if (w.type === "white" && w.body >= 4) o.push("dinner-party", "date-night");
  if (w.type === "red" && w.body <= 3) o.push("casual", "picnic", "dinner-party");
  if (w.type === "red" && w.body >= 4) o.push("dinner-party", "holiday-feast", "date-night");
  if (w.varietal.toLowerCase().includes("pinot noir")) o.push("date-night");
  if (w.type === "orange") o.push("dinner-party", "aperitif", "casual");
  if (w.type === "dessert") o.push("holiday-feast", "date-night");
  if (w.price <= 30) o.push("casual");
  return Array.from(new Set(o));
}
