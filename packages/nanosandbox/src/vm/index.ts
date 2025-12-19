import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Directory, Wasmer, Runtime } from "@wasmer/sdk/node";

export interface VirtualMachineOptions {
	args?: string[];
	env?: Record<string, string>;
	cwd?: string;
	memoryLimit?: number;
	/** Input to pass to the command's stdin */
	stdin?: string;
}

interface TerminalOptions {
	term: string;
	cols: number;
	rows: number;
}

interface HostExecContext {
	command: string;
	args: string[];
	env: Record<string, string>;
	cwd: string;
	stdin: ReadableStream<Uint8Array> | null;
	stdout: WritableStream<Uint8Array> | null;
	stderr: WritableStream<Uint8Array> | null;
	// Streaming callbacks for output
	onStdout?: (data: Uint8Array) => void;
	onStderr?: (data: Uint8Array) => void;
	// Stdin write callbacks - set by handler, called by scheduler
	setStdinWriter?: (writer: (data: Uint8Array) => void, closer: () => void) => void;
	// Kill/signal function callback - set by handler, called by scheduler
	setKillFunction?: (killFn: (signal: number) => void) => void;
	// Terminal options (if set, apply TERM/COLUMNS/LINES to env)
	terminal?: TerminalOptions;
}

const DATA_MOUNT_PATH = "/data";

let runtimePackage: Awaited<ReturnType<typeof Wasmer.fromFile>> | null = null;
let wasmerRuntime: Runtime | null = null;

/**
 * Handle host_exec syscalls from WASM.
 * Executes the requested command and returns the exit code.
 * Streams stdout/stderr via the onStdout/onStderr callbacks.
 */
// Signal number to name mapping for Node.js child.kill()
const SIGNAL_NAMES: Record<number, string> = {
	1: "SIGHUP",
	2: "SIGINT",
	3: "SIGQUIT",
	9: "SIGKILL",
	15: "SIGTERM",
	18: "SIGCONT",
	19: "SIGSTOP",
};

async function hostExecHandler(ctx: HostExecContext): Promise<number> {
	console.error(`[host_exec] command=${ctx.command} args=${JSON.stringify(ctx.args)}`);

	return new Promise((resolve) => {
		// Merge WASM environment with parent process environment
		// Parent env provides PATH and other system variables
		const mergedEnv = { ...process.env, ...ctx.env };

		// Apply terminal options if present
		if (ctx.terminal) {
			mergedEnv.TERM = ctx.terminal.term || "xterm-256color";
			mergedEnv.COLUMNS = String(ctx.terminal.cols || 80);
			mergedEnv.LINES = String(ctx.terminal.rows || 24);
		}

		const child = spawn(ctx.command, ctx.args, {
			env: mergedEnv,
			cwd: ctx.cwd !== "/" ? ctx.cwd : undefined,
			stdio: ["pipe", "pipe", "pipe"],
		});

		// Register kill function if setKillFunction is available
		if (ctx.setKillFunction) {
			ctx.setKillFunction((signal: number) => {
				const signalName = SIGNAL_NAMES[signal] || "SIGTERM";
				console.error(`[host_exec] sending signal ${signalName} (${signal}) to process`);
				child.kill(signalName);
			});
		}

		// Register stdin writer if setStdinWriter is available
		if (ctx.setStdinWriter && child.stdin) {
			const childStdin = child.stdin;
			ctx.setStdinWriter(
				// Writer function
				(data: Uint8Array) => {
					childStdin.write(Buffer.from(data));
				},
				// Closer function
				() => {
					childStdin.end();
				}
			);
		}

		// Stream stdout via callback
		child.stdout?.on("data", (data: Buffer) => {
			if (ctx.onStdout) {
				ctx.onStdout(new Uint8Array(data));
			}
		});

		// Stream stderr via callback
		child.stderr?.on("data", (data: Buffer) => {
			if (ctx.onStderr) {
				ctx.onStderr(new Uint8Array(data));
			}
		});

		child.on("close", (code, signal) => {
			// If killed by signal, return 128 + signal number (Unix convention)
			if (signal) {
				const sigNum = Object.entries(SIGNAL_NAMES).find(([_, name]) => name === signal)?.[0];
				const exitCode = sigNum ? 128 + parseInt(sigNum) : 128;
				console.error(`[host_exec] process killed by signal ${signal}, exit code ${exitCode}`);
				resolve(exitCode);
			} else {
				console.error(`[host_exec] process exited with code: ${code}`);
				resolve(code ?? 0);
			}
		});

		child.on("error", (err) => {
			console.error(`[host_exec] spawn error: ${err.message}`);
			resolve(1);
		});
	});
}

async function loadRuntimePackage(): Promise<Awaited<ReturnType<typeof Wasmer.fromFile>>> {
	if (!runtimePackage) {
		// Create runtime and set host_exec handler
		wasmerRuntime = new Runtime();
		wasmerRuntime.setHostExecHandler(hostExecHandler);

		const currentDir = path.dirname(fileURLToPath(import.meta.url));
		const webcPath = path.resolve(currentDir, "../../assets/runtime.webc");
		const webcBytes = await fs.readFile(webcPath);
		runtimePackage = await Wasmer.fromFile(webcBytes, wasmerRuntime);
	}
	return runtimePackage;
}

/**
 * VirtualMachine represents the result of running a command.
 */
export class VirtualMachine {
	public stdout = "";
	public stderr = "";
	public code = 0;

	private command: string;
	private options: VirtualMachineOptions;

	constructor(command: string, options: VirtualMachineOptions = {}) {
		this.command = command;
		this.options = options;
	}

	/**
	 * Execute the command. Called by Runtime.run().
	 */
	async setup(): Promise<void> {
		const pkg = await loadRuntimePackage();

		const cmd = pkg.commands[this.command];
		if (!cmd) {
			throw new Error(`Command not found: ${this.command}`);
		}

		const { args = [], env, cwd, stdin } = this.options;

		const directory = new Directory();

		const instance = await cmd.run({
			args,
			env,
			cwd,
			stdin,
			mount: {
				[DATA_MOUNT_PATH]: directory,
			},
		});

		const result = await instance.wait();

		this.stdout = result.stdout;
		this.stderr = result.stderr;
		this.code = result.code ?? 0;
	}
}
