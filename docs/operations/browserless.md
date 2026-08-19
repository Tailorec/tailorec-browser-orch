# How to operate Browserless workers

This guide configures either a fixed Browserless endpoint or allocator-owned AWS ECS/Fargate workers and shows how to verify capacity and cleanup.

## Prerequisites

- A reachable Browserless-compatible CDP/WebSocket endpoint
- Private network routing from this service to Browserless
- For dynamic workers: an ECS cluster, Fargate-compatible task definition, subnets, security groups, and AWS credentials available through the standard SDK chain
- IAM permissions for the operations used by the adapter: run, describe, list, and stop ECS tasks, plus task-role passing/tagging as required by your task definition and account policy

## Fixed endpoint

Set the provider and endpoint:

```dotenv
BROWSER_PROVIDER=browserless
BROWSER_ENDPOINT=wss://browserless.internal.example?token=YOUR_TOKEN
BROWSER_BROWSERLESS_SESSIONS_PER_WORKER=5
BROWSER_BROWSERLESS_MAX_TOTAL_SESSIONS=20
```

Without a complete ECS configuration, the in-memory allocator manages assignments against this provider.

Start and verify:

```bash
npm run build
npm start
curl -sS http://127.0.0.1:4000/status
```

Confirm `provider` is `browserless` and the endpoint is redacted.

## Dynamic ECS workers

Add all four activation fields plus networking:

```dotenv
BROWSER_PROVIDER=browserless
BROWSER_ENDPOINT=ws://browserless.internal:3000
BROWSER_BROWSERLESS_ECS_CLUSTER=browser-cluster
BROWSER_BROWSERLESS_ECS_TASK_DEFINITION=browserless-worker:1
BROWSER_BROWSERLESS_ECS_SUBNETS=["subnet-0123456789abcdef0"]
BROWSER_BROWSERLESS_ECS_SECURITY_GROUPS=["sg-0123456789abcdef0"]
BROWSER_BROWSERLESS_ECS_ASSIGN_PUBLIC_IP=DISABLED
BROWSER_BROWSERLESS_PORT=3000
BROWSER_BROWSERLESS_SESSIONS_PER_WORKER=5
BROWSER_BROWSERLESS_MAX_TOTAL_SESSIONS=20
BROWSER_BROWSERLESS_IDLE_GRACE_MS=30000
```

The subnet and security-group values are JSON arrays, not comma-separated strings. Use private subnets and `DISABLED` public IP unless your network design explicitly requires otherwise.

The allocator uses the configured endpoint as a URL template, replaces its host/port with the task address, and appends `BROWSER_BROWSERLESS_TOKEN` when configured.

## Verify allocation

1. Create a run session:

   ```bash
   curl -i -X POST http://127.0.0.1:4000/runs/ops-check/session
   ```

2. Inspect service-owned state:

   ```bash
   curl -sS http://127.0.0.1:4000/status
   ```

   Check `browserless_allocator.total_assigned_runs`, worker `assigned_run_ids`, ownership tags, and unavailability fields.

3. Close the run:

   ```bash
   curl -sS -X DELETE http://127.0.0.1:4000/runs/ops-check/session
   ```

4. After the idle grace period, confirm the empty owned task stops.

On startup the service reconciles ECS tasks with its ownership tags and stops owned orphans. It does not stop tasks it cannot prove it owns.

## Capacity behavior

The allocator serializes assignment, reuses workers below per-worker capacity, and launches another worker only when needed. When `BROWSER_BROWSERLESS_MAX_TOTAL_SESSIONS` is reached, session creation returns:

```json
{
  "ok": false,
  "error": "browserless capacity exceeded",
  "code": "capacity_exceeded",
  "active": 20,
  "max": 20,
  "retry_after_seconds": 5
}
```

Honor `Retry-After`; do not spin on the endpoint.

## Readiness and degradation

The service waits for the ECS task to reach running state, then probes the browser endpoint. Readiness failures quarantine the worker so it cannot receive new runs.

If an active remote connection dies, the run becomes degraded. Requests fail with `503` until cleanup. The service does not reconnect the run to a different worker because that would violate session continuity and ownership.

## Troubleshooting

| Symptom | Check | Action |
|---|---|---|
| In-memory allocator used unexpectedly | One of the four ECS activation fields is empty | Set cluster, task definition, subnets, and security groups together |
| `failed to parse ...` on startup | Subnet/security-group value is not valid JSON | Use a JSON array of non-empty strings |
| Worker never becomes ready | ECS status, task logs, security-group ingress, port, endpoint scheme | Fix reachability; then create a new run |
| `429 capacity_exceeded` | Total and per-worker limits in `/status` | Close leaked runs or raise limits with measured capacity |
| Session becomes degraded | Browserless task/connection logs | Do not reuse the run; recover provider and start a new run |
| Idle worker remains | Assigned run IDs and idle grace | Close all sessions and verify StopTask permissions |

## Production checklist

- Keep this service and Browserless on private networks.
- Store Browserless tokens and JWT secrets in a secret manager.
- Alarm on `capacity_exceeded`, readiness failures, degraded sessions, and orphan reconciliation.
- Call session close in success, cancellation, timeout, and failure handlers.
- Size worker capacity with browser memory and CPU measurements, not just request rate.
- Treat `/status` as diagnostic state, not a public endpoint.

See [Architecture](../architecture/overview.md) for the ownership model and [Configuration](../getting-started/configuration.md) for every tuning value.
