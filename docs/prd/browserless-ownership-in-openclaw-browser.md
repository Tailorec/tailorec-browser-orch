# PRD / Architecture Proposal: Browserless Ownership in `openclaw-browser`

## Related GitHub issues

- `Tailorec/openclaw-browser#18` — full browserless ownership redesign in `openclaw-browser`
- `Tailorec/tailorec-backend#44` — remove browserless wake/scaling ownership from backend
- `Tailorec/openclaw-agent#70` — update `open-agent` assumptions/tests/docs for the new ownership boundary

## 1. Problem

Today browser automation ownership is split across services:

- `tailorec-backend` currently wakes/scales browserless infrastructure
- `open-agent` orchestrates runs and browser tool usage
- `openclaw-browser` controls run-scoped browser sessions and browser actions

This creates a bad boundary:
- the service that owns browser session lifecycle (`openclaw-browser`) does **not** own browserless capacity
- the service that owns browserless wake (`tailorec-backend`) is **not** the service that actually manages browser session allocation

This leads to two main product/infrastructure issues:

1. **Browserless scale ownership is in the wrong place**
   - backend decides when browserless should wake
   - browser provider decides how sessions are used
   - ownership is split and harder to reason about

2. **No proper scale-to-zero / task-packing model driven by actual session demand**
   - desired behavior is:
     - 5 sessions per browserless instance/task
     - total concurrency limit = 20
     - strict packing across browserless tasks
     - scale down to zero when no browser sessions remain
   - current model does not give strict task packing or browserless-task pinning

---

## 2. Desired behavior

The system should behave as follows:

- `openclaw-browser` owns browserless capacity completely
- each browserless task supports **5 concurrent sessions**
- current total session limit is **20**
- therefore current max browserless task count is **4**
- session packing should be strict:
  - sessions 1–5 → first browserless task
  - sessions 6–10 → second browserless task
  - sessions 11–15 → third browserless task
  - sessions 16–20 → fourth browserless task
- when a run/session is assigned to browserless task D, **all subsequent actions for that run must continue to go to task D**
- when demand falls, idle browserless tasks should be stopped
- when there are no active browser sessions, browserless should scale to **zero active tasks**

---

## 3. Goals

### Functional goals
- Move browserless ownership from `tailorec-backend` to `openclaw-browser`
- Keep `tailorec-backend -> open-agent -> openclaw-browser` flow intact
- Keep `open-agent` browser-service API contract unchanged
- Provide exact session-to-task pinning
- Enforce `5 sessions per task`
- Enforce `20 sessions total`
- Scale browserless down to zero when idle
- Ensure all subsequent requests for a run use the same pinned browserless task

### Operational goals
- Make browserless capacity decisions based on actual run session lifecycle
- Remove dual ownership / split-brain control
- Make task launch, readiness, and cleanup observable
- Support restart-safe cleanup for v1

---

## 4. Non-goals

For v1, this proposal does **not** attempt to provide:

- multi-replica HA for `openclaw-browser`
- distributed allocator state via Redis/Postgres
- live browserless session reconstruction after `openclaw-browser` restart
- automatic migration of live sessions to another browserless task after task failure
- CloudWatch custom metrics as a hard requirement
- backward-compatible coexistence with the old browserless service model

---

## 5. Current state analysis

## 5.1 `tailorec-backend`
Relevant code:
- `app/utils/browserless_service.py`
- `app/agent/services.py`
- `app/core/config.py`

Current behavior:
- backend explicitly wakes/scales browserless ECS service
- backend does readiness polling before browser workflows proceed
- backend owns browserless wake config

Problem:
- backend owns infra concern that should belong to browser session owner

---

## 5.2 `open-agent`
Relevant code:
- `src/tools/browser/adapter.ts`
- `src/orchestrator/pi/run-with-pi-agent.ts`
- `src/tools/browser/tools.ts`
- `src/config/runtime-config.ts`

Current behavior:
- `open-agent` talks only to `openclaw-browser`
- `open-agent` creates a run session once per run
- all later browser tool calls are scoped by `run_id`
- bounded retries already exist for browser `429`s

Important conclusion:
- `open-agent` is already browserless-agnostic
- the current contract is sufficient for the new design
- no browserless ECS ownership belongs in `open-agent`

---

## 5.3 `openclaw-browser`
Relevant code:
- `src/api/context/browser.context.ts`
- `src/adapters/browser/remote.browser-runtime.adapter.ts`
- `src/main.ts`
- `src/config/*`

Current behavior:
- owns run-session state in memory
- owns browser action routing by `run_id`
- already enforces a browserless session cap of 20
- remote browser runtime is effectively a no-op
- currently assumes a generic browserless endpoint, not a managed task pool

