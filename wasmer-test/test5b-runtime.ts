// Test 5b: Explore Runtime and on_start
import { init, Wasmer, Runtime, runWasix, on_start } from "@wasmer/sdk/node";
import * as sdk from "@wasmer/sdk/node";

async function main(): Promise<void> {
  await init();

  // Explore Runtime
  console.log("Runtime type:", typeof Runtime);
  console.log("Runtime:", Runtime);
  if (Runtime) {
    console.log("Runtime keys:", Object.keys(Runtime));
    console.log("Runtime prototype:", Object.getOwnPropertyNames(Runtime.prototype || {}));
  }

  // Explore on_start
  console.log("\non_start type:", typeof on_start);
  console.log("on_start:", on_start);

  // Explore runWasix
  console.log("\nrunWasix type:", typeof runWasix);
  console.log("runWasix:", runWasix);

  // Check type definitions
  console.log("\nLooking at WasmerPackage...");
  const pkg = await Wasmer.fromRegistry("sharrattj/coreutils");
  console.log("pkg type:", typeof pkg);
  console.log("pkg constructor:", pkg.constructor?.name);

  // Check if there's a way to intercept process spawning
  const entrypoint = pkg.entrypoint;
  console.log("\nentrypoint type:", typeof entrypoint);
  console.log("entrypoint constructor:", entrypoint?.constructor?.name);
}

main().catch(console.error);
