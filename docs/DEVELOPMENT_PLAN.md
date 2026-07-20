# Resonant Ruins development plan

## Completed milestone: Rat Combat & Kiting v0.2

The Rat loop now supports readable facing, path-distance awareness, locked-target telegraphs, visual-only lunges, recovery after every attack, directional and perfect blocks, counterattack windows, simultaneous deterministic attacks, and crowding-aware movement. Combat state and timers persist through schema v6; generated rooms created under the four-path-tile spawn minimum identify themselves as `generator-2`.

The next development decision should follow browser balance playtesting rather than broadening combat immediately. Use Combat Debug to review dodge rate, shield use, perfect blocks, recovery counterattacks, maximum alert pressure, and body-lock intervention frequency. Tune only centralized values in `config/combat.ts` with a documented reason and regression coverage.

Do not add Rat variants, preset-specific decision quality, rewards, healing, upgrades, backend authority, or research telemetry until the v0.2 loop has been presentation-tested. See [Enemy Framework v0.2](ENEMY_FRAMEWORK.md) and [Balance changelog](BALANCE_CHANGELOG.md).

## Recommended strategy

Treat the current application as a validated visual prototype and stabilize one honest, deterministic game loop before expanding its surface area. The next milestone should make the claims already visible in the interface true; it should not add accounts, a database, AI, an admin dashboard, or more pages.

## First development milestone: Credible local adaptation

### Outcome

A player can complete or fail six mechanically meaningful rooms. The first three collect real events, the next three are composed differently from an explainable profile, and random/control mode produces a seeded comparison that does not use the profile. A completion report explains the difference. All of this remains local and works without the API.

### Scope

- Canonical package manager and working environment configuration
- Typed room/run model and reducer
- Movement, collision, objectives, health, attack, shield, hazards, treasure, failure, and retry
- Measured timing/combat/defense/exploration/reward events
- Seeded deterministic room composition
- Adaptive/control comparison
- Validated versioned local persistence
- Unit/integration tests for transitions, generation, storage, and API baseline
- Screen-reader-readable game state and keyboard parity
- Formatting baseline and CI-ready quality commands

### Explicitly out of scope

- User accounts
- Database
- AI generation
- Email delivery
- Public sharing or leaderboards
- Admin dashboard
- Billing
- Production deployment

### Exit criteria

1. Every visible dungeon control has a real state effect.
2. A room cannot advance solely because a story choice was clicked unless that is the documented objective.
3. Adaptive and control runs using the same seed are observably and testably different for the correct reason.
4. A report maps recorded events to changed room weights.
5. The full run is usable with keyboard and understandable through assistive technology.
6. Storage corruption does not crash any route.
7. Format, lint, types, unit/integration tests, production build, and a route smoke test pass from a clean clone.

## Immediate next steps

| Order | Task                                                                                  | Roadmap                        | Can run independently?                                 | Must wait for                |
| ----- | ------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------ | ---------------------------- |
| 1     | Decide exact room success/failure rules and adaptation metrics                        | Product decision for P1.1/P3.1 | Yes; product/design work                               | Nothing                      |
| 2     | Standardize package manager, Node version, and env loading                            | P1.3                           | Yes                                                    | Nothing                      |
| 3     | Normalize formatting in a dedicated non-behavior commit                               | P1.7                           | Yes                                                    | Nothing                      |
| 4     | Define room/run/event contracts and reducer transitions                               | P1.1                           | Partly                                                 | Step 1                       |
| 5     | Add unit tests around the new transitions and existing API                            | P1.6                           | API tests can start independently; reducer tests wait  | Steps 2 and 4 as applicable  |
| 6     | Implement collision, objectives, health, combat, shield, treasure, failure, and retry | P1.2                           | No                                                     | Step 4                       |
| 7     | Validate/migrate localStorage and type API responses                                  | P1.4                           | Storage infrastructure can start after shape agreement | Step 4                       |
| 8     | Fix request cancellation, timeouts, pending states, and fallback messaging            | P1.5                           | Mostly yes                                             | Step 2; API product decision |
| 9     | Make game state accessible and verify keyboard parity                                 | P2.1                           | Semantic design can start; implementation waits        | Step 6                       |
| 10    | Implement seeded adaptation/control generation and report                             | P3.1–P3.2                      | No                                                     | Steps 4–7 and agreed metrics |

The safest first engineering task is P1.3 because it is small, isolated, and removes setup ambiguity. The first behavior task is P1.1. Do not start P3.1 by manipulating the current static JSX grid; the room model must come first.

## Parallel work map

### Safe to complete independently now

- Package-manager and environment decision
- Formatting-only cleanup
- API integration tests for existing routes
- Product definition of mechanics and measured signals
- Accessibility design for announcing grid state
- Documentation of supported browsers and Node versions

### Can run in parallel after the room model is agreed

