# Recommended Resonant Ruins architecture

## Architecture goal

Keep Resonant Ruins understandable as it grows: one frontend application, one API, one shared contract layer, and explicit boundaries around game rules, persistence, authentication, and external providers. The project does not need microservices, event streaming, GraphQL, a complex state library, or a plugin system at its current scale.

## Recommended near-term structure

```text
apps/
  frontend/
    src/
      app/
        App.tsx
        routes.tsx
        providers.tsx
      components/
        common/
        layout/
      features/
        dungeon/
          components/
          data/
          hooks/
          model/
          pages/
        characters/
        history/
        settings/
        contact/
      services/
        api/
        storage/
      styles/
      test/
  backend/
    src/
      config/
      middleware/
      modules/
        adventures/
          adventure.controller.ts
          adventure.repository.ts
          adventure.routes.ts
          adventure.schema.ts
          adventure.service.ts
        contact/
        health/
      providers/
      app.ts
      server.ts
packages/
  contracts/
    src/
      adventure.ts
      api.ts
docs/
```

This should be introduced incrementally. Moving every current file at once would create noise without improving behavior.

## Frontend boundaries

### App layer

The app layer should contain routing, top-level providers, error boundaries, document metadata, and global shell concerns. It should not contain dungeon rules.

### Feature folders

Group files by behavior once a feature has more than a page and one or two components. The dungeon is already large enough to become a feature folder. Characters, history, and settings can remain small until their behavior grows.

### Dungeon domain model

Represent a room as data rather than hard-coded CSS coordinates:

```ts
type TileKind = 'floor' | 'wall' | 'exit' | 'rune' | 'hazard' | 'enemy' | 'treasure';

interface RoomDefinition {
  id: string;
  width: number;
  height: number;
  tiles: Tile[];
  entities: Entity[];
  objectives: Objective[];
  narrative: SceneContent;
}
```

Keep state transitions in a reducer or pure state machine:

```text
SETUP → LOADING_ROOM → PLAYING → ROOM_COMPLETE → LOADING_ROOM
                                          ↘ RUN_COMPLETE
PLAYING → RUN_FAILED
```

Actions such as move, attack, shield, interact, choose narrative option, reset, and retry should produce explicit state changes and events. Pure transition functions can be unit-tested without rendering React.

### Adaptation engine

Start with a deterministic frontend/domain service, not AI. It should accept bounded events and return an explainable profile:

```text
events → metrics → adaptation profile → seeded room composer
```

Suggested initial metrics:

- completion duration
- damage taken
- attacks attempted/hit
- shield timing
- optional hazards entered
- treasure accepted/skipped
- direct vs alternate exit
- retry count

Suggested output weights:

- combat density
- hazard density
- puzzle density
- exploration branching
- reward risk
- pressure target

The same seed plus profile should produce the same room. This makes adaptive and control runs comparable and debuggable.

### Client persistence

Keep anonymous preferences, selected character, and a bounded recent-run cache in `localStorage`. Add:

- Zod schemas at the storage boundary
- a storage version number
- migrations for changed shapes
- safe fallbacks when data is corrupt
- explicit clear/export controls

Do not store access tokens, privileged roles, API secrets, or sensitive profile data in `localStorage`.

The current defeat archive is implemented at the frontend storage boundary in
`apps/frontend/src/services/runArchive.ts`. It stores one validated, versioned envelope containing
separate five-record histories and independent best-stat ownership for Warden, Seeker, and Ember.
The separate `activeRunStorage.ts` boundary persists one validated active or defeated run, including
health, elapsed active time, evaluation order and analytics, room position, facing, and stable run
statistics. It excludes held input, transition frames, focus, and temporary action feedback. Neither
active-run progression nor evaluation analytics are written to the completed-run archive.

### Current data-driven room progression

The Resonant Ruins evaluation sequence is defined under `apps/frontend/src/data/rooms`. Five room
definitions describe dimensions, explicit coordinate-based floor and wall sets, exits, spawn points,
and optional hazards. Pure helpers in `roomGeometry.ts` generate rectangular shells and validate
walkability, boundary crossings, and safe spawns without relying on CSS dimensions.

`roomProgression.ts` creates the fixed five-room Awakening order for every new run while accepting
valid legacy shuffled orders during restore. `gameplayState.ts` atomically commits a room
exit, destination spawn, rooms-cleared count, and evaluation timing record. `useRoomTransition.ts`
owns only the temporary 150 ms fade phases and input lock; the destination gameplay state is already
committed and persisted so a refresh cannot restore a half-transitioned source room. After the fifth
Awakening Chamber, the same run continues through deterministic generated Dungeon Rooms.

## Shared contracts

Create `packages/contracts` when the next API response is consumed by the UI. It should contain only serializable TypeScript types and Zod schemas shared by both apps. It must not import React, Express, database libraries, or provider SDKs.

