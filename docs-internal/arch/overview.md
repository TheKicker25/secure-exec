# Architecture Overview

```
  NodeRuntime / PythonRuntime
  packages/secure-exec-core/
         │
    ┌────┴─────┬──────────┐
    │          │          │
  Node      Browser    Python
  packages/ packages/  packages/
  secure-   secure-    secure-
  exec-     exec-      exec-
  node/     browser/   python/

Package index:

  @secure-exec/core        packages/secure-exec-core/
    Shared types, utilities, bridge, NodeRuntime/PythonRuntime classes,
    isolate-runtime source, build scripts

  @secure-exec/node        packages/secure-exec-node/
    V8 isolate execution driver, bridge-loader, module-access overlay,
    createNodeDriver, createNodeRuntimeDriverFactory

  @secure-exec/browser     packages/secure-exec-browser/
    Web Worker execution driver, createBrowserDriver,
    createBrowserRuntimeDriverFactory

  @secure-exec/python      packages/secure-exec-python/
    Pyodide execution driver, createPyodideRuntimeDriverFactory

  @secure-exec/typescript  packages/secure-exec-typescript/
    Optional TypeScript compiler tools (type-checking, compilation)

  secure-exec              packages/secure-exec/
    Barrel re-export layer (re-exports core, node, browser, python)
```

## NodeRuntime / PythonRuntime

`packages/secure-exec-core/src/runtime.ts`, `packages/secure-exec-core/src/python-runtime.ts`

Public APIs. Thin facades that delegate orchestration to execution drivers.

- `NodeRuntime.run(code)` — execute JS module, get exports back
- `PythonRuntime.run(code)` — execute Python and return structured value/global wrapper
- `exec(code)` — execute as script, get exit code/error contract
- `dispose()` / `terminate()`
- Requires both:
  - `systemDriver` for runtime capabilities/config
  - runtime-driver factory for execution-driver construction

## SystemDriver

`packages/secure-exec-core/src/types.ts`

Config object that bundles what the isolate can access. Deny-by-default.

- `filesystem` — VFS adapter
- `network` — fetch, DNS, HTTP
- `commandExecutor` — child processes
- `permissions` — per-adapter allow/deny checks

## NodeRuntimeDriverFactory / PythonRuntimeDriverFactory

`packages/secure-exec-core/src/runtime-driver.ts`

Factory abstraction for constructing execution drivers from normalized runtime options.

- `createRuntimeDriver(options)` — returns an execution driver

### createNodeDriver()

`packages/secure-exec-node/src/driver.ts`

Factory that builds a `SystemDriver` with Node-native adapters.

- Wraps filesystem in `ModuleAccessFileSystem` (read-only `node_modules` overlay)
- Optionally wires up network and command executor

### createNodeRuntimeDriverFactory()

`packages/secure-exec-node/src/driver.ts`

Factory that builds a Node-backed execution driver factory.

- Constructs `NodeExecutionDriver` instances
- Owns optional Node-specific isolate creation hook

### createBrowserDriver()

`packages/secure-exec-browser/src/driver.ts`

Factory that builds a browser `SystemDriver` with browser-native adapters.

- Uses OPFS or in-memory filesystem adapters
- Uses fetch-backed network adapter with deterministic `ENOSYS` for unsupported DNS/server paths
- Applies permission wrappers before returning the driver

### createBrowserRuntimeDriverFactory()

`packages/secure-exec-browser/src/runtime-driver.ts`

Factory that builds a browser-backed execution driver factory.

- Validates and rejects Node-only runtime options
- Constructs `BrowserRuntimeDriver` instances
- Owns worker URL/execution-driver creation options

### createPyodideRuntimeDriverFactory()

`packages/secure-exec-python/src/driver.ts`

Factory that builds a Python-backed execution driver factory.

- Constructs `PyodideRuntimeDriver` instances
- Owns Pyodide worker bootstrap and execution-driver creation options

## NodeExecutionDriver

`packages/secure-exec-node/src/execution-driver.ts`

The engine. Owns the `isolated-vm` isolate and bridges host capabilities in.

- Creates contexts, compiles ESM/CJS, runs code
- Bridges fs, network, child_process, crypto, timers into the isolate via `ivm.Reference`
- Caches compiled modules and resolved formats per isolate
- Enforces payload size limits on bridge transfers

## BrowserRuntimeDriver

`packages/secure-exec-browser/src/runtime-driver.ts`

Browser execution driver that owns worker lifecycle and message marshalling.

- Spawns and manages the browser runtime worker
- Dispatches `run`/`exec` requests and correlates responses by request ID
- Streams optional stdio events to host hooks without runtime-managed output buffering
- Exposes the configured browser network adapter through `NodeRuntime.network`

### Browser Worker Runtime

`packages/secure-exec-browser/src/worker.ts`

Worker-side runtime implementation used by the browser execution driver.

- Initializes browser bridge globals and runtime config from worker init payload
- Executes transformed CJS/ESM user code and returns runtime-contract results
- Uses permission-aware filesystem/network adapters in the worker context
- Preserves deterministic unsupported-operation contracts (for example DNS gaps)

## PyodideRuntimeDriver

`packages/secure-exec-python/src/driver.ts`

Python execution driver that owns a Node worker running Pyodide.

- Loads Pyodide once per runtime instance and keeps interpreter state warm across runs
- Dispatches `run`/`exec` requests and correlates responses by request ID
- Streams stdio events to host hooks without runtime-managed output buffering
- Uses worker-to-host RPC for permission-wrapped filesystem/network access through `SystemDriver`
- Restarts worker state on execution timeout to preserve deterministic recovery behavior

## TypeScript Tools

`packages/secure-exec-typescript/src/index.ts`

Optional companion package for isolated TypeScript compiler work (`@secure-exec/typescript`).

- `createTypeScriptTools(...)` — build project/source compile and typecheck helpers
- Uses a dedicated `NodeRuntime` isolate per request
- Keeps TypeScript compiler execution out of the core runtime path

## ModuleAccessFileSystem

`packages/secure-exec-node/src/module-access.ts`

Filesystem overlay that makes host `node_modules` available read-only at `/root/node_modules`.

- Blocks `.node` native addons
- Prevents symlink escapes (resolves pnpm virtual-store paths)
- Non-module paths fall through to base VFS

## Permissions

`packages/secure-exec-core/src/shared/permissions.ts`

Wraps each adapter with allow/deny checks before calls reach the host.

- `wrapFileSystem()`, `wrapNetworkAdapter()`, `wrapCommandExecutor()`
- Missing adapters get deny-all stubs

---

> **Kernel packages** (`packages/kernel/`, `packages/runtime/`, `packages/os/`) are experimental and not part of the public API. See `wasmvm/CLAUDE.md` for kernel and WasmVM architecture details.
