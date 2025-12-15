// Test 3i: Using truncate to create a file with size
import { init, Wasmer, Directory } from "@wasmer/sdk/node";

async function main(): Promise<void> {
  await init();

  const dir = new Directory();
  const pkg = await Wasmer.fromRegistry("sharrattj/coreutils");

  // Use truncate to create a file with content
  console.log("testing truncate...");
  const instance = await pkg.commands["truncate"].run({
    args: ["-s", "10", "/data/sized.txt"],
    mount: { "/data": dir }
  });

  const output = await instance.wait();
  console.log("truncate exit code:", output.code);

  // Check directory
  console.log("\ndir entries:");
  const entries = await dir.readDir("/");
  console.log(entries);

  // Try to read file
  console.log("\nreading sized.txt:");
  try {
    const content = await dir.readTextFile("/sized.txt");
    console.log("content length:", content.length);
    console.log("content:", JSON.stringify(content));
  } catch (e) {
    console.log("FAILED:", (e as Error).message);
  }
}

main().catch(console.error);
