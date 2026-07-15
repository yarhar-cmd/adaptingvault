# Mirrorvault Local

Mirrorvault Local is an editable, local-first recreation of the **Mirrorvault adaptive dungeon experiment**. It preserves the original dark-vault atmosphere and its core idea: observe how a player approaches three assessment rooms, then change later room composition while the underlying rules remain stable.

This repository is intentionally a functional prototype. Story scenes and adaptations are labeled mock content. It does not call an AI provider, require an API key, create user accounts, or use a database.

## Planning and architecture

- [Current repository assessment](docs/CURRENT_STATE.md)
- [Development plan and immediate milestone](docs/DEVELOPMENT_PLAN.md)
- [Phased feature roadmap](docs/ROADMAP.md)
- [Recommended architecture](docs/ARCHITECTURE.md)
- [Prioritized checkbox backlog](docs/BACKLOG.md)
- [Earlier future-backend notes](docs/future-backend-plan.md)

## Technology

- React 19, TypeScript, Vite, and React Router for the frontend
- Node.js, Express, TypeScript, Zod validation, CORS, and Morgan for the backend
- npm workspaces for running both apps from one root
- ESLint and Prettier for code quality
- browser `localStorage` for selected character, preferences, and completed demo runs

## Folder structure

```text
mirrorvault-local/
├── apps/
│   ├── frontend/
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── assets/        # Future local images, icons, and fonts
│   │   │   ├── components/    # Common, layout, and Mirrorvault components
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
- `/dungeon` — setup, playable grid, story choices, and run reset
- `/characters` — local character selection
- `/history` — completed browser-local runs
- `/about` — adaptation explanation and prototype boundaries
- `/settings` — local accessibility and presentation preferences
- `/contact` — locally validated test form
- every unmatched URL — custom 404 chamber

React Router owns client-side navigation. To add a page, create a component in `apps/frontend/src/pages`, then add its route in `apps/frontend/src/routes/AppRoutes.tsx`. Add a navigation link only when the route should be globally visible.

## Components and state

Layout components define the shell, header, footer, desktop links, and mobile links. Common components define panels, buttons, and feedback states. Mirrorvault components hold domain-specific controls such as the intake form, dungeon grid, story choices, and run status.

To add a component, create a focused `.tsx` file under the best matching component folder. Accept data and callbacks as props, keep page-specific state in the page, and move shared state into context or a dedicated hook only when multiple routes need it.

The `AdventureProvider` shares the selected character and settings. The dungeon page owns active-run state so leaving the page naturally abandons the unfinished mock run.

## Frontend and backend communication

All HTTP calls go through `apps/frontend/src/services/api.ts`. It reads:

```text
VITE_API_BASE_URL=http://localhost:3001
```

Copy `apps/frontend/.env.example` to `.env` only if you need to change the value. Do not commit `.env` files.

The unobtrusive lower-corner status indicator calls `GET /api/health`. If the backend is unavailable, the dungeon still works in explicitly labeled demo-only mode because its mock generator is local.

## Mock generation and localStorage

`mockAdventureService.ts` returns deterministic example scenes. The first three are assessment rooms. Rooms four through six add an adaptation sentence based on the selected mode, challenge, and playstyle. The service interface is deliberately separate from UI code so a future API implementation can replace it.

The browser stores only:

- `mirrorvault:character`
- `mirrorvault:settings`
- `mirrorvault:runs`

Clear the run archive on `/history`, or clear site data in browser settings to reset everything.

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
npm run lint
npm run typecheck
npm run build
npm run format
```

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
