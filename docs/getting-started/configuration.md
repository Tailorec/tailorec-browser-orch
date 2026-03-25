# Configuration

The runtime loads env vars at startup through `dotenv/config` in `src/main.ts`.

## Common Variables

### Server

- `PORT`: HTTP port, default `4000`

### Browser

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
- headless `false` in code defaults, but `.env.example` sets `BROWSER_HEADLESS=true`
- viewport `1280x720`
- evaluate enabled
- JSON logging to file

## Example `.env`

```bash
PORT=4000
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
- profile definitions are part of runtime config shape, but the checked-in `.env.example` only exposes the common single-profile setup
