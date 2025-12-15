// Test 3f: Using touch to create a file
import { init, Wasmer, Directory } from "@wasmer/sdk/node";

async function main(): Promise<void> {
  await init();

  const dir = new Directory();
  const pkg = await Wasmer.fromRegistry("sharrattj/coreutils");

  // Use touch to create a file
  console.log("creating file via touch...");
  const instance = await pkg.commands["touch"].run({
    args: ["/data/newfile.txt"],
    mount: { "/data": dir }
  });

  const output = await instance.wait();
  console.log("touch exit code:", output.code);

  // Check if file exists
  console.log("\ndir entries:");
  try {
    const entries = await dir.readDir("/");
    console.log(entries);
  } catch (e) {
    console.log("readDir failed:", (e as Error).message);
  }
}

main().catch(console.error);
