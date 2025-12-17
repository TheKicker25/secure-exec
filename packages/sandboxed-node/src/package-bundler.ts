import type { VirtualFileSystem } from "./types.js";
import { exists, stat } from "./fs-helpers.js";

// Path utilities (since we can't use node:path in a way that works in isolate)
function dirname(p: string): string {
	const lastSlash = p.lastIndexOf("/");
	if (lastSlash === -1) return ".";
	if (lastSlash === 0) return "/";
	return p.slice(0, lastSlash);
}

function join(...parts: string[]): string {
	const segments: string[] = [];
	for (const part of parts) {
		if (part.startsWith("/")) {
			segments.length = 0;
		}
		for (const seg of part.split("/")) {
			if (seg === "..") {
				segments.pop();
			} else if (seg && seg !== ".") {
				segments.push(seg);
			}
		}
	}
	return `/${segments.join("/")}`;
}

/**
 * Resolve a module request to an absolute path in the virtual filesystem
 */
export async function resolveModule(
	request: string,
	fromDir: string,
	fs: VirtualFileSystem,
): Promise<string | null> {
	// Absolute paths - resolve directly
	if (request.startsWith("/")) {
		return resolveAbsolute(request, fs);
	}

	// Relative imports (including bare '.' and '..')
	if (
		request.startsWith("./") ||
		request.startsWith("../") ||
		request === "." ||
		request === ".."
	) {
		return resolveRelative(request, fromDir, fs);
	}

	// Bare imports - walk up node_modules
	return resolveNodeModules(request, fromDir, fs);
}

/**
 * Resolve an absolute path
 */
async function resolveAbsolute(
	request: string,
	fs: VirtualFileSystem,
): Promise<string | null> {
	// First check if the exact path exists and is a file
	try {
		const statInfo = await stat(fs, request);
		if (!statInfo.isDirectory) {
			return request;
		}
		// It's a directory - look for main entry
		const pkgJsonPath = join(request, "package.json");
		if (await exists(fs, pkgJsonPath)) {
			const pkgJson = JSON.parse(await fs.readTextFile(pkgJsonPath));
			const main = pkgJson.main || "index.js";
			const mainPath = join(request, main);
			if (await exists(fs, mainPath)) {
				return mainPath;
			}
		}
		// Check for index.js
		const indexPath = join(request, "index.js");
		if (await exists(fs, indexPath)) {
			return indexPath;
		}
		const indexJsonPath = join(request, "index.json");
		if (await exists(fs, indexJsonPath)) {
			return indexJsonPath;
		}
	} catch {
		// Path doesn't exist - try with extensions
	}

	// Try with extensions
	const extensions = [".js", ".json"];
	for (const ext of extensions) {
		const withExt = request + ext;
		if (await exists(fs, withExt)) {
			return withExt;
		}
	}

	return null;
}

/**
 * Resolve a relative import
 */
async function resolveRelative(
	request: string,
	fromDir: string,
	fs: VirtualFileSystem,
): Promise<string | null> {
	const basePath = join(fromDir, request);

	// First check if the exact path exists and is a file
	try {
		const statInfo = await stat(fs, basePath);
		if (!statInfo.isDirectory) {
			return basePath;
		}
		// It's a directory - look for main entry
		const pkgJsonPath = join(basePath, "package.json");
		if (await exists(fs, pkgJsonPath)) {
			const pkgJson = JSON.parse(await fs.readTextFile(pkgJsonPath));
			const main = pkgJson.main || "index.js";
			const mainPath = join(basePath, main);
			if (await exists(fs, mainPath)) {
				return mainPath;
			}
		}
		// Check for index.js
		const indexPath = join(basePath, "index.js");
		if (await exists(fs, indexPath)) {
			return indexPath;
		}
		const indexJsonPath = join(basePath, "index.json");
		if (await exists(fs, indexJsonPath)) {
			return indexJsonPath;
		}
	} catch {
		// Path doesn't exist - try with extensions
	}

	// Try with extensions
	const extensions = [".js", ".json"];
	for (const ext of extensions) {
		const withExt = basePath + ext;
		if (await exists(fs, withExt)) {
			return withExt;
		}
	}

	return null;
}

/**
 * Resolve a bare module import by walking up node_modules
 */
