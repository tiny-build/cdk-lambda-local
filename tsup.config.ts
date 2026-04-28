import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		"extract/index": "src/extract/index.ts",
		"server/index": "src/server/index.ts",
		types: "src/types.ts",
		"bin/cdk-local": "src/bin/cdk-local.tsx",
	},
	format: ["esm", "cjs"],
	sourcemap: true,
	clean: true,
	target: "node22",
	splitting: false,
	shims: true,
	outDir: "dist",
	esbuildOptions(options) {
		options.jsx = "transform";
		options.jsxFactory = "React.createElement";
		options.jsxFragment = "React.Fragment";
	},
	external: ["react", "react-dom"],
});
