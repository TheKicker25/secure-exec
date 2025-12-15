// Test 3b: Bidirectional filesystem - using tee instead of redirection
import { init, Wasmer, Directory } from "@wasmer/sdk/node";

async function main(): Promise<void> {
  await init();

  const dir = new Directory();
  const pkg = await Wasmer.fromRegistry("sharrattj/coreutils");

  // Use echo + tee to write a file
  console.log("having WASM write a file via echo | tee...");
  const instance = await pkg.commands["sh"].run({
    args: ["-c", "echo written_by_wasm | tee /out/test.txt"],
    mount: { "/out": dir }
  });

  const output = await instance.wait();
  console.log("exit code:", output.code);
  console.log("stdout:", output.stdout);

  // Now try to read it back from JS
  console.log("\ntrying to read back from JS...");
  try {
    const content = await dir.readTextFile("/test.txt");
    console.log("SUCCESS: read back from JS:", content);
  } catch (e) {
    console.log("FAILED to read back:", (e as Error).message);
  }

  // Try readDir
  try {
    const entries = await dir.readDir("/");
    console.log("directory entries:", entries);
  } catch (e) {
    console.log("readDir failed:", (e as Error).message);
  }
}

main().catch(console.error);
