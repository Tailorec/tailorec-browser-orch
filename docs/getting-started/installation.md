# Installation Guide

This guide covers system requirements, installation steps, and verification for Tailorec Browser Service.

---

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Node.js | 18.x | 20.x LTS |
| npm | 9.x | 10.x |
| RAM | 2 GB | 4 GB+ |
| Disk Space | 500 MB | 1 GB+ |
| OS | Linux, macOS, Windows 10+ | Linux, macOS |

### Browser Requirements

The service uses Playwright to manage Chromium automatically. No manual browser installation is required.

---

## Installation Steps

### Step 1: Clone or Navigate to Project

```bash
cd /path/to/openclaw-browser
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs:
- **Playwright** - Browser automation library
- **Express** - HTTP server framework
- **TypeScript** - Type system and compiler
- **tsx** - TypeScript execution for development
- **vitest** - Testing framework
- Other dependencies

### Step 3: Install Playwright Browsers

```bash
npx playwright install chromium
```

This downloads Chromium (~150MB) optimized for automation.

**Optional:** Install system dependencies (Linux only):

```bash
npx playwright install-deps chromium
```

### Step 4: Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Browser service
PORT=4000

# Headless mode (set to false for debugging)
BROWSER_HEADLESS=true

# Browser viewport size
BROWSER_VIEWPORT=1280x720

# Logging configuration
LOG_LEVEL=info
LOG_FORMAT=json
LOG_TO_FILE=true
LOG_FILE_PATH=logs/app.log
LOG_MAX_BYTES=10485760
LOG_BACKUP_COUNT=5
```

See [Configuration Guide](./configuration.md) for all options.

### Step 5: Build TypeScript

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### Step 6: Verify Installation

Run the service:

```bash
npm start
```

Expected output:

```
info [main] Starting Tailorec Browser Service...
info [main] Service ready on port 4000
```

Test the health endpoint:

```bash
curl http://localhost:4000/status
```

Expected response:

```json
{
  "ok": true,
  "profiles": []
}
```

---

## Development Installation

For development with hot reload:

```bash
# No build step needed
npm run dev
```

The service will automatically reload on code changes.

---

## Docker Installation (Optional)

### Create Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install Playwright dependencies
RUN apk add --no-cache chromium

# Set Playwright environment
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/local/browsers
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]
```

### Build and Run

```bash
docker build -t tailorec-browser .
docker run -p 4000:4000 tailorec-browser
```

---

## Troubleshooting

### Issue: Port Already in Use

**Error:** `EADDRINUSE: address already in use`

**Solution:** Change the port in `.env`:

```env
PORT=4001
```

Or find and kill the process:

```bash
# Linux/macOS
lsof -i :4000
kill -9 <PID>

# Windows
netstat -ano | findstr :4000
taskkill /PID <PID> /F
```

### Issue: Playwright Browser Not Found

**Error:** `Executable doesn't exist at /path/to/chromium`

**Solution:** Reinstall Playwright browsers:

```bash
npx playwright install chromium --force
```

### Issue: Permission Denied (Linux)

**Error:** `spawn EACCES`

**Solution:** Install system dependencies:

```bash
npx playwright install-deps chromium
```

Or run with elevated permissions (not recommended for production):

```bash
sudo npm start
```

### Issue: TypeScript Compilation Errors

**Error:** Various TypeScript errors during build

**Solution:** Ensure dependencies are installed:

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue: High Memory Usage

**Symptoms:** Service consumes >2GB RAM

**Solutions:**

1. Enable headless mode:
   ```env
   BROWSER_HEADLESS=true
   ```

2. Reduce viewport size:
   ```env
   BROWSER_VIEWPORT=1024x768
   ```

3. Close unused tabs via API:
   ```bash
   curl -X POST http://localhost:4000/act \
     -H "Content-Type: application/json" \
     -d '{"kind": "close"}'
   ```

---

## Next Steps

- **[Quick Start](./quickstart.md)** - Your first automation in 5 minutes
- **[Configuration](./configuration.md)** - Detailed configuration options
- **[Architecture Overview](../architecture/overview.md)** - Understand how it works

---

## Verification Checklist

- [ ] Node.js 20+ installed (`node --version`)
- [ ] npm 9+ installed (`npm --version`)
- [ ] Dependencies installed (`npm install`)
- [ ] Playwright browsers installed (`npx playwright install chromium`)
- [ ] Environment file configured (`.env`)
- [ ] Service starts successfully (`npm start`)
- [ ] Health endpoint responds (`curl http://localhost:4000/status`)

---

**Last Updated:** 2026-03-03
