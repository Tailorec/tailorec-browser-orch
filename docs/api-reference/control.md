# Control API

## `GET /`

Plain-text health check.

### Response

```text
Tailorec Browser Service OK
```

## `GET /status`

Returns provider, active-profile, configured-profile, and Browserless allocator diagnostics.

### Response

```json
{
  "ok": true,
  "provider": "local",
  "profiles": ["default"],
  "configured_profiles": [
    { "name": "default", "provider": "local", "browser_endpoint": "http://127.0.0.1:9222" }
  ],
  "browserless_allocator": {
    "total_assigned_runs": 0,
    "max_total_sessions": 20,
    "max_sessions_per_worker": 5,
    "workers": []
  }
}
```

Notes:

- `profiles` reflects live runtime state, not just static configuration
- endpoint credentials and query values are redacted
- this is service-owned diagnostic state, not a live external-provider probe

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

1. caller creates a run session and navigates to a tab
2. trusted backend issues a valid control token for that run
3. caller requests `/control?token=...`
4. service returns `ws_url`
5. caller connects to `/control/live`

The websocket server is installed at runtime by `installControlLiveWebSocketServer(...)` in `src/main.ts`.
