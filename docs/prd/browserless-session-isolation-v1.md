## Problem Statement

Production browser automation is unreliable because the current browser-provider/browserless integration does not guarantee strict per-run isolation. In local development this often appears to work because there is effectively one process and limited concurrency, but in production the browser-provider can reconnect to a shared browserless endpoint, enumerate multiple pages, and use fallback heuristics to find a target. That creates ambiguity, cross-run leakage risk, and behavior that diverges from local testing.

The product requirement for v1 is strict and simple: each `run_id` must get its own isolated browserless session and exactly one tab for the full run lifetime. The system must never attach a run to a different browserless session, never guess a target by URL, never silently fall back to another page, and never continue a flow that opens a second tab.

## Solution

Introduce an explicit browser session lifecycle owned by browser-provider and orchestrated by open-agent:

- `open-agent` calls `CreateRunSession(run_id)` before first browser use.
- browser-provider provisions a dedicated browserless session for that `run_id`.
- browser-provider stores live ownership in run-session state keyed by `run_id`.
- the first explicit `navigate` creates and binds the one allowed tab.
- all later browser operations resolve strictly through the stored live binding.
- `open-agent` calls `CloseRunSession(run_id)` on terminal run completion.
- browser-provider also enforces idle timeout, max lifetime, degraded cleanup, and admission control.

For v1, the invariant is absolute:

- `1 run_id -> 1 isolated browserless session -> 1 tab only`

If the site attempts to open a second tab or popup, the flow is classified as unsupported for v1. The provider must not follow the new target and must not continue browser automation silently.

## User Stories

1. As an automation platform operator, I want each run to receive its own isolated browserless session, so that runs cannot leak browser state across each other.
2. As an open-agent orchestrator, I want to create a browser session explicitly before first browser use, so that session lifecycle is deterministic and observable.
3. As an open-agent orchestrator, I want repeated `CreateRunSession(run_id)` calls to be idempotent for an already active run, so that network retries do not create duplicate sessions.
4. As an open-agent orchestrator, I want browser-provider to reject new session creation when capacity is exhausted, so that admission failures are explicit rather than hidden inside timeouts or queueing.
5. As an open-agent orchestrator, I want browser-provider to return `retry_after_seconds` on admission rejection, so that retry behavior can be controlled cleanly.
6. As a browser-provider, I want to store run-session ownership internally by `run_id`, so that callers do not need browserless transport details.
7. As a browser-provider, I want to keep `ws_endpoint` internal, so that browserless internals are encapsulated and not leaked to callers.
8. As an operator, I want `session_id` surfaced in logs and diagnostics, so that production incidents can be traced without exposing sensitive connection URLs.
9. As a run owner, I want the first explicit `navigate` to be the only place where the single tab is created and bound, so that tab ownership starts deterministically.
10. As a run owner, I want snapshot requests before first navigate to fail clearly, so that the lifecycle contract is explicit.
11. As a run owner, I want action requests before first navigate to fail clearly, so that the system never creates tabs implicitly.
12. As a run owner, I want `/control/live` to use only the run-bound tab, so that human review cannot attach to the wrong page.
13. As a run owner, I want every browser operation to resolve through the stored run binding, so that the system never scans global pages and guesses.
14. As an operator, I want URL-based tab matching removed, so that browserless-specific blank tabs or duplicate URLs cannot misroute requests.
15. As an operator, I want the created target to be captured deterministically from the create response, so that target binding is exact.
16. As a run owner, I want a mismatched endpoint or target for a `run_id` to return `409`, so that incorrect ownership is rejected instead of tolerated.
17. As a run owner, I want the browser-provider to reject missing-target fallbacks, so that stale or incorrect references cannot silently keep the run going.
18. As a run owner, I want a missing bound target to return a clear error, so that clients know navigate has not happened yet.
19. As an operator, I want a single browser-provider replica for v1, so that in-memory ownership remains valid under the deployment model.
20. As an operator, I want run-session state to be cleaned up on normal completion, so that active capacity is reclaimed promptly.
21. As an operator, I want run-session state to be cleaned up on explicit close, so that completed or cancelled runs do not retain sessions.
22. As an operator, I want idle timeout cleanup, so that abandoned runs do not consume capacity indefinitely.
23. As an operator, I want max lifetime cleanup, so that long-lived or leaked sessions are reclaimed.
24. As an operator, I want degraded sessions auto-closed after a short grace window, so that dead sessions do not permanently occupy capacity.
25. As a caller, I want unexpected browserless disconnects to return retriable `503`s during the grace window, so that infra failures are distinguishable from logic failures.
26. As a caller, I want degraded sessions to avoid automatic rebinding to another browserless session, so that the isolation invariant is preserved.
27. As a caller, I want a disconnected session to keep the original `run_id` burned for the lifetime of that run, so that event history remains coherent.
28. As an operator, I want the live binding freed after cleanup while the historical `run_id` remains persisted, so that traces remain intact without allowing run reuse.
29. As a caller, I want multi-tab flows classified as unsupported in v1, so that the system fails honestly instead of pretending the flow can continue.
30. As a caller, I want a second tab creation attempt to return a structured `409` unsupported-flow error, so that the limitation is visible and actionable.
31. As a caller, I want unsupported multi-tab flows to enter a distinct non-retriable terminal state, so that product limitations are not confused with infra degradation.
32. As an operator, I want browserless session disconnects and unsupported flow failures classified differently, so that alerting and remediation can be targeted.
33. As an operator, I want logs for every session lifecycle event to include `run_id` and `session_id`, so that incidents can be correlated end-to-end.
34. As an operator, I want browser session create, bind, close, timeout, degrade, and unsupported-flow events logged consistently, so that production behavior is auditable.
35. As a test author, I want concurrent runs to isolate even when they navigate to the same URL, so that shared destination pages do not break routing.
36. As a test author, I want disconnecting one browserless session not to impact another run, so that isolation is validated under failure.
37. As a test author, I want race tests for navigate/snapshot/act across multiple runs, so that concurrency invariants are checked before production rollout.
38. As an operator, I want explicit `CloseRunSession(run_id)` on happy-path completion from open-agent, so that browser cleanup does not rely solely on timeouts.
39. As an operator, I want browser-provider safety-net cleanup even if open-agent misses close calls, so that production capacity remains bounded.
40. As a future maintainer, I want the API contract to keep browserless details behind browser-provider, so that the implementation can evolve without widening the integration surface.

