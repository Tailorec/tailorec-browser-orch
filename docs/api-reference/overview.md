# API Overview

Base URL:

```text
http://127.0.0.1:4000
```

## Request Conventions

- JSON endpoints use `Content-Type: application/json`
- `targetId` is optional on most browser operations
- `timeoutMs` is supported where the underlying action can block
- the standard workflow is `navigate -> snapshot -> act -> snapshot`

Example:

```bash
curl -X POST http://127.0.0.1:4000/endpoint \
  -H 'Content-Type: application/json' \
  -d '{"key":"value"}'
```

## Response Conventions

### Success

```json
{
  "ok": true,
  "targetId": "ABC123.1"
}
```

### Errors

Handled controller errors typically use the flat response contract:

```json
{
  "ok": false,
  "error": "human-readable message"
}
```

Uncaught failures may be normalized by global middleware. Client integrations should rely on HTTP status and `ok` first.

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Validation or request error |
| `401` | Missing or invalid control token |
| `403` | Feature disabled by config |
| `500` | Internal server failure |

## Public Endpoint Surface

### Basic

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/` | plain-text health check |
| `GET` | `/status` | runtime status |

### Snapshot

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/snapshot` | semantic page snapshot |
| `POST` | `/snapshot/delta` | DOM observation start/stop |

### Actions

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/act` | execute browser action by `kind` |

Supported action kinds:

- `navigate`
- `click`
- `type`
- `press`
- `hover`
- `scrollIntoView`
- `drag`
- `select`
- `fill`
- `resize`
- `wait`
- `evaluate`
- `close`
- `query_state`
- `discover_dropdown`
- `close_dropdown`
- `detect_blocker`
- `dismiss_blocker`

### Hooks and Downloads

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/hooks/file-chooser` | stage and arm uploads |
| `POST` | `/hooks/dialog` | arm alert/confirm/prompt handling |
| `POST` | `/wait/download` | wait for a download |
| `POST` | `/download` | click and capture a download |

### Media

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/screenshot` | page or element screenshot |
| `POST` | `/screenshot/labeled` | viewport screenshot with ref overlays |
| `POST` | `/highlight` | highlight a ref-backed element |

### Control

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/control` | validate control token and return websocket URL |
| `WS` | `/control/live` | interactive browser control channel |

## Target IDs

`targetId` identifies the active browser tab.

Example:

```json
{
  "targetId": "ABC123.1"
}
```

Operational rules:

1. responses may return a `targetId` even if the request did not specify one
2. clients should reuse the latest returned `targetId`
3. after navigation or close, the active tab state may change

## Reference IDs

Snapshot responses provide stable refs like `e12`:

```text
- button "Login" [ref=e12]
- textbox "Email" [ref=e13]
```

Operational rules:

1. refs come from `/snapshot`
2. refs can become stale after DOM changes or navigation
3. clients should take a fresh snapshot after meaningful page updates
