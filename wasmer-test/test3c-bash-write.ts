// Test 3c: Bidirectional filesystem - using bash
import { init, Wasmer, Directory } from "@wasmer/sdk/node";

async function main(): Promise<void> {
  await init();

  const dir = new Directory();

  console.log("loading bash...");
  const bashPkg = await Wasmer.fromRegistry("sharrattj/bash");
  console.log("bash loaded");

  // Use bash to write a file
  console.log("having bash write a file...");
  const instance = await bashPkg.entrypoint.run({
    args: ["-c", "echo 'written by wasm' > /out/test.txt"],
    mount: { "/out": dir }
  });

  const output = await instance.wait();
  console.log("exit code:", output.code);
  console.log("stdout:", output.stdout);
  console.log("stderr:", output.stderr);

  // Now try to read it back from JS
  console.log("\ntrying to read back from JS...");
  try {
    const content = await dir.readTextFile("/test.txt");
    console.log("SUCCESS: read back from JS:", content);
  } catch (e) {
    console.log("FAILED to read back:", (e as Error).message);
  }

  // Try readDir
  console.log("\ntrying readDir...");
  try {
    const entries = await dir.readDir("/");
    console.log("directory entries:", entries);
  } catch (e) {
    console.log("readDir failed:", (e as Error).message);
  }
}

main().catch(console.error);
