# API Reference Overview

Complete reference for the Tailorec Browser Service HTTP API.

---

## API Conventions

### Base URL

```
http://localhost:4000
```

### Authentication

Currently, the API does not require authentication. For production use, implement authentication at the gateway/proxy level.

### Request Format

All requests use `application/json`:

```bash
curl -X POST http://localhost:4000/endpoint \
  -H "Content-Type: application/json" \
  -d '{ "key": "value" }'
```

### Response Format

All responses are JSON:

**Success:**

```json
{
  "ok": true,
  "targetId": "ABC123.1",
  ...
}
```

**Error:**

```json
{
  "ok": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (invalid parameters) |
| 403 | Forbidden (feature disabled) |
| 401 | Unauthorized (control token required) |
| 408 | Request Timeout |
| 500 | Internal Server Error |

### Common Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `targetId` | string | Browser tab identifier (optional) |
| `timeoutMs` | number | Operation timeout in milliseconds |

---

## API Endpoints

### Snapshot Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| [`/snapshot`](./snapshot.md) | POST | Get page as semantic tree |
| [`/snapshot/delta`](./snapshot.md) | POST | Track DOM changes |

### Action Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| [`/act`](./act.md) | POST | Perform browser action |

**Supported Actions:**

| Action | Description |
|--------|-------------|
| `click` | Click element |
| `type` | Type text |
| `press` | Press key |
| `hover` | Hover over element |
| `select` | Select option |
| `fill` | Fill form fields |
| `navigate` | Navigate to URL |
| `wait` | Wait for condition |
| `evaluate` | Execute JavaScript |
| `discover_dropdown` | Discover dropdown options |
| `close_dropdown` | Close dropdown |
| `detect_blocker` | Detect blocking element |
| `dismiss_blocker` | Dismiss blocker |
| `query_state` | Query element state |

### Hook Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| [`/hooks/file-chooser`](./hooks.md) | POST | Handle file upload |
| [`/hooks/dialog`](./hooks.md) | POST | Handle JS alert/confirm |
| [`/wait/download`](./hooks.md) | POST | Wait for download |
| [`/download`](./hooks.md) | POST | Download via element |

### Screenshot Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| [`/screenshot`](./screenshot.md) | POST | Take screenshot |
| [`/screenshot/labeled`](./screenshot.md) | POST | Labeled screenshot |

### Control Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| [`/status`](./control.md) | GET | Health check |
| [`/control`](./control.md) | GET | Browser control |

---

## Error Handling

### Error Response Format

```json
{
  "ok": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "value"
  }
}
```

### Common Error Codes

| Code | Meaning |
|------|---------|
| `REF_NOT_FOUND` | Element reference not found |
| `TIMEOUT` | Operation timed out |
| `INVALID_PARAMETER` | Invalid request parameter |
| `NAVIGATION_FAILED` | Navigation failed |
| `DIALOG_NOT_FOUND` | No dialog to handle |
| `FILE_NOT_FOUND` | Upload file not found |
| `EVALUATE_DISABLED` | JavaScript evaluation disabled |

### Error Examples

**Element Not Found:**

```json
{
  "ok": false,
  "error": "Element not found: e12",
  "code": "REF_NOT_FOUND",
  "details": {
    "ref": "e12",
    "url": "https://example.com"
  }
}
```

**Timeout:**

```json
{
  "ok": false,
  "error": "Operation timed out after 5000ms",
  "code": "TIMEOUT",
  "details": {
    "timeoutMs": 5000,
    "action": "click"
  }
}
```

---

## Target ID Management

### What is Target ID?

Target ID identifies a browser tab:

```
"targetId": "ABC123.1"
```

### Using Target ID

**Optional:** If not provided, uses current tab:

```bash
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Explicit:** Specify tab:

```bash
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{ "targetId": "ABC123.1" }'
```

### Target ID Lifecycle

1. **Created** on navigation or tab open
2. **Reused** across requests
3. **Invalidated** on tab close
4. **Changed** on navigation (sometimes)

Always use the `targetId` from the response for subsequent requests.

---

## Reference ID Management

### What are Reference IDs?

Reference IDs identify page elements:

```
- button "Login" [ref=e12]
- textbox "Email" [ref=e13]
```

### Reference ID Format

- Prefix: `e`
- Number: `1`, `2`, `3`, ...
- Example: `e1`, `e12`, `e123`

### Reference ID Lifecycle

1. **Created** in snapshot response
2. **Valid** until page changes
3. **Invalidated** on navigation or DOM change
4. **Refreshed** by taking new snapshot

**Important:** Always take a new snapshot after page changes.

---

## Request Examples

### Complete Workflow

```bash
# 1. Navigate
RESPONSE=$(curl -s -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "navigate", "url": "https://example.com"}')

TARGET_ID=$(echo "$RESPONSE" | jq -r '.targetId')

# 2. Take snapshot
SNAPSHOT=$(curl -s -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d "{\"targetId\": \"$TARGET_ID\", \"interactiveOnly\": true}")

# 3. Extract button ref
BUTTON_REF=$(echo "$SNAPSHOT" | jq -r '.refs | to_entries[] | select(.value.role == "button") | .key')

# 4. Click button
curl -s -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d "{\"targetId\": \"$TARGET_ID\", \"kind\": \"click\", \"ref\": \"$BUTTON_REF\"}"
```

---

## Rate Limiting

Currently, there is no built-in rate limiting. For production use:

1. Implement rate limiting at proxy/gateway
2. Queue requests client-side
3. Monitor server resources

Recommended limits:
- 10 requests/second per client
- 100 concurrent tabs max

---

## Best Practices

### 1. Always Handle Errors

```javascript
try {
  const response = await fetch('/act', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'click', ref: 'e12' })
  });
  
  const data = await response.json();
  if (!data.ok) {
    console.error('Action failed:', data.error);
  }
} catch (error) {
  console.error('Request failed:', error);
}
```

### 2. Take Snapshots After Navigation

```bash
# Navigate
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "navigate", "url": "https://example.com"}'

# Wait for load
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "wait", "loadState": "load"}'

# Take snapshot
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 3. Use Timeouts

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "wait",
    "loadState": "networkidle",
    "timeoutMs": 30000
  }'
```

### 4. Close Unused Tabs

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "close"}'
```

### 5. Use Interactive-Only Snapshots

For token efficiency:

```bash
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{"interactiveOnly": true}'
```

---

## Next Steps

- **[Snapshot API](./snapshot.md)** - Detailed snapshot documentation
- **[Act API](./act.md)** - Detailed action documentation
- **[Hooks API](./hooks.md)** - File uploads and dialogs
- **[Screenshot API](./screenshot.md)** - Screenshot options
- **[Control API](./control.md)** - Browser lifecycle

---

**Last Updated:** 2026-03-03
