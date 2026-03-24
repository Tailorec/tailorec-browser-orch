# Control API

## `GET /`

Plain-text health check.

### Response

```text
Tailorec Browser Service OK
```

## `GET /status`

Returns runtime health and the currently active runtime profiles.

### Response

```json
{
  "ok": true,
  "profiles": ["default"]
}
```

Notes:

- `profiles` reflects live runtime state, not just static configuration
- use this endpoint as the basic readiness check

## `GET /control`

Validates a control token and returns the websocket URL for interactive control.

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | string | required control token |
| `targetId` | string | optional tab target |

### Success Response

```json
{
  "ok": true,
  "mode": "interactive",
  "ws_url": "ws://127.0.0.1:4000/control/live?token=abc123&targetId=ABC123.1",
  "run_id": "run-123",
  "note": "Use ws_url for browser interaction. Legacy frame/action/status control endpoints are removed."
}
```

### Error Responses

Missing token:

```json
{
  "ok": false,
  "error": "missing_control_token"
}
```

Invalid token:

```json
{
  "ok": false,
  "error": "invalid_control_token"
}
```

Actual invalid-token text may also come directly from token verification.

## `WS /control/live`

Interactive websocket channel used after a successful `/control` exchange.

Typical flow:

1. caller obtains a valid control token
2. caller requests `/control?token=...`
3. service returns `ws_url`
4. caller connects to `/control/live`

The websocket server is installed at runtime by `installControlLiveWebSocketServer(...)` in `src/main.ts`.
