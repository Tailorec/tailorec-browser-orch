# Test Suite README

This directory contains the repository test suites and the support code used by them.

## Layout

```text
src/__tests__/
├── unit/
├── integration/
├── contract/
├── e2e/
├── helpers/
├── factories/
├── fixtures/
└── __mocks__/
```

## What Each Suite Covers

- `unit/`: local logic, helpers, adapters, config, and controller behavior
- `integration/`: route/controller/use-case integration behavior
- `contract/`: externally visible response and header contracts
- `e2e/`: Playwright-driven end-to-end browser workflows

## Commands

```bash
npm run test
npm run test:unit
npm run test:integration
npm run test:contract
npm run test:e2e
npm run test:coverage
```

## Helper Docs

- [Test Helpers](./HELPERS.md)
- [Test Contributing Guide](./TEST-CONTRIBUTING.md)
- [Testing Overview](../../docs/testing/overview.md)

## Notes

- prefer contract tests for public API guarantees
- prefer integration tests for controller routing and validation behavior
- use E2E coverage only where a real browser flow is required
