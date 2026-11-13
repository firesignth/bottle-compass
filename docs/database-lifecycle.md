# Database Lifecycle

**Status:** Product direction recorded; the current implementation does not yet
provide this full behavior. This document distinguishes current behavior from
the intended per-installation catalog.

## Terms

- **Default catalog:** A versioned catalog shipped with the app.
- **Local catalog:** The editable catalog owned by one installation, initialized
  from the default catalog. Local changes are not shared with other devices.
- **Provenance:** The ways a wine or fact entered the local catalog, including
  bundled defaults, manual entry, fair listings, and other imports.
- **Fair appearance:** A relationship between a wine and a specific fair
  edition, with source details when available.

## Current Implementation

- The built-in `WINES` catalog and its source rows are bundled in
  `src/lib/wines.ts`; users cannot edit those rows directly.
- User-added and imported wines are stored separately in browser `localStorage`.
- Fair membership is represented by a fixed list of festival tags on a wine.
  The model does not record fair editions, source URLs, or import history.
- Wines do not have general entry-source history. If an imported wine matches
  a built-in wine, the current add flow reports a merge but does not persist
  imported fields or provenance onto that built-in row.

## Intended Behavior

Each installation should have its own editable local catalog initialized from
a known default. A wine may have multiple provenance records and multiple fair
appearances; recording a new appearance must not replace the wine's existing
fair history.

The data model should represent fairs and editions separately from wines, with a
many-to-many relationship between wine records and fair appearances. Provenance
should capture the entry method and, when available, a source URL or identifier
and the time it was imported. This allows a wine to be linked to several fairs
and to other sources without losing its history.

## Update Rules

### Fair and CSV imports

The selected source-refresh policy is **append-only**:

1. Add unmatched wines to the local catalog.
2. If an incoming wine matches an existing one, retain the existing wine fields
   and append newly learned provenance or fair appearances. Do not silently
   overwrite existing fields.
3. Report conflicting incoming field values; do not use them to
   replace existing values automatically.
4. Do not delete a wine or fair appearance merely because it is absent from a
   later source listing. A source may be incomplete, and past fair appearances
   are historical facts.
5. Make re-importing the same source and fair edition idempotent, so it does not
   create duplicate wines or duplicate provenance records.

The exact wine-matching key and whether conflicting source values are retained
as reviewable claims remain to be defined. Whether imports require a preview
before applying changes is also undecided.

### New bundled defaults

When a newer app version ships a newer default catalog, merge its new wines and
source facts into the local catalog without deleting local records or
overwriting user edits. Keep stable wine identities where records represent the
same bottling so favorites, ratings, and tasting history remain attached.

### Reset

Provide separate reset choices:

- **Reset catalog:** Restore the default catalog and remove local additions and
  imported catalog changes. Keep favorites, tried status, ratings, and saved
  searches for wines that remain in the default catalog; remove activity that
  points only to removed local wines.
- **Reset everything:** Restore the default catalog and clear all local
  activity and preferences.

Both actions should explain their effects and require confirmation. Whether to
offer an export or backup before reset remains to be decided.

## Expected Effects

- Added wines and fair appearances should be available to discovery, fair
  browsing, and producer views.
- New facts and source links should enrich a wine without erasing its previous
  sources or user-maintained fields.
- Removing a wine during reset can affect favorites, ratings, tried status, and
  saved searches, so those references need explicit cleanup rules.
- Local changes remain specific to that installation unless a separate sync or
  export/import capability is designed.

## Decisions Still Needed

- Define the stable identity and matching rules for a wine across spelling,
  vintage, and source variations.
- Decide whether each import requires a preview and confirmation.
- Decide whether to retain conflicting incoming values as source claims so the
  user can inspect them later.
- Define how default-catalog versioning and migrations are represented.
- Decide whether local wines can be edited or deleted individually and how
  those actions affect provenance and tasting history.
- Decide whether users can export or back up their local catalog before reset.
