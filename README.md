# Tailorec Browser Service

Standalone browser automation service for LLM-driven workflows. The service exposes pages as semantic snapshots with stable element refs and executes browser actions through a small HTTP API.

## What Ships Now

- Runtime entrypoint: `src/main.ts`
- HTTP API on `127.0.0.1:4000` by default
- Clean architecture split across `api`, `adapters`, `core`, `config`, `container`, and `shared`
- Playwright-backed browser/session management with pluggable browser providers
- Snapshot, action, hooks, media, and interactive control endpoints
- Vitest unit/integration/contract coverage plus Playwright E2E coverage

## Quick Start

```bash
npm install
npx playwright install chromium
npm run dev
```

Service URLs:

- `GET /` health text response
- `GET /status` JSON status response
- API base URL: `http://127.0.0.1:4000`

## Example Workflow

Navigate:

```bash
curl -X POST http://127.0.0.1:4000/act \
  -H 'Content-Type: application/json' \
  -d '{"kind":"navigate","url":"https://example.com"}'
```

Take a snapshot:

```bash
curl -X POST http://127.0.0.1:4000/snapshot \
  -H 'Content-Type: application/json' \
  -d '{"interactiveOnly":true,"compact":true}'
```

Click by ref:

```bash
curl -X POST http://127.0.0.1:4000/act \
  -H 'Content-Type: application/json' \
  -d '{"kind":"click","ref":"e2"}'
```

## Architecture

The runtime composes the application in `src/main.ts`:

1. Load config from `src/config/config.ts`
2. Build the dependency container in `src/container/container.ts`
3. Create browser route context and controllers
4. Register route modules from `src/api/routes/`
5. Install error middleware and `/control/live` WebSocket support

Current source layout:

```text
src/
├── main.ts
├── api/          # Routes, controllers, middlewares, validators
├── adapters/     # HTTP, Playwright, Chrome, logging, in-memory adapters
├── config/       # Config loading and validation
├── container/    # Dependency wiring
├── core/         # Entities, ports, services, use cases
├── shared/       # Shared errors, utils, types
└── __tests__/    # Unit, integration, contract, and E2E suites
```

More detail:

- [Docs Index](./docs/README.md)
- [Architecture Overview](./docs/architecture/overview.md)
- [Clean Architecture](./docs/architecture/clean-architecture.md)

## API Surface

Routes registered by the current runtime:

- `GET /`
- `GET /status`
- `GET /control`
- `POST /snapshot`
- `POST /snapshot/delta`
- `POST /act`
- `POST /hooks/file-chooser`
- `POST /hooks/dialog`
- `POST /wait/download`
- `POST /download`
- `POST /screenshot`
- `POST /screenshot/labeled`
- `POST /highlight`
- `WS /control/live`

API reference:

- [Overview](./docs/api-reference/overview.md)
- [Snapshot](./docs/api-reference/snapshot.md)
- [Actions](./docs/api-reference/act.md)
- [Hooks and Downloads](./docs/api-reference/hooks.md)
- [Screenshots](./docs/api-reference/screenshot.md)
- [Control](./docs/api-reference/control.md)

## Configuration

Primary environment variables:

- `PORT` default `4000`
- `BROWSER_PROVIDER` one of `local` or `browserless`
- `BROWSER_CDP_PORT` local provider only, default `9222`
- `BROWSER_ENDPOINT` browserless provider only, must be a full `ws(s)` or `http(s)` endpoint
- `BROWSER_HEADLESS` default `true` in `.env.example`
- `BROWSER_NO_SANDBOX`
- `BROWSER_VIEWPORT` format `WIDTHxHEIGHT`
- `LOG_LEVEL`
- `LOG_FORMAT`
- `LOG_TO_FILE`
- `LOG_FILE_PATH`
- `LOG_MAX_BYTES`
- `LOG_BACKUP_COUNT`

Details: [Configuration](./docs/getting-started/configuration.md)

Provider examples:

```bash
# local browser runtime
BROWSER_PROVIDER=local
BROWSER_CDP_PORT=9222
BROWSER_HEADLESS=true
```

```bash
# remote/browserless runtime
BROWSER_PROVIDER=browserless
BROWSER_ENDPOINT=wss://browser.example.com?token=YOUR_TOKEN
BROWSER_HEADLESS=true
```

Current v1 constraints:

- One provider per process. Mixed local and remote profiles are rejected.
- One active browser connection per process.
- Remote disconnects fail the current request; the client should retry explicitly.
- `/status` reports provider diagnostics with redacted endpoints and does not perform live provider health checks.

## Testing

```bash
npm run check
npm run test
npm run test:unit
npm run test:integration
npm run test:contract
npm run test:e2e
```

Testing docs:

- [Testing Overview](./docs/testing/overview.md)
- [Test Suite README](./src/__tests__/README.md)
- [Test Contributing Guide](./src/__tests__/TEST-CONTRIBUTING.md)

## Planning Docs

The refactor planning documents have been removed. The only retained planning set is:

- [Skyvern Plan](./docs/skyvern-plan/00-overview.md)
