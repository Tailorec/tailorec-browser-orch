# Configuration

The runtime loads env vars at startup through `dotenv/config` in `src/main.ts`.

## Common Variables

### Server

- `PORT`: HTTP port, default `4000`

### Control API

- `AGENT_RUNTIME_JWT_SECRET`: required for `/control` and `/control/live` JWT verification
- `AGENT_RUNTIME_JWT_ISSUER`: defaults to `tailorec-backend`
- `AGENT_RUNTIME_JWT_AUDIENCE`: defaults to `tailorec-agent-runtime`

### Browser

- `BROWSER_PROVIDER`: `local|browserless`
- `BROWSER_CDP_PORT`: local provider only, default `9222`
- `BROWSER_ENDPOINT`: browserless provider only, full `ws(s)` or `http(s)` endpoint
- `BROWSER_HEADLESS`: `true|false`
- `HEADLESS`: legacy fallback for headless mode
- `BROWSER_NO_SANDBOX`: `true|false`
- `BROWSER_VIEWPORT`: `WIDTHxHEIGHT`, for example `1280x720`
- `BROWSER_KEEP_STAGED_UPLOADS`: keep temporary upload staging files if set to `true`

### Logging

- `LOG_LEVEL`: `debug|info|warn|error`
- `LOG_FORMAT`: `json|console`
- `LOG_TO_FILE`: `true|false`
- `LOG_FILE_PATH`: default `logs/app.log`
- `LOG_MAX_BYTES`
- `LOG_BACKUP_COUNT`

## Defaults

Current defaults come from `src/config/config.ts`:

- port `4000`
- host `127.0.0.1`
- browser enabled
- provider `local`
- local browser port `9222`
- headless `false` in code defaults, but `.env.example` sets `BROWSER_HEADLESS=true`
- viewport `1280x720`
- evaluate enabled
- JSON logging to file

## Example `.env`

```bash
PORT=4000
AGENT_RUNTIME_JWT_SECRET=replace-me
AGENT_RUNTIME_JWT_ISSUER=tailorec-backend
AGENT_RUNTIME_JWT_AUDIENCE=tailorec-agent-runtime
BROWSER_PROVIDER=local
BROWSER_CDP_PORT=9222
BROWSER_HEADLESS=true
BROWSER_VIEWPORT=1280x720
LOG_LEVEL=info
LOG_FORMAT=json
LOG_TO_FILE=true
LOG_FILE_PATH=logs/app.log
LOG_MAX_BYTES=10485760
LOG_BACKUP_COUNT=5
```

## Remote Example

```bash
PORT=4000
AGENT_RUNTIME_JWT_SECRET=replace-me
AGENT_RUNTIME_JWT_ISSUER=tailorec-backend
AGENT_RUNTIME_JWT_AUDIENCE=tailorec-agent-runtime
BROWSER_PROVIDER=browserless
BROWSER_ENDPOINT=wss://browser.example.com?token=YOUR_TOKEN
BROWSER_HEADLESS=true
BROWSER_VIEWPORT=1280x720
LOG_LEVEL=info
LOG_FORMAT=json
LOG_TO_FILE=true
LOG_FILE_PATH=logs/app.log
LOG_MAX_BYTES=10485760
LOG_BACKUP_COUNT=5
```

## Notes

- `BROWSER_VIEWPORT` must be in `WIDTHxHEIGHT` format
- invalid boolean or viewport values fall back to defaults
- `local` requires `BROWSER_CDP_PORT`
- `browserless` requires `BROWSER_ENDPOINT`
- the default `Dockerfile` is for `browserless`; use `Dockerfile.local` if you need a containerized local browser
- all configured profiles must resolve to the same provider in v1
- the service keeps a single active browser connection per process in v1
- remote endpoints may include secrets; logs and `/status` redact endpoint credentials and query parameter values
