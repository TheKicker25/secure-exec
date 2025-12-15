// Test 6c: Using bash to run a script
import { init, Wasmer, Directory } from "@wasmer/sdk/node";

async function main(): Promise<void> {
  await init();

  const scripts = new Directory();

  // Create a script
  await scripts.writeFile("/intercept.sh", `#!/bin/bash
echo "INTERCEPT:$@"
`);

  const pkg = await Wasmer.fromRegistry("sharrattj/bash");

  // Use bash to run our script
  console.log("running bash with our script...");
  const instance = await pkg.entrypoint.run({
    args: ["/scripts/intercept.sh", "arg1", "arg2"],
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