async function resolveNodeModules(
	request: string,
	fromDir: string,
	fs: VirtualFileSystem,
): Promise<string | null> {
	// Handle scoped packages: @scope/package
	let packageName: string;
	let subpath: string;

	if (request.startsWith("@")) {
		// Scoped package: @scope/package or @scope/package/subpath
		const parts = request.split("/");
		if (parts.length >= 2) {
			packageName = `${parts[0]}/${parts[1]}`;
			subpath = parts.slice(2).join("/");
		} else {
			return null;
		}
	} else {
		// Regular package: package or package/subpath
		const slashIndex = request.indexOf("/");
		if (slashIndex === -1) {
			packageName = request;
			subpath = "";
		} else {
			packageName = request.slice(0, slashIndex);
			subpath = request.slice(slashIndex + 1);
		}
	}

	let dir = fromDir;
	while (dir !== "/" && dir !== "") {
		const packageDir = join(dir, "node_modules", packageName);
		const pkgJsonPath = join(packageDir, "package.json");

		if (await exists(fs, pkgJsonPath)) {
			if (subpath) {
				// Direct file reference: require("lodash/get")
				return resolveRelative(`./${subpath}`, packageDir, fs);
			}

			// Main entry point
			const pkgJson = JSON.parse(await fs.readTextFile(pkgJsonPath));
			const main = pkgJson.main || "index.js";

			// Normalize main path (remove leading ./ and trailing /)
			const normalizedMain = main.replace(/^\.\//, "").replace(/\/$/, "");
			const mainPath = join(packageDir, normalizedMain);

			// Check if mainPath is a directory
			try {
				const statInfo = await stat(fs, mainPath);
				if (statInfo.isDirectory) {
					// It's a directory - look for index.js
					const indexPath = join(mainPath, "index.js");
					if (await exists(fs, indexPath)) {
						return indexPath;
					}
					const indexJsonPath = join(mainPath, "index.json");
					if (await exists(fs, indexJsonPath)) {
						return indexJsonPath;
					}
				} else {
					// It's a file
					return mainPath;
				}
			} catch {
				// Path doesn't exist - try with extensions
			}

			// Try the main path with extensions
			const mainCandidates = [
				`${mainPath}.js`,
				`${mainPath}.json`,
				`${mainPath}/index.js`,
				`${mainPath}/index.json`,
			];

			// If main was defaulted to index.js, also try just index.json at package root
			if (!pkgJson.main) {
				const indexJsonPath = join(packageDir, "index.json");
				mainCandidates.unshift(indexJsonPath);
			}

			for (const candidate of mainCandidates) {
				if (await exists(fs, candidate)) {
					return candidate;
				}
			}
		}

		dir = dirname(dir);
	}

	// Also check root node_modules
	const rootPackageDir = join("/node_modules", packageName);
	const rootPkgJsonPath = join(rootPackageDir, "package.json");

	if (await exists(fs, rootPkgJsonPath)) {
		if (subpath) {
			return resolveRelative(`./${subpath}`, rootPackageDir, fs);
		}

		const pkgJson = JSON.parse(await fs.readTextFile(rootPkgJsonPath));
		const main = pkgJson.main || "index.js";

		// Normalize main path (remove leading ./ and trailing /)
		const normalizedMain = main.replace(/^\.\//, "").replace(/\/$/, "");
		const mainPath = join(rootPackageDir, normalizedMain);

		// Check if mainPath is a directory
		try {
			const statInfo = await stat(fs, mainPath);
			if (statInfo.isDirectory) {
				const indexPath = join(mainPath, "index.js");
				if (await exists(fs, indexPath)) {
					return indexPath;
				}
				const indexJsonPath = join(mainPath, "index.json");
				if (await exists(fs, indexJsonPath)) {
					return indexJsonPath;
				}
			} else {
				return mainPath;
			}
		} catch {
			// Path doesn't exist - try with extensions
		}

		const mainCandidates = [`${mainPath}.js`, `${mainPath}/index.js`];

		for (const candidate of mainCandidates) {
			if (await exists(fs, candidate)) {
				return candidate;
			}
		}
	}

	return null;
}

/**
 * Load a file's content from the virtual filesystem
 */
export async function loadFile(
	path: string,
	fs: VirtualFileSystem,
): Promise<string | null> {
	try {
		return await fs.readTextFile(path);
	} catch {
		return null;
	}
}

/**
 * Legacy function - bundle a package from node_modules (simple approach)
 * This is kept for backwards compatibility but the new dynamic resolution is preferred
 */
export async function bundlePackage(
	packageName: string,
	fs: VirtualFileSystem,
): Promise<string | null> {
	// Resolve the package entry point
	const entryPath = await resolveNodeModules(packageName, "/", fs);
	if (!entryPath) {
		return null;
	}

	try {
		const entryCode = await fs.readTextFile(entryPath);

		// Wrap the code in an IIFE that sets up module.exports
		const wrappedCode = `(function() {
      var module = { exports: {} };
      var exports = module.exports;
      ${entryCode}
      return module.exports;
    })()`;

		return wrappedCode;
	} catch {
		return null;
	}
}
