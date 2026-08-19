# Run your first browser workflow

This tutorial starts the local provider, opens a run-owned browser, reads a semantic snapshot, and closes the session.

## What you need

- Node.js 20 or newer
- npm
- Linux, macOS, or Windows with a Chromium-compatible Playwright runtime

## 1. Install and start the service

```bash
npm ci
npx playwright install chromium
cp .env.example .env
npm run dev
```

The service listens on port `4000`. Confirm both liveness and runtime configuration:

```bash
curl -sS http://127.0.0.1:4000/
curl -sS http://127.0.0.1:4000/status
```

The first command returns `Tailorec Browser Service OK`; the second returns JSON with `ok: true` and the configured provider.

## 2. Create a session and navigate

```bash
curl -sS -X POST http://127.0.0.1:4000/runs/quickstart/session

curl -sS -X POST http://127.0.0.1:4000/act \
  -H 'Content-Type: application/json' \
  -d '{"run_id":"quickstart","kind":"navigate","url":"https://example.com"}'
```

Save the `targetId` from the navigation response. The service binds it to `quickstart`; another run cannot use it.

## 3. Snapshot and act

```bash
curl -sS -X POST http://127.0.0.1:4000/snapshot \
  -H 'Content-Type: application/json' \
  -d '{"run_id":"quickstart","interactiveOnly":true,"compact":true}'
```

The response contains a semantic page description and a `refs` map. For a page with an interactive ref such as `e12`, act on it with:

```bash
curl -sS -X POST http://127.0.0.1:4000/act \
  -H 'Content-Type: application/json' \
  -d '{"run_id":"quickstart","kind":"click","ref":"e12"}'
```

Take another snapshot after the click. DOM changes can invalidate old refs.

## 4. Close the session

```bash
curl -sS -X DELETE http://127.0.0.1:4000/runs/quickstart/session
```

The response reports whether a live session was closed. Closing an already-closed run is safe.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `missing_run_id` | A browser operation omitted `run_id` | Add the same run ID used to create the session |
| `run session is not initialized` | Navigation or snapshot ran before session creation | Call `POST /runs/:runId/session` first |
| Chromium executable not found | Playwright browser is not installed | Run `npx playwright install chromium` |
| `409` target ownership error | A `targetId` belongs to another run | Use the target returned for the current run |
| `429` capacity error | Local or remote session limit was reached | Honor `Retry-After`, then retry session creation |

## What you built

You completed the core contract: session → navigate → snapshot → ref action → fresh snapshot → cleanup. Continue with the [action reference](../api-reference/act.md) or switch providers using the [configuration reference](./configuration.md).
