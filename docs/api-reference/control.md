# Control API

The Control API provides service health checks and browser lifecycle management.

---

## Status Endpoint

Check service health and status.

### Endpoint

```
GET /status
```

### Request

No parameters required.

### Example

```bash
curl http://localhost:4000/status
```

### Response

```json
{
  "ok": true,
  "profiles": ["default", "profile-2"]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `ok` | boolean | Health status |
| `profiles` | array | List of configured browser profiles |

### Health Check in CI/CD

```bash
#!/bin/bash

# Wait for service to be ready
for i in {1..30}; do
  RESPONSE=$(curl -s http://localhost:4000/status)
  OK=$(echo "$RESPONSE" | jq -r '.ok')
  
  if [ "$OK" = "true" ]; then
    echo "Service is healthy"
    exit 0
  fi
  
  sleep 1
done

echo "Service failed to start"
exit 1
```

---

## Control Endpoint

Get browser control URL for interactive mode.

### Endpoint

```
GET /control?token=<control-token>&targetId=<target-id>
```

### Request

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | string | **Required.** Control authentication token |
| `targetId` | string | Specific tab to control (optional) |

### Example

```bash
curl "http://localhost:4000/control?token=abc123&targetId=ABC123.1"
```

### Response

```json
{
  "ok": true,
  "mode": "interactive",
  "ws_url": "ws://127.0.0.1:4000/control/live?token=abc123&targetId=ABC123.1",
  "run_id": "run-123",
  "note": "Use ws_url for browser interaction. Legacy frame/action/status control endpoints are removed."
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `ok` | boolean | Success indicator |
| `mode` | string | Control mode (`interactive`) |
| `ws_url` | string | WebSocket URL for live control |
| `run_id` | string | Run identifier |
| `note` | string | Usage instructions |

### WebSocket Control

The `ws_url` provides real-time browser control via WebSocket:

```javascript
const ws = new WebSocket('ws://127.0.0.1:4000/control/live?token=abc123');

ws.onopen = () => {
  console.log('Connected to browser control');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Browser event:', data);
};

ws.send(JSON.stringify({
  type: 'navigate',
  url: 'https://example.com'
}));
```

---

## Root Endpoint

Simple health check.

### Endpoint

```
GET /
```

### Example

```bash
curl http://localhost:4000/
```

### Response

```
Tailorec Browser Service OK
```

---

## Token Generation

Control tokens are generated and validated by the service.

### Token Claims

| Claim | Description |
|-------|-------------|
| `run_id` | Run identifier |
| `profile` | Browser profile name |
| `exp` | Expiration timestamp |

### Token Validation

Tokens are validated on each `/control` request:

```bash
# Valid token
curl "http://localhost:4000/control?token=valid-token"
# Returns: { "ok": true, "ws_url": "..." }

# Invalid token
curl "http://localhost:4000/control?token=invalid-token"
# Returns: { "ok": false, "error": "invalid_control_token" }

# Missing token
curl "http://localhost:4000/control"
# Returns: { "ok": false, "error": "missing_control_token" }
```

---

## Browser Lifecycle

### Start Browser

Browser is started automatically when the service starts or on first request.

### Stop Browser

Browser tabs are closed via the Act API:

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "close"}'
```

### Restart Browser

Restart by restarting the service:

```bash
# Stop service
# (Ctrl+C in terminal)

# Start service
npm start
```

---

## Monitoring

### Health Check Interval

Recommended: Check every 30 seconds

```bash
while true; do
  curl -s http://localhost:4000/status | jq '.ok'
  sleep 30
done
```

### Alert on Failure

```bash
#!/bin/bash

RESPONSE=$(curl -s http://localhost:4000/status)
OK=$(echo "$RESPONSE" | jq -r '.ok')

if [ "$OK" != "true" ]; then
  echo "Browser service is unhealthy!"
  # Send alert (email, Slack, PagerDuty, etc.)
  # send_alert "Browser service unhealthy"
  exit 1
fi

echo "Service healthy"
exit 0
```

---

## Best Practices

### 1. Check Health Before Automation

```bash
# Check service is running
STATUS=$(curl -s http://localhost:4000/status)
OK=$(echo "$STATUS" | jq -r '.ok')

if [ "$OK" != "true" ]; then
  echo "Service not ready"
  exit 1
fi

# Proceed with automation
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "navigate", "url": "https://example.com"}'
```

### 2. Use Control Token for Security

Generate token server-side and pass to client:

```javascript
// Server-side
const token = generateControlToken({ run_id: 'run-123' });

// Client-side
const response = await fetch(`/control?token=${token}`);
const { ws_url } = await response.json();

// Connect to WebSocket
const ws = new WebSocket(ws_url);
```

### 3. Monitor Resource Usage

```bash
# Check service response time
time curl -s http://localhost:4000/status > /dev/null

# Check memory usage (Linux)
ps aux | grep node | grep openclaw

# Check open browser tabs
curl -s http://localhost:4000/status | jq '.profiles | length'
```

---

## Troubleshooting

### Service Not Responding

**Problem:** `/status` endpoint doesn't respond

**Solutions:**
1. Check service is running:
   ```bash
   ps aux | grep node
   ```

2. Check port is listening:
   ```bash
   netstat -tlnp | grep 4000
   ```

3. Check logs:
   ```bash
   tail -f logs/app.log
   ```

### Invalid Token

**Problem:** `invalid_control_token` error

**Solutions:**
1. Regenerate token
2. Check token hasn't expired
3. Verify token generation logic

### WebSocket Connection Fails

**Problem:** Can't connect to `ws_url`

**Solutions:**
1. Check WebSocket port is open
2. Verify token is valid
3. Check firewall rules

---

**Last Updated:** 2026-03-03
