# Resonant Ruins Local

Resonant Ruins Local is an editable, local-first adaptive dungeon prototype. It preserves the original dark-vault atmosphere while observing five authored Awakening Chambers and deterministically generating an endless sequence of later Dungeon Rooms.

This repository is intentionally a functional prototype. Story scenes and adaptations are labeled mock content. It does not call an AI provider, require an API key, create user accounts, or use a database.

## Planning and architecture

- [Current repository assessment](docs/CURRENT_STATE.md)
- [Development plan and immediate milestone](docs/DEVELOPMENT_PLAN.md)
- [Phased feature roadmap](docs/ROADMAP.md)
- [Recommended architecture](docs/ARCHITECTURE.md)
- [Prioritized checkbox backlog](docs/BACKLOG.md)
- [Enemy Framework v0.2](docs/ENEMY_FRAMEWORK.md)
- [Balance changelog](docs/BALANCE_CHANGELOG.md)
- [Earlier future-backend notes](docs/future-backend-plan.md)

## Technology

- React 19, TypeScript, Vite, and React Router for the frontend
- Node.js, Express, TypeScript, Zod validation, CORS, and Morgan for the backend
- npm workspaces for running both apps from one root
- ESLint and Prettier for code quality
- browser `localStorage` for selected character, preferences, experience preset, adaptive profile,
  shortcut unlock, a validated active run snapshot, and preset-partitioned run records and bests
- Playwright for a small Chromium-only critical-flow suite

## Folder structure

```text
mirrorvault-local/
├── apps/
│   ├── frontend/
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── assets/        # Future local images, icons, and fonts
│   │   │   ├── components/    # Common, layout, and domain components
│   │   │   ├── context/       # Shared character and settings state
│   │   │   ├── hooks/         # Context and API-health hooks
│   │   │   ├── pages/         # Route-level screens
│   │   │   ├── routes/        # React Router map
│   │   │   ├── services/      # API, mock-adventure, and storage boundaries
│   │   │   ├── styles/        # Theme, global, component, and page CSS
│   │   │   ├── types/         # Shared frontend domain types
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── .env.example
│   │   ├── index.html
│   │   ├── package.json
│   │   └── vite.config.ts
│   └── backend/
│       ├── src/
│       │   ├── config/        # Environment configuration
│       │   ├── controllers/   # HTTP response handlers
│       │   ├── middleware/    # Validation, 404, and error handling
│       │   ├── routes/        # Express route definitions
│       │   ├── services/      # Mock adventure and contact logic
│       │   ├── types/         # Backend domain types
│       │   ├── utils/         # Reusable HTTP error
│       │   ├── app.ts
│       │   └── server.ts
│       ├── .env.example
│       └── package.json
├── docs/
│   ├── architecture.md
│   └── future-backend-plan.md
├── AGENTS.md
├── eslint.config.js
├── package.json
└── README.md
```

## Software required

Install a current Node.js LTS release, which includes npm. On Windows, confirm installation in PowerShell:

```powershell
node --version
npm --version
```

## Install and start

From the repository root:

```powershell
npm install
npm run dev
```

Open **http://localhost:5173**. The local API runs at **http://localhost:3001**, and its health endpoint is **http://localhost:3001/api/health**.

The root development command starts both processes. Press `Ctrl+C` in that PowerShell window to stop them. If Windows asks whether to terminate a batch job, type `Y` and press Enter.

Run only one side when needed:

```powershell
npm run dev:frontend
npm run dev:backend
```

## Routes

- `/` — the original landing experience and methodology
- `/dungeon` — first-time experience choice and minimal run setup
- `/dungeon/run` — dedicated full-viewport Awakening Chamber and generated-room gameplay
- `/characters` — local character selection
- `/history` — completed browser-local runs
- `/about` — adaptation explanation and prototype boundaries
- `/settings` — local accessibility and presentation preferences
- `/contact` — locally validated test form
- every unmatched URL — custom 404 chamber

React Router owns client-side navigation. To add a page, create a component in `apps/frontend/src/pages`, then add its route in `apps/frontend/src/routes/AppRoutes.tsx`. Add a navigation link only when the route should be globally visible.

## Components and state

Layout components define the shell, header, footer, desktop links, and mobile links. Common components define panels, buttons, and feedback states. The existing `components/mirrorvault` folder holds domain-specific controls such as the intake form, dungeon grid, story choices, and run status; its internal name remains unchanged for now to avoid a broad rename.

To add a component, create a focused `.tsx` file under the best matching component folder. Accept data and callbacks as props, keep page-specific state in the page, and move shared state into context or a dedicated hook only when multiple routes need it.

The `AdventureProvider` shares the selected character, settings, and versioned local player profile.
`DungeonEntryPage` owns setup and creates the initial saved run. `DungeonRunPage` renders the
dedicated game shell, while `useRunController` owns the single live gameplay reducer, generation,
transitions, pause/resume actions, persistence, archive effects, and run navigation. Validated
snapshots allow active, defeated, and paused runs to survive refresh without counting closed-tab or
paused time.

The first run uses `Experience Choice → Run Setup → Delve`. Returning runs begin at Run Setup,
while Restart Run immediately reuses the current preset and settings. Authored room IDs remain
`evaluation-room-*` internally for migration safety, but their player-facing labels are Awakening
Chambers. Completing all five unlocks Chamber 1's persistent generated-dungeon shortcut.

