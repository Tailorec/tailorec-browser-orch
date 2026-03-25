# Installation

## Requirements

- Node.js 20+
- npm
- Chromium installed through Playwright

## Install Dependencies

```bash
npm install
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

## Default Bindings

- host: `127.0.0.1`
- port: `4000`
