# Configuration Guide

This guide covers all configuration options for Tailorec Browser Service.

---

## Configuration Methods

Configuration can be set via:

1. **Environment variables** (recommended)
2. **`.env` file** in project root
3. **Command-line flags** (not yet supported)

Environment variables take precedence over `.env` file values.

---

## Environment Variables

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | HTTP server port |

**Example:**

```env
PORT=4001
```

### Browser Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `BROWSER_HEADLESS` | `false` | Run browser in headless mode |
| `BROWSER_VIEWPORT` | `1280x720` | Browser viewport size (WIDTHxHEIGHT) |

**Example:**

```env
BROWSER_HEADLESS=true
BROWSER_VIEWPORT=1920x1080
```

**Viewport Formats:**

- Standard: `1280x720`
- Custom: `1440x900`
- Mobile: `375x667`

### Logging Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Logging level |
| `LOG_FORMAT` | `json` | Log output format |
| `LOG_TO_FILE` | `true` | Enable file logging |
| `LOG_FILE_PATH` | `logs/app.log` | Log file location |
| `LOG_MAX_BYTES` | `10485760` | Max log file size (bytes) |
| `LOG_BACKUP_COUNT` | `5` | Number of backup log files |

**Log Levels:**

- `debug` - All logs (very verbose)
- `info` - Informational messages (default)
- `warn` - Warnings and errors
- `error` - Errors only

**Example:**

```env
LOG_LEVEL=debug
LOG_FORMAT=console
LOG_TO_FILE=true
LOG_FILE_PATH=logs/browser-service.log
LOG_MAX_BYTES=5242880
LOG_BACKUP_COUNT=3
```

### Security Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `BROWSER_EVALUATE_ENABLED` | `true` | Enable JavaScript evaluation via API |

**Example:**

```env
BROWSER_EVALUATE_ENABLED=false
```

⚠️ **Security Note:** Disabling evaluate prevents arbitrary JavaScript execution, which is recommended for untrusted clients.

### File Upload Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `BROWSER_UPLOAD_MAX_BYTES` | `15728640` | Max file upload size (15MB) |
| `BROWSER_UPLOAD_DOWNLOAD_TIMEOUT_MS` | `45000` | Upload/download timeout (ms) |
| `BROWSER_KEEP_STAGED_UPLOADS` | `false` | Keep temporary upload files |

**Example:**

```env
BROWSER_UPLOAD_MAX_BYTES=31457280
BROWSER_UPLOAD_DOWNLOAD_TIMEOUT_MS=60000
BROWSER_KEEP_STAGED_UPLOADS=true
```

---

## Complete Example `.env` File

```env
# ======================
# Server Configuration
# ======================
PORT=4000

# ======================
# Browser Configuration
# ======================
BROWSER_HEADLESS=true
BROWSER_VIEWPORT=1280x720

# ======================
# Security
# ======================
BROWSER_EVALUATE_ENABLED=true

# ======================
# File Uploads
# ======================
BROWSER_UPLOAD_MAX_BYTES=15728640
BROWSER_UPLOAD_DOWNLOAD_TIMEOUT_MS=45000
BROWSER_KEEP_STAGED_UPLOADS=false

# ======================
# Logging Configuration
# ======================
LOG_LEVEL=info
LOG_FORMAT=json
LOG_TO_FILE=true
LOG_FILE_PATH=logs/app.log
LOG_MAX_BYTES=10485760
LOG_BACKUP_COUNT=5
```

---

## Configuration Profiles

### Development Profile

Optimized for debugging:

```env
PORT=4000
BROWSER_HEADLESS=false
BROWSER_VIEWPORT=1920x1080
LOG_LEVEL=debug
LOG_FORMAT=console
LOG_TO_FILE=true
BROWSER_EVALUATE_ENABLED=true
BROWSER_KEEP_STAGED_UPLOADS=true
```

### Production Profile

Optimized for performance and security:

```env
PORT=4000
BROWSER_HEADLESS=true
BROWSER_VIEWPORT=1280x720
LOG_LEVEL=info
LOG_FORMAT=json
LOG_TO_FILE=true
LOG_MAX_BYTES=5242880
LOG_BACKUP_COUNT=3
BROWSER_EVALUATE_ENABLED=false
BROWSER_UPLOAD_MAX_BYTES=10485760
```

### CI/CD Profile

Optimized for automated testing:

```env
PORT=4000
BROWSER_HEADLESS=true
BROWSER_VIEWPORT=1280x720
LOG_LEVEL=warn
LOG_FORMAT=json
LOG_TO_FILE=false
BROWSER_EVALUATE_ENABLED=true
```

### High-Performance Profile

Optimized for heavy workloads:

```env
PORT=4000
BROWSER_HEADLESS=true
BROWSER_VIEWPORT=1024x768
LOG_LEVEL=warn
LOG_FORMAT=json
LOG_TO_FILE=true
LOG_MAX_BYTES=2097152
LOG_BACKUP_COUNT=2
BROWSER_UPLOAD_MAX_BYTES=5242880
```

---

## Runtime Configuration

Some configuration can be adjusted at runtime via API requests.

### Per-Request Timeout

Override default timeout for specific requests:

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "wait",
    "loadState": "networkidle",
    "timeoutMs": 30000
  }'
```

### Per-Request Viewport

Resize viewport for specific operations:

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

## Environment Variable Precedence

1. **Process environment** - `PORT=4001 npm start`
2. **`.env` file** - Values in `.env`
3. **Defaults** - Built-in defaults

**Example:**

```bash
# This PORT overrides .env file
PORT=4001 npm start
```

---

## Validation

The service validates configuration on startup:

```
info [main] Starting Tailorec Browser Service...
info [config] Loaded configuration from .env
info [config] PORT: 4000
info [config] BROWSER_HEADLESS: true
info [config] BROWSER_VIEWPORT: 1280x720
info [main] Service ready on port 4000
```

Invalid configuration will prevent startup:

```
error [config] Invalid BROWSER_VIEWPORT format. Use WIDTHxHEIGHT (e.g., 1280x720)
error [main] Fatal error during service startup
```

---

## Troubleshooting

### Configuration Not Loading

**Symptom:** Service uses defaults instead of `.env` values

**Solution:** Ensure `.env` file is in project root:

```bash
ls -la .env
```

### Invalid Viewport Format

**Error:** `Invalid BROWSER_VIEWPORT format`

**Solution:** Use correct format:

```env
# ✅ Correct
BROWSER_VIEWPORT=1280x720

# ❌ Incorrect
BROWSER_VIEWPORT=1280x720px
BROWSER_VIEWPORT="1280x720"
```

### Log File Not Created

**Symptom:** No log file appears

**Solutions:**

1. Ensure directory exists:
   ```bash
   mkdir -p logs
   ```

2. Check permissions:
   ```bash
   chmod 755 logs
   ```

3. Verify `LOG_TO_FILE=true`

### High Disk Usage from Logs

**Symptom:** Log files consume excessive disk space

**Solution:** Reduce log retention:

```env
LOG_MAX_BYTES=2097152
LOG_BACKUP_COUNT=2
```

Or disable file logging:

```env
LOG_TO_FILE=false
```

---

## Next Steps

- **[Quick Start](./quickstart.md)** - Your first automation
- **[Architecture Overview](../architecture/overview.md)** - System design
- **[API Reference](../api-reference/overview.md)** - Complete API docs

---

**Last Updated:** 2026-03-03
