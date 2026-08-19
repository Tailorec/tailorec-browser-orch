# Action API

## `POST /act`

Executes browser actions through a single compatibility endpoint keyed by `kind`.

Create the run first with `POST /runs/:runId/session`. Every request to this endpoint requires the same `run_id`.

### Common Request Fields

| Parameter | Type | Description |
|-----------|------|-------------|
| `run_id` | string | required run-session owner |
| `kind` | string | required action kind |
| `targetId` | string | optional browser tab |
| `timeoutMs` | number | optional action timeout |

### Common Success Response

```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "url": "https://example.com"
}
```

## Supported Kinds

### `click`

| Parameter | Type | Description |
|-----------|------|-------------|
| `ref` | string | required element ref |
| `button` | string | `left`, `right`, `middle` |
| `doubleClick` | boolean | double-click when `true` |
| `modifiers` | array | `Alt`, `Control`, `ControlOrMeta`, `Meta`, `Shift` |
| `timeoutMs` | number | optional timeout |

Example:

```json
{ "run_id": "run-123", "kind": "click", "ref": "e12", "button": "left", "doubleClick": false }
```

### `type`

| Parameter | Type | Description |
|-----------|------|-------------|
| `ref` | string | required element ref |
| `text` | string | required text |
| `submit` | boolean | press Enter after typing |
| `slowly` | boolean | type gradually |
| `timeoutMs` | number | optional timeout |

### `press`

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | required key |
| `delayMs` | number | optional key press delay |

Common keys include `Enter`, `Escape`, `Tab`, arrow keys, and alphanumerics.

### `hover`

- requires `ref`

### `scrollIntoView`

- requires `ref`

### `drag`

| Parameter | Type | Description |
|-----------|------|-------------|
| `startRef` | string | required drag source |
| `endRef` | string | required drop target |
| `timeoutMs` | number | optional timeout |

### `select`

| Parameter | Type | Description |
|-----------|------|-------------|
| `ref` | string | required select ref |
| `values` | array | required selected values |
| `timeoutMs` | number | optional timeout |

### `fill`

| Parameter | Type | Description |
|-----------|------|-------------|
| `fields` | array | required non-empty field list |
| `timeoutMs` | number | optional timeout |

Each field is expected to include at least a `ref` and `type`.

### `resize`

- requires `width`
- requires `height`

### `wait`

At least one of these must be provided:

- `timeMs`
- `text`
- `textGone`
- `selector`
- `url`
- `loadState`
- `fn`

Supported `loadState` values:

- `load`
- `domcontentloaded`
- `networkidle`

If `fn` is used, `browser.evaluateEnabled` must be enabled.

### `evaluate`

- requires `fn`
- may optionally operate against a `ref`
- depends on `browser.evaluateEnabled`

### `navigate`

- requires `url`
- supports `createNewTab`
- supports `idempotencyKey` or `idempotency_key` for retry-safe tab creation

### `close`

- closes the active tab context

### `query_state`

- requires `ref` or non-empty `refs`

### Dropdown And Blocker Actions

- `discover_dropdown`: requires `ref`, optional `searchText`
- `close_dropdown`: requires `ref`
- `detect_blocker`: requires `ref`
- `dismiss_blocker`: requires `targetRef`

## Validation Rules

### `selector` Rejection

For non-`wait` actions, sending `selector` returns a validation error and the API instructs callers to use snapshot refs instead.

### Common Validation Errors

```json
{ "ok": false, "error": "kind is required" }
```

Other common errors:

- `run_id is required` with code `missing_run_id`
- `run session is not initialized. Call CreateRunSession first.`
- `ref is required`
- `text is required`
- `key is required`
- `width and height are required`
- `ref and values are required`
- `startRef and endRef are required`
- `button must be left|right|middle`
- `modifiers must be Alt|Control|ControlOrMeta|Meta|Shift`
- `wait requires at least one of: timeMs, text, textGone, selector, url, loadState, fn`

Ownership conflicts return `409`; provider capacity returns `429`; degraded remote sessions return `503`. See [Run sessions](./run-sessions.md).