Important conclusion:
- `openclaw-browser` already has the right control point
- it just lacks browserless task lifecycle ownership

---

## 5.4 Current infra
Relevant Terraform:
- `infra/terraform/ecs.tf`
- `infra/terraform/iam.tf`
- `infra/terraform/locals.tf`
- `infra/terraform/variables.tf`
- `infra/terraform/production.tfvars`

Current behavior:
- browserless is an ECS service with desired count 0 and autoscaling
- backend has IAM to scale browserless service
- browser provider/openclaw does not
- browser provider runs single replica today, which fits v1 allocator assumptions

Problem:
- ECS service model is not ideal for strict 5-session packing and exact idle-task removal

---

# 6. Proposed architecture

## 6.1 High-level design

Move browserless ownership entirely into `openclaw-browser`.

`openclaw-browser` will:
- launch browserless ECS tasks directly using AWS SDK
- wait for readiness
- allocate sessions to specific browserless tasks
- pin run sessions to those tasks
- stop idle browserless tasks after configurable grace period
- clean up orphan browserless tasks on startup

`tailorec-backend` will no longer:
- wake browserless
- scale browserless
- wait for browserless readiness

`open-agent` will continue:
- creating run sessions
- sending browser actions using `run_id`
- closing run sessions
- retrying bounded `429`s

---

## 6.2 Ownership model

### Final ownership boundaries

#### `tailorec-backend`
- owns run creation at application/business level
- talks to `open-agent`
- does not own browserless infra

#### `open-agent`
- owns run orchestration
- talks to `openclaw-browser` using existing browser-service APIs
- does not know browserless task identities

#### `openclaw-browser`
- owns run-scoped browser session lifecycle
- owns browserless task lifecycle
- owns admission control
- owns task pinning
- owns scale-up / scale-down / scale-to-zero

---

## 6.3 Browserless execution model

### Chosen model
Use **individual ECS tasks** launched/stopped via:
- `RunTask`
- `DescribeTasks`
- `StopTask`
- `ListTasks`

### Why not ECS service scaling
Service-based scaling makes it harder to guarantee:
- strict packing
- exact per-run task pinning
- exact stop of the idle task
- safe scale-in without killing an in-use task

RunTask/StopTask gives exact control.

---

# 7. Core invariants

The new system must preserve these invariants:

1. **1 run_id -> 1 pinned browserless task**
2. **1 run_id -> 1 run-owned browser session**
3. **1 run_id -> 1 active owned tab for v1 flow**
4. No silent migration to another browserless task after task failure
5. No more than 5 active runs per browserless task
6. No more than 20 total active browserless run sessions
7. All subsequent actions for a run use the same pinned browserless endpoint

---

# 8. Detailed behavior

## 8.1 Allocation rules

### Config
- `BROWSERLESS_SESSIONS_PER_TASK = 5`
- `BROWSERLESS_MAX_TOTAL_SESSIONS = 20`

Derived:
- `max_tasks = ceil(20 / 5) = 4`

### Packing strategy
Strict packing, oldest-non-full-first:
- fill task A to 5
- then task B
- then task C
- then task D

This ensures:
- desired 5-session blocks
- easier scale-down
- better cost efficiency

---

## 8.2 Run session creation

When `open-agent` calls:

- `POST /runs/:runId/session`

`openclaw-browser` should:

1. check whether session already exists
   - if healthy, return existing session idempotently
   - if degraded, return failure; do not silently recreate

2. check browserless capacity
   - if total active sessions >= 20 → return `429`

3. choose a browserless task
   - prefer oldest running non-full task
   - if none exists:
     - if running task count >= 4 → return `429`
     - else launch new browserless task

4. if launching new task:
   - `RunTask`
   - wait for ECS `RUNNING`
   - extract private IP from ECS task metadata
   - probe browserless readiness over private IP:port
   - only after readiness succeeds, continue

5. assign run to chosen task
   - store run->task mapping in memory
   - store task->assigned runs in memory

6. return success only when pinned browserless endpoint is ready

### Important decision
`createRunSession` is **readiness-blocking**.  
It does not succeed until the assigned browserless task is actually usable.

---

## 8.3 Subsequent browser actions

All later browser actions from `open-agent` already carry the same `run_id`.

`openclaw-browser` should:
- resolve run session from in-memory state
- reuse stored browser endpoint for that run
- route request to the pinned browserless task endpoint only

So if run X was assigned to task D:
- navigate → task D
- snapshot → task D
- click → task D
- upload → task D
- close → task D

---

## 8.4 Run session close

When `open-agent` calls:
- `DELETE /runs/:runId/session`

`openclaw-browser` should:
- release the run from its assigned browserless task
- remove run session mapping
- if task has no assigned runs left:
  - mark task idle
  - stop it after `BROWSERLESS_IDLE_SHUTDOWN_GRACE_SECONDS`

