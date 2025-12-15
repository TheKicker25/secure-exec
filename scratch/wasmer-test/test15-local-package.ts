// Test 15: Building and Loading Local Packages
// Explore Wasmer.fromFile and Wasmer.createPackage APIs
//
// Goals:
// 1. Understand how to create a package programmatically
// 2. Load a package from a local .webc file
// 3. Create a package with dependencies on coreutils

import { init, Wasmer, Directory, wat2wasm } from "@wasmer/sdk/node";
import * as fs from "fs/promises";
import * as path from "path";

async function main(): Promise<void> {
  console.log("Test 15: Building and Loading Local Packages");
  console.log("=============================================\n");

  await init();

  // Test 15a: Inspect Wasmer static methods
  console.log("--- Test 15a: Wasmer Static Methods ---\n");
  console.log("Wasmer static properties:", Object.getOwnPropertyNames(Wasmer));
  console.log("");

  // Test 15b: Create a package that wraps bash with our script
  console.log("--- Test 15b: Wasmer.createPackage with bash dependency ---\n");
  console.log("Creating a package that wraps bash with a script...\n");

  try {
    // The manifest references existing packages via module: "namespace/package:command"
    // Pattern from Wasmer blog:
    // https://wasmer.io/posts/create-web-apps-programmatically-in-js
    const manifest = {
      command: [
        {
          // Reference bash from sharrattj/bash package
          module: "sharrattj/bash:bash",
          name: "run",
          runner: "https://webc.org/runner/wasi",
          annotations: {
            wasi: {
              "main-args": ["/src/run.sh"],
            },
          },
        },
      ],
      dependencies: {
        "sharrattj/bash": "*",
        "sharrattj/coreutils": "*",
      },
      fs: {
        "/src": {
          "run.sh": `#!/bin/bash
echo "Hello from custom package!"
echo "Listing current directory:"
ls -la
echo "Done!"
`,
        },
      },
    };

    console.log("Manifest:");
    console.log(JSON.stringify(manifest, null, 2));
    console.log("");

    const pkg = await Wasmer.createPackage(manifest as any);
    console.log("Package created!");
    console.log("Entrypoint:", pkg.entrypoint?.name);
    console.log("Commands:", Object.keys(pkg.commands || {}));

    if (pkg.commands && pkg.commands["run"]) {
      console.log("\nRunning 'run' command...");
      const instance = await pkg.commands["run"].run({
        uses: ["sharrattj/coreutils"],
      });
      const result = await Promise.race([
        instance.wait(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout after 10s")), 10000)
        ),
      ]);
      console.log("Exit code:", result.code);
      console.log("Stdout:", result.stdout);
      console.log("Stderr:", result.stderr);
    }
  } catch (e: unknown) {
    const err = e as Error;
    console.log("createPackage error:", err.message);
    console.log(err.stack?.slice(0, 800));
  }

  // Test 15c: Create a Python-based package
  console.log("\n--- Test 15c: Package with Python dependency ---\n");

  try {
    const manifest = {
      command: [
        {
          module: "wasmer/python:python",
          name: "hello",
          runner: "https://webc.org/runner/wasi",
          annotations: {
            wasi: {
              "main-args": ["-c", "print('Hello from Python in custom package!')"],
            },
          },
        },
      ],
      dependencies: {
        "wasmer/python": "3.12.9",
      },
      fs: {},
    };

    console.log("Python manifest:");
    console.log(JSON.stringify(manifest, null, 2));
    console.log("");

    const pkg = await Wasmer.createPackage(manifest as any);
    console.log("Python package created!");
    console.log("Commands:", Object.keys(pkg.commands || {}));

    if (pkg.commands && pkg.commands["hello"]) {
      console.log("\nRunning 'hello' command...");
      const instance = await pkg.commands["hello"].run({});
      const result = await Promise.race([
        instance.wait(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout after 10s")), 10000)
        ),
      ]);
      console.log("Exit code:", result.code);
      console.log("Stdout:", result.stdout);
      console.log("Stderr:", result.stderr);
    }
  } catch (e: unknown) {
    const err = e as Error;
    console.log("Python package error:", err.message);
  }

  // Test 15d: Load our custom .webc file
  console.log("\n--- Test 15d: Wasmer.fromFile (custom-node-pkg) ---\n");

  try {
    // Load our custom built package
    const webcPath = path.join(
      process.cwd(),
      "custom-node-pkg/test-custom-node-0.1.0.webc"
    );
    console.log("Loading:", webcPath);

    const webcBytes = await fs.readFile(webcPath);
    console.log("Found .webc file, size:", webcBytes.length, "bytes");

    const pkg = await Wasmer.fromFile(webcBytes);
    console.log("\nLoaded from file!");
    console.log("Entrypoint:", pkg.entrypoint?.name);
    console.log("Commands:", Object.keys(pkg.commands || {}));

    if (pkg.commands && pkg.commands["node"]) {
      console.log("\nRunning 'node' command from custom package...");
      const instance = await pkg.commands["node"].run({});
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
    console.log("fromFile error:", err.message);
    console.log(err.stack?.slice(0, 500));
  }

  // Test 15e: See if we can get the webc binary from a registry package
  console.log("\n--- Test 15e: Extract webc from registry package ---\n");

  try {
    // Load coreutils from registry
    const coreutils = await Wasmer.fromRegistry("sharrattj/coreutils");
    console.log("Loaded coreutils");
    console.log("Entrypoint:", coreutils.entrypoint?.name);
    console.log("Commands:", Object.keys(coreutils.commands || {}));

    // Check if we can access the underlying binary
    console.log("\nPackage properties:", Object.getOwnPropertyNames(coreutils));
    console.log(
      "Package prototype:",
      Object.getOwnPropertyNames(Object.getPrototypeOf(coreutils))
    );

    // Check the pkg property
    if (coreutils.pkg) {
      console.log("\npkg property:", coreutils.pkg);
      console.log("pkg hash:", coreutils.pkg.hash);
    }
  } catch (e: unknown) {
    const err = e as Error;
    console.log("Error:", err.message);
  }

  // Test 15f: Use wasmer CLI to build a package (if available)
  console.log("\n--- Test 15f: Check wasmer CLI availability ---\n");

  try {
    const { execSync } = await import("child_process");

    // Check if wasmer CLI is installed
    const version = execSync("wasmer --version", { encoding: "utf-8" });
    console.log("Wasmer CLI:", version.trim());

    // Try wasmer init help
    try {
      const initHelp = execSync("wasmer init --help 2>&1", {
        encoding: "utf-8",
      });
      console.log("\nwasmer init help (first 500 chars):");
      console.log(initHelp.slice(0, 500));
    } catch {
      console.log("wasmer init not available");
    }

    // Try wasmer package help
    try {
      const pkgHelp = execSync("wasmer package --help 2>&1", {
        encoding: "utf-8",
      });
      console.log("\nwasmer package help (first 500 chars):");
      console.log(pkgHelp.slice(0, 500));
    } catch {
      console.log("wasmer package not available");
    }
  } catch {
    console.log("Wasmer CLI not installed");
  }

  console.log("\n=== Summary ===\n");
  console.log("Key findings:");
  console.log("1. Wasmer.createPackage() creates packages from manifest");
  console.log("2. Wasmer.fromFile() loads .webc binary files");
  console.log("3. Dependencies can be specified in manifest");
  console.log("4. Package manifest follows wasmer.toml structure");
  console.log("");
  console.log("Next steps:");
  console.log("- Use wasmer CLI to build .webc packages");
  console.log("- Create custom package with node bridge imports");
}

main().catch(console.error);
