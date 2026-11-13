# Initial User Journey Inventory

This is a first-pass inventory based on the current routes and components, not a
final product specification. It identifies flows to map and test as the app and
its storage move across web, Android, and iOS.

## User Model

The primary user is an individual building and using a personal wine collection.
“First-time user,” “returning user,” and “attending a wine event” are contexts
for that same person, not separate administrator personas. A common event
journey can connect several flows below: browse a fair, explore its producers
and bottles, record which wines were tried or liked, and add or import wines
that are missing from the collection.

There are two kinds of catalog data to distinguish:

- The built-in reference catalog ships with the app and is read-only to the
  user in the current implementation. Updating it requires changing the app's
  bundled data.
- The user's personal wines are added or imported into local storage on that
  device. That is the part the user maintains; it is not currently synced
  across devices.

This describes the current implementation. The intended editable,
per-installation catalog initialized from a resettable default is described in
[Database Lifecycle](database-lifecycle.md).

## Primary Journeys

### 1. Discover wines that fit a person's preferences

**Entry point:** `/`

The user adjusts search and preference filters, including wine style, taste,
price, vintage, varietals, tasting notes, region, winemaking practices,
festivals, winemaker identity, producer, and food or occasion context. They can
choose whether a filter section is active and, for supported preferences, how
strongly it should affect the match. Results are ranked and explain why wines
matched. If nothing matches, the user can relax filters or reset them.

**Map and test:** filter interactions, match inclusion/exclusion, ranking,
explanations, combinations of filters, and recovery from zero results.

### 2. Save, restore, and share a search

**Entry point:** `/`

The user can save the current filters and sort order as a named preset, load or
delete a preset, or share the current search. Filter state is encoded in the URL
so that opening a shared link can restore the search. The user can copy either
the link or a text summary of the matches.

**Map and test:** preset create/update/load/delete, URL encode/decode and
invalid parameters, restoring a link in a fresh session, and clipboard success
or failure.

### 3. Track wines they like, have tried, or have rated

**Entry point:** wine results on `/`

The user marks a wine as tried, adds or removes it from favorites, and gives it
a one-to-five-star rating (selecting the current rating clears it). They can
sort by rating and filter results to favorites, tried wines, or wines they have
not tried.

**Related route:** `/favorites` groups saved wines by producer and allows
removing a favorite or clearing the list.

**Map and test:** toggle behavior, persistence across reloads, sorting/filtering,
empty states, and clear-all confirmation.

### 4. Add a wine to the personal cellar

**Entry point:** **Add wine** on `/`

The user enters wine and producer details, taste attributes, and optional
metadata. The form validates the entry before adding it. A duplicate may be
merged into an existing entry; incompatible data is reported as a conflict
instead of silently creating a duplicate.

**Map and test:** required-field validation, invalid values, new entries,
duplicate IDs, matching and conflicting bottlings, and persistence after
restart.

### 5. Import wines from a sheet or CSV

**Entry point:** **Bulk import** on `/`

The user supplies a public Google Sheets or CSV URL. The app fetches and parses
the data, shows a preview, then imports the accepted rows and reports additions,
merges, duplicates, incomplete or invalid rows, and catalog-audit results.

**Map and test:** supported URLs and CSV formats, header detection, preview
accuracy, confirmation/cancel paths, repeated imports, network errors, and
partial or invalid rows.

### 6. Find producers near a location

**Entry point:** the **Near me** filter on `/`

The user chooses a radius and grants location access. Wines are matched using
approximate coordinates for their region; the user can update or clear their
location. Permission denial and unsupported geolocation are visible error
paths.

**Map and test:** permission granted/denied, unsupported location, radius
boundaries, unknown wine regions, update/clear behavior, and platform-specific
location permissions.

### 7. Browse fairs and festivals

**Entry points:** `/festivals` and `/festivals/$fest`

The user browses fairs with producer and bottle counts, opens a fair, searches
its producers, and filters by tasting notes. They can follow producer links or
cross-listed fairs to continue exploring.

**Map and test:** counts, search/filter combinations, empty results, unknown
festival routes, and navigation between fairs and producers.

### 8. Explore a producer

**Entry point:** `/producers/$slug`, linked from wine results, favorites, and
festival pages

The user reviews a producer summary, wine styles, price and vintage ranges, and
tasting notes. They can filter the producer's bottles by notes, see how those
bottles compare with preferences encoded in the current URL, and follow the
winemaker or shop links.

**Map and test:** known/unknown producer routes, note filters, preference-based
match information, and external links.

## Catalog-Quality Diagnostic

This is an audit view, not a separate administrator persona or an editor for
the bundled reference catalog.

**Entry point:** `/admin/conflicts`

The user can inspect field conflicts, entries kept separate, producer spelling
variants, invalid rows, and merge decisions. They can search merge records and
open producer pages. The view analyzes bundled source rows and local user wines;
it does not edit the bundled catalog.

**Map and test:** each tab and count, search behavior, before/incoming/after
values, and empty states.

## Cross-Cutting State and Platform Concerns

- The built-in catalog is bundled with the app. User wines, favorites, tried
  status, ratings, and presets currently use separate `localStorage` helpers.
- Adding or importing a wine updates the user's local collection, not the
  bundled reference catalog.
- Near-me coordinates use `sessionStorage`; the shareable URL includes the
  near-me setting and radius, but not the coordinates.
- Search results can be shared through URL state. Clipboard, geolocation, and
  CSV/PDF downloads rely on browser APIs and need platform-specific verification
  in Capacitor.
- External winemaker and shop links leave the app; the app does not complete a
  purchase.

## Behaviors to Confirm

- Should user-added wines appear on `/favorites`? Discovery combines user wines
  with the built-in catalog, while the favorites page currently resolves saved
  IDs against the built-in catalog only.
- What should opening a shared near-me search do on another device, given that
  coordinates are not part of the URL?
- Are account-based backup or cross-device sync, and editing or deleting
  personal wines, intended product capabilities?
