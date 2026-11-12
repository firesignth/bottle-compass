// Lightweight geolocation helpers for the "Near me" filter.
// Wines don't carry coordinates individually — instead we map their
// appellation or country to an approximate lat/lng centroid. Wines whose
// region isn't recognized are excluded from radius matches.

export type LatLng = { lat: number; lng: number };
export type RadiusMiles = 10 | 20 | 40 | 100;
export const RADIUS_OPTIONS: RadiusMiles[] = [10, 20, 40, 100];

// Approximate centroids for common wine regions / appellations we ship.
// Keys are lowercased. Match order: exact appellation → exact country.
export const REGION_COORDS: Record<string, LatLng> = {
  // California
  "napa valley": { lat: 38.502, lng: -122.291 },
  "napa": { lat: 38.502, lng: -122.291 },
  "sonoma county": { lat: 38.507, lng: -122.981 },
  "sonoma": { lat: 38.291, lng: -122.458 },
  "russian river valley": { lat: 38.512, lng: -122.911 },
  "sonoma coast": { lat: 38.35, lng: -123.05 },
  "anderson valley": { lat: 39.0, lng: -123.4 },
  "mendocino": { lat: 39.31, lng: -123.79 },
  "mendocino county": { lat: 39.31, lng: -123.79 },
  "santa cruz mountains": { lat: 37.15, lng: -122.05 },
  "santa barbara county": { lat: 34.65, lng: -120.05 },
  "santa barbara": { lat: 34.42, lng: -119.7 },
  "santa maria valley": { lat: 34.94, lng: -120.42 },
  "sta. rita hills": { lat: 34.62, lng: -120.31 },
  "sierra foothills": { lat: 38.66, lng: -120.85 },
  "el dorado": { lat: 38.68, lng: -120.83 },
  "amador county": { lat: 38.44, lng: -120.65 },
  "lodi": { lat: 38.13, lng: -121.27 },
  "paso robles": { lat: 35.63, lng: -120.69 },
  "central coast": { lat: 35.5, lng: -120.7 },
  "berkeley": { lat: 37.87, lng: -122.27 },
  "oakland": { lat: 37.8, lng: -122.27 },
  "richmond": { lat: 37.94, lng: -122.35 },
  "east bay": { lat: 37.83, lng: -122.28 },

  // Pacific Northwest
  "willamette valley": { lat: 45.2, lng: -123.1 },
  "columbia gorge": { lat: 45.7, lng: -121.5 },
  "columbia valley": { lat: 46.3, lng: -119.5 },
  "walla walla valley": { lat: 46.06, lng: -118.34 },

  // New York
  "finger lakes": { lat: 42.66, lng: -76.9 },
  "hudson valley": { lat: 41.7, lng: -73.94 },
  "long island": { lat: 40.94, lng: -72.5 },

  // Other US
  "texas hill country": { lat: 30.2, lng: -98.8 },
  "virginia": { lat: 38.03, lng: -78.48 },
  "vermont": { lat: 44.26, lng: -72.58 },
  "michigan": { lat: 44.94, lng: -85.62 },

  // France
  "burgundy": { lat: 47.05, lng: 4.84 },
  "bourgogne": { lat: 47.05, lng: 4.84 },
  "beaujolais": { lat: 46.13, lng: 4.7 },
  "loire": { lat: 47.4, lng: 0.7 },
  "loire valley": { lat: 47.4, lng: 0.7 },
  "sancerre": { lat: 47.33, lng: 2.83 },
  "muscadet": { lat: 47.1, lng: -1.42 },
  "chinon": { lat: 47.17, lng: 0.24 },
  "vouvray": { lat: 47.4, lng: 0.79 },
  "bordeaux": { lat: 44.84, lng: -0.58 },
  "champagne": { lat: 49.05, lng: 4.03 },
  "alsace": { lat: 48.32, lng: 7.44 },
  "jura": { lat: 46.75, lng: 5.62 },
  "savoie": { lat: 45.57, lng: 6.06 },
  "rhône": { lat: 44.85, lng: 4.85 },
  "rhone": { lat: 44.85, lng: 4.85 },
  "languedoc": { lat: 43.6, lng: 3.0 },
  "roussillon": { lat: 42.7, lng: 2.9 },
  "provence": { lat: 43.5, lng: 6.0 },

  // Italy
  "piedmont": { lat: 44.72, lng: 8.03 },
  "piemonte": { lat: 44.72, lng: 8.03 },
  "tuscany": { lat: 43.35, lng: 11.2 },
  "toscana": { lat: 43.35, lng: 11.2 },
  "veneto": { lat: 45.5, lng: 11.6 },
  "friuli": { lat: 46.0, lng: 13.0 },
  "sicily": { lat: 37.6, lng: 14.0 },
  "sicilia": { lat: 37.6, lng: 14.0 },
  "etna": { lat: 37.75, lng: 15.0 },
  "alto adige": { lat: 46.5, lng: 11.35 },

  // Spain / Portugal
  "rioja": { lat: 42.29, lng: -2.52 },
  "priorat": { lat: 41.18, lng: 0.75 },
  "penedès": { lat: 41.35, lng: 1.7 },
  "penedes": { lat: 41.35, lng: 1.7 },
  "galicia": { lat: 42.75, lng: -8.0 },
  "canary islands": { lat: 28.29, lng: -16.63 },
  "douro": { lat: 41.15, lng: -7.5 },
  "vinho verde": { lat: 41.5, lng: -8.3 },

  // Germany / Austria / Switzerland
  "mosel": { lat: 49.98, lng: 6.95 },
  "rheingau": { lat: 50.03, lng: 8.0 },
  "rheinhessen": { lat: 49.85, lng: 8.15 },
  "pfalz": { lat: 49.35, lng: 8.15 },
  "baden": { lat: 48.35, lng: 7.75 },
  "württemberg": { lat: 48.9, lng: 9.4 },
  "wurttemberg": { lat: 48.9, lng: 9.4 },
  "wachau": { lat: 48.37, lng: 15.42 },
  "kamptal": { lat: 48.55, lng: 15.68 },
  "burgenland": { lat: 47.6, lng: 16.55 },
  "styria": { lat: 46.85, lng: 15.5 },

  // New World other
  "central otago": { lat: -45.03, lng: 169.19 },
  "marlborough": { lat: -41.5, lng: 173.9 },
  "hawke's bay": { lat: -39.5, lng: 176.9 },
  "mendoza": { lat: -32.89, lng: -68.85 },
  "maipo": { lat: -33.75, lng: -70.8 },
  "itata": { lat: -36.6, lng: -72.4 },
  "swartland": { lat: -33.55, lng: 18.7 },
  "stellenbosch": { lat: -33.94, lng: 18.87 },
  "yarra valley": { lat: -37.65, lng: 145.55 },
  "mclaren vale": { lat: -35.22, lng: 138.55 },
  "barossa": { lat: -34.55, lng: 138.95 },

  // Country fallbacks (used only when the appellation isn't recognized)
  "usa": { lat: 39.5, lng: -98.35 },
  "united states": { lat: 39.5, lng: -98.35 },
  "france": { lat: 46.6, lng: 2.2 },
  "italy": { lat: 42.5, lng: 12.5 },
  "spain": { lat: 40.0, lng: -3.7 },
  "portugal": { lat: 39.4, lng: -8.2 },
  "germany": { lat: 51.1, lng: 10.4 },
  "austria": { lat: 47.5, lng: 14.5 },
  "greece": { lat: 39.0, lng: 22.0 },
  "hungary": { lat: 47.2, lng: 19.5 },
  "slovenia": { lat: 46.1, lng: 14.8 },
  "croatia": { lat: 45.1, lng: 15.2 },
  "georgia": { lat: 42.3, lng: 43.4 },
  "chile": { lat: -35.7, lng: -71.5 },
  "argentina": { lat: -34.6, lng: -63.6 },
  "south africa": { lat: -30.6, lng: 22.9 },
  "australia": { lat: -25.3, lng: 133.8 },
  "new zealand": { lat: -41.0, lng: 174.9 },
  "canada": { lat: 56.1, lng: -106.3 },
  "mexico": { lat: 23.6, lng: -102.5 },
  "japan": { lat: 36.2, lng: 138.3 },
  "lebanon": { lat: 33.9, lng: 35.9 },
  "turkey": { lat: 38.9, lng: 35.2 },
  "brazil": { lat: -14.2, lng: -51.9 },
  "uruguay": { lat: -32.5, lng: -55.8 },
};

