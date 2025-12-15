// Test 4: @wasmer/wasm-terminal command interception
// Note: This package is browser-only (requires xterm, DOM)

async function main(): Promise<void> {
  try {
    // Try ESM path
    const WasmTerminal = await import("@wasmer/wasm-terminal/lib/unoptimized/wasm-terminal.esm.js");
    console.log("wasm-terminal loaded");
    console.log("exports:", Object.keys(WasmTerminal));

    const fetchCommand = async ({ args, env }: { args: string[]; env: Record<string, string> }) => {
      console.log("intercepted command:", args);

      if (args[0] === "node") {
        // Return a callback instead of WASM binary
        return async (options: unknown, wasmFs: unknown) => {
          console.log("executing node command in JS!");
          console.log("script path:", args[1]);
          return "hello from JS callback";
        };
      }

      throw new Error("command not found: " + args[0]);
    };

    // @ts-expect-error - WasmTerminal may have different API
    const terminal = new WasmTerminal.default({ fetchCommand });
    console.log("terminal created");
  } catch (e) {
    console.log("wasm-terminal failed:", (e as Error).message);
    console.log("likely browser-only or incompatible");
  }
}

main().catch(console.error);
