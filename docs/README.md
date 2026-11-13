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

## iOS Setup

The project already includes the `@capacitor/ios` dependency, but the native
`ios/` project has not been generated. Creating and building it requires macOS
with Xcode; Windows can be used for web and Android development but cannot run
the iOS simulator or produce a native iOS build.

On a Mac, from the repository root:

1. Install Node.js, pnpm, and Xcode, then run `pnpm install`.
2. Generate the native project once with `pnpm exec cap add ios`.
3. After web changes, run `pnpm build` and `pnpm exec cap sync ios`.
4. Open the project with `pnpm exec cap open ios`, then select a simulator or
   device in Xcode. Physical-device and distribution builds require Apple code
   signing setup.

## Guiding Principle

Keep wine and cellar behavior independent of the platform. Define storage and native capabilities behind narrow interfaces so the same business rules can be tested once, with adapter-specific tests and a small set of end-to-end checks verifying each platform.

## Documentation

- [Initial user journey inventory](user-journeys.md) — current flows to map, test, and validate across platforms.
- [Database lifecycle](database-lifecycle.md) — current behavior, intended update/reset rules, and open design decisions.
