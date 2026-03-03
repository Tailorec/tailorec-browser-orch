# Act API

The Act API performs browser actions like clicking, typing, navigating, and waiting.

---

## Endpoint

```
POST /act
```

---

## Request

### Headers

```
Content-Type: application/json
```

### Body Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `kind` | string | **Required.** Action type (click, type, navigate, etc.) |
| `targetId` | string | Browser tab identifier (optional) |
| `timeoutMs` | number | Action timeout (optional) |
| ... | varies | Action-specific parameters |

### Example Request

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "click",
    "ref": "e12"
  }'
```

---

## Response

### Success Response

```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "url": "https://example.com"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `ok` | boolean | Success indicator |
| `targetId` | string | Browser tab identifier |
| `url` | string | Current page URL (if changed) |

---

## Action Types

### 1. Click

Click an element.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `kind` | string | `"click"` |
| `ref` | string | **Required.** Element reference |
| `button` | string | Button: `left`, `right`, `middle` (default: `left`) |
| `doubleClick` | boolean | Double click (default: `false`) |
| `modifiers` | array | Modifier keys: `Alt`, `Control`, `Meta`, `Shift` |
| `timeoutMs` | number | Timeout in milliseconds |

**Example:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "click",
    "ref": "e12",
    "button": "left",
    "doubleClick": false
  }'
```

**Right-click:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "click",
    "ref": "e12",
    "button": "right"
  }'
```

**Double-click:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "click",
    "ref": "e12",
    "doubleClick": true
  }'
```

**With modifier:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "click",
    "ref": "e12",
    "modifiers": ["Control"]
  }'
```

---

### 2. Type

Type text into an input field.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `kind` | string | `"type"` |
| `ref` | string | **Required.** Element reference |
| `text` | string | **Required.** Text to type |
| `submit` | boolean | Press Enter after typing (default: `false`) |
| `slowly` | boolean | Type character by character (default: `false`) |
| `timeoutMs` | number | Timeout in milliseconds |

**Example:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "type",
    "ref": "e12",
    "text": "hello@example.com"
  }'
```

**With submit:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "type",
    "ref": "e12",
    "text": "search query",
    "submit": true
  }'
```

**Type slowly (for controlled inputs):**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "type",
    "ref": "e12",
    "text": "555-1234",
    "slowly": true
  }'
```

---

### 3. Press

Press a keyboard key.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `kind` | string | `"press"` |
| `key` | string | **Required.** Key to press |
| `delayMs` | number | Key press delay |

**Example:**

```bash
# Press Enter
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "press",
    "key": "Enter"
  }'

# Press Arrow Down
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "press",
    "key": "ArrowDown"
  }'

# Press Escape
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "press",
    "key": "Escape"
  }'
```

**Common Keys:**

- `Enter`, `Escape`, `Tab`, `Backspace`, `Delete`
- `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`
- `Home`, `End`, `PageUp`, `PageDown`
- `a` through `z`, `0` through `9`

---

### 4. Hover

Hover over an element.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `kind` | string | `"hover"` |
| `ref` | string | **Required.** Element reference |
| `timeoutMs` | number | Timeout in milliseconds |

**Example:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "hover",
    "ref": "e12"
  }'
```

---

### 5. Select

Select option(s) in a `<select>` element.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `kind` | string | `"select"` |
| `ref` | string | **Required.** Element reference |
| `values` | array | **Required.** Values to select |
| `timeoutMs` | number | Timeout in milliseconds |

**Example:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "select",
    "ref": "e12",
    "values": ["option1"]
  }'
```

**Multiple selection:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "select",
    "ref": "e12",
    "values": ["option1", "option3"]
  }'
```

---

### 6. Fill

Fill multiple form fields at once.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `kind` | string | `"fill"` |
| `fields` | array | **Required.** Array of field objects |
| `timeoutMs` | number | Timeout in milliseconds |

**Field Object:**

| Field | Type | Description |
|-------|------|-------------|
| `ref` | string | **Required.** Element reference |
| `type` | string | **Required.** Field type |
| `value` | any | Value to set (optional) |

