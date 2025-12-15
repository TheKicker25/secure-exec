// Test 6d: Using bash -c to source a file
import { init, Wasmer, Directory } from "@wasmer/sdk/node";

async function main(): Promise<void> {
  await init();

  const scripts = new Directory();

  // Create a script content
  await scripts.writeFile("/script.sh", `echo INTERCEPT:arg1 arg2`);

  const pkg = await Wasmer.fromRegistry("sharrattj/bash");

  // Use bash -c to source our script
  console.log("running bash -c with source...");
  const instance = await pkg.entrypoint.run({
    args: ["-c", "source /scripts/script.sh"],
    mount: {
      "/scripts": scripts
    }
  });

  const output = await instance.wait();
  console.log("exit code:", output.code);
  console.log("stdout:", output.stdout);
  console.log("stderr:", output.stderr);

  // Check interception
  if (output.stdout.includes("INTERCEPT:")) {
    console.log("\nSUCCESS: Script executed and args captured!");
  }
}

main().catch(console.error);