Close should remain **idempotent**.

---

## 8.5 Automatic cleanup paths

Slot/task release must happen not just on explicit close, but also on:
- idle timeout cleanup
- max lifetime cleanup
- degraded-close timeout
- startup orphan cleanup

This is required to ensure:
- no slot leaks
- no stuck capacity
- scale-to-zero works reliably

---

## 8.6 Browserless task failure

If a pinned browserless task dies:
- run session becomes degraded
- subsequent calls return retriable failure
- no automatic migration to another task
- session is eventually closed and resources released

This preserves the invariant:
- no silent rebinding / no broken isolation

---

## 8.7 Restart behavior for `openclaw-browser`

For v1:
- allocator state is in memory
- `openclaw-browser` is single replica

On restart:
- it should list browserless tasks it previously launched
- identify them via `startedBy=openclaw-browser` or equivalent metadata
- stop those orphan tasks
- do not attempt to reconstruct live browser session ownership

This is intentionally conservative and correct for v1.

---

# 9. In-memory state model

## 9.1 Per-task state
Each browserless task tracked by `openclaw-browser` should include:

- `taskArn`
- `privateIp`
- `status`
- `assignedRunIds`
- `assignedSessionCount` or derive from `assignedRunIds.size`
- `launchedAt`
- `idleSince`
- optional `lastReadyAt`

## 9.2 Per-run session state
Extend current run session state to include:

- `browserTaskArn`
- `browserTaskIp`
- `browserEndpoint`
- existing run/browser target state
- degraded state as already supported

### Chosen simplification
No explicit numbered slot bookkeeping is required in v1.
Use:
- `assignedRunIds.size < 5`

as slot availability.

---

# 10. Error semantics

## 10.1 `429`
Use when:
- total configured capacity is exhausted
- no task has free room and max task count reached

This is an admission-control error.

## 10.2 `503`
Use when:
- task launch fails
- readiness probe times out
- browserless endpoint becomes unavailable
- pinned task dies / session degrades

This is an availability/infrastructure error.

## 10.3 Retry behavior
`open-agent` should keep its existing bounded retry behavior for browser `429`s unchanged.

---

# 11. Configuration

Allocator configuration should move entirely into `openclaw-browser` env vars.

Suggested env vars:

- `AWS_REGION`
- `BROWSERLESS_ECS_CLUSTER`
- `BROWSERLESS_ECS_TASK_DEFINITION`
- `BROWSERLESS_ECS_SUBNETS`
- `BROWSERLESS_ECS_SECURITY_GROUPS`
- `BROWSERLESS_ECS_ASSIGN_PUBLIC_IP`
- `BROWSERLESS_PORT`
- `BROWSERLESS_TOKEN`
- `BROWSERLESS_SESSIONS_PER_TASK`
- `BROWSERLESS_MAX_TOTAL_SESSIONS`
- `BROWSERLESS_IDLE_SHUTDOWN_GRACE_SECONDS`
- `BROWSERLESS_LAUNCH_TIMEOUT_SECONDS`
- optional readiness poll interval env

### Current default intentions
- sessions per task: `5`
- max total sessions: `20`
- idle shutdown grace: configurable by env
- launch timeout: configurable by env

---

# 12. Observability

## v1 requirements
- structured logs
- allocator state visible through `/status`

## `/status` should expose at least
- total active browserless sessions
- total running browserless tasks
- max sessions per task
- max total sessions
- per-task summary:
  - taskArn
  - privateIp
  - status
  - assigned run count
  - launchedAt
  - idleSince
  - readiness state

CloudWatch custom metrics are optional phase 2.

---

# 13. API contract impact

## `open-agent` contract
No change for v1.

Keep:
- `POST /runs/:runId/session`
- `DELETE /runs/:runId/session`
- existing browser action endpoints
- existing `run_id` scoped behavior

This minimizes blast radius and keeps browserless details hidden inside `openclaw-browser`.

---

# 14. Code change plan by repo

## 14.1 `tailorec-backend`

### Remove
- `app/utils/browserless_service.py`
- browserless wake calls in `app/agent/services.py`
- browserless wake config fields in `app/core/config.py`
- Terraform backend env injection related to browserless wake

### Keep
- `tailorec-backend -> open-agent` integration
- no browserless ownership logic

---

## 14.2 `open-agent`

### Keep contract unchanged
No browserless task awareness added.

### Keep
- `BrowserAdapter`
- run session create/close lifecycle
- bounded `429` retry behavior

