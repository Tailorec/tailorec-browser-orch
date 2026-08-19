# API reference

Default base URL: `http://127.0.0.1:4000`.

## Lifecycle contract

Every browser workflow follows this order:

```text
create run session -> navigate -> snapshot -> act -> snapshot -> close run session
```

Browser-operation JSON bodies require `run_id`. `targetId` is optional when the run already has an active tab; callers should still retain and reuse the latest returned target ID. A `targetId` owned by another run returns `409`.

## Endpoints

| Method | Path | Purpose | Detail |
|---|---|---|---|
| `GET` | `/` | Plain-text liveness | — |
| `GET` | `/status` | Provider, profile, and allocator diagnostics | This page |
| `POST` | `/runs/:runId/session` | Create or reuse a run session | [Run sessions](./run-sessions.md) |
| `DELETE` | `/runs/:runId/session` | Close a run session | [Run sessions](./run-sessions.md) |
| `POST` | `/snapshot` | Semantic snapshot and refs | [Snapshots](./snapshot.md) |
| `POST` | `/snapshot/delta` | Start or stop DOM-delta observation | [Snapshots](./snapshot.md) |
| `POST` | `/act` | Execute an action selected by `kind` | [Actions](./act.md) |
| `POST` | `/hooks/file-chooser` | Stage and attach upload files | [Hooks](./hooks.md) |
| `POST` | `/hooks/dialog` | Arm dialog handling | [Hooks](./hooks.md) |
| `POST` | `/wait/download` | Wait for a browser download | [Hooks](./hooks.md) |
| `POST` | `/download` | Click a ref and capture its download | [Hooks](./hooks.md) |
| `POST` | `/screenshot` | Page or element screenshot | [Media](./screenshot.md) |
| `POST` | `/screenshot/labeled` | Screenshot with ref overlays | [Media](./screenshot.md) |
| `POST` | `/highlight` | Highlight a ref-backed element | [Media](./screenshot.md) |
| `GET` | `/control` | Validate a control JWT and return WebSocket URL | [Control](./control.md) |
| `WS` | `/control/live` | Stream frames and accept human input | [Control](./control.md) |

## Request conventions

- Send JSON with `Content-Type: application/json`.
- Use `profile=default` unless another configured profile exists.
- Include `run_id` in every browser-operation body.
- Use refs from the latest snapshot instead of arbitrary selectors. `selector` is accepted only by the `wait` action.
- Use `timeoutMs` only on endpoints that document it.
- The JSON parser limit is 50 MiB; production gateways should enforce a smaller policy appropriate to the deployment.

## Responses

Successful JSON responses include `ok: true`. Browser operations normally include `targetId` and may include the current URL.

```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "url": "https://example.com"
}
```

Errors use a flat contract:

```json
{
  "ok": false,
  "error": "run_id is required",
  "code": "missing_run_id"
}
```

Capacity and degraded-session responses can also include `active`, `max`, `retry_after_seconds`, and a `Retry-After` header.

## Status codes

| Code | Meaning |
|---:|---|
| `200` | Successful operation or idempotent close |
| `201` | Run session accepted/created |
| `400` | Invalid input or missing run ID |
| `401` | Missing or invalid control token |
| `403` | Code evaluation disabled |
| `404` | Profile or target not found |
| `409` | Run/target ownership conflict, uninitialized session, or unsupported tab flow |
| `429` | Session capacity exhausted |
| `500` | Unhandled internal error |
| `503` | Browser runtime unavailable or session degraded |

## `GET /status`

Returns the configured provider, active profiles, redacted endpoints, and allocator state. Worker entries expose task ID, assigned run IDs, ownership tags, capacity, idle state, and unavailability details. Endpoint credentials and query parameter values are redacted.

`/status` reports service-owned state; it does not perform a live external health check for every configured provider.

## Correlation IDs

Send the configured correlation header, `x-correlation-id` by default, to join caller and service logs. The service creates one when absent and includes it in the response.

## Ref freshness

Snapshot refs such as `e12` are stable for the captured page state, not forever. Navigation, rerendering, and dynamic UI changes can invalidate them. After a mutation, take a fresh snapshot before choosing the next action.