New runs use a fixed five-Chamber order. Chambers 4 and 5 contain ordered authored Rat spawns, with
the first one, two, or three enabled by experience preset. Rats begin unaware, alert by path
distance, chase with deterministic BFS/reservations, lock a tile for a readable telegraph, lunge
visually, and recover after every hit, miss, or block. Hold Shift to raise a directional shield;
raising it or turning it correctly during the final 125 ms before impact produces a perfect block
and longer Rat recovery. See [Enemy Framework v0.2](docs/ENEMY_FRAMEWORK.md) for constants and rules.

Generated rooms are derived from a run seed, room number, chosen exit, and generator version. The
generator supports rectangles and L-shapes, one to three exits, red-rune hazards, deterministic
validation/retries, and a known-safe fallback. The active-run record stores both the seed inputs and
the exact validated current-room snapshot so refreshes do not change the room. New rooms use
`generator-2`; saved rooms retain the generator version that produced them.

## Frontend and backend communication

All HTTP calls go through `apps/frontend/src/services/api.ts`. It reads:

```text
VITE_API_BASE_URL=http://localhost:3001
```

Copy `apps/frontend/.env.example` to `.env` only if you need to change the value. Do not commit `.env` files.

The unobtrusive lower-corner status indicator calls `GET /api/health`. If the backend is unavailable, the dungeon still works in explicitly labeled demo-only mode because its mock generator is local.

## Mock generation and localStorage

`mockAdventureService.ts` returns deterministic example scenes. The first three are assessment rooms. Rooms four through six add an adaptation sentence based on the selected mode, challenge, and playstyle. The service interface is deliberately separate from UI code so a future API implementation can replace it.

The browser stores only prototype data under these keys:

- `mirrorvault:character`
- `mirrorvault:settings`
- `mirrorvault:player-profile:v1`
- `mirrorvault:run-archive:v1` (version 2 envelope)
- `mirrorvault:active-run:v1`

Development builds may also use `mirrorvault:awakening-editor-drafts:v1`. It is isolated from normal
gameplay storage and absent from production output.

The active-run record contains the run ID, character, health, elapsed active time, room order,
current room and tile, facing, stable statistics, Awakening analytics, authoritative pause state,
and remaining invulnerability, pending-rune, and attack-cooldown durations. Temporary held input,
fade, visual feedback, and focus state remain excluded. Active-run Pause-menu navigation to Settings
or Main Menu preserves the record; Game Over Main Menu intentionally clears it. Restart replaces it.
The v6 active-run schema also keeps exact Rat facing, awareness, combat state, locked target,
outcome, recovery kind, and remaining enemy deadlines for the current room only. Physically held
keyboard/pointer input is intentionally cleared on pause or refresh so the shield resumes lowered.
It keeps exact visited tiles only for the current room, five detailed recent
room snapshots, and a fixed-size numeric summary for older rooms. The completed archive keeps five
recent defeats per character plus fixed-size best statistics. Clear site data in browser settings to
reset everything.

## API routes and adding another route

- `GET /api/health`
- `GET /api/adventures`
- `POST /api/adventures`
- `POST /api/contact`

To add an endpoint:

1. Put domain work in `apps/backend/src/services`.
2. Add an HTTP handler in `controllers`.
3. Add a route in `routes`, with a Zod schema for incoming data.
4. Mount the router in `routes/index.ts`.
5. Add the corresponding centralized frontend method to `services/api.ts` when the UI needs it.

## Future integrations

A real adventure model should be called from a backend service, never directly from React. Authentication middleware would sit before protected API routes. Database repositories would live behind services so controllers do not depend on a specific database. See [docs/future-backend-plan.md](docs/future-backend-plan.md) for a staged plan.

Environment variables belong in app-specific `.env` files and are documented in each `.env.example`. Variables beginning with `VITE_` are visible to browser code and must never contain secrets.

## Quality commands

```powershell
npm run test
npm run test:e2e
npm run lint
npm run typecheck
npm run build
npm run verify:production-safety
npm run format
```

The end-to-end suite uses the installed Chrome channel as its Chromium runtime. To use Playwright's
bundled Chromium instead, remove `channel: 'chrome'` from `playwright.config.ts` and install it with
`npx playwright install chromium`.

The production frontend output is under `apps/frontend/dist`; compiled backend output is under `apps/backend/dist`.

## Windows troubleshooting

- **`npm` is not recognized:** install Node.js LTS, close PowerShell, and open a new PowerShell window.
- **Port 5173 or 3001 is already in use:** stop the earlier development process with `Ctrl+C`, or locate it with `Get-NetTCPConnection -LocalPort 5173,3001`.
- **PowerShell blocks scripts:** run npm through `npm.cmd`, or review your user execution policy with your administrator.
- **The API indicator says demo-only:** make sure `npm run dev` is still running and open the health URL directly.
- **A stale page appears:** use `Ctrl+F5` to refresh Vite's client, then restart `npm run dev` if necessary.
- **Dependencies behave unexpectedly:** delete `node_modules` and `package-lock.json` only when you intentionally want a clean reinstall, then run `npm install` again.

## Current boundaries

No screenshots or image files were supplied with the build brief, so the accessible hosted Mirrorvault page was used as the visual reference. The dungeon tiles and symbols are recreated with CSS instead of copied proprietary assets. Contact submissions are validated and discarded; adventure responses are mock data.