Good shared candidates:

- `AdventureConfig`
- `AdventureSummary`
- `RunEvent`
- `RunSummary`
- API error envelope
- request/response schemas

This removes the current duplicate adventure configuration definitions and gives the API client typed responses.

## Backend boundaries

### Keep frontend-only for now

- anonymous setup state
- immediate movement and combat interactions
- deterministic room rendering
- accessibility preferences
- selected character
- optional recent-run cache
- explainable local adaptation calculations during prototype development

These features benefit from instant feedback and do not require trust or centralized persistence.

### Move to the backend when needed

- durable account-owned runs
- cross-device synchronization
- public/shareable adventures
- authoritative achievements or leaderboards
- contact delivery
- admin moderation
- usage limits
- AI/provider calls
- billing or entitlements

Anything requiring secrecy, authorization, global uniqueness, moderation, or trusted records belongs on the server.

### Module pattern

Each backend module should own its route, request schema, controller, service, and repository interface. Controllers should translate HTTP; services should implement use cases; repositories should isolate persistence. Avoid adding a generic repository abstraction until at least two real repositories need the same behavior.

### Environment configuration

Choose one backend environment location and validate it at startup. Recommended options:

1. Run the backend with `cwd=apps/backend` and keep `apps/backend/.env`, or
2. Use a root `.env` and document it as the single server configuration file.

Parse all values with a schema. Reject invalid ports, origins, missing production secrets, and unsupported environment names before listening.

## Database recommendation

Do not add a database until the run schema and save behavior are stable. When ready, PostgreSQL is the safest default because the data is relational and likely to need filtering, ownership, migrations, and transactional updates.

Recommended first tables:

- `users`
- `characters`
- `adventures`
- `runs`
- `run_events`
- `adaptation_profiles`
- `refresh_sessions` only if the chosen auth system requires them

Store generated room definitions and adaptation profiles as versioned JSON only where their shapes are naturally document-like. Keep ownership, status, timestamps, and searchable fields as normal columns.

Use migrations from the first database commit. Add a repository interface so unit tests can use an in-memory implementation without pretending the database does not exist.

## Authentication and accounts

Prefer a maintained authentication service or library that supports secure server-side sessions. Do not build password storage from scratch.

Recommended flow:

1. Add authentication only after anonymous runs are stable.
2. Keep anonymous play available.
3. Let a new account import local runs explicitly.
4. Use secure, HTTP-only, same-site cookies where the deployment topology allows it.
5. Enforce authorization in services/repositories, not only route components.
6. Add account data export and deletion before storing meaningful histories.

Frontend route guards improve UX but never replace backend authorization.

## API design

Keep REST for the current product. Suggested future resources:

```text
GET    /api/health
GET    /api/me
GET    /api/characters
GET    /api/runs
POST   /api/runs
GET    /api/runs/:runId
POST   /api/runs/:runId/events
POST   /api/runs/:runId/complete
DELETE /api/runs/:runId
POST   /api/contact
```

Use a consistent error envelope with a request ID, stable error code, user-safe message, and optional validation details. Add pagination before run lists can grow without bounds.

## AI integration

AI should be an optional backend provider behind an `AdventureGenerator` interface. Do not let provider output directly become executable rules or trusted database fields.

Pipeline:

1. Convert validated run signals into a bounded generation brief.
2. Request structured output.
3. Validate output against room/content schemas.
4. Apply deterministic rule validation: reachable exit, bounded enemies, legal coordinates, allowed content.
5. Fall back to authored templates on failure or timeout.
6. Record provider/model/schema version without storing secrets.

Rate limits, content moderation, cost caps, timeouts, retries, and redacted observability are prerequisites for public AI generation.

## Admin dashboard

Do not add an admin dashboard until there is real moderated or operational data. When required, build it as a protected route group or a small separate frontend only if deployment/security needs differ.

Potential capabilities:

- review flagged generated content
- inspect failed generations and schema violations
- manage authored templates
- view aggregate system health and usage
- suspend accounts or revoke shared content

Every admin action must be authorized on the backend and written to an audit log. Never infer admin access from a client-side flag.

## Testing architecture

Use a small testing pyramid:

- Pure unit tests for dungeon transitions, scoring, seeded generation, storage migration, and services
- React component/integration tests for setup, navigation, settings, history, error states, and accessibility semantics
- API integration tests for validation, CORS, errors, and future authorization
- A few end-to-end tests for the critical anonymous run and account save flows

Recommended tools are Vitest, React Testing Library, Supertest, and Playwright. Add them only as the corresponding test layer is introduced.

## Deployment shape

Initially deploy two artifacts:

- static Vite frontend with SPA fallback routing
- Node API process behind HTTPS

Use separate staging and production environments. Configure exact allowed origins, secure headers, request limits, health/readiness checks, structured logs, and a managed secret store. Add a managed PostgreSQL database only in the database phase.

