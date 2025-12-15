// Test 6: Custom /bin/node approach
// Create a fake "node" script that writes args to a file
import { init, Wasmer, Directory } from "@wasmer/sdk/node";

async function main(): Promise<void> {
  await init();

  const bin = new Directory();
  const tmp = new Directory();

  // Create a fake "node" script that writes its args to stdout
  // (since file writing hangs, we use stdout instead)
  await bin.writeFile("/node", `#!/bin/sh
echo "NODE_INTERCEPT:$@"
`);

  const pkg = await Wasmer.fromRegistry("sharrattj/bash");

  console.log("running bash with custom /bin/node...");
  const instance = await pkg.entrypoint.run({
    args: ["-c", "chmod +x /bin/node && /bin/node script.js arg1 arg2"],
    mount: {
      "/bin": bin,
      "/tmp": tmp
    }
  });

  const output = await instance.wait();
  console.log("exit code:", output.code);
  console.log("stdout:", output.stdout);
  console.log("stderr:", output.stderr);

  // Check if we can detect the intercept
  if (output.stdout.includes("NODE_INTERCEPT:")) {
    console.log("\nSUCCESS: Intercepted node command!");
    const match = output.stdout.match(/NODE_INTERCEPT:(.+)/);
    if (match) {
      console.log("Args captured:", match[1]);
    }
  }
}

main().catch(console.error);
