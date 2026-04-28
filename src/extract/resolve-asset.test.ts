import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveAssetDir } from "./resolve-asset.js";

function makeFixture() {
	const dir = mkdtempSync(join(tmpdir(), "cdk-local-test-"));
	mkdirSync(join(dir, "asset.deadbeef"));
	writeFileSync(
		join(dir, "Stack.assets.json"),
		JSON.stringify({
			files: {
				deadbeef: {
					source: { path: "asset.deadbeef", packaging: "zip" },
					destinations: {},
				},
			},
		}),
	);
	return dir;
}

describe("resolveAssetDir", () => {
	it("resolves an asset dir from a plain S3Key hash.zip", () => {
		const cdkOut = makeFixture();
		const got = resolveAssetDir({
			cdkOut,
			stack: "Stack",
			codeS3Key: "deadbeef.zip",
		});
		expect(got).toBe(join(cdkOut, "asset.deadbeef"));
	});

	it("resolves from an Fn::Sub wrapped key", () => {
		const cdkOut = makeFixture();
		const got = resolveAssetDir({
			cdkOut,
			stack: "Stack",
			codeS3Key: { "Fn::Sub": "something/deadbeef.zip" },
		});
		expect(got).toBe(join(cdkOut, "asset.deadbeef"));
	});

	it("throws when the hash has no entry in assets.json", () => {
		const cdkOut = makeFixture();
		expect(() => resolveAssetDir({ cdkOut, stack: "Stack", codeS3Key: "cafef00d.zip" })).toThrow(
			/cafef00d/,
		);
	});
});
