import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { LocalLambda } from "../types";

import { ModuleLoader } from "./module-loader";

function makeLambda(entry: string, handler = "main"): LocalLambda {
	return {
		functionKey: "fn",
		lambdaLogicalId: "X",
		lambdaFunctionName: "x",
		assetDir: "/n/a",
		entry,
		handler,
		runtime: "nodejs22.x",
		environment: {},
	};
}

describe("ModuleLoader", () => {
	it("loads a handler and caches it", async () => {
		const dir = mkdtempSync(join(tmpdir(), "ml-"));
		const file = join(dir, "h.mjs");
		writeFileSync(file, 'export const main = () => "v1";');
		const ml = new ModuleLoader();
		const fn = await ml.load(makeLambda(file));
		expect((fn as () => string)()).toBe("v1");
		const fn2 = await ml.load(makeLambda(file));
		expect(fn2).toBe(fn);
	});

	it("throws a clear error when the handler name is missing", async () => {
		const dir = mkdtempSync(join(tmpdir(), "ml-"));
		const file = join(dir, "h.mjs");
		writeFileSync(file, "export const other = () => 1;");
		const ml = new ModuleLoader();
		await expect(ml.load(makeLambda(file))).rejects.toThrow(/main/);
	});

	it("invalidate clears the cache and picks up changes", async () => {
		const dir = mkdtempSync(join(tmpdir(), "ml-"));
		const file = join(dir, "h.mjs");
		writeFileSync(file, 'export const main = () => "v1";');
		const ml = new ModuleLoader();
		const fn1 = await ml.load(makeLambda(file));
		expect((fn1 as () => string)()).toBe("v1");
		writeFileSync(file, 'export const main = () => "v2";');
		const cleared = ml.invalidate();
		expect(cleared).toBe(1);
		const fn2 = await ml.load(makeLambda(file));
		expect((fn2 as () => string)()).toBe("v2");
	});
});
