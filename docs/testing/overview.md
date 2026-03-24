# Testing Overview

The repository test suite is organized by behavior and contract coverage rather than by migration stage.

## Test Pyramid

```text
        /\
       /  \      E2E
      /----\
     /      \    Integration / Contract
    /--------\
   /          \  Unit
  /------------\
```

## Frameworks

### Vitest

Used for:

- unit tests
- integration tests
- contract tests

### Playwright Test

Used for:

- end-to-end browser workflows
- smoke scenarios
- regression coverage on real browser behavior

## Test Categories

### Unit

Location: `src/__tests__/unit/`

Use for:

- config parsing
- utility functions
- controller/runtime helpers
- adapter-local logic
- token and websocket helpers

### Integration

Location: `src/__tests__/integration/`

Use for:

- route/controller integration
- validation behavior
- service interactions across modules
- snapshot, status, and control flows

### Contract

Location: `src/__tests__/contract/`

Use for:

- public response shapes
- header contracts
- error contract consistency
- externally visible API behavior

### E2E

Location: `src/__tests__/e2e/`

Use for:

- real browser workflows
- smoke, regression, concurrency, and recovery scenarios
- fixture-backed end-to-end coverage

## Commands

```bash
npm run test
npm run test:unit
npm run test:integration
npm run test:contract
npm run test:e2e
npm run test:coverage
```

Coverage scripts retained in `package.json`:

- `npm run test:coverage:phase1`
- `npm run test:coverage:phase2`
- `npm run test:coverage:phase3`

## Testing Guidance

- prefer unit tests for isolated logic
- prefer integration tests for route/controller behavior
- prefer contract tests when the caller-visible surface matters
- use E2E only when a real browser or workflow is required
