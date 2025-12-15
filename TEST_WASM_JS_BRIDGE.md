# WASM-JS Bridge Testing Spec

manual tests to verify @wasmer/sdk works and explore how to bridge WASM commands to JavaScript.

## 1. verify @wasmer/sdk package

first, confirm we have the right package and it works in Node.js.

```bash
mkdir wasmer-test && cd wasmer-test
pnpm init
pnpm add @wasmer/sdk
```

create `test-basic.mjs`:

```javascript
// for Node.js < 22, use: import { init, Wasmer } from "@wasmer/sdk/node"
import { init, Wasmer } from "@wasmer/sdk";

async function main() {
  console.log("initializing wasmer...");
  await init();
  console.log("wasmer initialized");

  // run a simple command from wasmer registry
  const pkg = await Wasmer.fromRegistry("sharrattj/coreutils");
  console.log("loaded coreutils package");

  const instance = await pkg.commands["echo"].run({
    args: ["hello", "from", "wasmer"]
  });

  const output = await instance.wait();
  console.log("exit code:", output.code);
  console.log("stdout:", output.stdout);
  console.log("stderr:", output.stderr);
}

main().catch(console.error);
```

run:
```bash
node test-basic.mjs
```

expected output:
```
initializing wasmer...
wasmer initialized
loaded coreutils package
exit code: 0
stdout: hello from wasmer
stderr:
```

check package version:
```bash
pnpm list @wasmer/sdk
```

## 2. test Directory filesystem

verify we can mount a virtual filesystem into WASM.

create `test-fs.mjs`:

```javascript
import { init, Wasmer, Directory } from "@wasmer/sdk";

async function main() {
  await init();

  const dir = new Directory();
  await dir.writeFile("/hello.txt", "content from javascript");

  const pkg = await Wasmer.fromRegistry("sharrattj/coreutils");

  // test cat command reading our file
  const instance = await pkg.commands["cat"].run({
    args: ["/app/hello.txt"],
    mount: { "/app": dir }
  });

  const output = await instance.wait();
  console.log("cat output:", output.stdout);

  // test ls command
  const lsInstance = await pkg.commands["ls"].run({
    args: ["-la", "/app"],
    mount: { "/app": dir }
  });

  const lsOutput = await lsInstance.wait();
  console.log("ls output:", lsOutput.stdout);
}

main().catch(console.error);
```

expected: cat shows "content from javascript", ls shows hello.txt

## 3. test bidirectional filesystem (WASM writes, JS reads)

this is the critical test - can JS read files that WASM wrote?

create `test-fs-write.mjs`:

```javascript
import { init, Wasmer, Directory } from "@wasmer/sdk";

async function main() {
  await init();

  const dir = new Directory();

  const pkg = await Wasmer.fromRegistry("sharrattj/coreutils");

  // have WASM write a file using echo + redirect
  // note: this may not work if echo doesn't support redirection
  // alternative: use a shell
  const bashPkg = await Wasmer.fromRegistry("sharrattj/bash");

  const instance = await bashPkg.entrypoint.run({
    args: ["-c", "echo 'written by wasm' > /out/test.txt"],
    mount: { "/out": dir }
  });

  await instance.wait();

  // now try to read it back from JS
  try {
    const content = await dir.readTextFile("/test.txt");
    console.log("SUCCESS: read back from JS:", content);
  } catch (e) {
    console.log("FAILED to read back:", e.message);
    console.log("this confirms the known issue - Directory may be one-way");
  }

  // also try readDir
  try {
    const entries = await dir.readDir("/");
    console.log("directory entries:", entries);
  } catch (e) {
    console.log("readDir failed:", e.message);
  }
}

main().catch(console.error);
```

## 4. test command interception (approach A: @wasmer/wasm-terminal)

test if the older wasm-terminal package provides command interception.

```bash
pnpm add @wasmer/wasm-terminal @wasmer/wasmfs
```

create `test-terminal.mjs`:

```javascript
// note: this package may be browser-only or deprecated
import WasmTerminal from "@wasmer/wasm-terminal";

async function main() {
  const fetchCommand = async ({ args, env }) => {
    console.log("intercepted command:", args);

    if (args[0] === "node") {
      // return a callback instead of WASM binary
      return async (options, wasmFs) => {
        console.log("executing node command in JS!");
        console.log("script path:", args[1]);
        return "hello from JS callback";
      };
    }

    // for other commands, would fetch from WAPM
    throw new Error("command not found: " + args[0]);
  };

  // this may fail if wasm-terminal is browser-only
  try {
    const terminal = new WasmTerminal({ fetchCommand });
    console.log("terminal created");
  } catch (e) {
    console.log("wasm-terminal failed (likely browser-only):", e.message);
  }
}

main().catch(console.error);
```

if this fails, the package is browser-only and we need alternative approaches.

## 5. test command interception (approach B: spawn callback in @wasmer/sdk)

check if @wasmer/sdk has any spawn/exec callback mechanism.

create `test-sdk-spawn.mjs`:

```javascript
import { init, Wasmer, Directory } from "@wasmer/sdk";

async function main() {
  await init();

  // check what's available on the Wasmer object
  console.log("Wasmer keys:", Object.keys(Wasmer));

  const pkg = await Wasmer.fromRegistry("sharrattj/bash");
  console.log("package keys:", Object.keys(pkg));
  console.log("entrypoint:", pkg.entrypoint);
  console.log("commands:", Object.keys(pkg.commands || {}));

  // check if there's any hook/callback mechanism
  const instance = await pkg.entrypoint.run({
    args: ["-c", "echo test"]
  });

  console.log("instance keys:", Object.keys(instance));

  // look for any spawn/fork/exec related APIs
  await instance.wait();
}

main().catch(console.error);
```

## 6. test command interception (approach C: custom /bin/node)

if no callback mechanism exists, we could potentially:
1. mount a custom `/bin/node` script
2. have it write to a special file that we poll
3. handle the "command" from JS

create `test-custom-bin.mjs`:

```javascript
import { init, Wasmer, Directory } from "@wasmer/sdk";

async function main() {
  await init();

  const bin = new Directory();
  const tmp = new Directory();

  // create a fake "node" script that writes its args to a file
  // then we could poll for that file
  await bin.writeFile("/node", `#!/bin/sh
echo "NODE_INTERCEPT:$@" > /tmp/node-request.txt
# in real impl, would wait for response
`);

  const pkg = await Wasmer.fromRegistry("sharrattj/bash");

  const instance = await pkg.entrypoint.run({
    args: ["-c", "chmod +x /bin/node && /bin/node script.js arg1 arg2"],
    mount: {
      "/bin": bin,
      "/tmp": tmp
    }
  });

  await instance.wait();

  // check if we can read the intercept file
  try {
    const request = await tmp.readTextFile("/node-request.txt");
    console.log("intercepted request:", request);
  } catch (e) {
    console.log("could not read intercept file:", e.message);
  }
}

main().catch(console.error);
```

## summary

run tests in order. document results:

| test | result | notes |
|------|--------|-------|
| 1. basic sdk | PASS | works with `@wasmer/sdk/node` import, requires tsx/pnpm |
| 2. directory read | PASS | JS writes, WASM reads via cat - works perfectly |
| 3. directory write (bidirectional) | PARTIAL | touch works (empty files), content-writing commands (cp, dd, truncate, bash redirect) hang |
| 4. wasm-terminal | FAIL | browser-only (requires window/xterm), not usable in Node.js |
| 5. sdk spawn hooks | NONE | no spawn/exec callback mechanism in SDK - designed for isolated execution |
| 6. custom /bin/node | PARTIAL | `bash -c "source /script"` works; cannot intercept real process spawns |

based on results, decide which approach to use for WASM-JS bridging.

### key findings

1. **@wasmer/sdk works in Node.js** but requires `/node` import path
2. **filesystem is one-way for content**: JS can write files that WASM reads, but WASM writing file content hangs
3. **no command interception**: SDK has no hooks for intercepting syscalls or process spawns
4. **workaround possible**: can mount custom scripts and use `bash -c "source /path"` to execute them
5. **exit code quirk**: bash WASM returns exit code 45 even on success

### recommendation

the alternative approach is recommended:

## alternative: skip wasix shell entirely

if bridging proves too difficult, consider:
- only use @wasmer/sdk for specific linux commands (ls, cat, etc)
- route `node` commands directly to NodeProcess without going through WASM
- VirtualMachine.spawn() checks command name and routes accordingly

this would simplify the architecture but lose the ability to run arbitrary shell scripts that call node.
