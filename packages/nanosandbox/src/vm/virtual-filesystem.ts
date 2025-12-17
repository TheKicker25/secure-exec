/**
 * VirtualFileSystem implementation for nanosandbox.
 *
 * This wraps the wasmer Directory API and handles path normalization
 * for the /data mount path.
 *
 * In WASM, the Directory is mounted at /data, so:
 * - Files written to Directory at /foo.txt appear at /data/foo.txt in WASM
 * - This VirtualFileSystem accepts both paths and normalizes them
 */
import type { Directory } from "@wasmer/sdk/node";
import type { VirtualFileSystem } from "sandboxed-node";
import { DATA_MOUNT_PATH } from "../wasix/index.js";

/**
 * Normalize a filesystem path for Directory access.
 *
 * In WASM, the Directory is mounted at /data, so files appear at /data/foo.txt.
 * But the Directory API stores them at /foo.txt (without the /data prefix).
 *
 * This function strips the /data prefix when accessing the Directory.
 */
function normalizePathForDirectory(path: string): string {
	if (path.startsWith(DATA_MOUNT_PATH + "/")) {
		return path.slice(DATA_MOUNT_PATH.length);
	}
	if (path === DATA_MOUNT_PATH) {
		return "/";
	}
	return path;
}

/**
 * Create a VirtualFileSystem that wraps a wasmer Directory.
 *
 * @param directory - The wasmer Directory instance
 * @returns A VirtualFileSystem implementation
 */
export function createVirtualFileSystem(
	directory: Directory,
): VirtualFileSystem {
	return {
		readFile: async (path: string): Promise<Uint8Array> => {
			const normalizedPath = normalizePathForDirectory(path);
			return directory.readFile(normalizedPath);
		},

		readTextFile: async (path: string): Promise<string> => {
			const normalizedPath = normalizePathForDirectory(path);
			return directory.readTextFile(normalizedPath);
		},

		readDir: async (path: string): Promise<string[]> => {
			const normalizedPath = normalizePathForDirectory(path);
			const entries = await directory.readDir(normalizedPath);
			// Convert DirEntry[] to string[] (extract names)
			return entries.map((entry) =>
				typeof entry === "string"
					? entry
					: (entry as { name: string }).name,
			);
		},

		writeFile: (path: string, content: string | Uint8Array): void => {
			const normalizedPath = normalizePathForDirectory(path);
			directory.writeFile(normalizedPath, content);
		},

		createDir: (path: string): void => {
			const normalizedPath = normalizePathForDirectory(path);
			directory.createDir(normalizedPath);
		},

		removeFile: async (path: string): Promise<void> => {
			const normalizedPath = normalizePathForDirectory(path);
			await directory.removeFile(normalizedPath);
		},

		removeDir: async (path: string): Promise<void> => {
			const normalizedPath = normalizePathForDirectory(path);
			await directory.removeDir(normalizedPath);
		},
	};
}
