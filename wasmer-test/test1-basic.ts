// Test 1: Basic @wasmer/sdk functionality
import { init, Wasmer } from "@wasmer/sdk/node";

async function main(): Promise<void> {
  console.log("initializing wasmer...");
  await init();
  console.log("wasmer initialized");

  console.log("loading coreutils...");
  const pkg = await Wasmer.fromRegistry("sharrattj/coreutils");
  console.log("loaded coreutils package");
  console.log("available commands:", Object.keys(pkg.commands || {}));

  console.log("running echo command...");
  const instance = await pkg.commands["echo"].run({
    args: ["hello", "from", "wasmer"]
  });
  console.log("instance created");

  console.log("waiting for output...");
  const output = await instance.wait();
  console.log("exit code:", output.code);
  console.log("stdout:", output.stdout);
  console.log("stderr:", output.stderr);
}

main().catch(console.error);
