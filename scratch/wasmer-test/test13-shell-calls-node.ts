// Test 13: Shell script that calls `node`
// Can we intercept a `node` call from within a WASM shell?
//
// This test demonstrates the problem: @wasmer/sdk bash cannot call
// external commands like `node` because there's no way to intercept
// the exec/spawn syscalls.

import { init, Wasmer, Directory } from "@wasmer/sdk/node";

async function main(): Promise<void> {
  console.log("Test 13: Shell Script Calling Node");
  console.log("===================================\n");

  await init();

  // Create a test script that calls node
  const dir = new Directory();
  await dir.writeFile(
    "/test.sh",
    `#!/bin/bash
echo "Starting test.sh"
echo "About to call node..."
node -e "console.log('Hello from Node.js!')"
echo "Done with node call"
`
  );

  // Also create a JS file to run
  await dir.writeFile(
    "/script.js",
    `console.log("Hello from script.js!");
console.log("Process argv:", process.argv);
`
  );

  console.log("Created test.sh and script.js in virtual filesystem\n");

  // Load bash from wasmer registry
  console.log("Loading bash from wasmer registry...");
  const bashPkg = await Wasmer.fromRegistry("sharrattj/bash");
  console.log("Bash loaded\n");

  // Test 13a: Try to run test.sh directly
  console.log("--- Test 13a: Run test.sh via bash ---\n");
  console.log("Command: bash /app/test.sh");
  console.log("(This will fail because 'node' is not available in WASM)\n");

  try {
    const instance = await bashPkg.entrypoint!.run({
      args: ["/app/test.sh"],
      mount: { "/app": dir },
    });

    const result = await Promise.race([
      instance.wait(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout after 5s")), 5000)
      ),
    ]);

    console.log("Exit code:", result.code);
    console.log("Stdout:", result.stdout);
    console.log("Stderr:", result.stderr);
  } catch (e: unknown) {
    const err = e as Error;
    console.log("Result:", err.message);
  }

  // Test 13b: Try inline node call
  console.log("\n--- Test 13b: Inline node -e call ---\n");
  console.log('Command: bash -c \'node -e "console.log(1)"\'');
  console.log("(This will also fail)\n");

  try {
    const instance = await bashPkg.entrypoint!.run({
      args: ["-c", 'node -e "console.log(1)"'],
      mount: { "/app": dir },
    });

    const result = await Promise.race([
      instance.wait(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout after 5s")), 5000)
      ),
    ]);

    console.log("Exit code:", result.code);
    console.log("Stdout:", result.stdout);
    console.log("Stderr:", result.stderr);
  } catch (e: unknown) {
    const err = e as Error;
    console.log("Result:", err.message);
  }

  // Test 13c: Check if we can see the error message
  console.log("\n--- Test 13c: Check error for missing node ---\n");
  console.log("Command: bash -c 'which node || echo node not found'");

  try {
    const instance = await bashPkg.entrypoint!.run({
      args: ["-c", "which node || echo 'node: command not found'"],
      mount: { "/app": dir },
    });

    const result = await Promise.race([
      instance.wait(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout after 5s")), 5000)
      ),
    ]);

    console.log("Exit code:", result.code);
    console.log("Stdout:", result.stdout);
    console.log("Stderr:", result.stderr);
  } catch (e: unknown) {
    const err = e as Error;
    console.log("Result:", err.message);
  }

  // Test 13d: Try mounting a fake node script
  console.log("\n--- Test 13d: Mount fake /usr/bin/node script ---\n");

  const binDir = new Directory();
  await binDir.writeFile(
    "/node",
    `#!/bin/bash
echo "[INTERCEPTED] node called with args: $@"
echo "[INTERCEPTED] Would forward to real Node.js here"
`
  );

  console.log("Mounted fake node script at /usr/bin/node");
  console.log("Command: bash -c 'chmod +x /usr/bin/node && /usr/bin/node script.js'");

  try {
    const instance = await bashPkg.entrypoint!.run({
      args: [
        "-c",
        "chmod +x /usr/bin/node && /usr/bin/node /app/script.js arg1 arg2",
      ],
      mount: {
        "/app": dir,
        "/usr/bin": binDir,
      },
    });

    const result = await Promise.race([
      instance.wait(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout after 5s")), 5000)
      ),
    ]);

    console.log("Exit code:", result.code);
    console.log("Stdout:", result.stdout);
    console.log("Stderr:", result.stderr);
  } catch (e: unknown) {
    const err = e as Error;
    console.log("Result:", err.message);
  }

  // Test 13e: Use source instead of exec
  console.log("\n--- Test 13e: Source the fake node script ---\n");
  console.log("Command: bash -c 'source /usr/bin/node'");

  try {
    const instance = await bashPkg.entrypoint!.run({
      args: ["-c", "source /usr/bin/node /app/script.js"],
      mount: {
        "/app": dir,
        "/usr/bin": binDir,
      },
    });

    const result = await Promise.race([
      instance.wait(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout after 5s")), 5000)
      ),
    ]);

    console.log("Exit code:", result.code);
    console.log("Stdout:", result.stdout);
    console.log("Stderr:", result.stderr);
  } catch (e: unknown) {
    const err = e as Error;
    console.log("Result:", err.message);
  }

  console.log("\n=== Summary ===\n");
  console.log("Test 13 demonstrates the core problem:");
  console.log("1. @wasmer/sdk bash cannot execute external 'node' command");
  console.log("2. Mounting a fake /usr/bin/node script times out on exec");
  console.log("3. 'source' works for shell scripts but can't run real Node.js");
  console.log("");
  console.log("Conclusion: To run 'node' from shell scripts, we need:");
  console.log("  - A custom WASM shell with bridge imports (test12 approach)");
  console.log("  - OR hybrid routing at the JS level (not through WASM shell)");
}

main().catch(console.error);
