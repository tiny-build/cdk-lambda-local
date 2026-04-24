import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		"extract/index": "src/extract/index.ts",
		"server/index": "src/server/index.ts",
		types: "src/types.ts",
		"bin/cdk-local": "src/bin/cdk-local.ts",
	},
	format: ["esm", "cjs"],
	dts: true,
	sourcemap: true,
	clean: true,
	target: "node22",
	splitting: false,
	shims: true,
	outDir: "dist",
});
