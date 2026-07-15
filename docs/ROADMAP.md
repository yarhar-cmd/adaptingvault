# Mirrorvault feature roadmap

This roadmap is ordered by risk reduction. A later phase may be explored in design, but implementation should not bypass its prerequisites.

Difficulty describes engineering effort in this repository, not calendar time. “Backend required” means the task needs server behavior beyond the current mock API.

## Phase 1: Fix and stabilize the current website

### P1.1 Align the game model with the interface

- **What:** Define room, tile, entity, player, objective, action, and run-state types. Move static grid coordinates out of `DungeonGrid` and transition logic out of `DungeonPage` into a reducer/domain module.
- **Why:** The current grid is visual decoration and cannot support reliable rules, adaptation, or tests.
- **Likely areas:** `apps/frontend/src/pages/DungeonPage.tsx`, `components/mirrorvault/DungeonGrid.tsx`, `types/adventure.ts`, new `features/dungeon/model/*`.
- **Prerequisites:** Product decision on room completion and failure rules.
- **Difficulty:** Hard
- **Priority:** Critical
- **Backend required:** No
- **Definition of done:** All player actions flow through typed transitions; room data drives rendering; invalid moves are rejected; the existing six-room flow still completes.

### P1.2 Implement honest baseline mechanics

- **What:** Make exit/rune interaction complete a room, hazards affect health, enemies respond to attack, shield work by button and Shift, treasure record risk, and character health initialize the run.
- **Why:** Visible controls and claims must have real outcomes before adaptation is credible.
- **Likely areas:** Dungeon feature reducer, grid, controls, status panel, character data, CSS state styles.
- **Prerequisites:** P1.1.
- **Difficulty:** Hard
- **Priority:** Critical
- **Backend required:** No
- **Definition of done:** Each advertised action has a tested state effect; health and objectives update visibly and accessibly; rooms can succeed or fail without using story choices as a shortcut.

### P1.3 Fix environment and package-manager consistency

- **What:** Choose npm or pnpm as canonical, declare `packageManager` and supported Node versions, align lockfiles/README/scripts, and make backend `.env` loading explicit from the documented location.
- **Why:** Reproducible installs and correct configuration are prerequisites for every contributor and deployment.
- **Likely areas:** root and app `package.json`, `pnpm-workspace.yaml` or npm configuration, `apps/backend/src/config/env.ts`, `.env.example`, README.
- **Prerequisites:** Package-manager choice.
- **Difficulty:** Easy
- **Priority:** Critical
- **Backend required:** No
- **Definition of done:** A clean clone can install, configure, run, typecheck, and build with one documented tool; a non-default backend port/origin from the documented env file is honored.

### P1.4 Add runtime validation for local data and API contracts

- **What:** Validate/migrate `localStorage`; type API responses; create a shared contract package when the UI consumes backend adventures; provide structured errors.
- **Why:** TypeScript casts do not protect against corrupt storage, stale versions, or network data.
- **Likely areas:** `services/storage.ts`, `services/api.ts`, frontend/backend adventure types, new `packages/contracts`.
- **Prerequisites:** Stable run shape from P1.1.
- **Difficulty:** Medium
- **Priority:** High
- **Backend required:** No, but shared with backend
- **Definition of done:** Invalid stored/network data falls back safely; storage carries a schema version; all consumed API responses are validated and typed.

### P1.5 Repair request lifecycle and user feedback

- **What:** Pass abort signals, add timeouts, expose recoverable API errors, prevent duplicate contact submissions, and remove silent adventure-request failure.
- **Why:** Silent failures make the API indicator misleading and can leave stale updates after navigation.
- **Likely areas:** `services/api.ts`, `hooks/useApiHealth.ts`, `pages/ContactPage.tsx`, `pages/DungeonPage.tsx`, shared status components.
- **Prerequisites:** Decide whether runs remain local when the API is unavailable.
- **Difficulty:** Medium
- **Priority:** High
- **Backend required:** No
- **Definition of done:** Requests cancel on unmount, time out predictably, buttons show pending state, and failures have a clear retry or documented local fallback.

### P1.6 Establish automated baseline tests

- **What:** Add Vitest, React Testing Library, and Supertest tests for storage, run transitions, route smoke tests, API health/validation/404, and contact behavior.
- **Why:** The next phases will otherwise regress the only working prototype flow.
- **Likely areas:** package files, test setup, dungeon model, frontend components, backend app export.
- **Prerequisites:** P1.1 for durable game tests; P1.3 for reproducible scripts.
- **Difficulty:** Medium
- **Priority:** High
- **Backend required:** No
- **Definition of done:** One root test command runs deterministic unit/integration tests and fails on a broken critical flow.

### P1.7 Normalize formatting and line endings

