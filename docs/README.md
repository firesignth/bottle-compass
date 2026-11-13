# Project Engineering Guide

## Goals

1. Understand how the app is structured and how its key user journeys work.
2. Build a strong automated test suite for app functionality and use it to catch regressions as the app moves to Android and iOS.
3. Choose an embedded persistence approach that works for the app's data and target platforms.
4. Establish a repeatable way to build, run, and verify the app on web, Android, and iOS.

## Approach

1. **Map the app:** Trace important user journeys through routes and components into business logic and data storage. Document responsibilities and data flow before changing architecture.
2. **Strengthen tests:** Keep business rules platform-independent and test them with Vitest. Add coverage for storage and user journeys, then browser and device-level checks for behavior that unit tests cannot verify.
3. **Choose persistence deliberately:** Identify offline, data-volume, migration, and account-sync requirements first. Put persistence behind a shared interface, compare browser storage, Capacitor Preferences, and SQLite as appropriate, and test the same storage behavior across implementations.
4. **Port incrementally:** Build and smoke-test the web app, Android app, and iOS app as separate targets while reusing the same business logic. Automate the checks that can run reliably in CI.

## Current Baseline

- The app uses React, TypeScript, TanStack Start, and TanStack Router.
- Vitest runs in a Node environment and includes `src/**/*.test.ts`.
- The existing 22 tests cover wine-catalog integrity, deduplication, and CSV ingestion; they do not currently exercise the UI in a browser or on a device.
- User wines, favorites, and tried-wine IDs are stored through separate `localStorage` helpers.
- Capacitor is configured with `.output/public` as its web directory. The repository has an Android project; an iOS project has not yet been added.

## Guiding Principle

Keep wine and cellar behavior independent of the platform. Define storage and native capabilities behind narrow interfaces so the same business rules can be tested once, with adapter-specific tests and a small set of end-to-end checks verifying each platform.