### Required changes
Small but explicit changes are expected in `open-agent`:
- review browser-service failure handling for `503` during run session creation and later browser operations
- keep `429` retry behavior intact under allocator-owned browser capacity
- update tests/mocks for session creation failures, degraded pinned-session failures, and allocator-driven browser-service behavior
- update docs/config comments to clarify that browserless ownership lives in `openclaw-browser`, not backend

### Explicit non-goals
Do **not** add any of the following to `open-agent`:
- direct ECS/AWS calls
- browserless task ARN/IP awareness
- slot allocation logic
- browserless scale-up/down logic
- session migration logic after task death

---

## 14.3 `openclaw-browser`

### Add
A new allocator / pool manager, e.g.
- `src/adapters/browser/ecs-browserless-pool.adapter.ts`
- or `src/core/services/browserless-capacity.service.ts`

Responsibilities:
- launch ECS task
- wait for readiness
- extract private IP
- assign run to task
- release run from task
- stop idle tasks
- startup orphan cleanup

### Modify
- `src/adapters/browser/remote.browser-runtime.adapter.ts`
  - replace no-op behavior with allocator-backed provisioning/release

- `src/core/ports/browser-runtime.port.ts`
  - extend runtime metadata to include task identity and endpoint details

- `src/api/context/browser.context.ts`
  - replace flat browserless session-cap check with allocator-backed capacity logic
  - integrate release on all cleanup paths

- `src/config/*`
  - add allocator env/config validation and loading

- `src/main.ts`
  - wire allocator into runtime creation
  - expose status visibility

---

# 15. Infra / Terraform changes

## Remove old model
Since you chose full replacement:
- remove browserless ECS service
- remove browserless autoscaling target/policies
- remove backend browserless wake env/config
- remove backend IAM for browserless service scaling if no longer needed

## Reuse
- existing browserless ECS task definition

## Add / move IAM to `openclaw-browser`
Grant browser-provider/openclaw task role permissions for:
- `ecs:RunTask`
- `ecs:DescribeTasks`
- `ecs:StopTask`
- `ecs:ListTasks`
- `iam:PassRole`

## Pass envs to `openclaw-browser`
Allocator configuration moves there directly.

---

# 16. Deployment model

You chose a **full replacement model**, not gradual coexistence.

## Deployment intent
- remove old backend browserless wake model
- remove old browserless service control path
- remove old browserless ECS service from Terraform
- deploy only the new allocator model

## Important rule
There should **not** be a period where:
- backend wake logic and
- `openclaw-browser` allocator

are both actively controlling browserless in production.

## Rollback posture
Even though active runtime coexistence is not wanted:
- preserve rollback ability in code/infra history
- old model can be restored if needed
- but not run concurrently in steady state

---

# 17. Risks

## 17.1 Single replica dependency
Because state is in memory:
- `openclaw-browser` must remain single replica in v1

## 17.2 Cold-start latency
Sessions 1, 6, 11, and 16 may incur cold-start latency when a new browserless task is needed.

Accepted for v1.

## 17.3 Restart kills active sessions
Chosen intentionally for correctness:
- startup orphan cleanup stops old allocator-managed tasks
- in-flight runs must retry/recover upstream

## 17.4 No silent migration on failure
Task death causes session failure rather than migration.
This is correct for isolation, but may feel stricter operationally.

---

# 18. Future enhancements

Not part of v1, but natural next steps:

- Redis/Postgres-backed allocator state for HA
- multi-replica `openclaw-browser`
- prewarming next browserless task near saturation
- CloudWatch custom metrics
- persisted allocator observability/audit metadata
- smarter session recovery flows

---

# 19. Acceptance criteria

The implementation is complete when all of the following are true:

1. `tailorec-backend` contains no browserless wake/scale control
2. `open-agent` still works through the same browser-service contract
3. `openclaw-browser` launches browserless ECS tasks directly
4. browserless task selection follows strict 5-session packing
5. total active browserless sessions are capped at 20
6. run sessions remain pinned to one browserless task for their lifetime
7. all subsequent browser actions for a run use the same task endpoint
8. idle browserless tasks are stopped after configured grace period
9. zero active runs leads to zero browserless tasks
10. `openclaw-browser` restart cleans up orphan allocator-launched browserless tasks
11. `429` vs `503` semantics behave as specified
12. `/status` exposes allocator state sufficiently for debugging
13. old browserless ECS service model is removed

---

# 20. Final proposal summary

## Proposed final architecture
Replace the old backend-driven browserless service wake model with a new allocator-owned model inside `openclaw-browser`.

### Core characteristics
- direct ECS task control from `openclaw-browser`
- strict run-to-task pinning
- 5 sessions per task
- 20 total sessions
- 4 max tasks
- scale-to-zero
- no browserless ownership in backend
- unchanged `open-agent` contract

This is the cleanest design for your stated behavior and creates the correct long-term ownership boundary.
