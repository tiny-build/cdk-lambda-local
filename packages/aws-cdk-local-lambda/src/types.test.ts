import { describe, expect, it } from "vitest";
import type { LocalLambda, LocalManifest, LocalRoute } from "./types.js";

describe("LocalManifest types", () => {
	it("LocalManifest shape accepts the minimal valid object", () => {
		const lambda: LocalLambda = {
			functionKey: "hello",
			lambdaLogicalId: "HelloFnABC123",
			lambdaFunctionName: "zephyr-wombat-dev-grizzly",
			assetDir: "/abs/cdk.out/asset.deadbeef",
			entry: "/abs/api/src/functions/hello/handler.ts",
			handler: "main",
			runtime: "nodejs22.x",
			environment: { STAGE: "dev" },
		};
		const route: LocalRoute = {
			method: "GET",
			path: "/hello",
			functionKey: "hello",
			authorizerKey: null,
		};
		const manifest: LocalManifest = {
			source: "cdk-synth",
			stack: "TurbineRocketStack",
			stage: "dev",
			cdkOut: "/abs/cdk.out",
			lambdas: { hello: lambda },
			routes: { "GET /hello": route },
		};
		expect(manifest.lambdas.hello?.handler).toBe("main");
		expect(manifest.routes["GET /hello"]?.authorizerKey).toBeNull();
	});
});
