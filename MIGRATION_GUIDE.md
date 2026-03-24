# Migration Guide

The architecture migration is complete.

This document now exists only as a short transition note so readers do not mistake older references for the current runtime model.

## Canonical Runtime Model

Use these as the authoritative references:

- `src/main.ts` as the runtime entrypoint
- `src/container/container.ts` for dependency wiring
- `src/api/routes/` for the public HTTP surface
- `docs/architecture/overview.md` for the current architecture summary
- `docs/architecture/clean-architecture.md` for layer responsibilities

## Current Entry Points

- source entry: `src/main.ts`
- package main: `dist/main.js`

## Current Layers

- `api`
- `adapters`
- `config`
- `container`
- `core`
- `shared`

## Removed From The Active Docs Set

These migration-era concepts should no longer be treated as the current operating model:

- per-worktree implementation plans
- "in progress" refactor status
- pending merge guidance
- `server.ts` as the runtime entrypoint

If you need the present architecture, read the docs under `docs/` instead of older migration references.
