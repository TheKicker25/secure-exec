## Context

`sandboxed-node` currently validates compatibility mostly through inline runtime snippets and targeted bridge tests. This is fast, but it under-represents real package behaviors that depend on package manager install topology, package `exports` maps, and full project entrypoint execution.

The project already has a practical loader/runner pattern in `examples/hono` that uses a real project (`package.json` + source) copied into a temp directory and installed before execution. The same pattern can be generalized into a compatibility project matrix for automated parity checks.

Key constraints:
- Node compatibility expectations are canonical in OpenSpec baseline specs.
- Test runs must stay practical for local iteration (timeouts under one minute per invocation).
- Compatibility projects must remain black-box and avoid sandbox-aware logic.

## Goals / Non-Goals

**Goals:**
- Run compatibility fixtures as real Node projects with their own dependencies and entrypoints.
- Compare host-Node and sandboxed-node outcomes for each fixture using consistent parity assertions.
- Reuse fixture installs across repeated `vitest` runs through a persistent hash-based cache.
- Enforce fail-until-fixed behavior with no "known mismatch" skip class.
- Prevent fixture/runtime coupling by codifying black-box boundaries.

**Non-Goals:**
- Implementing network-dependent end-to-end tests against public services.
- Adding fixture-specific behavior in sandbox runtime internals.
- Solving every historical compatibility gap in the same change.
- Replacing existing focused unit tests in `tests/index.test.ts` and `tests/types/`.

## Decisions

### Decision: Add a dedicated compatibility project matrix under tests/projects
Fixtures will live under `packages/sandboxed-node/tests/projects/<fixture-name>/` with at least:
- `package.json`
- `src/` entrypoint code
- fixture config describing entry path and expected policy (`pass` or `fail`)

Rationale:
- Keeps compatibility cases realistic and self-contained.
- Mirrors real user project layout and dependency resolution.

Alternatives considered:
- Inline code strings in test files: simpler but misses package-manager/module-resolution realism.
- Reusing `examples/` directly: examples are documentation-first and not stable as strict compatibility fixtures.

### Decision: Use persistent hash-keyed install cache across Vitest runs
Prepared fixture directories will be stored under a persistent cache root in `packages/sandboxed-node/.cache/`.
Cache keys will include fixture contents and environment factors that affect install validity (Node major, pnpm version, platform/arch, lockfile).

Rationale:
- Removes repetitive `copy + pnpm install` costs on subsequent runs.
- Keeps implementation small compared to global content-addressable fixture orchestration.

Alternatives considered:
- Install once per test run only (`beforeAll`): helps one run but not repeated local runs.
- Always reinstall in temp dir: simplest but too slow for iterative compatibility work.

### Decision: Differential execution is the primary assertion model
Each fixture will run in:
1) host Node
2) sandboxed-node

Parity assertions compare normalized result envelopes (`code`, `stdout`, `stderr`, and selected error text).

Rationale:
- Keeps tests "blind" to implementation details and measures externally visible behavior.
- Catches ordering/async semantics gaps that isolated unit assertions can miss.

Alternatives considered:
- Sandbox-only expected outputs: can encode sandbox quirks and reduce pressure toward Node parity.

### Decision: Enforce black-box and fail-until-fixed policy in harness metadata
Fixture schema will not include any `knownMismatch` state.
Accepted expectations are only:
- `pass`: parity required
- `fail`: deterministic failure required (for explicitly unsupported capabilities)

Harness checks will reject fixture metadata that attempts sandbox-tailored execution paths.
Contributor docs (`CLAUDE.md`) will codify this policy.

Rationale:
- Prevents compatibility debt from being normalized into a third status.
- Keeps pressure aligned with "Node 1:1 as practical".

## Risks / Trade-offs

- **[Risk] Cache staleness due to missing key inputs** -> **Mitigation:** include lockfile/toolchain/platform inputs in hash and use a `.ready` marker only after successful install.
- **[Risk] Cached fixture mutation during test execution** -> **Mitigation:** require fixtures to avoid writing into project directories; direct writable outputs to OS temp locations.
- **[Risk] Slower cold-start CI runs with many fixtures** -> **Mitigation:** start with a small curated matrix and keep per-test concurrency bounded.
- **[Risk] Brittle parity compares from path/timing noise** -> **Mitigation:** normalize temp paths and other unstable substrings before assertion.

## Migration Plan

1. Introduce harness utilities for fixture discovery, cache-key computation, cache preparation, and dual runtime execution.
2. Add an initial fixture set (small, representative common-library projects).
3. Add policy checks and docs updates (`CLAUDE.md`, friction/process notes as needed).
4. Roll additional fixtures incrementally as compatibility gaps are fixed.

Rollback:
- Disable the project-matrix test file and remove fixture cache usage without affecting existing targeted runtime tests.

## Open Questions

- Should fixture metadata allow per-fixture permission presets, or should permissions be globally fixed for this matrix?
- Do we pin per-fixture lockfiles immediately, or rely on package.json + global lock strategy for v1?
