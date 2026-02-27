## ADDED Requirements

### Requirement: Compatibility Project Matrix Uses Black-Box Node Fixtures
Compatibility validation for sandboxed-node SHALL execute fixture projects that behave as ordinary Node projects, with no sandbox-aware code paths.

#### Scenario: Fixture uses only Node-project interfaces
- **WHEN** a fixture is added under the compatibility project matrix
- **THEN** it MUST define a standard Node project structure (`package.json` + source entrypoint) and MUST NOT import sandbox runtime internals directly

#### Scenario: Runtime remains opaque to fixture identity
- **WHEN** sandboxed-node executes a compatibility fixture
- **THEN** runtime behavior MUST NOT branch on fixture name, fixture path, or test-specific markers

### Requirement: Compatibility Matrix Enforces Differential Parity Checks
The compatibility project matrix SHALL execute each fixture in host Node and in sandboxed-node, then compare normalized externally visible outcomes.

#### Scenario: Pass fixture requires parity
- **WHEN** a fixture is classified as pass-expected
- **THEN** the matrix MUST fail unless host Node and sandboxed-node produce matching normalized `code`, `stdout`, and `stderr`

#### Scenario: Fail fixture requires deterministic failure contract
- **WHEN** a fixture is classified as fail-expected for unsupported behavior
- **THEN** the matrix MUST fail unless sandboxed-node produces the documented deterministic error contract

### Requirement: Compatibility Matrix Uses Persistent Fixture Install Cache
Fixture dependency installation SHALL be cached across repeated test invocations using a persistent content hash.

#### Scenario: Unchanged fixture reuses cached install
- **WHEN** fixture inputs and cache key factors are unchanged
- **THEN** matrix preparation MUST reuse the existing prepared fixture directory and skip reinstall

#### Scenario: Changed fixture invalidates cache
- **WHEN** fixture files or cache key factors change
- **THEN** the matrix MUST prepare a new cache entry and reinstall dependencies before execution

### Requirement: Parity Mismatches Remain Failing Until Resolved
Compatibility project-matrix policy SHALL NOT include a "known mismatch" or equivalent pass-through state for parity failures.

#### Scenario: Detected parity mismatch
- **WHEN** a fixture marked pass-expected fails parity comparison
- **THEN** the test result MUST remain failing and MUST be addressed by runtime or bridge fixes rather than fixture reclassification