const norm = (s: string | undefined | null) =>
  (s ?? "").toLowerCase().trim();

/** Return coords for a wine's region string, or null if unknown. */
export function coordsForRegion(region: string): LatLng | null {
  const parts = region.split(",").map((s) => s.trim());
  for (const p of parts) {
    const hit = REGION_COORDS[norm(p)];
    if (hit) return hit;
  }
  return null;
}

const EARTH_MI = 3958.7613;

export function haversineMiles(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_MI * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Miles from user to a wine's region centroid, or null if unknown. */
export function distanceToWineMiles(
  user: LatLng,
  region: string,
): number | null {
  const c = coordsForRegion(region);
  if (!c) return null;
  return haversineMiles(user, c);
}

const COORDS_KEY = "cellar:nearme:v1";

export function loadStoredCoords(): LatLng | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed && typeof parsed.lat === "number" && typeof parsed.lng === "number"
    ) {
      return parsed;
    }
  } catch {}
  return null;
}

export function storeCoords(c: LatLng | null) {
  if (typeof window === "undefined") return;
  try {
    if (c) window.sessionStorage.setItem(COORDS_KEY, JSON.stringify(c));
    else window.sessionStorage.removeItem(COORDS_KEY);
  } catch {}
}

export function requestBrowserLocation(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation isn't supported in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message || "Couldn't get your location.")),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  });
}