- **What:** Run Prettier intentionally, add `.editorconfig`/`.gitattributes` if desired, and make formatting a non-mutating CI check.
- **Why:** The current Prettier check fails on 18 files and dense CSS/page markup is difficult to review.
- **Likely areas:** 18 reported files, root formatting configuration, Git attributes.
- **Prerequisites:** None; isolate from behavior changes.
- **Difficulty:** Easy
- **Priority:** Medium
- **Backend required:** No
- **Definition of done:** `format:check` passes from a clean checkout and produces stable line endings on Windows.

## Phase 2: Improve design, responsiveness, and accessibility

### P2.1 Make dungeon state accessible

- **What:** Replace or justify `role="application"`; expose player coordinates, entities, objectives, health, results, and room changes to assistive technology; manage focus after transitions.
- **Why:** The primary experience currently hides its meaningful grid state from screen readers.
- **Likely areas:** dungeon grid, controls, status/story panels, shared live-region component.
- **Prerequisites:** P1.1–P1.2.
- **Difficulty:** Hard
- **Priority:** Critical
- **Backend required:** No
- **Definition of done:** Keyboard and screen-reader users can identify state, take every action, understand results, and complete/fail a run without visual-only information.

### P2.2 Complete settings or remove placeholders

- **What:** Either implement ambient sound with mute/volume and reduced-motion-safe behavior, or remove the inactive sound toggle; fully audit high-contrast tokens.
- **Why:** Settings should not promise effects that do not exist.
- **Likely areas:** settings page, provider, theme/global CSS, optional local audio assets.
- **Prerequisites:** Product decision on audio.
- **Difficulty:** Medium
- **Priority:** High
- **Backend required:** No
- **Definition of done:** Every visible setting has an immediate persistent effect and remains usable under reduced motion/high contrast.

### P2.3 Perform a formal accessibility pass

- **What:** Add `eslint-plugin-jsx-a11y`, automated axe checks, manual keyboard review, form autocomplete, live status semantics, and 44px target minimums.
- **Why:** Current semantic foundations are good, but game and status interactions need systematic coverage.
- **Likely areas:** ESLint config, forms, navigation, buttons, status components, tests, CSS.
- **Prerequisites:** P2.1 for the main game surface.
- **Difficulty:** Medium
- **Priority:** High
- **Backend required:** No
- **Definition of done:** Automated checks pass; all routes and the full run are keyboard-tested; documented contrast and screen-reader checks have no critical violations.

### P2.4 Refine responsive compositions

- **What:** Test real devices and intermediate widths, tune sticky mobile controls, long history content, landscape phones, and touch hit areas.
- **Why:** Current widths do not overflow, but responsive quality needs interaction and content-stress testing beyond three snapshots.
- **Likely areas:** `styles/components.css`, `styles/pages.css`, dungeon controls, history/settings/contact layouts.
- **Prerequisites:** Stable mechanics from Phase 1.
- **Difficulty:** Medium
- **Priority:** Medium
- **Backend required:** No
- **Definition of done:** No clipping/overlap at supported breakpoints, controls stay reachable during play, and long localized/sample content remains readable.

### P2.5 Add route metadata and visual polish

- **What:** Add per-route titles/descriptions, favicon, local social preview, consistent empty/error/success states, and restrained transitions.
- **Why:** It improves comprehension, bookmarking, sharing, and portfolio readiness without changing the identity.
- **Likely areas:** app route layer, `index.html`, public assets, states, CSS.
- **Prerequisites:** Stable route names and product positioning.
- **Difficulty:** Easy
- **Priority:** Medium
- **Backend required:** No
- **Definition of done:** Every route has a meaningful title, branded metadata/assets are local, and no starter/generic metadata remains.

## Phase 3: Add important frontend features

### P3.1 Build deterministic adaptive and control generation

- **What:** Calculate an explainable adaptation profile and compose different seeded room definitions for adaptive and random/control modes.
- **Why:** This is Mirrorvault's core differentiator.
- **Likely areas:** dungeon events, metrics, generation service, room data, results UI, tests.
- **Prerequisites:** Phase 1 mechanics/tests and agreed metrics.
- **Difficulty:** Hard
- **Priority:** Critical
- **Backend required:** No
- **Definition of done:** Identical seeds reproduce rooms; changed profiles visibly change documented weights; control mode ignores profile; tests prove both behaviors.

### P3.2 Add an end-of-run interpretation report

- **What:** Show measured signals, inferred weights, room changes, uncertainty, and the difference between self-reported preferences and observed behavior.
- **Why:** Adaptation must be legible rather than feeling arbitrary.
- **Likely areas:** completion page, run record, history details, charts or compact comparison components.
- **Prerequisites:** P3.1.
- **Difficulty:** Medium
- **Priority:** High
- **Backend required:** No
- **Definition of done:** A completed run explains what changed and why using recorded events, without claiming personality diagnosis.