**Example:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "fill",
    "fields": [
      { "ref": "e1", "type": "email", "value": "test@example.com" },
      { "ref": "e2", "type": "password", "value": "secret123" },
      { "ref": "e3", "type": "checkbox" }
    ]
  }'
```

**Response:**

```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "results": [
    { "ref": "e1", "matched": true, "requestedValue": "test@example.com", "actualValue": "test@example.com" },
    { "ref": "e2", "matched": true, "requestedValue": "secret123", "actualValue": "secret123" },
    { "ref": "e3", "matched": true }
  ],
  "allMatched": true
}
```

---

### 7. Navigate

Navigate to a URL.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `kind` | string | `"navigate"` |
| `url` | string | **Required.** URL to navigate to |
| `timeoutMs` | number | Navigation timeout |

**Example:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "navigate",
    "url": "https://example.com",
    "timeoutMs": 30000
  }'
```

---

### 8. Wait

Wait for a condition.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `kind` | string | `"wait"` |
| `timeMs` | number | Wait fixed time |
| `text` | string | Wait for text to appear |
| `textGone` | string | Wait for text to disappear |
| `selector` | string | Wait for CSS selector |
| `url` | string | Wait for URL change |
| `loadState` | string | Wait for load state |
| `fn` | string | Wait for JS function |
| `timeoutMs` | number | Timeout |

**At least one condition is required.**

**Wait for page load:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "wait",
    "loadState": "load"
  }'
```

**Load state options:**
- `load` - Wait for load event
- `domcontentloaded` - Wait for DOMContentLoaded
- `networkidle` - Wait for network idle (no connections for 500ms)

**Wait for text:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "wait",
    "text": "Welcome",
    "timeoutMs": 5000
  }'
```

**Wait for text to disappear:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "wait",
    "textGone": "Loading...",
    "timeoutMs": 10000
  }'
```

**Wait for URL:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "wait",
    "url": "https://example.com/dashboard",
    "timeoutMs": 10000
  }'
```

**Wait fixed time:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "wait",
    "timeMs": 2000
  }'
```

---

### 9. Evaluate

Execute JavaScript (requires `BROWSER_EVALUATE_ENABLED=true`).

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `kind` | string | `"evaluate"` |
| `fn` | string | **Required.** JavaScript function |
| `ref` | string | Element reference (passed to function) |

**Example:**

```bash
# Get page title
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "evaluate",
    "fn": "() => document.title"
  }'
```

**With element:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "evaluate",
    "fn": "(el) => el.value",
    "ref": "e12"
  }'
```

**Response:**

```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "url": "https://example.com",
  "result": "Page Title"
}
```

---

### 10. Scroll Into View

Scroll element into viewport.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `kind` | string | `"scrollIntoView"` |
| `ref` | string | **Required.** Element reference |
| `timeoutMs` | number | Timeout |

**Example:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "scrollIntoView",
    "ref": "e12"
  }'
```

---

### 11. Drag

Drag element to another.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `kind` | string | `"drag"` |
| `startRef` | string | **Required.** Source element |
| `endRef` | string | **Required.** Target element |
| `timeoutMs` | number | Timeout |

**Example:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "drag",
    "startRef": "e1",
    "endRef": "e2"
  }'
```

---

### 12. Resize

Resize browser viewport.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `kind` | string | `"resize"` |
| `width` | number | **Required.** Width in pixels |
| `height` | number | **Required.** Height in pixels |

**Example:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "resize",
    "width": 1920,
    "height": 1080
  }'
```

---

### 13. Close

Close current tab.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `kind` | string | `"close"` |

**Example:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "close"
  }'
```

---

### 14. Discover Dropdown

Discover dynamic dropdown options.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `kind` | string | `"discover_dropdown"` |
| `ref` | string | **Required.** Dropdown element |
| `searchText` | string | Filter options by text |
| `timeoutMs` | number | Timeout |

**Example:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "discover_dropdown",
    "ref": "e12"
  }'
```

**Response:**

```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "snapshot": "- option \"United States\" [ref=d1]\n- option \"Canada\" [ref=d2]",
  "refs": {
    "d1": { "role": "option", "name": "United States" },
    "d2": { "role": "option", "name": "Canada" }
  },
  "incremental": true
}
```

---

### 15. Close Dropdown

Close custom dropdown.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `kind` | string | `"close_dropdown"` |
| `ref` | string | **Required.** Dropdown element |

**Example:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "close_dropdown",
    "ref": "e12"
  }'
```

