import { describe, expect, it, beforeAll } from "vitest";
import { Runtime, Process } from "../src/runtime/index.js";

/**
 * Tests for sandboxed Node.js execution via the V8 Accelerator.
 *
 * When WASM runs `node`, the host_exec syscalls delegate to sandboxed-node's
 * NodeProcess (V8 isolate) instead of spawning a real process.
 */
describe("Node Process", () => {
	let runtime: Runtime;

	beforeAll(async () => {
		runtime = await Runtime.load();
	});

	describe("Basic execution", () => {
		it("should execute node -e directly", async () => {
			const vm = await runtime.run("node", {
				args: ["-e", "console.log('hello from node')"],
			});
			expect(vm.stdout).toContain("hello from node");
			expect(vm.code).toBe(0);
		});

		it("should handle node errors properly", async () => {
			const vm = await runtime.run("node", {
				args: ["-e", "throw new Error('oops')"],
			});
			expect(vm.code).not.toBe(0);
		});
	});

	describe("Stdin handling", () => {
		it("should read stdin and output it (node)", async () => {
			const script = `
				let data = '';
				process.stdin.on('data', chunk => data += chunk);
				process.stdin.on('end', () => console.log('got:', data.trim()));
			`;
			const vm = await runtime.run("node", {
				args: ["-e", script],
				stdin: "hello world",
			});
			expect(vm.stdout.trim()).toBe("got: hello world");
		});

		// Streaming stdin tests are skipped due to wasmer-js TTY bug.
		// See: docs/research/wasmer-js-tty-stdin-bug.md
		it.skip("should stream stdin to node with spawn()", async () => {
			const script = `
				let data = '';
				process.stdin.on('data', chunk => data += chunk);
				process.stdin.on('end', () => {
					data.trim().split('\\n').forEach(line => console.log('OUT:' + line));
				});
			`;
			const proc = await runtime.spawn("node", {
				args: ["-e", script],
			});

			await proc.writeStdin("ping1\n");
			await proc.writeStdin("ping2\n");
			await proc.writeStdin("ping3\n");
			await proc.closeStdin();

			const result = await proc.wait();
			expect(result.stdout).toContain("OUT:ping1");
			expect(result.stdout).toContain("OUT:ping2");
			expect(result.stdout).toContain("OUT:ping3");
		}, 30000);
	});

	// More comprehensive child process tests are in node-child-process.test.ts
	// These basic tests verify the integration works
	describe("Child process basics", () => {
		// Child process spawning from Node spawns actual WASM instances
		// Note: execSync uses bash -c, which has exit code issues in WASM
		// Use spawnSync for direct command execution
		it("should spawn echo command from node via spawnSync", async () => {
			const script = `
				const { spawnSync } = require('child_process');
				const result = spawnSync('echo', ['hello from child']);
				console.log('stdout:', result.stdout.toString().trim());
				console.log('code:', result.status);
			`;
			const vm = await runtime.run("node", {
				args: ["-e", script],
			});
			expect(vm.stdout).toContain("stdout: hello from child");
		}, 30000);
	});
});

/** Poll stdout until we get the expected exact output */
async function pollForOutput(proc: Process, expected: string, timeoutMs = 5000): Promise<void> {
	const startTime = Date.now();
	while (Date.now() - startTime < timeoutMs) {
		const output = await proc.readStdout();
		if (output === expected) return;
		if (output !== "") throw new Error(`Expected "${expected}", got "${output}"`);
		await new Promise(r => setTimeout(r, 50));
	}
	throw new Error(`Timeout waiting for "${expected}"`);
}