## Implementation Decisions

- The v1 invariant is strict: `1 run_id -> 1 isolated browserless session -> 1 tab only`.
- `open-agent` is responsible for explicit session orchestration by calling `CreateRunSession(run_id)` before first browser use and `CloseRunSession(run_id)` on terminal completion.
- browser-provider is responsible for browser session lifecycle enforcement, session provisioning, target binding, cleanup, admission control, and failure classification.
- `CreateRunSession(run_id)` creates the isolated browserless session eagerly, but the single allowed tab is created and bound lazily on first explicit `navigate`.
- `CreateRunSession(run_id)` is idempotent for an already active run and must never create a second session for the same `run_id`.
- `CreateRunSession(run_id)` returns acknowledgement plus safe debug metadata such as `session_id`, but must not return raw `ws_endpoint`.
- browser-provider stores live run-session ownership internally keyed by `run_id`, including session lifecycle state and later the bound `target_id`.
- The browser-provider deployment assumption for v1 is a strict singleton replica. Shared state or horizontal scaling is deferred.
- All browser actions, snapshots, hooks, and live control must resolve strictly through the stored run binding. No global page enumeration fallback is allowed for request routing.
- URL-based tab matching is removed from the create path and lookup path.
- The exact created target must be captured deterministically from the creation mechanism rather than inferred by URL or page ordering.
- When a request references a mismatched endpoint or target for a `run_id`, browser-provider must return `409` and never attempt fallback.
- `/control/live` must resolve only the run-bound target. There is no fallback to profile-level endpoints or a guessed page.
- Snapshot, action, and control requests before the first bound target exists must fail clearly rather than implicitly creating a session or tab.
- V1 supports only one tab for the entire run lifetime. If a site opens a second tab, popup, or window, the provider must treat the flow as unsupported.
- Unsupported multi-tab behavior results in a non-retriable terminal state such as `unsupported_flow` and returns a structured `409` error such as `new_tab_opened_unsupported`.
- Unexpected browserless disconnects result in a temporary `degraded` state with retriable `503` responses for browser operations.
- During `degraded`, only status, diagnostics, and explicit close remain allowed. Browser actions remain blocked.
- Degraded sessions are never rebound to another browserless session automatically.
- Degraded sessions auto-close after a bounded grace timeout and free live capacity, while the historical `run_id` remains preserved in persistent run history.
- A `run_id` is burned for the lifetime of the run and is never reused for a fresh session after disconnect or completion.
- Final session cleanup must occur on any terminal path: explicit close, open-agent terminal completion, idle timeout, max lifetime, or degraded grace expiry.
- Admission control is enforced at browser-provider with a hard maximum of 20 active isolated browserless sessions.
- When at capacity, `CreateRunSession(run_id)` returns `429` with `retry_after_seconds` and does not create partial live state.
- Queueing is out of scope for v1. Rejection is preferred over hidden waiting.
- Structured logs must include `run_id` and `session_id` on all lifecycle events and failure paths.
- Module boundaries should be deep where possible:
- A session lifecycle module should encapsulate create, bind, state transitions, cleanup, and admission control behind a stable interface.
- A browserless provisioning module should encapsulate session creation/termination details and keep browserless-specific transport hidden from higher layers.
- A target-binding module should encapsulate first-tab creation, deterministic target capture, and ownership validation.
- A failure-classification module should map disconnects, stale ownership, unsupported multi-tab flows, and admission control into stable API errors and lifecycle transitions.

