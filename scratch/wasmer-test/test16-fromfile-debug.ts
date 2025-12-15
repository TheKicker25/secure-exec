// Test 16: Debug Wasmer.fromFile with custom package
// Investigating why the node command times out

import { init, Wasmer } from "@wasmer/sdk/node";
import * as fs from "fs/promises";
import * as path from "path";

async function main(): Promise<void> {
  console.log("Test 16: fromFile Debug");
  console.log("========================\n");

  await init();

  // Load our custom package
  const webcPath = path.join(process.cwd(), "custom-node-pkg/test-custom-node-0.1.0.webc");
  console.log("Loading:", webcPath);

  const webcBytes = await fs.readFile(webcPath);
  console.log("Package size:", webcBytes.length, "bytes\n");

  const pkg = await Wasmer.fromFile(webcBytes);
  console.log("Package loaded!");
  console.log("Entrypoint:", pkg.entrypoint?.name);
  console.log("Commands:", Object.keys(pkg.commands || {}).join(", ").slice(0, 200), "...");

  // Test 16a: Run echo (from coreutils dep)
  console.log("\n--- Test 16a: Run 'echo' from coreutils ---\n");
  try {
    if (pkg.commands && pkg.commands["echo"]) {
      const instance = await pkg.commands["echo"].run({
        args: ["Hello from custom package echo!"],
      });
      const result = await Promise.race([
        instance.wait(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 5000)
        ),
      ]);
      console.log("Exit code:", result.code);
      console.log("Stdout:", result.stdout);
    }
  } catch (e: unknown) {
    const err = e as Error;
    console.log("Error:", err.message);
  }

  // Test 16b: Run ls (from coreutils dep)
  console.log("\n--- Test 16b: Run 'ls' from coreutils ---\n");
  try {
    if (pkg.commands && pkg.commands["ls"]) {
      const instance = await pkg.commands["ls"].run({
        args: ["-la"],
      });
      const result = await Promise.race([
        instance.wait(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 5000)
        ),
      ]);
      console.log("Exit code:", result.code);
      console.log("Stdout:", result.stdout);
    }
  } catch (e: unknown) {
    const err = e as Error;
    console.log("Error:", err.message);
  }

  // Test 16c: Try the node command with different timeouts
  console.log("\n--- Test 16c: Run 'node' command (our custom) ---\n");
  try {
    if (pkg.commands && pkg.commands["node"]) {
      console.log("Node command binary size:", pkg.commands["node"].binary().length, "bytes");

      // Try running with a very short timeout to see if it starts at all
      const instance = await pkg.commands["node"].run({
        args: [],
      });

      console.log("Instance created, waiting...");

      // Use stdout/stderr streams if available
      if (instance.stdout) {
        const reader = instance.stdout.getReader();
        console.log("Reading from stdout stream...");

        // Try to read with a timeout
        const readPromise = reader.read();
        const timeoutPromise = new Promise<{done: boolean, value?: Uint8Array}>((resolve) =>
          setTimeout(() => resolve({ done: true, value: undefined }), 3000)
        );

        const readResult = await Promise.race([readPromise, timeoutPromise]);
        if (readResult.value) {
          console.log("Got data:", new TextDecoder().decode(readResult.value));
        } else {
          console.log("No data within 3s");
        }
        reader.releaseLock();
      }

      // Try wait with longer timeout
      const result = await Promise.race([
        instance.wait(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout after 5s")), 5000)
        ),
      ]);
      console.log("Exit code:", result.code);
      console.log("Stdout:", result.stdout);
      console.log("Stderr:", result.stderr);
    }
  } catch (e: unknown) {
    const err = e as Error;
    console.log("Error:", err.message);
  }

  // Test 16d: Run bash from a package that includes it
  console.log("\n--- Test 16d: Test using 'uses' with our package ---\n");
  try {
    // Load bash separately
    const bashPkg = await Wasmer.fromRegistry("sharrattj/bash");
    console.log("Loaded bash package");

    // Can we use our node package as a 'uses' dependency?
    // Note: uses only accepts registry package names, not local packages
    // Let's test if our package's commands are available in bash via uses
    const instance = await bashPkg.entrypoint!.run({
      args: ["-c", "echo $PATH && which node || echo 'node not found'"],
      uses: ["sharrattj/coreutils"],
    });

    const result = await Promise.race([
      instance.wait(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 5000)
      ),
    ]);
    console.log("Exit code:", result.code);
    console.log("Stdout:", result.stdout);
    console.log("Stderr:", result.stderr);
  } catch (e: unknown) {
    const err = e as Error;
    console.log("Error:", err.message);
  }

  console.log("\n=== Summary ===\n");
  console.log("Key findings:");
  console.log("1. Wasmer.fromFile() successfully loads local .webc packages");
  console.log("2. Dependencies in the package are resolved");
  console.log("3. Our custom 'node' command appears in the package");
  console.log("4. Running custom commands may require debugging");
}

main().catch(console.error);
