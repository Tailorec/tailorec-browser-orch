# Configuration reference

The service loads `.env` through `dotenv/config` during startup. Invalid provider combinations fail startup; malformed booleans and viewports fall back to their code defaults.

## Server and browser

| Variable | Default | Description |
|---|---:|---|
| `PORT` | `4000` | Express listen port, from `1` to `65535` |
| `NODE_ENV` | `development` | `development`, `production`, or `test` |
| `BROWSER_PROVIDER` | `local` | Exactly `local` or `browserless` |
| `BROWSER_ENDPOINT` | none | Required for `browserless`; full `http(s)` or `ws(s)` URL |
| `BROWSER_CDP_PORT` | `9222` | Local profile CDP port used as the base configuration |
| `BROWSER_HEADLESS` | `false` in code | Launch local Chromium headlessly; `.env.example` sets `true` |
| `HEADLESS` | none | Legacy fallback for `BROWSER_HEADLESS` |
| `BROWSER_NO_SANDBOX` | `false` | Adds Chrome no-sandbox flags; use only where the host requires it |
| `NO_SANDBOX` | none | Legacy fallback for `BROWSER_NO_SANDBOX` |
| `BROWSER_VIEWPORT` | `1280x720` | `WIDTHxHEIGHT`; validated between `100x100` and `7680x4320` |
| `CHROME_EXECUTABLE_PATH` | auto-discovered | Explicit Chrome/Chromium executable for the local provider |
| `PLAYWRIGHT_BROWSERS_PATH` | Playwright default | Playwright browser cache root |

The server binds `0.0.0.0`. Restrict exposure at the container, host firewall, service mesh, or gateway.

## Session ownership and capacity

| Variable | Default | Description |
|---|---:|---|
| `BROWSER_MAX_SESSIONS` | `200` | Process-wide active runtime cap |
| `BROWSER_LOCAL_MAX_SESSIONS` | `5` | Local-provider active runtime cap |
| `BROWSER_CREATE_IDEMPOTENCY_TTL_MS` | `600000` | Cache lifetime for idempotent create-tab results |
| `BROWSER_ADMISSION_RETRY_AFTER_SECONDS` | `5` | Value returned in `Retry-After` on admission failure |
| `BROWSER_SESSION_IDLE_TIMEOUT_MS` | `1200000` | Idle session expiry; `0` disables it |
| `BROWSER_SESSION_MAX_LIFETIME_MS` | `14400000` | Absolute session lifetime; `0` disables it |
| `BROWSER_SESSION_CLEANUP_SWEEP_MS` | `30000` | Expiry sweep interval; `0` disables periodic sweeps |
| `BROWSER_SESSION_DEGRADED_CLOSE_GRACE_MS` | `60000` | Delay before a degraded session is closed; `0` disables this expiry path |

All positive-capacity values that parse as zero or negative fall back to defaults. Timeout values documented as disableable accept `0`.

## Browserless and ECS allocation

| Variable | Default | Description |
|---|---:|---|
| `BROWSER_BROWSERLESS_SESSIONS_PER_WORKER` | `5` | Run assignments allowed per worker |
| `BROWSER_BROWSERLESS_MAX_TOTAL_SESSIONS` | `20` | Total Browserless run assignments |
| `BROWSER_BROWSERLESS_READY_TIMEOUT_MS` | `60000` | ECS-running and browser-readiness deadline |
| `BROWSER_BROWSERLESS_READY_POLL_INTERVAL_MS` | `1000` | Readiness polling interval |
| `BROWSER_BROWSERLESS_IDLE_GRACE_MS` | `30000` | Delay before an empty owned worker is stopped |
| `BROWSER_BROWSERLESS_ECS_CLUSTER` | none | ECS cluster name or ARN |
| `BROWSER_BROWSERLESS_ECS_TASK_DEFINITION` | none | Task definition name, revision, or ARN |
| `BROWSER_BROWSERLESS_ECS_SUBNETS` | none | JSON string array of subnet IDs |
| `BROWSER_BROWSERLESS_ECS_SECURITY_GROUPS` | none | JSON string array of security-group IDs |
| `BROWSER_BROWSERLESS_ECS_ASSIGN_PUBLIC_IP` | `DISABLED` | `ENABLED` or `DISABLED` |
| `BROWSER_BROWSERLESS_PORT` | `3000` | Browserless container port |
| `BROWSER_BROWSERLESS_TOKEN` | none | Optional token appended to allocated worker endpoints |
| `AWS_REGION` | SDK resolution | Optional AWS SDK region override |

The ECS allocator activates only when cluster, task definition, subnets, and security groups are all present. Otherwise the service uses the in-memory allocator.

## Uploads and control

| Variable | Default | Description |
|---|---:|---|
| `BROWSER_UPLOAD_DOWNLOAD_TIMEOUT_MS` | `45000` | Remote upload download timeout, clamped to 2–120 seconds |
| `BROWSER_UPLOAD_MAX_BYTES` | `15728640` | Staged file limit, clamped to 256 KiB–50 MiB |
| `BROWSER_KEEP_STAGED_UPLOADS` | `false` | Preserve temporary upload files after use |
| `CONTROL_FRAME_INTERVAL_MS` | `350` | Control screenshot interval; minimum effective value is 200 ms |
| `AGENT_RUNTIME_JWT_SECRET` | none | HMAC secret for human-control JWTs |
| `JWT_SECRET_KEY` | none | Legacy fallback secret |
| `AGENT_RUNTIME_JWT_ISSUER` | `tailorec-backend` | Expected/issued `iss` claim |
| `AGENT_RUNTIME_JWT_AUDIENCE` | `tailorec-agent-runtime` | Expected/issued `aud` claim |

Use a high-entropy secret from your secret manager. Do not put production credentials in `.env` or source control.

## Logging

| Variable | Default | Description |
|---|---:|---|
| `CORRELATION_ID_HEADER` | `x-correlation-id` | Inbound/outbound correlation header |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error` |
| `LOG_FORMAT` | `json` | `json` or `console` |
| `LOG_TO_FILE` | `true` | Enable rotating file logs |
| `LOG_FILE_PATH` | `logs/app.log` | Log destination |
| `LOG_MAX_BYTES` | `10485760` | Rotation threshold; minimum 1024 |
| `LOG_BACKUP_COUNT` | `5` | Rotated files retained, from 0 to 100 |

Production and staging clamp the effective log level to at least `warn`. Browser endpoint credentials and query values are redacted from status output and structured logs.

## Local example

```dotenv
NODE_ENV=development
PORT=4000
BROWSER_PROVIDER=local
BROWSER_HEADLESS=true
BROWSER_VIEWPORT=1280x720
LOG_FORMAT=console
LOG_TO_FILE=false
AGENT_RUNTIME_JWT_SECRET=replace-with-a-secret
```

## Hosted Browserless example

```dotenv
NODE_ENV=production
PORT=4000
BROWSER_PROVIDER=browserless
BROWSER_ENDPOINT=wss://browser.internal.example?token=YOUR_TOKEN
BROWSER_BROWSERLESS_MAX_TOTAL_SESSIONS=20
LOG_FORMAT=json
LOG_TO_FILE=false
AGENT_RUNTIME_JWT_SECRET=replace-with-a-secret
```

For elastic ECS workers, continue with [Browserless operations](../operations/browserless.md).
