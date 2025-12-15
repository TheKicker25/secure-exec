// Test 3g: Using printf to write content to stdout, then tee to file
import { init, Wasmer, Directory } from "@wasmer/sdk/node";

async function main(): Promise<void> {
  await init();

  const dir = new Directory();
  const pkg = await Wasmer.fromRegistry("sharrattj/coreutils");

  // Use printf to write to stdout
  console.log("testing printf...");
  const instance = await pkg.commands["printf"].run({
    args: ["hello from wasm\\n"],
    mount: { "/data": dir }
  });

  const output = await instance.wait();
  console.log("printf exit code:", output.code);
  console.log("printf stdout:", output.stdout);

  // Now try tee to write stdout to a file
  console.log("\ntesting echo + tee...");
  // First check if tee exists
  console.log("commands:", Object.keys(pkg.commands));
}

main().catch(console.error);