## Decisions to avoid for now

- Microservices
- GraphQL
- Redux or another global state library before reducer/context boundaries prove insufficient
- WebSockets before real-time collaboration exists
- Kubernetes
- Event sourcing
- Custom authentication/password storage
- A separate admin application without real admin use cases
- AI-generated mechanics before deterministic rules are validated

## Current adaptive dungeon boundary

The local frontend now separates three persistence lifetimes:

- `playerProfileStorage.ts` owns the versioned experience preset, first-time status, shortcut unlock,
  long-term adaptive traits, and confidence metadata.
- `activeRunStorage.ts` owns volatile per-run signals, current-run/effective profiles, the run seed,
  poke cooldown, authored Chamber analytics, dungeon-only room count, player state, and the exact
  current generated-room snapshot. Schema version 5 stores reducer-owned pause state and safe
  remaining durations for invulnerability, pending rune damage, and attack cooldown. It bounds
  exact signal storage to the current room, retains five detailed generated-room snapshots, and
  compacts older rooms into a fixed numeric summary. Version 3 migrates and compacts on load;
  versions 1 and 2 migrate as unpaused.
- `runArchive.ts` owns completed records. Version 2 records store `experiencePreset` and
  `dungeonRoomsCleared`; legacy records migrate to the explicit `unknown` preset. Bests are
  partitioned by character and preset.

Enemy Framework v1 is reducer-owned and frontend-authoritative. `enemySystem.ts` provides
deterministic cardinal BFS and generated quantity selection; `useEnemyClock.ts` provides one shared
real-time clock; and `types/enemies.ts` defines the Rat state machine and fixed constants. Active-run
schema v5 stores exact current-room Rat state and remaining deadlines only. Pausing shifts enemy
deadlines exactly, living Rats seal `enemies-defeated` exits, and corpses become non-blocking
immediately. New combat signals remain bounded numeric summaries. Adaptation affects generated Rat
quantity only, never Rat stats or intelligence.

Generation remains frontend-only and deterministic. Pure utilities map bounded profiles to typed
parameters, derive a room seed from the run seed/room number/chosen exit/generator version, generate
rectangle or L-shaped floor regions, place exits and existing rune hazards, validate connectivity and
safe cardinal paths, retry at most 20 times, and fall back to a known-safe rectangle. Generated rooms
may contain deterministic safe Rat spawns and rune hazards; treasure, branches, internal wall
structures, and backtracking remain outside this milestone.

The dungeon has two route boundaries. `/dungeon` uses the normal website shell and contains only
experience selection and run setup. `/dungeon/run` uses `GameShell` without the website header,
footer, narrative, or page padding. `DungeonRunPage` composes the view, and `useRunController` is the
single gameplay authority for reducer state, restoration, transitions, generation, adaptation,
persistence, archives, pause timing, and run navigation.

Pause is reducer-owned rather than a page boolean. Survival time subtracts accumulated and current
pause duration. Resume shifts absolute gameplay deadlines by the pause duration, and persistence
stores remaining durations so refresh and time spent in Settings or Main Menu cannot consume them.
Held keyboard/pointer input is cleared when the shared gameplay input gate closes.

Development-only inspection reuses `DebugTools.tsx` inside the right-side `DebugDrawer`, behind
`import.meta.env.DEV`. It displays raw signals, long-term/current/effective traits, generation inputs
and reasons, validation state, poke cooldown, active/archive byte sizes, retained snapshots,
current-room visited tiles, summarized-room count, schema versions, and centralized build metadata.
Its advance and override controls use the same normal reducer/generation paths. It also contains
current-room enemy controls and the isolated Awakening editor. `apps/frontend/src/config/version.ts`
is the typed source of truth for game, generator, adaptation-rules, and future telemetry-schema
versions; persisted storage-envelope versions remain owned by their storage modules because they
govern migrations.
`import.meta.env.DEV` removes the Debug boundary from production, and the post-build
production-safety scanner verifies emitted JavaScript.

The active record, settings, profile, and completed archive are parsed and recovered independently.
A malformed area resets only that area. A valid preset may be salvaged from a malformed profile,
but adaptive traits and shortcut unlocks return to safe defaults. Invalid player positions are
repaired to the nearest safe spawn; malformed room geometry is rejected. Storage write failures do
not stop the in-memory run and show a rate-limited warning that refresh may lose progress.

The deterministic generator validator checks terrain bounds and duplicates, directional boundary
openings, exit structure and spacing, spawn safety, hazard separation, connected floors, complete
perimeter walls, and hazard-free spawn-to-exit paths. Unit tests cover 5,000 varied deterministic
seeds. The root Playwright configuration adds a Chromium-only smoke suite for start, pause/refresh,
Main Menu resume, restart, defeat/archive, maximum room layout, and stored-position repair.