### P3.3 Make characters mechanically distinct

- **What:** Apply health and one bounded, testable trait per character; show tradeoffs before selection.
- **Why:** Current character cards imply differences that do not affect play.
- **Likely areas:** character data/model, run initialization, grid visibility/cooldowns, character page, tests.
- **Prerequisites:** P1.2.
- **Difficulty:** Medium
- **Priority:** Medium
- **Backend required:** No
- **Definition of done:** Each trait changes a documented mechanic, remains balanced enough for the demo, and is covered by transition tests.

### P3.4 Expand local history and run management

- **What:** Add run detail, decision/event summary, filtering, export/import, schema migration, and storage limits.
- **Why:** Existing stored decisions are invisible and history is not useful for comparing modes.
- **Likely areas:** history pages/components, storage service, run types, routes.
- **Prerequisites:** Stable run schema and P3.2 report.
- **Difficulty:** Medium
- **Priority:** Medium
- **Backend required:** No
- **Definition of done:** Users can inspect, compare, export, import, and delete individual validated local runs.

### P3.5 Add authored content packs and seeds

- **What:** Separate narrative/room templates into versioned data packs and support shareable local seeds.
- **Why:** More content should not require editing rendering logic, and reproducibility enables testing/comparison.
- **Likely areas:** dungeon data, generator, setup form, URL/query handling, docs.
- **Prerequisites:** P3.1.
- **Difficulty:** Medium
- **Priority:** Low
- **Backend required:** No
- **Definition of done:** At least two packs load through the same schema; a copied seed reproduces the same anonymous run configuration.

## Phase 4: Add backend and database functionality

### P4.1 Introduce PostgreSQL and migrations

- **What:** Add database configuration, migration tooling, run/adventure tables, repository interfaces, and local development setup.
- **Why:** Durable cross-device data requires authoritative persistence.
- **Likely areas:** backend config/modules, new database package/config, migrations, environment docs.
- **Prerequisites:** Stable run/adventure contracts and product decision to persist data.
- **Difficulty:** Hard
- **Priority:** High
- **Backend required:** Yes
- **Definition of done:** A migration creates the documented schema; repository integration tests create/read/delete runs; setup is reproducible without committed secrets.

### P4.2 Add durable anonymous run APIs

- **What:** Create versioned endpoints to start runs, append bounded events, complete runs, list summaries, and delete data using an anonymous device/session identifier.
- **Why:** It validates persistence before authentication complexity.
- **Likely areas:** adventure/run backend modules, shared contracts, API client, history UI.
- **Prerequisites:** P4.1 and shared contracts.
- **Difficulty:** Hard
- **Priority:** High
- **Backend required:** Yes
- **Definition of done:** Valid runs persist transactionally, invalid transitions are rejected, pagination exists, and local-only mode remains available.

### P4.3 Implement real contact delivery only if required

- **What:** Connect a chosen email/ticket provider, add rate limiting, spam controls, privacy text, and observable delivery status.
- **Why:** The current endpoint validates and discards messages; a public form must not imply delivery without it.
- **Likely areas:** contact service/routes, provider adapter, frontend status copy, environment/operations docs.
- **Prerequisites:** Confirm contact is a product requirement.
- **Difficulty:** Medium
- **Priority:** Low
- **Backend required:** Yes
- **Definition of done:** Accepted messages reach the approved destination, failures are retried/reported safely, and abuse/PII handling is documented.

### P4.4 Add backend operational foundations

- **What:** Add validated env config, request IDs, structured/redacted logs, readiness checks, rate limits, security headers, timeouts, and graceful shutdown deadline.
- **Why:** Public persistence and providers need safe operations and diagnosable failures.
- **Likely areas:** backend config, app/server middleware, logging, deployment config.
- **Prerequisites:** Deployment topology and first public backend feature.
- **Difficulty:** Medium
- **Priority:** High
- **Backend required:** Yes
- **Definition of done:** Production config fails fast, logs contain request IDs without sensitive bodies, limits are tested, and readiness differs from liveness where appropriate.

## Phase 5: Add authentication, user accounts, and saved data

### P5.1 Select and integrate authentication

- **What:** Choose a maintained provider/library, implement secure sessions, sign-in/out/callbacks, and protected API identity.
- **Why:** Account-owned data requires verified identity.
- **Likely areas:** backend auth module/middleware, frontend provider/routes, environment config, contracts.
- **Prerequisites:** Database, deployment domains, privacy decisions.
- **Difficulty:** Hard
- **Priority:** High
- **Backend required:** Yes
- **Definition of done:** Users can sign in/out; sessions use approved secure storage; protected endpoints reject anonymous/other-user access; auth integration tests pass.

