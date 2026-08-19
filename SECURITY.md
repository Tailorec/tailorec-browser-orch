# Security policy

## Reporting a vulnerability

Do not disclose suspected vulnerabilities in a public issue, discussion, or pull request.

Use GitHub's private vulnerability reporting or security-advisory flow for this repository when available. If that channel is unavailable, contact a repository maintainer privately through the organization and include:

- affected commit or version
- impact and realistic attack path
- minimal reproduction steps
- whether secrets or personal data may be exposed
- any temporary mitigation you have verified

Do not include live credentials, production Browserless endpoints, JWTs, resumes, or other personal data in the report.

## Supported versions

This repository does not currently publish a maintained release train. Security fixes target the latest commit on the default branch. Older commits and forks are not supported unless a maintainer states otherwise.

## Deployment security

The browser service can control a real browser and process uploads. Treat it as privileged infrastructure.

- Keep HTTP execution routes on a private network or behind an authenticated, authorized gateway. They do not implement application-level authentication inside this service.
- Restrict who can mint control JWTs. Tokens must be short-lived and scoped to `browser:control` with `token_type=agent_browser_control`.
- Store `AGENT_RUNTIME_JWT_SECRET`, Browserless tokens, and AWS credentials in a secret manager.
- Use distinct secrets and AWS roles per environment.
- Restrict ECS roles to the required cluster, task definitions, network resources, and task operations.
- Run Chromium without `BROWSER_NO_SANDBOX` whenever the environment supports sandboxing.
- Limit outbound network access if workflows do not need the open internet.
- Enforce request-size, upload-size, rate, and concurrency limits at the gateway.
- Call run-session cleanup on all terminal paths and monitor leaked capacity.
- Do not expose `/status` publicly; it is intended for trusted diagnostics.
- Keep Node.js, Playwright, Chromium images, and AWS SDK dependencies patched.

## Sensitive data

Snapshots, screenshots, logs, uploaded files, and downloaded files may contain credentials or personal information. Production deployments should define retention, access, encryption, and deletion policies for each artifact.

The service redacts browser endpoint credentials in status/log output, but callers are still responsible for avoiding sensitive values in URLs, correlation IDs, run IDs, and application-level logs.

## Security boundaries

Run/session and target ownership prevent one in-process workflow from taking another run's tab. This is an application isolation boundary, not a substitute for host, container, network, tenant, or cloud-account isolation. Ownership state is process-local and is not durable across restarts.

See [Architecture](./docs/architecture/overview.md) for the full trust model.
