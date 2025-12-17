import { Directory, init } from "@wasmer/sdk/node";
import { beforeAll, describe, expect, it } from "vitest";
import { createVirtualFileSystem } from "./virtual-filesystem.js";
import { DATA_MOUNT_PATH } from "../wasix/index.js";

describe("VirtualFileSystem", () => {
	beforeAll(async () => {
		await init();
	});

	describe("path normalization", () => {
		it("should read file with direct path (no /data prefix)", async () => {
			const directory = new Directory();
			await directory.writeFile("/test.txt", "hello world");

			const vfs = createVirtualFileSystem(directory);
			const content = await vfs.readTextFile("/test.txt");

			expect(content).toBe("hello world");
		});

		it("should read file with /data prefix", async () => {
			const directory = new Directory();
			await directory.writeFile("/test.txt", "hello from data");

			const vfs = createVirtualFileSystem(directory);
			// Access via /data prefix - should strip it
			const content = await vfs.readTextFile(`${DATA_MOUNT_PATH}/test.txt`);

			expect(content).toBe("hello from data");
		});

		it("should write file with direct path", async () => {
			const directory = new Directory();
			const vfs = createVirtualFileSystem(directory);

			vfs.writeFile("/written.txt", "direct write");

			// Verify via Directory directly
			const content = await directory.readTextFile("/written.txt");
			expect(content).toBe("direct write");
		});

		it("should write file with /data prefix", async () => {
			const directory = new Directory();
			const vfs = createVirtualFileSystem(directory);

			// Write via /data prefix
			vfs.writeFile(`${DATA_MOUNT_PATH}/data-written.txt`, "data write");

			// Verify via Directory directly (without /data prefix)
			const content = await directory.readTextFile("/data-written.txt");
			expect(content).toBe("data write");
		});

		it("should read directory with direct path", async () => {
			const directory = new Directory();
			await directory.createDir("/mydir");
			await directory.writeFile("/mydir/file1.txt", "a");
			await directory.writeFile("/mydir/file2.txt", "b");

			const vfs = createVirtualFileSystem(directory);
			const entries = await vfs.readDir("/mydir");

			expect(entries).toContain("file1.txt");
			expect(entries).toContain("file2.txt");
		});

		it("should read directory with /data prefix", async () => {
			const directory = new Directory();
			await directory.createDir("/datadir");
			await directory.writeFile("/datadir/a.txt", "a");
			await directory.writeFile("/datadir/b.txt", "b");

			const vfs = createVirtualFileSystem(directory);
			// Access via /data prefix
			const entries = await vfs.readDir(`${DATA_MOUNT_PATH}/datadir`);

			expect(entries).toContain("a.txt");
			expect(entries).toContain("b.txt");
		});

		it("should create directory with /data prefix", async () => {
			const directory = new Directory();
			const vfs = createVirtualFileSystem(directory);

			// Create via /data prefix
			vfs.createDir(`${DATA_MOUNT_PATH}/newdir`);
			vfs.writeFile(`${DATA_MOUNT_PATH}/newdir/file.txt`, "test");

			// Verify via Directory directly
			const entries = await directory.readDir("/newdir");
			const fileNames = entries.map((e) =>
				typeof e === "string" ? e : e.name,
			);
			expect(fileNames).toContain("file.txt");
		});

		it("should normalize /data alone to root", async () => {
			const directory = new Directory();
			await directory.writeFile("/root-file.txt", "at root");

			const vfs = createVirtualFileSystem(directory);
			// Reading /data should list root contents
			const entries = await vfs.readDir(DATA_MOUNT_PATH);

			expect(entries).toContain("root-file.txt");
		});

		it("should read binary files with path normalization", async () => {
			const directory = new Directory();
			const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
			await directory.writeFile("/image.png", binaryData);

			const vfs = createVirtualFileSystem(directory);

			// Read via /data prefix
			const result = await vfs.readFile(`${DATA_MOUNT_PATH}/image.png`);

			expect(result).toEqual(binaryData);
		});

		it("should remove file with /data prefix", async () => {
			const directory = new Directory();
			await directory.writeFile("/to-remove.txt", "delete me");

			const vfs = createVirtualFileSystem(directory);

			// Remove via /data prefix
			await vfs.removeFile(`${DATA_MOUNT_PATH}/to-remove.txt`);

			// Verify file is gone
			await expect(directory.readFile("/to-remove.txt")).rejects.toThrow();
		});

		it("should handle nested paths with /data prefix", async () => {
			const directory = new Directory();
			await directory.createDir("/deep");
			await directory.createDir("/deep/nested");
			await directory.createDir("/deep/nested/path");
			await directory.writeFile("/deep/nested/path/file.txt", "deep content");

			const vfs = createVirtualFileSystem(directory);

			// Read via /data prefix with full nested path
			const content = await vfs.readTextFile(
				`${DATA_MOUNT_PATH}/deep/nested/path/file.txt`,
			);

			expect(content).toBe("deep content");
		});
	});

	describe("paths without normalization (non-/data)", () => {
		it("should handle absolute paths correctly", async () => {
			const directory = new Directory();
			await directory.createDir("/etc");
			await directory.writeFile("/etc/config.json", '{"key": "value"}');

			const vfs = createVirtualFileSystem(directory);

			// Direct path access (no /data prefix)
			const content = await vfs.readTextFile("/etc/config.json");
			expect(content).toBe('{"key": "value"}');
		});

		it("should handle paths in node_modules", async () => {
			const directory = new Directory();
			await directory.createDir("/node_modules");
			await directory.createDir("/node_modules/my-pkg");
			await directory.writeFile(
				"/node_modules/my-pkg/package.json",
				'{"name": "my-pkg", "version": "1.0.0"}',
			);

			const vfs = createVirtualFileSystem(directory);

			// Direct path access
			const content = await vfs.readTextFile("/node_modules/my-pkg/package.json");
			expect(JSON.parse(content)).toEqual({
				name: "my-pkg",
				version: "1.0.0",
			});

			// Same path via /data prefix
			const content2 = await vfs.readTextFile(
				`${DATA_MOUNT_PATH}/node_modules/my-pkg/package.json`,
			);
			expect(JSON.parse(content2)).toEqual({
				name: "my-pkg",
				version: "1.0.0",
			});
		});
	});
});
