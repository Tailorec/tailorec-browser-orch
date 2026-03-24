# Snapshot API

## `POST /snapshot`

Returns the current page as a semantic accessibility tree plus a ref metadata map.

### Request Body

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `targetId` | string | current tab | optional browser tab |
| `timeoutMs` | number | runtime default | snapshot timeout |
| `maxChars` | number | unlimited | maximum snapshot length |
| `interactiveOnly` | boolean | `false` | include only actionable elements |
| `compact` | boolean | `false` | remove structural noise where possible |
| `maxDepth` | number | runtime default | semantic tree depth cap |

### Example

```bash
curl -X POST http://127.0.0.1:4000/snapshot \
  -H 'Content-Type: application/json' \
  -d '{
    "interactiveOnly": true,
    "compact": true,
    "maxChars": 5000
  }'
```

### Success Response

```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "url": "https://example.com",
  "snapshot": "- heading \"Welcome\" [ref=e1]\n- button \"Login\" [ref=e2]",
  "refs": {
    "e1": { "role": "heading", "name": "Welcome" },
    "e2": { "role": "button", "name": "Login" }
  },
  "truncated": false,
  "stats": {}
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `ok` | boolean | success indicator |
| `targetId` | string | resolved browser tab |
| `url` | string | current page URL |
| `snapshot` | string | semantic text tree |
| `refs` | object | ref metadata map |
| `truncated` | boolean | set when `maxChars` truncates output |
| `stats` | object | optional snapshot statistics |

### `refs` Structure

```json
{
  "e1": {
    "role": "button",
    "name": "Submit",
    "nth": 0
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `role` | string | semantic role |
| `name` | string | accessible name when available |
| `nth` | number | optional duplicate index |

## Snapshot Text Format

Example:

```text
- heading "Welcome to Example" [ref=e1]
  - link "Home" [ref=e2]
  - textbox "Search" [ref=e3]
  - button "Search" [ref=e4]
```

Rules:

- indentation expresses hierarchy
- each item starts with `-`
- role comes first
- accessible name appears in quotes
- ref appears as `[ref=eN]`

## Options Explained

### `interactiveOnly`

Reduces the tree to interactive elements such as buttons, links, text inputs, and other actionable controls.

Benefits:

- smaller payloads
- less token usage
- easier LLM action selection

### `compact`

Removes structural containers where possible so the tree is easier to read and smaller to transmit.

### `maxChars`

Truncates the returned snapshot string if the page is too large.

When truncation happens, `truncated` is set and the snapshot text is shortened.

### `maxDepth`

Caps the nesting depth of the semantic tree.

## `POST /snapshot/delta`

Starts or stops DOM observation for incremental change tracking.

### Request Body

| Parameter | Type | Description |
|-----------|------|-------------|
| `targetId` | string | optional browser tab |
| `action` | string | required: `start` or `stop` |
| `anchorRef` | string | optional observer anchor ref |

### Example Start

```bash
curl -X POST http://127.0.0.1:4000/snapshot/delta \
  -H 'Content-Type: application/json' \
  -d '{"action":"start","anchorRef":"e12"}'
```

### Example Stop

```bash
curl -X POST http://127.0.0.1:4000/snapshot/delta \
  -H 'Content-Type: application/json' \
  -d '{"action":"stop"}'
```

### Validation Error

```json
{
  "ok": false,
  "error": "action must be 'start' or 'stop'"
}
```