- Reducer unit tests
- Room renderer refactor
- Storage schema/versioning
- Event/metric calculation
- Accessible state descriptions
- Authored room data extraction

### Must wait

- Adaptive generation waits for real events and a stable room schema.
- Run interpretation waits for defined metrics and adaptive weights.
- Database persistence waits for a stable run/event contract.
- Authentication waits for a real account-owned persistence use case.
- Admin tools wait for public content or operational moderation needs.
- AI generation waits for deterministic validation, provider safeguards, and authored fallback rooms.
- Production deployment waits for CI, environment validation, security controls, and an approved hosting target.

## Work packages

### Work package A: Repository baseline

- Complete P1.3 and P1.7.
- Add an `engines` range and canonical `packageManager` declaration.
- Ensure a clean clone can follow exactly one install path.
- Make `format:check`, lint, types, tests, and build stable root commands.
- Document backend env location and confirm an overridden port/origin at runtime.

**Risk:** Low. Keep formatting separate from functional changes to preserve reviewability.

### Work package B: Domain model

- Complete P1.1.
- Write state and event contracts before UI refactoring.
- Use pure functions for movement, attack, shield, interact, room completion, retry, and run completion.
- Model coordinates and entities as data.
- Add seeded random number generation as an injectable dependency.

**Risk:** Medium. Avoid turning the state model into a generic game engine; model only Mirrorvault's current mechanics.

### Work package C: Mechanics and truthfulness

- Complete P1.2.
- Remove or disable any control until it has behavior.
- Align About/Home claims with measured events.
- Use character health and implement one trait only after baseline mechanics pass.

**Risk:** Medium to high. The key product decision is whether movement or narrative choices complete rooms.

### Work package D: Data boundaries

- Complete P1.4 and P1.5.
- Add versioned storage schemas and migration tests.
- Add typed API envelopes, timeouts, cancellation, and pending/error states.
- Decide whether the current adventure POST is useful; either consume its response or remove the call until backend orchestration exists.

**Risk:** Low to medium. Preserve the intentional offline/local fallback.

### Work package E: Accessibility

- Complete P2.1 and relevant P2.3 items.
- Test keyboard-only and screen-reader flows against real mechanics.
- Announce state changes without flooding live regions during rapid movement.
- Keep visual focus and touch controls equivalent to keyboard commands.

**Risk:** Medium. `role="application"` changes screen-reader behavior and should not remain without a tested interaction model.

### Work package F: Adaptation

- Complete P3.1 and P3.2.
- Convert bounded events into normalized metrics.
- Keep weights explainable and capped.
- Use the same seed for fair adaptive/control comparisons.
- Validate generated rooms for bounds, reachable objectives, and legal entity counts.

**Risk:** High. Avoid AI or opaque scoring until deterministic composition is demonstrably fun and correct.

## Validation plan by change type

### Every meaningful change

- Format check
- ESLint
- TypeScript
- Relevant unit/integration tests
- Production build

### Dungeon behavior changes

- Pure transition tests
- Keyboard and on-screen control parity
- Success, failure, retry, and reset paths
- 375px and desktop play checks
- Screen-reader state announcement review

### API changes

- Valid and invalid request tests
- 404 and standardized error envelope
- CORS test
- Body limit and rate-limit tests when public
- Authorization tests once accounts exist

### Persistence changes

- Migration from every supported storage/database version
- Corrupt-data fallback
- Ownership and deletion tests
- Export/import round trip

## Decision record to create before implementation

Create short architecture decision records for:

1. Canonical package manager and Node support
2. Room completion and failure semantics
3. Adaptation metrics and weights
4. Local-only vs backend-authoritative run behavior
5. Authentication provider when Phase 5 begins
6. Database and migration tooling when Phase 4 begins
7. AI provider boundaries when AI generation is approved

## Product questions blocking major work

- Is the main experience a spatial game with narrative, or a narrative choice experiment with a spatial visualization?
- Should reaching the exit or rune always complete a room?
- Can the player lose a run, and what does retry mean for assessment scoring?
- Which actions should count toward combat, defense, puzzle, exploration, and risk?
- How visible should adaptation be during play versus only in the final report?
- Should control mode be random, seeded random, or an authored fixed sequence?
- Are character traits expected to affect adaptation scoring or only moment-to-moment play?
- Is offline/local-first support a permanent product promise?
- What information, if any, may leave the device in future versions?

## Planning document map

- [CURRENT_STATE.md](CURRENT_STATE.md): audited facts, strengths, gaps, checks, assumptions
- [ARCHITECTURE.md](ARCHITECTURE.md): recommended future boundaries and technology shape
- [ROADMAP.md](ROADMAP.md): full phase tasks with priority, difficulty, prerequisites, and done criteria
- [BACKLOG.md](BACKLOG.md): checkbox execution view grouped by phase and priority
- [future-backend-plan.md](future-backend-plan.md): earlier high-level backend notes retained for historical context
