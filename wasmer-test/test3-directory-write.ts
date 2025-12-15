// Test 3: Bidirectional filesystem - WASM writes, JS reads
import { init, Wasmer, Directory } from "@wasmer/sdk/node";

async function main(): Promise<void> {
  await init();

  const dir = new Directory();
  const pkg = await Wasmer.fromRegistry("sharrattj/coreutils");

  // Use sh to write a file (echo with redirection)
  console.log("having WASM write a file via sh...");
  const shCmd = pkg.commands["sh"];
  const instance = await shCmd.run({
    args: ["-c", "echo 'written by wasm' > /out/test.txt"],
    mount: { "/out": dir }
  });

  const output = await instance.wait();
  console.log("sh exit code:", output.code);
  console.log("sh stdout:", output.stdout);
  console.log("sh stderr:", output.stderr);

  // Now try to read it back from JS
  console.log("\ntrying to read back from JS...");
  try {
    const content = await dir.readTextFile("/test.txt");
    console.log("SUCCESS: read back from JS:", content);
  } catch (e) {
    console.log("FAILED to read back:", (e as Error).message);
    console.log("this confirms the known issue - Directory may be one-way");
  }

  // Also try readDir
  console.log("\ntrying readDir...");
  try {
    const entries = await dir.readDir("/");
    console.log("directory entries:", entries);
  } catch (e) {
    console.log("readDir failed:", (e as Error).message);
  }
}

main().catch(console.error);