---

### 16. Detect Blocker

Detect blocking elements (modals, overlays).

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `kind` | string | `"detect_blocker"` |
| `ref` | string | **Required.** Target element |

**Example:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "detect_blocker",
    "ref": "e12"
  }'
```

**Response:**

```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "isBlocked": true,
  "blocker": {
    "type": "modal",
    "selector": ".cookie-banner"
  },
  "suggestedStrategy": "click_close"
}
```

---

### 17. Dismiss Blocker

Dismiss blocking element.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `kind` | string | `"dismiss_blocker"` |
| `targetRef` | string | **Required.** Blocked element |
| `strategy` | string | Dismissal strategy |
| `closeButtonRef` | string | Close button reference |

**Strategies:**
- `click_close` - Click close button
- `press_escape` - Press Escape key
- `click_outside` - Click outside modal

**Example:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "dismiss_blocker",
    "targetRef": "e12",
    "strategy": "click_close"
  }'
```

---

### 18. Query State

Query element state.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `kind` | string | `"query_state"` |
| `ref` | string | Element reference |
| `refs` | array | Multiple element references |

**Example (single):**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "query_state",
    "ref": "e12"
  }'
```

**Response:**

```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "state": {
    "visible": true,
    "enabled": true,
    "editable": true,
    "checked": false,
    "focused": false,
    "obscured": false
  }
}
```

**Example (multiple):**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "query_state",
    "refs": ["e1", "e2", "e3"]
  }'
```

---

## Error Responses

### Element Not Found

```json
{
  "ok": false,
  "error": "Element not found: e12",
  "code": "REF_NOT_FOUND"
}
```

### Timeout

```json
{
  "ok": false,
  "error": "Action timed out after 5000ms",
  "code": "TIMEOUT"
}
```

### Evaluate Disabled

```json
{
  "ok": false,
  "error": "act:evaluate is disabled by config",
  "code": "EVALUATE_DISABLED"
}
```

### Invalid Parameters

```json
{
  "ok": false,
  "error": "ref is required",
  "code": "INVALID_PARAMETER"
}
```

---

## Best Practices

### 1. Wait After Navigation

```bash
# Navigate
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "navigate", "url": "https://example.com"}'

# Wait for load
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "wait", "loadState": "load"}'

# Then take snapshot
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 2. Use Submit for Forms

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "type",
    "ref": "e12",
    "text": "search query",
    "submit": true
  }'
```

### 3. Handle Dynamic Dropdowns

```bash
# Click dropdown to open
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e1"}'

# Wait for options
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "wait", "timeMs": 500}'

# Discover options
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "discover_dropdown", "ref": "e1"}'

# Click option
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "d1"}'

# Close dropdown
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "close_dropdown", "ref": "e1"}'
```

### 4. Handle Blocking Elements

```bash
# Check for blocker
RESPONSE=$(curl -s -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "detect_blocker", "ref": "e1"}')

IS_BLOCKED=$(echo "$RESPONSE" | jq -r '.isBlocked')

if [ "$IS_BLOCKED" = "true" ]; then
  # Dismiss blocker
  curl -X POST http://localhost:4000/act \
    -H "Content-Type: application/json" \
    -d '{"kind": "dismiss_blocker", "targetRef": "e1", "strategy": "click_close"}'
fi

# Now interact with element
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e1"}'
```

---

## Troubleshooting

### Element Not Found

**Problem:** `REF_NOT_FOUND` error

**Solutions:**
1. Take new snapshot to refresh refs
2. Check element still exists on page
3. Verify correct targetId

### Timeout

**Problem:** Action times out

**Solutions:**
1. Increase timeout: `"timeoutMs": 10000`
2. Check element is visible
3. Check for blocking elements

### Type Not Working

**Problem:** Text doesn't appear in field

**Solutions:**
1. Use `slowly: true` for controlled inputs
2. Clear field first
3. Try keyboard fallback

---

**Last Updated:** 2026-03-03
