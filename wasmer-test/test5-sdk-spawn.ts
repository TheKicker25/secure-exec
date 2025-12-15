// Test 5: SDK spawn hooks exploration
import { init, Wasmer, Directory } from "@wasmer/sdk/node";
import * as sdk from "@wasmer/sdk/node";

async function main(): Promise<void> {
  await init();

  // Check what's exported from the SDK
  console.log("SDK exports:", Object.keys(sdk));

  const pkg = await Wasmer.fromRegistry("sharrattj/bash");
  console.log("\npackage keys:", Object.keys(pkg));
  console.log("entrypoint:", pkg.entrypoint);
  console.log("commands:", Object.keys(pkg.commands || {}));

  // Check Wasmer object for hooks
  console.log("\nWasmer static methods:", Object.keys(Wasmer));
  console.log("Wasmer.prototype:", Object.keys(Object.getPrototypeOf(Wasmer)));

  // Run a simple command and inspect the instance
  const instance = await pkg.entrypoint.run({
    args: ["-c", "echo test"]
  });

  console.log("\ninstance keys:", Object.keys(instance));
  console.log("instance.stdin:", instance.stdin);
  console.log("instance.stdout:", instance.stdout);

  // Check for any spawn/fork/exec related APIs
  const output = await instance.wait();
  console.log("\noutput keys:", Object.keys(output));
  console.log("exit code:", output.code);
  console.log("stdout:", output.stdout);
}

main().catch(console.error);
