# Architecture

## Goals

Mirrorvault is split into a React frontend and an Express API so each can evolve independently. The current product remains useful without a server connection, but all backend-capable operations have a clear replacement boundary.

## Workspace boundary

The root npm workspace coordinates `apps/frontend` and `apps/backend`. Each application owns its dependencies, TypeScript configuration, environment example, development command, and build output. Root commands provide one beginner-friendly entry point.

## Frontend

The frontend is a Vite single-page application. React Router maps route-level page components into `AppShell`, which owns persistent navigation, the footer, mobile navigation, and the API-health indicator.

The visual system is split into:

- `theme.css` for custom properties and design tokens
- `global.css` for resets, typography, focus behavior, and reusable buttons
- `components.css` for shared shell and form patterns
- `pages.css` for route-level compositions and responsive rules

This keeps the original visual language centralized without tying each small component to a separate stylesheet.

`AdventureProvider` owns only state shared across routes: selected character and user settings. Active dungeon state remains inside `DungeonPage`, preventing unrelated routes from depending on game internals.

Mock content lives in `services/mockAdventureService.ts`. The UI does not claim this content is produced by AI. `services/api.ts` is the only place that knows the API base URL. `services/storage.ts` is the only place that knows browser-storage keys.

## Backend

The API follows a thin layered design:

```text
route → validation middleware → controller → service → response
```

Routes own paths and request schemas. Controllers translate requests into service calls. Services own mock domain behavior. Shared error middleware converts known and unknown failures to consistent JSON. This is deliberately more structured than the current feature set requires so later database and model-provider integrations do not force an application rewrite.

The API disables the Express signature header, limits JSON bodies, allows only the configured frontend origin, logs local requests, and returns explicit 404 and validation errors.

## Adaptation model

The original experience distinguishes stable mechanics from changing composition. The local prototype represents this as a `DungeonConfig` plus sequential scenes. Later rooms interpolate the selected challenge and playstyle into labeled mock copy. A future implementation can replace the mock service with a scoring engine while keeping the same component contract.

## Accessibility and responsive behavior

The shell provides a skip link, semantic navigation, visible focus rings, labeled forms, press-state buttons, keyboard dungeon controls, a reduced-motion preference, and system reduced-motion support. Layouts collapse at 920px and 600px, with bottom navigation on smaller viewports. The dungeon grid uses aspect ratios instead of fixed pixels to avoid horizontal overflow.

## Decisions deferred

Authentication, database storage, model providers, email delivery, analytics, and production deployment are intentionally absent. Their proposed boundaries are documented in `future-backend-plan.md`.