## Testing Decisions

- Good tests must verify externally observable behavior and API contracts, not internal Maps, timers, or implementation details.
- Tests should verify the session and routing invariants from the perspective of browser-provider and open-agent integration.
- Unit tests should cover session lifecycle transitions, admission control, deterministic target binding, stale/mismatched target rejection, degraded cleanup, and unsupported-flow classification.
- Integration tests should cover explicit session creation, first-navigate binding, no-target-before-navigate behavior, strict ownership enforcement across browser actions, and explicit close.
- End-to-end or concurrency tests should cover:
- two concurrent runs on the same URL producing isolated `session_id`s and `target_id`s
- forced disconnect in one run leaving the other run unaffected
- parallel navigate/snapshot/act requests across multiple runs
- unsupported second-tab creation producing a terminal unsupported-flow result
- Existing browser, snapshot, action, and concurrency tests in the repo should be used as prior art where the current suite already validates run-based browser behavior.
- Tests must assert there is no URL-based matching fallback and no single-page fallback when a target is missing.
- Tests must assert `/control/live` uses only the bound run target and fails when no valid bound target exists.
- Tests must assert `CreateRunSession` is idempotent for retries on the same active run.
- Tests must assert `429` admission control behavior at 20 active sessions and the presence of `retry_after_seconds`.
- Tests must assert `503` degraded behavior during the grace window and full cleanup after grace expiry.
- Tests must assert terminal cleanup frees live session capacity while preserving run-history observability.

## Out of Scope

- Multi-tab or popup support beyond detection-and-fail behavior.
- Automatic promotion from one target to another.
- Automatic rebinding to a new browserless session after disconnect.
- Horizontal scaling of browser-provider or shared run-session ownership in Redis.
- Sticky routing or replica coordination for browser-provider.
- Internal queueing for admission control.
- Cross-run browser session reuse.
- Public exposure of browserless connection endpoints.
- Full rollout of Redis-backed shared state for multi-replica browser-provider.

## Further Notes

- This PRD intentionally chooses the simplest production-safe invariant for v1 and rejects convenience fallbacks that hide correctness bugs.
- The design requires coordinated changes in both browser-provider and open-agent. This is not an `openclaw-browser`-only refactor.
- The current production mismatch between local behavior and deployed behavior is driven both by infrastructure wiring and by runtime ownership heuristics. The v1 design removes those heuristics rather than trying to harden them.
- A future phase can relax the single-tab restriction only after isolated per-run session ownership is proven in production and shared ownership state is designed explicitly.
