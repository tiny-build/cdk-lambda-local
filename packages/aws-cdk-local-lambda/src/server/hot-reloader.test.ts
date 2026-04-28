import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { startWatcher } from "./hot-reloader.js";
import { ModuleLoader } from "./module-loader.js";

const WAIT = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("startWatcher", () => {
	it("calls onReload after a file change (debounced)", async () => {
		const dir = mkdtempSync(join(tmpdir(), "hr-"));
		const file = join(dir, "f.ts");
		writeFileSync(file, "x=1");
		const loader = new ModuleLoader();
		const events: Array<[string, number]> = [];
		const stop = await startWatcher({
			paths: [dir],
			loader,
			onReload: (p, n) => events.push([p, n]),
			debounceMs: 50,
		});
		await WAIT(200);
		writeFileSync(file, "x=2");
		await WAIT(400);
		expect(events.length).toBeGreaterThanOrEqual(1);
		await stop();
	});

	it("calls onManifestChange when a *.generated.json manifest is saved (not ignored)", async () => {
		const dir = mkdtempSync(join(tmpdir(), "hr-manifest-"));
		mkdirSync(join(dir, "src"), { recursive: true });
		const watchedTs = join(dir, "src", "handler.ts");
		writeFileSync(watchedTs, "export const main = () => {}");
		const manifestPath = join(dir, "local-route-manifest.generated.json");
		writeFileSync(manifestPath, '{"v":1}\n');

		const loader = new ModuleLoader();
		const manifestEvents: string[] = [];
		const reloadEvents: Array<[string, number]> = [];
		const stop = await startWatcher({
			paths: [join(dir, "src")],
			manifestPath,
			loader,
			debounceMs: 50,
			onManifestChange: (p) => manifestEvents.push(p),
			onReload: (p, n) => reloadEvents.push([p, n]),
		});
		await WAIT(250);
		writeFileSync(manifestPath, '{"v":2}\n');
		await WAIT(400);
		expect(manifestEvents.length).toBeGreaterThanOrEqual(1);
		expect(reloadEvents.length).toBe(0);
		await stop();
	});

	it("stop is idempotent", async () => {
		const loader = new ModuleLoader();
		const stop = await startWatcher({
			paths: [process.cwd()],
			loader,
			debounceMs: 10,
		});
		await stop();
		await stop();
	});
});
