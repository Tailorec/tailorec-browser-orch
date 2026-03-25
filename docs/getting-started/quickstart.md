# Quick Start

## 1. Start The Service

```bash
npm install
npx playwright install chromium
cp .env.example .env
npm run dev
```

## 2. Check Health

```bash
curl http://127.0.0.1:4000/
curl http://127.0.0.1:4000/status
```

## 3. Navigate

```bash
curl -X POST http://127.0.0.1:4000/act \
  -H 'Content-Type: application/json' \
  -d '{"kind":"navigate","url":"https://example.com"}'
```

## 4. Take A Snapshot

```bash
curl -X POST http://127.0.0.1:4000/snapshot \
  -H 'Content-Type: application/json' \
  -d '{"interactiveOnly":true,"compact":true}'
```

## 5. Use A Ref

From the snapshot response, pick a ref like `e2` and act on it:

```bash
curl -X POST http://127.0.0.1:4000/act \
  -H 'Content-Type: application/json' \
  -d '{"kind":"click","ref":"e2"}'
```

## 6. Capture Media

```bash
curl -X POST http://127.0.0.1:4000/screenshot \
  -H 'Content-Type: application/json' \
  -d '{"fullPage":true}'
```
