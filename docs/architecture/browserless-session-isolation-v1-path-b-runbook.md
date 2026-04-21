# Browserless Session Isolation V1 (Path B) Runbook

## Scope

This runbook documents the production operating model for Browserless isolation V1 (Path B):

- `1 run_id -> 1 isolated browserless connection -> 1 tab`
- Singleton browser-provider deployment (one replica only)
- No Browserless Session Create/Stop API dependency

## Runtime Rules

- `CreateRunSession(run_id)` creates or returns the run-owned session and connection.
- First `navigate` is the only target-binding point for a run.
- All browser operations are run-bound and target-bound.
- Any run/target mismatch returns `409` with no fallback behavior.
- If flow attempts to open an additional non-blank tab, session is closed as `unsupported_flow`.

## Capacity

- Capacity is controlled by `BROWSER_BROWSERLESS_MAX_SESSIONS`.
- Default policy is `20` active sessions.
- If capacity is full, create returns `429` with `retry_after_seconds`.

## Failure and Cleanup

- Connection disconnect marks run session `degraded`.
- While degraded, browser operations return retriable `503`.
- Degraded sessions are hard-closed after configured grace timeout.
- Idle timeout and max lifetime cleanup close sessions and release capacity.

## Logging and Diagnostics

- Lifecycle logs must include `run_id` and provider `session_id`.
- Required lifecycle coverage in logs: create, degraded, close.
- Use `session_id` to correlate all run browser events.

## Deployment Constraints (V1)

- Browser-provider must run as a single replica in production.
- No shared state backend is required for V1.
- Horizontal scaling is out of scope for this phase.

## Verification Checklist

- Concurrent runs on same URL produce distinct `session_id` and `target_id`.
- Forced disconnect in one run does not impact other runs.
- Parallel navigate/snapshot/act requests pass isolation checks.
- Capacity limit emits deterministic `429` responses.
- Degraded auto-close releases capacity after timeout.

## Deferred Phases

- Redis-backed run-session ownership for multi-replica routing.
- Optional admission queue for wait-over-fail behavior.
- Advanced cross-instance zombie cleanup coordination.
