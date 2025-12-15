import { init, wat2wasm } from "@wasmer/sdk/node";
import * as fs from "fs";

async function main() {
  await init();
  const wat = fs.readFileSync("custom-node-pkg/node-bridge.wat", "utf-8");
  const wasm = wat2wasm(wat);
  fs.writeFileSync("custom-node-pkg/node-bridge.wasm", wasm);
  console.log("Compiled", wasm.length, "bytes");
}

main().catch(console.error);
