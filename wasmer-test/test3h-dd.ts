// Test 3h: Using dd to write content to a file
import { init, Wasmer, Directory } from "@wasmer/sdk/node";

async function main(): Promise<void> {
  await init();

  const dir = new Directory();
  const pkg = await Wasmer.fromRegistry("sharrattj/coreutils");

  // First write an input file from JS
  await dir.writeFile("/input.txt", "content to copy via dd");

  // Use dd to copy the file
  console.log("testing dd...");
  const instance = await pkg.commands["dd"].run({
    args: ["if=/data/input.txt", "of=/data/output.txt"],
    mount: { "/data": dir }
  });

  const output = await instance.wait();
  console.log("dd exit code:", output.code);
  console.log("dd stderr:", output.stderr); // dd outputs stats to stderr

  // Check directory
  console.log("\ndir entries:");
  const entries = await dir.readDir("/");
  console.log(entries);

  // Try to read output
  console.log("\nreading output.txt:");
  try {
    const content = await dir.readTextFile("/output.txt");
    console.log("SUCCESS:", content);
  } catch (e) {
    console.log("FAILED:", (e as Error).message);
  }
}

main().catch(console.error);
