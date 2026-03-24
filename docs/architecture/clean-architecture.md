# Clean Architecture

The refactor is complete. The runtime now runs entirely through the clean-architecture layout instead of the old migration split.

## Layer Rule

Dependencies point inward:

```text
api -> core
adapters -> core
container -> api + adapters + core + config
shared -> consumed where needed
```

The runtime composition itself lives in `container` and `main.ts`, not in the domain layer.

## Layer Breakdown

### Core

`src/core/` contains the domain-facing browser logic:

- entities: browser session, tab, profile
- ports: browser driver, event bus, session store
- services: session, interaction, discovery, navigation, snapshot
- use cases: execute action, take snapshot, start session, generate control token

### Adapters

`src/adapters/` contains concrete implementations:

- `playwright/` for browser/page automation, snapshots, navigation, activity, downloads, DOM observation
- `chrome/` for launching and managing Chrome-based profiles and relay support
- `http/` for Express server setup and `/control/live` websocket installation
- `logging/` for structured logging
- `utils/` for in-memory infra pieces

### API

`src/api/` owns the transport contract:

- route registration
- request handling via controllers
- middleware for correlation, logging, and errors
- request validation and compatibility handling for `/act`

### Config

`src/config/` loads environment-backed configuration and validates defaults.

### Container

`src/container/` wires concrete adapters into the services and use cases used by the controllers.

### Shared

`src/shared/` contains reusable errors, types, constants, and utility functions used across layers.

## Runtime Entry

`src/main.ts` does all runtime assembly:

1. `import 'dotenv/config'`
2. `loadConfig()`
3. `createContainer(config)`
4. create route context and controller instances
5. register route modules
6. start HTTP server
7. install `/control/live`

The package entrypoint matches that runtime:

- source entry: `src/main.ts`
- built entry: `dist/main.js`

## What Changed From Migration-Era Docs

These statements are no longer true and have been removed from the docs set:

- the project is no longer "in progress"
- the refactor is no longer split across worktrees
- the runtime entry is not `server.ts`
- the current docs should not describe a pending merge or dual-path architecture as the primary model

Legacy compatibility code still exists in some places, especially under `src/browser/`, but the runtime documentation now treats the clean-architecture path as the canonical application path.
