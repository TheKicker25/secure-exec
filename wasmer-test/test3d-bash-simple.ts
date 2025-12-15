// Test 3d: Simple bash test
import { init, Wasmer } from "@wasmer/sdk/node";

async function main(): Promise<void> {
  await init();

  console.log("loading bash...");
  const bashPkg = await Wasmer.fromRegistry("sharrattj/bash");
  console.log("bash loaded");

  // Simple echo without file ops
  console.log("running simple echo...");
  const instance = await bashPkg.entrypoint.run({
    args: ["-c", "echo hello from bash"]
  });

  const output = await instance.wait();
  console.log("exit code:", output.code);
  console.log("stdout:", output.stdout);
}

main().catch(console.error);
