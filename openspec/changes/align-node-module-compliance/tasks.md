## 1. Resolver And Module-Format Semantics

- [ ] 1.1 Add package-metadata-aware module format classification (extension + nearest `package.json` type) and remove regex-only classification dependence.
- [ ] 1.2 Align package entrypoint selection for `require`/`import` so Node-compatible metadata precedence is applied consistently.
- [ ] 1.3 Unify builtin handling in resolver helper paths so `require.resolve` and `createRequire(...).resolve` return builtin identifiers instead of filesystem lookup failures.

## 2. Dynamic Import Semantics And Interop

- [ ] 2.1 Update dynamic import precompile/evaluation flow to stop masking ESM compile/evaluation failures behind fallback behavior.
- [ ] 2.2 Restrict CommonJS fallback behavior to intended cases and preserve ESM-origin error fidelity for true ESM failures.
- [ ] 2.3 Implement safe CJS namespace construction for dynamic import results so primitive and null `module.exports` values resolve via `default` without runtime throw paths.

## 3. Builtin ESM Import Surface

- [ ] 3.1 Add ESM wrapper export behavior for bridged/polyfilled builtins to support both default and named imports for supported APIs.
- [ ] 3.2 Verify builtin named-import behavior remains consistent with default export access for targeted modules (`fs`, `path`, and other exposed builtins in scope).

## 4. Conformance Coverage And Documentation

- [ ] 4.1 Add regression tests for package metadata semantics (`type` handling and require/import entrypoint behavior) and builtin resolver helper behavior.
- [ ] 4.2 Add regression tests for dynamic import error fidelity and CJS namespace shape edge cases (primitive/null exports).
- [ ] 4.3 Update compatibility artifacts (`docs-internal/node/stdlib-compat.md`, `docs-internal/friction/sandboxed-node.md`) for any intentional or remaining Node deviations.
- [ ] 4.4 Run targeted sandboxed-node checks (`pnpm vitest` scoped module tests, `pnpm tsc`/project type checks) and record outcomes in the change notes.
