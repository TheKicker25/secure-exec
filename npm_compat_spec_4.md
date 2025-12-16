# npm Compatibility Spec - Phase 4: Remaining Issues

## Current State After Phase 3

Phase 3 implemented:
- Path.resolve polyfill with process.cwd() support
- Zlib polyfill (gunzip, gzip, deflate, inflate)
- Binary data handling with base64 encoding
- Improved HTTP stream handling

All 8 npm CLI tests pass, but with known limitations:

| Command | Status | Notes |
|---------|--------|-------|
| npm --version | ✅ Working | Returns version string |
| npm config list | ✅ Working | Shows configuration |
| npm ls | ✅ Working | Shows package tree |
| npm init -y | ✅ Working | Creates package.json |
| npm ping | ✅ Working | Registry connectivity |
| npm view | ✅ Working | Fetches package info |
| npm pack | ⚠️ Partial | Error in stderr but exits 0 |
| npm install | ⚠️ Partial | Network works, no node_modules |

## Remaining Issues

### 1. npm pack - File URL Resolution

**Symptom:**
```
npm error Invalid file: URL, must comply with RFC 8089
```

**Status:** Test passes (exit code 0) but tarball not created.

**Root Cause Analysis:**

The path.resolve patch in Phase 3 wraps the function to prepend `process.cwd()`, but the issue persists. This suggests one of:

1. **Path module loaded before patch** - The path module may be required and cached before our patch runs. The patch modifies `result.resolve` but if npm-package-arg already captured a reference to the original function, it won't see the patch.

2. **Different code path** - npm-package-arg might use a different method (like `path.join` or direct string manipulation) to construct the file URL.

3. **Caching issue** - The patched module might not be the one npm is using due to module caching.

**Debugging Steps:**

```javascript
// Add logging to verify patch is applied
if (name === 'path') {
  console.log('[DEBUG] Patching path.resolve');
  const originalResolve = result.resolve;
  result.resolve = function resolve() {
    console.log('[DEBUG] path.resolve called with:', arguments);
    // ... rest of patch
  };
}
```

**Potential Solutions:**

1. **Pre-patch approach** - Initialize the path polyfill with process.cwd baked in before any code runs:
   ```javascript
   // In process polyfill, before path is loaded:
   globalThis.__initialCwd = '/app';
   ```
   Then modify path-browserify bundle to use `__initialCwd`.

2. **Monkey-patch npm-package-arg** - Intercept the specific function that creates file specs.

3. **Transform file specs** - In the npm CLI wrapper, transform relative file specs to absolute before npm processes them.

**Files to investigate:**
- `node_modules/npm-package-arg/lib/npa.js` - How it creates file specs
- `node_modules/npm/lib/commands/pack.js` - How pack resolves the target

### 2. npm install - Incomplete Installation

**Symptom:**
```
[Network] httpRequest: https://registry.npmjs.org/is-number
node_modules exists: false
```

**Status:** Network requests work, but no files installed.

**Root Cause Analysis:**

The installation pipeline has multiple stages that may be failing silently:

```
1. Resolve package metadata ✅ (network request seen)
2. Build dependency tree ❓ (may be hanging or erroring)
3. Fetch tarballs ❌ (no .tgz requests seen)
4. Extract to node_modules ❌
5. Run lifecycle scripts ❌
```

The fact that we see the metadata request but no tarball request suggests the failure is in stage 2 or early stage 3.

**Likely Causes:**

#### 2a. Arborist Tree Building

npm uses `@npmcli/arborist` to build the dependency tree. This involves:
- Reading package-lock.json (if exists)
- Calculating ideal tree
- Diffing with actual tree

If any of these operations hang or error silently, no tarballs are requested.

**Debug:**
```javascript
// Add to test before npm install
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED]', reason);
});
```

#### 2b. Cache Operations (cacache)

npm caches packuments before proceeding. If `cacache` operations don't complete:
- Missing fs methods for cache directories
- Stream operations not completing
- Promise chains breaking

**Key cacache operations:**
- `cacache.get.info()` - Check if cached
- `cacache.put()` - Write to cache
- Uses streams internally

#### 2c. Integrity Verification (ssri)

npm verifies package integrity using `ssri`. If:
- Crypto operations fail
- Hash comparison errors silently
- The process hangs waiting for streams

**Debug:**
```javascript
// Check if crypto is working
const crypto = require('crypto');
const hash = crypto.createHash('sha512');
hash.update('test');
console.log(hash.digest('base64'));
```

#### 2d. Packument Processing

The packument (package metadata) must be fully processed:
```javascript
{
  name: "is-number",
  "dist-tags": { latest: "7.0.0" },
  versions: {
    "7.0.0": {
      dist: {
        tarball: "https://...",
        integrity: "sha512-..."
      }
    }
  }
}
```

Our mock may be missing fields that cause silent failures:
- `_id`, `_rev` - npm internal fields
- `time` - Version timestamps
- `repository`, `maintainers` - Metadata fields

### 3. Tarball Extraction Pipeline

