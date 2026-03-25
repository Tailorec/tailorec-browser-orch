# Test Contributing Guide

## Principles

- test observable behavior, not incidental implementation detail
- keep unit tests small and deterministic
- use integration tests for route and controller behavior
- use contract tests when the response surface matters to external callers
- use E2E tests only when a real browser interaction is required

## Where To Add A Test

- `src/__tests__/unit/` for helpers, parsing, validation, and isolated modules
- `src/__tests__/integration/` for multi-module runtime behavior
- `src/__tests__/contract/` for public HTTP contract assertions
- `src/__tests__/e2e/` for real browser workflows

## Common Commands

```bash
npm run test:unit
npm run test:integration
npm run test:contract
npm run test:e2e
```

Run one file:

```bash
npx vitest run src/__tests__/unit/config.unit.test.ts
```

## Preferred Scope

Choose the lowest level that proves the behavior:

- pure utility or helper: unit
- route validation or controller dispatch: integration
- response shape or headers: contract
- browser workflow: E2E

## References

- [Testing Overview](../../docs/testing/overview.md)
- [Test Suite README](./README.md)
- [Test Helpers](./HELPERS.md)
