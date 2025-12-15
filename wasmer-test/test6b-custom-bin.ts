// Test 6b: Custom /bin approach - simpler
import { init, Wasmer, Directory } from "@wasmer/sdk/node";

async function main(): Promise<void> {
  await init();

  const scripts = new Directory();

  // Create a script that just echoes
  await scripts.writeFile("/intercept.sh", `#!/bin/sh
echo "INTERCEPT:$@"
`);

  const pkg = await Wasmer.fromRegistry("sharrattj/coreutils");

  // Use sh to run our script
  console.log("running sh with our script...");
  const instance = await pkg.commands["sh"].run({
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
