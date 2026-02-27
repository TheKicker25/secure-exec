## 1. Project-Matrix Harness

- [x] 1.1 Add a dedicated Vitest project-matrix runner under `packages/sandboxed-node/tests/` that discovers fixture projects from `tests/projects/`
- [x] 1.2 Define fixture metadata schema with only `pass` and `fail` expectations (no known-mismatch state)
- [x] 1.3 Implement differential execution for each fixture in host Node and sandboxed-node with normalized parity assertions (`code`, `stdout`, `stderr`)

## 2. Persistent Fixture Install Cache

- [x] 2.1 Implement persistent cache directory management under `packages/sandboxed-node/.cache/` for prepared fixture projects
- [x] 2.2 Implement stable cache-key hashing from fixture inputs plus install-affecting factors (lockfile/package manifests, Node major, pnpm version, platform/arch)
- [x] 2.3 Implement cache hit/miss flow with `.ready` marker semantics and `pnpm install --ignore-workspace --prefer-offline` for misses

## 3. Black-Box Fixture Projects

- [x] 3.1 Add an initial pass fixture project for a common library package (for example `semver`) using real `package.json` + source entrypoint
- [x] 3.2 Add an initial pass fixture project for env/filesystem-driven behavior (for example `dotenv`) using real project layout
- [x] 3.3 Add an initial deterministic-fail fixture for unsupported capability behavior (for example `net`/`tls`) and assert documented error contract

## 4. Policy and Documentation

- [x] 4.1 Update `CLAUDE.md` with explicit black-box compatibility-test policy (fixtures sandbox-blind, runtime fixture-opaque)
- [x] 4.2 Document the fail-until-fixed parity policy in compatibility-facing docs (no known-mismatch bypass classification)
- [x] 4.3 Update `docs-internal/friction/sandboxed-node.md` with any encountered setup/perf friction and mitigation notes from the new harness work

## 5. Validation

- [x] 5.1 Run the new project-matrix Vitest target and verify cache-hit behavior on repeated runs
- [x] 5.2 Run targeted `sandboxed-node` regression tests that overlap changed harness/utilities and fix any regressions before completion
