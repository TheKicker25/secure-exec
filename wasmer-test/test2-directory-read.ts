// Test 2: Directory filesystem - JS writes, WASM reads
import { init, Wasmer, Directory } from "@wasmer/sdk/node";

async function main(): Promise<void> {
  await init();

  const dir = new Directory();
  await dir.writeFile("/hello.txt", "content from javascript");

  const pkg = await Wasmer.fromRegistry("sharrattj/coreutils");

  // test cat command reading our file
  console.log("testing cat...");
  const instance = await pkg.commands["cat"].run({
    args: ["/app/hello.txt"],
    mount: { "/app": dir }
  });

  const output = await instance.wait();
  console.log("cat output:", output.stdout);
  console.log("cat exit code:", output.code);

  // test ls command
  console.log("\ntesting ls...");
  const lsInstance = await pkg.commands["ls"].run({
    args: ["-la", "/app"],
    mount: { "/app": dir }
  });

  const lsOutput = await lsInstance.wait();
  console.log("ls output:", lsOutput.stdout);
  console.log("ls exit code:", lsOutput.code);
}

main().catch(console.error);
