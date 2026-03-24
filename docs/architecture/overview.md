# Architecture Overview

Tailorec Browser Service is a browser automation service optimized for semantic, ref-based interaction rather than raw DOM scraping. The service exposes a small HTTP and WebSocket surface over a Playwright-backed browser runtime.

## System Model

```text
Client / LLM
  -> HTTP JSON API on port 4000
  -> Tailorec Browser Service
     -> Express transport layer
     -> Controllers and middleware
     -> Core use cases and services
     -> Playwright and Chrome adapters
     -> Chromium over CDP
```

## Runtime Composition

`src/main.ts` is the runtime entrypoint.

Startup flow:

1. load env-backed config from `src/config/config.ts`
2. initialize logging
3. create the dependency container
4. create the browser route context
5. instantiate controllers
6. register route modules
7. start the HTTP server
8. install `/control/live`

## Source Layout

```text
src/
├── main.ts
├── api/
├── adapters/
├── config/
├── container/
├── core/
├── shared/
└── __tests__/
```

## Main Responsibilities

### Transport layer

Implemented by `src/api/` and `src/adapters/http/`.

Responsibilities:

- parse HTTP requests
- attach correlation and logging middleware
- route requests to controllers
- normalize handled errors
- install interactive control websocket support

### Core browser behavior

Implemented by `src/core/`.

Responsibilities:

- session management
- browser interactions
- discovery and DOM observation
- navigation behavior
- snapshot orchestration
- use-case execution

### Browser integration

Implemented primarily by `src/adapters/playwright/` and `src/adapters/chrome/`.

Responsibilities:

- connect to browser targets
- manage tabs and pages
- capture snapshots and screenshots
- perform actions and downloads
- launch and manage Chrome-backed profiles

## Public API Surface

Current public endpoints:

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

## Snapshot And Ref Workflow

The service is designed around a semantic workflow:

1. navigate to a page
2. request `/snapshot`
3. read semantic structure and `refs`
4. act using `ref` values rather than selectors
5. refresh the snapshot after page changes

That design reduces selector brittleness and makes the service easier for LLM-driven agents to use.

## Profiles And Runtime State

Profiles are resolved from configuration at startup, but the live runtime state separately tracks which profiles are active.

This matters for `/status`: the response reflects runtime-tracked profiles, not just declared config keys.