Even if we get tarball requests working, extraction requires:

#### 3a. Gunzip Stream

```javascript
const zlib = require('zlib');
const gunzip = zlib.createGunzip();
response.pipe(gunzip);
```

Our zlib polyfill has basic gunzip but may not handle:
- Large files (chunked decompression)
- Error propagation
- Proper stream backpressure

#### 3b. Tar Extraction

npm uses `node-tar` which requires:
- Proper stream piping from gunzip
- File write operations
- Directory creation
- Permission handling

```javascript
const tar = require('tar');
tar.extract({
  cwd: 'node_modules',
  strip: 1  // Remove package/ prefix
});
```

#### 3c. Binary Data Flow

The complete flow for tarball handling:
```
HTTP Response (body as string)
    ↓
Convert to Buffer
    ↓
Pipe to gunzip stream
    ↓
Pipe to tar extractor
    ↓
Write files to node_modules
```

Each transition must preserve binary data integrity.

### 4. Async Completion

**Problem:** npm operations may hang indefinitely because:

1. **Unresolved promises** - Some internal promise never resolves
2. **Missing event emissions** - Streams don't emit 'end' or 'finish'
3. **Callback not called** - Async operations with callbacks

**Debugging Strategy:**

```javascript
// Wrap npm execution with timeout and diagnostics
const timeout = setTimeout(() => {
  console.error('[TIMEOUT] npm operation did not complete');
  console.error('Pending operations:', process._getActiveHandles?.());
}, 10000);

try {
  await npmCli(process);
} finally {
  clearTimeout(timeout);
}
```

## Implementation Priority

### Phase 4a: Debug npm pack (Medium Effort)
1. Add logging to path.resolve patch to verify it's being called
2. Trace the code path from npm pack to npm-package-arg
3. Identify exactly where the file URL is constructed
4. Fix the specific issue

### Phase 4b: Debug npm install tree building (High Effort)
1. Add unhandled rejection handlers
2. Add verbose logging to network adapter
3. Trace arborist operations
4. Identify where the process stalls

### Phase 4c: Implement full tarball flow (Very High Effort)
1. Ensure tarball requests are made
2. Return valid gzipped tarball data from mock
3. Verify gunzip stream works with real data
4. Implement/verify tar extraction
5. Test end-to-end file creation

## Test Cases to Add

```typescript
describe("npm pack debugging", () => {
  it("should trace path.resolve calls", async () => {
    // Add logging to path.resolve and verify it's called with expected args
  });

  it("should work with explicit absolute path", async () => {
    // npm pack /app instead of npm pack
  });
});

describe("npm install debugging", () => {
  it("should complete arborist tree building", async () => {
    // Verify the dependency tree is built before tarball fetch
  });

  it("should request tarballs after metadata fetch", async () => {
    // Verify .tgz URLs are requested
  });

  it("should handle tarball extraction", async () => {
    // With a real gzipped tarball, verify extraction works
  });
});

describe("stream completion", () => {
  it("should emit all events on IncomingMessage", async () => {
    // Verify data, end, close events are emitted properly
  });

  it("should complete gunzip stream", async () => {
    const zlib = require('zlib');
    const gzipped = Buffer.from('H4sIAAAAAAAAA0tMTAYAV9cQCgMAAAA=', 'base64');
    const gunzip = zlib.createGunzip();

    const chunks = [];
    gunzip.on('data', chunk => chunks.push(chunk));

    await new Promise((resolve, reject) => {
      gunzip.on('end', resolve);
      gunzip.on('error', reject);
      gunzip.end(gzipped);
    });

    expect(Buffer.concat(chunks).toString()).toBe('test');
  });
});
```

## Alternative Approaches

### Option A: Mock at Higher Level

Instead of fixing every low-level issue, mock npm's internal operations:

```javascript
// Mock pacote (npm's package fetcher)
const pacote = require('pacote');
pacote.extract = async (spec, dest, opts) => {
  // Directly create files without network/tar
  await fs.mkdir(dest, { recursive: true });
  await fs.writeFile(path.join(dest, 'package.json'), JSON.stringify({
    name: spec.name,
    version: spec.version
  }));
};
```

### Option B: Use npm Programmatic API

Instead of running npm CLI, use npm's programmatic API which may have fewer dependencies:

```javascript
const Arborist = require('@npmcli/arborist');
const arb = new Arborist({ path: '/app' });
await arb.buildIdealTree();
await arb.reify();
```

### Option C: Minimal Package Manager

Implement a minimal package manager that handles:
1. Fetch package metadata
2. Download tarball
3. Extract to node_modules
4. Update package-lock.json

This bypasses npm's complexity while achieving the same result.

## References

- @npmcli/arborist: https://github.com/npm/arborist
- pacote: https://github.com/npm/pacote
- cacache: https://github.com/npm/cacache
- node-tar: https://github.com/npm/node-tar
- npm-package-arg: https://github.com/npm/npm-package-arg
- ssri: https://github.com/npm/ssri
