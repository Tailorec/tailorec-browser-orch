# Architecture

Tailorec Browser Service isolates browser mechanics behind a run-scoped HTTP contract. Agent reasoning stays outside the service; session ownership, browser execution, and observable failures stay inside it.

## Component boundaries

```mermaid
flowchart TB
    Client[Agent runtime or API client]
    Reviewer[Human reviewer]

    subgraph Transport[Transport layer]
        Routes[Express routes and controllers]
        Middleware[Correlation, logging, errors]
        WS[Control WebSocket]
    end

    subgraph Application[Application and domain]
        UC[ExecuteAction and TakeSnapshot use cases]
        Services[Session, interaction, discovery, snapshot services]
        State[Run sessions and target ownership]
        Interfaces[Browser, runtime, allocator, store, event ports]
    end

    subgraph Infrastructure[Adapters]
        PW[Playwright adapters]
        Chrome[Local Chrome launcher]
        Remote[Remote Browserless runtime]
        Allocator[In-memory or ECS allocator]
    end

    Client --> Routes
    Reviewer --> WS
    Routes --> Middleware
    Routes --> UC
    WS --> State
    UC --> Services
    Services --> State
    Services --> Interfaces
    Interfaces --> PW
    Interfaces --> Chrome
    Interfaces --> Remote
    Remote --> Allocator
```

Dependencies point inward. `src/core` defines entities, ports, services, and use cases. `src/api` translates HTTP into those operations. `src/adapters` implements Express, Playwright, Chrome, logging, and AWS behavior. `src/container` is the composition root.

## Run lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant C as Caller
    participant API as HTTP controller
    participant O as Ownership context
    participant A as Browserless allocator
    participant B as Browser runtime

    C->>API: POST /runs/:runId/session
    API->>O: ensureRunSession(runId)
    opt Browserless with allocator
        O->>A: assignRun(runId, sessionId)
        A-->>O: pinned worker endpoint
    end
    O->>B: ensure browser and probe readiness
    B-->>C: 201 session_id, created

    C->>API: POST /act with run_id and navigate
    API->>O: ensureTabAvailable(runId)
    O->>B: create or focus owned tab
    B-->>C: targetId and URL

    C->>API: POST /snapshot with run_id and targetId
    API->>O: validate target ownership
    O->>B: snapshot page
    B-->>C: semantic tree and refs

    C->>API: DELETE /runs/:runId/session
    API->>O: closeRunSession(runId)
    O->>B: disconnect or stop runtime
    O->>A: release assignment
```

Session creation is idempotent for an active run. Browser operations are not. Use `idempotencyKey` when a `navigate` request intentionally creates a new tab and may be retried.

## Isolation state machine

```mermaid
stateDiagram-v2
    [*] --> Creating: create run session
    Creating --> Active: runtime ready
    Creating --> [*]: allocation or readiness failure
    Active --> Active: snapshot or action
    Active --> Degraded: remote disconnect
    Active --> Closed: explicit close
    Active --> Closed: idle or lifetime expiry
    Active --> Closed: unsupported extra tab
    Degraded --> Closed: degraded grace expiry
    Closed --> [*]
```

The ownership context maintains `runSessions` and `targetOwners` maps in process memory. It rejects:

- a run bound to a different profile
- a target owned by another run
- browser use before session creation
- extra non-blank tabs in the current single-tab model
- actions on degraded sessions

This fail-closed behavior prevents a retry or stale caller from controlling an unrelated page.

## Provider model

### Local

Each run gets a reserved loopback port and a local browser runtime. Local admission defaults to five active sessions. This provider is intended for development, CI, and trusted single-host deployments.

### Browserless

Each run gets a dedicated remote browser connection. With only `BROWSER_ENDPOINT`, the in-memory allocator tracks capacity against that provider. With complete ECS configuration, the allocator launches or reuses owned Fargate tasks, waits for ECS and browser readiness, pins runs to workers, quarantines unavailable workers, reconciles tagged orphans on startup, and retires idle workers.

## Trust boundaries

```mermaid
flowchart LR
    Public[Public or user-facing application]
    Gateway[Authenticated private gateway]
    BrowserAPI[Browser execution API]
    Control[JWT control channel]
    Chrome[Chrome or Browserless]

    Public --> Gateway
    Gateway --> BrowserAPI
    Public -->|short-lived scoped JWT| Control
    BrowserAPI --> Chrome
    Control --> Chrome
```

Only the human-control channel authenticates requests inside this service. HTTP execution routes assume a trusted network caller. Production deployments must enforce authentication, authorization, rate limits, and request-size policy at the gateway or service mesh.

Control JWTs use HS256 and require `exp`, the configured issuer/audience, `token_type=agent_browser_control`, and `browser:control` scope. A newer control socket for the same `run_id` replaces the older one.

## Failure semantics

| Failure | Response | Caller behavior |
|---|---|---|
| Invalid input or missing `run_id` | `400` | Correct the request; do not retry unchanged |
| Unknown profile or target | `404` | Refresh state or fix configuration |
| Ownership conflict or unsupported extra tab | `409` | Stop the flow and create a correctly scoped run |
| Capacity exhausted | `429` with `Retry-After` | Back off, then retry session creation |
| Disabled evaluation | `403` | Remove code evaluation or enable it deliberately |
| Remote runtime unavailable/degraded | `503` | Close or abandon the run; create a new run after recovery |

## Trade-offs

- Process-local ownership is simple and fast, but active sessions do not survive restart and multiple service replicas need external affinity or shared ownership.
- A single active tab makes ownership easy to prove, but popup and multi-tab workflows are intentionally rejected.
- Semantic refs are more stable than arbitrary selectors, but callers must snapshot again after state changes.
- ECS worker ownership gives explicit capacity and cleanup, but adds AWS permissions, readiness latency, and control-plane failure modes.

## Source map

| Concern | Source |
|---|---|
| Composition and startup | `src/main.ts`, `src/container/container.ts` |
| HTTP contract | `src/api/routes`, `src/api/controllers` |
| Ownership and lifecycle | `src/api/context/browser.context.ts` |
| Domain behavior | `src/core` |
| Playwright execution | `src/adapters/playwright` |
| Local/remote runtimes | `src/adapters/browser` |
| Control authentication | `src/shared/utils/control-token.ts`, `src/adapters/http/control-live.server.ts` |

See [Run sessions](../api-reference/run-sessions.md), [Browserless operations](../operations/browserless.md), and [Testing](../testing/overview.md).
