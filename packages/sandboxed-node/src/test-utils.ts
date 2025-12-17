/**
 * Test utilities for sandboxed-node
 */
import type { Directory } from "@wasmer/sdk/node";
import type { VirtualFileSystem } from "./types.js";

/**
 * Wrap a wasmer Directory as VirtualFileSystem for testing
 */
export function wrapDirectory(directory: Directory): VirtualFileSystem {
	return {
		readFile: (path: string) => directory.readFile(path),
		readTextFile: (path: string) => directory.readTextFile(path),
		readDir: async (path: string) => {
			const entries = await directory.readDir(path);
			// Convert DirEntry[] to string[]
			return entries.map((e) =>
				typeof e === "string" ? e : (e as { name: string }).name,
			);
		},
		writeFile: (path: string, content: string | Uint8Array) =>
			directory.writeFile(path, content),
		createDir: (path: string) => directory.createDir(path),
		removeFile: (path: string) => directory.removeFile(path),
		removeDir: (path: string) => directory.removeDir(path),
	};
}