### P5.2 Add account-owned saves and local import

- **What:** Let signed-in users save/sync runs and explicitly import validated local history.
- **Why:** It provides account value while preserving local-first use.
- **Likely areas:** run repositories/APIs, history UI, storage migration, account pages.
- **Prerequisites:** P5.1 and P4.2.
- **Difficulty:** Hard
- **Priority:** High
- **Backend required:** Yes
- **Definition of done:** Ownership is enforced server-side; imported runs are deduplicated; offline/local runs remain usable; conflicts have a defined resolution.

### P5.3 Add profile, privacy, export, and deletion

- **What:** Add profile/preferences, account data export, run deletion, and full account deletion workflows.
- **Why:** Users need control over persisted behavioral data.
- **Likely areas:** account UI, user/run services, background deletion/export jobs if needed, privacy docs.
- **Prerequisites:** P5.1–P5.2 and retention policy.
- **Difficulty:** Hard
- **Priority:** High
- **Backend required:** Yes
- **Definition of done:** A user can view/export/delete owned data; deletion is authorization-tested and documented end to end.

### P5.4 Add admin tools only for real moderation needs

- **What:** Implement protected moderation/template/operations views and immutable audit records.
- **Why:** Admin access is justified only when public content or operational workflows exist.
- **Likely areas:** admin route group, backend authorization, audit log, moderation services.
- **Prerequisites:** Defined admin use cases, roles, and incident process.
- **Difficulty:** Hard
- **Priority:** Low
- **Backend required:** Yes
- **Definition of done:** Every action is backend-authorized and audited; ordinary users cannot load or call admin capabilities; no sensitive data is exposed unnecessarily.

## Phase 6: Testing, security, deployment, and maintenance

### P6.1 Add CI quality and security gates

- **What:** Run format check, lint, types, tests, build, dependency audit, and secret scanning on pull requests.
- **Why:** Local checks do not protect the main branch from regressions.
- **Likely areas:** `.github/workflows`, root scripts, test reports, dependency policy.
- **Prerequisites:** Phase 1 test command and canonical package manager.
- **Difficulty:** Medium
- **Priority:** High
- **Backend required:** No
- **Definition of done:** A failing check blocks merge; caches are safe; no secrets are printed; branch protection references required checks.

### P6.2 Add end-to-end and accessibility regression coverage

- **What:** Automate anonymous run completion, mode comparison, history, settings, contact, account flows, axe checks, and 375/768/1440 viewport tests.
- **Why:** Critical behavior spans components, routes, storage, and API boundaries.
- **Likely areas:** e2e tests, fixtures, stable selectors, CI browser job.
- **Prerequisites:** Stable mechanics; authentication tests wait for Phase 5.
- **Difficulty:** Hard
- **Priority:** High
- **Backend required:** Partly
- **Definition of done:** Critical paths pass reliably in CI with failure artifacts and no dependence on production services.

### P6.3 Deploy staging with production-like controls

- **What:** Deploy static frontend and Node API, configure SPA fallback/HTTPS/CORS/secrets, add managed database where required, and document rollback.
- **Why:** Staging exposes configuration and routing problems before production.
- **Likely areas:** deployment manifests, environment docs, health checks, build pipeline.
- **Prerequisites:** Features intended for deployment, operational foundation, approved platform.
- **Difficulty:** Hard
- **Priority:** Medium
- **Backend required:** Yes for API features
- **Definition of done:** Direct route refreshes work, health checks pass, secrets are managed externally, migrations are controlled, and rollback has been rehearsed.

### P6.4 Add monitoring, privacy, backup, and incident practices

- **What:** Add privacy-aware error monitoring, uptime/latency metrics, database backups/restore tests, retention policy, dependency updates, and incident runbooks.
- **Why:** Production reliability includes detection, recovery, and user-data stewardship.
- **Likely areas:** observability/deployment config, operations docs, database jobs, privacy policy.
- **Prerequisites:** Public deployment and stored data.
- **Difficulty:** Hard
- **Priority:** High before production, low before persistence
- **Backend required:** Yes
- **Definition of done:** Alerts are actionable and redacted, restores are tested, retention/deletion run as documented, and ownership/on-call expectations are clear.

### P6.5 Add performance budgets and maintenance cadence

- **What:** Track bundle size, page responsiveness, API latency, supported runtime versions, and scheduled dependency updates.
- **Why:** Current performance is good, but growth needs measurable limits.
- **Likely areas:** CI, build reports, monitoring, maintenance docs.
- **Prerequisites:** CI and deployment metrics.
- **Difficulty:** Medium
- **Priority:** Medium
- **Backend required:** No for bundles; yes for API metrics
- **Definition of done:** Budgets fail CI or alert at agreed thresholds, runtime support is documented, and dependency updates have an owner/cadence.
