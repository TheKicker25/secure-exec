## Why

Current runtime tests mostly validate isolated behaviors with inline snippets, but they do not consistently exercise real Node projects with `package.json` + source entrypoints. This leaves compatibility gaps undiscovered until later and makes it easy to normalize known failures instead of fixing them.

## What Changes

- Add a compatibility project-matrix harness that runs real fixture projects (each with its own `package.json` and source files) as black-box workloads.
- Add persistent install caching keyed by fixture content and tool/runtime versions so repeated `vitest` runs avoid reinstalling unchanged fixtures.
- Run each fixture through both host Node and sandboxed-node, then compare normalized outcomes (`code`, `stdout`, `stderr`) for parity.
- Enforce strict black-box boundaries for compatibility fixtures:
  - fixtures MUST NOT contain sandbox-specific logic;
  - sandboxed-node runtime MUST NOT include fixture-specific branches or tailoring.
- Remove any "known mismatch" classification from this harness; parity failures remain failing until runtime behavior is fixed.
- Document the policy in contributor guidance (`CLAUDE.md`) and compatibility process docs.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `compatibility-governance`: add requirements for black-box compatibility project testing, persistent fixture-install caching for local iteration speed, and fail-until-fixed parity policy.

## Impact

- Affected tests: `packages/sandboxed-node/tests/` (new project-matrix harness and fixtures).
- Affected docs/process: `CLAUDE.md`, `docs-internal/friction/sandboxed-node.md`, and compatibility governance references.
- Affected tooling: fixture preparation/install workflow and cache directory under `packages/sandboxed-node/`.
