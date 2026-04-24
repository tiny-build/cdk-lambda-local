import { randomBytes } from "node:crypto";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";
import type { Handler } from "aws-lambda";
import { buildSync } from "esbuild";
import type { LocalLambda } from "../types";

import { findAncestorWithNodeModules, findNearestNamedFile } from "../utils/path-search";

let loadSeq = 0;

export interface ModuleLoaderOptions {
	readonly repoRoot?: string;
}

export class ModuleLoader {
	private readonly cache = new Map<string, Promise<Handler>>();
	private readonly deps = new Map<string, Set<string>>();
	private readonly repoRoot: string;

	constructor(opts?: ModuleLoaderOptions) {
		this.repoRoot = opts?.repoRoot ?? process.cwd();
	}

	private async bundleAndImportTs(
		absPath: string,
	): Promise<{ mod: Record<string, unknown>; deps: Set<string> }> {
		const tsconfig = findNearestNamedFile(absPath, "tsconfig.json");
		if (!tsconfig) {
			throw new Error(
				"bundleAndImportTs requires a tsconfig.json on the path from the handler file",
			);
		}
		const absWorkingDir = dirname(tsconfig);
		const result = buildSync({
			entryPoints: [absPath],
			absWorkingDir,
			bundle: true,
			platform: "node",
			format: "esm",
			target: "node22",
			tsconfig,
			packages: "external",
			write: false,
			metafile: true,
			logLevel: "silent",
		});
		const code = result.outputFiles?.[0]?.text;
		if (!code) {
			throw new Error("esbuild produced no output for local handler bundle");
		}
		const deps = new Set(
			Object.keys(result.metafile?.inputs ?? {}).map((f) => normalize(join(absWorkingDir, f))),
		);
		const cacheBase = findAncestorWithNodeModules(absPath) ?? this.repoRoot;
		const cacheDir = join(cacheBase, "node_modules", ".cache", "cdk-local-lambda");
		mkdirSync(cacheDir, { recursive: true });
		const tmp = join(
			cacheDir,
			`bundle-${Date.now()}-${++loadSeq}-${randomBytes(8).toString("hex")}.mjs`,
		);
		writeFileSync(tmp, code, "utf8");
		try {
			const mod = (await import(pathToFileURL(tmp).href)) as Record<string, unknown>;
			return { mod, deps };
		} finally {
			try {
				unlinkSync(tmp);
			} catch {
				// best-effort
			}
		}
	}

	private async importModule(
		path: string,
	): Promise<{ mod: Record<string, unknown>; deps: Set<string> }> {
		const isTs = path.endsWith(".ts") || path.endsWith(".tsx");
		if (isTs) {
			try {
				return await this.bundleAndImportTs(path);
			} catch {
				// fall through to direct import
			}
		}
		const url = `${pathToFileURL(path).href}?t=${Date.now()}-${++loadSeq}`;
		return {
			mod: (await import(url)) as Record<string, unknown>,
			deps: new Set([path]),
		};
	}

	async load(lambda: LocalLambda): Promise<Handler> {
		const path = lambda.entry;
		const cached = this.cache.get(path);
		if (cached) return cached;

		const p = (async () => {
			const { mod, deps } = await this.importModule(path);
			this.deps.set(path, deps);
			const direct = mod[lambda.handler];
			const viaDefault =
				typeof mod.default === "object" && mod.default !== null
					? (mod.default as Record<string, unknown>)[lambda.handler]
					: undefined;
			const fn = direct ?? viaDefault;
			if (typeof fn !== "function") {
				throw new Error(`Handler "${lambda.handler}" not exported by ${path}`);
			}
			return fn as Handler;
		})();
		this.cache.set(path, p);
		try {
			await p;
		} catch (e) {
			this.cache.delete(path);
			this.deps.delete(path);
			throw e;
		}
		return p;
	}

	invalidate(changedFile?: string): number {
		if (!changedFile) {
			const count = this.cache.size;
			this.cache.clear();
			this.deps.clear();
			return count;
		}

		const normalized = normalize(changedFile);
		console.log(`[cdk-local] invalidating modules dependent on ${normalized}`);
		let count = 0;
		for (const [handlerPath, fileDeps] of this.deps) {
			if (fileDeps.has(normalized)) {
				this.cache.delete(handlerPath);
				this.deps.delete(handlerPath);
				count++;
				console.log(`[cdk-local] invalidating handler "${handlerPath}" (changed: ${normalized})`);
			}
		}
		return count;
	}
}
