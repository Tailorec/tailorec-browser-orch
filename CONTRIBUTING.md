# Contributing

Thanks for improving Tailorec Browser Service. Changes should preserve the run-isolation contract and keep documentation traceable to shipped behavior.

## Development setup

```bash
git clone git@github.com:Tailorec/tailorec-browser-orch.git
cd tailorec-browser-orch
npm ci
npx playwright install chromium
cp .env.example .env
npm run check
npm run test
```

Use `npm run dev` for local development. The default provider launches local Chromium when a run session is created.

## Repository layout

```text
src/
├── api/          # HTTP context, routes, controllers, middleware, validation
├── core/         # Entities, ports, services, and use cases
├── adapters/     # Express, Playwright, Chrome, Browserless/ECS, logging
├── config/       # Environment loading and validation
├── container/    # Dependency composition
├── shared/       # Errors, types, and utilities
└── __tests__/    # Unit, integration, contract, E2E, fixtures, helpers
```

Keep dependencies pointing inward: core code must not import transport or provider implementations. Add new infrastructure behind a port when domain/application code needs it.

## Change workflow

1. Open an issue or describe the observable problem and intended contract.
2. Add or update the lowest-level test that proves the change.
3. Implement the smallest coherent change without weakening ownership checks.
4. Update API, config, operations, or architecture docs in the same pull request.
5. Run the verification matrix below.
6. Keep commits focused and explain behavior changes in the pull request.

## Verification matrix

| Change | Required checks |
|---|---|
| Documentation only | Link check, example review, `npm run check` when API claims changed |
| Pure utility/config | Focused unit tests, `npm run test:unit`, `npm run check` |
| Route/controller | Focused integration and contract tests, `npm run check` |
| Session ownership/capacity | Integration/contract tests and `npm run test:gate:run-isolation` |
| Playwright/browser behavior | Focused unit/integration tests and affected E2E specs |
| Public API or error shape | Contract tests and all affected documentation |

Before requesting review, run:

```bash
npm run check
npm run test
```

Run `npm run test:e2e` when the change reaches a real browser. Playwright must have Chromium installed.

## Design invariants

Changes must preserve these rules unless an approved design explicitly replaces them:

- Every browser operation is scoped by a non-empty `run_id`.
- A target owned by one run cannot be used by another.
- A session must exist before navigation, snapshot, action, media, or hook calls.
- Unknown or conflicting ownership fails closed; it never picks a fallback page.
- Browserless credentials and endpoint query values are not emitted in diagnostics.
- Session cleanup happens on success, cancellation, timeout, and failure paths.
- Public contract changes include tests and docs.

## Documentation style

- Put tutorials and task steps in `docs/getting-started` or `docs/operations`.
- Put exact request/response contracts in `docs/api-reference`.
- Put design rationale and trade-offs in `docs/architecture`.
- Use Mermaid only when it makes data flow, lifecycle, state, or ownership clearer.
- Use placeholders in examples; never commit real endpoints, tokens, resumes, or user data.
- Verify every relative link from the file that contains it.

## Pull requests

Include:

- the user-visible or operator-visible problem
- the chosen behavior and alternatives considered
- tests run and their results
- API/config compatibility notes
- rollout or recovery steps for operational changes

Do not mix unrelated formatting or refactors into a behavioral pull request.

## Security issues

Do not open a public issue for a suspected vulnerability. Follow [SECURITY.md](./SECURITY.md).
