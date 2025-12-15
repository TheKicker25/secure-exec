// Test 3e: Using Volume instead of Directory
import { init, Wasmer, Volume, Directory } from "@wasmer/sdk/node";

async function main(): Promise<void> {
  await init();

  // Check what's exported
  console.log("Volume:", typeof Volume);
  console.log("Directory:", typeof Directory);

  // Create a directory and pre-populate it
  const dir = new Directory();

  // First, write a file from JS
  await dir.writeFile("/input.txt", "input from js");

  const pkg = await Wasmer.fromRegistry("sharrattj/coreutils");

  // Use cp to copy input.txt to output.txt
  console.log("copying file via cp...");
  const instance = await pkg.commands["cp"].run({
    args: ["/data/input.txt", "/data/output.txt"],
    mount: { "/data": dir }
  });

  const output = await instance.wait();
  console.log("cp exit code:", output.code);
  console.log("cp stdout:", output.stdout);
  console.log("cp stderr:", output.stderr);

  // Check if we can read output.txt
  console.log("\ntrying to read output.txt from JS...");
  try {
    const content = await dir.readTextFile("/output.txt");
    console.log("SUCCESS: read output.txt:", content);
  } catch (e) {
    console.log("FAILED to read output.txt:", (e as Error).message);
  }

  // List directory
  console.log("\ndir entries:");
  try {
    const entries = await dir.readDir("/");
    console.log(entries);
  } catch (e) {
    console.log("readDir failed:", (e as Error).message);
  }
}

main().catch(console.error);
