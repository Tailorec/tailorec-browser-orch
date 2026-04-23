# Installation

## Requirements

- Node.js 20+
- npm
- Chromium installed through Playwright when using the local browser provider or Playwright E2E tests

## Install Dependencies

```bash
npm install
# required only for local provider / E2E
npx playwright install chromium
```

## Create Environment File

```bash
cp .env.example .env
```

Adjust values as needed, then start the service:

```bash
npm run dev
```

Production entry:

```bash
npm run build
npm start
```

Container entry:

```bash
# browserless / production
docker build -t tailorec-browser .

# local browser runtime
docker build -f Dockerfile.local -t tailorec-browser-local .
```

## Default Bindings

- host: `127.0.0.1`
- port: `4000`
