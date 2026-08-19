# Run-session API

Run sessions establish ownership before any browser operation. The service binds one provider session and one active non-blank tab to a `run_id`.

## `POST /runs/:runId/session`

Creates a run-owned browser runtime or returns the existing active session. The `runId` path parameter must be non-empty.

```bash
curl -sS -X POST http://127.0.0.1:4000/runs/run-123/session
```

Response:

```json
{
  "ok": true,
  "accepted": true,
  "run_id": "run-123",
  "session_id": "a6b090fb-7eec-431a-849d-c6e4fc234c6e",
  "created": true
}
```

The endpoint returns `201` for both a new session and an idempotent reuse. `created` distinguishes them.

For the Browserless provider, creation assigns capacity and waits for runtime readiness. A failed new allocation is rolled back rather than leaving a partial session.

## `DELETE /runs/:runId/session`

Closes the owned browser runtime, clears target ownership and idempotency entries, and releases any Browserless assignment.

```bash
curl -sS -X DELETE http://127.0.0.1:4000/runs/run-123/session
```

Response:

```json
{
  "ok": true,
  "run_id": "run-123",
  "session_id": "a6b090fb-7eec-431a-849d-c6e4fc234c6e",
  "closed": true,
  "target_id": "ABC123.1"
}
```

Closing an absent session is idempotent: the response remains successful with `closed: false`.

## Ownership rules

- Create the session before calling snapshot, action, hook, media, or control operations.
- Reuse the same `run_id` throughout one workflow.
- Do not reuse a `targetId` across runs.
- Do not reuse a completed or degraded run ID for a fresh workflow; create a new run ID.
- Close sessions on every terminal path, including cancellation and failure.

## Admission and retry

A full provider returns `429` with `code: capacity_exceeded`, `active`, `max`, `retry_after_seconds`, and `Retry-After`. Retrying with the same run ID after the delay is safe if creation did not succeed.

A remote disconnect marks the session degraded and returns `503` with `code: session_degraded`. The run is not silently rebound because doing so could mix browser history or ownership. Close or abandon that run, wait for provider recovery, and create a new run ID.

## Expiry

Sessions are swept by idle timeout, absolute lifetime, and degraded-close grace. See [Configuration](../getting-started/configuration.md) for defaults and disable behavior.
