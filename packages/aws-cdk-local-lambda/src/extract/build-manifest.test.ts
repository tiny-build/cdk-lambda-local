import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { extractManifest } from "./build-manifest.js";

function makeRepo() {
	const root = mkdtempSync(join(tmpdir(), "cdk-local-int-"));
	const cdkOut = join(root, "cdk.out");
	mkdirSync(cdkOut);

	mkdirSync(join(root, "api/src/functions/hello"), { recursive: true });
	writeFileSync(
		join(root, "api/src/functions/hello/handler.ts"),
		'export const main = async () => ({ statusCode: 200, body: "ok" });',
	);
	mkdirSync(join(root, "api/src/functions/authorizer"), { recursive: true });
	writeFileSync(
		join(root, "api/src/functions/authorizer/handler.ts"),
		'export const main = async () => ({ policyDocument: { Statement: [{ Effect: "Allow" }] } });',
	);

	mkdirSync(join(cdkOut, "asset.abcdef01"));
	writeFileSync(
		join(cdkOut, "asset.abcdef01/index.js"),
		"// api/src/functions/hello/handler.ts\nexports.main = async () => {};",
	);
	mkdirSync(join(cdkOut, "asset.feedface"));
	writeFileSync(
		join(cdkOut, "asset.feedface/index.js"),
		"// api/src/functions/authorizer/handler.ts\nexports.main = async () => {};",
	);

	const template = {
		Resources: {
			Api: { Type: "AWS::ApiGateway::RestApi", Properties: {} },
			HelloRes: {
				Type: "AWS::ApiGateway::Resource",
				Properties: {
					ParentId: { "Fn::GetAtt": ["Api", "RootResourceId"] },
					PathPart: "hello",
					RestApiId: { Ref: "Api" },
				},
			},
			HelloMethod: {
				Type: "AWS::ApiGateway::Method",
				Properties: {
					HttpMethod: "GET",
					ResourceId: { Ref: "HelloRes" },
					AuthorizationType: "CUSTOM",
					AuthorizerId: { Ref: "Auth1" },
					Integration: {
						Type: "AWS_PROXY",
						Uri: {
							"Fn::Join": ["", ["a/", { "Fn::GetAtt": ["HelloFn", "Arn"] }, "/i"]],
						},
					},
				},
			},
			HelloFn: {
				Type: "AWS::Lambda::Function",
				Properties: {
					FunctionName: "zephyr-wombat-dev-grizzly",
					Handler: "index.main",
					Runtime: "nodejs22.x",
					Code: { S3Key: "abcdef01.zip" },
					Environment: { Variables: { STAGE: "dev" } },
				},
			},
			Auth1: {
				Type: "AWS::ApiGateway::Authorizer",
				Properties: {
					Type: "REQUEST",
					AuthorizerUri: {
						"Fn::Join": ["", ["a/", { "Fn::GetAtt": ["AuthFn", "Arn"] }, "/i"]],
					},
				},
			},
			AuthFn: {
				Type: "AWS::Lambda::Function",
				Properties: {
					FunctionName: "mango-blizzard-dev-pelican",
					Handler: "index.main",
					Runtime: "nodejs22.x",
					Code: { S3Key: "feedface.zip" },
					Environment: { Variables: {} },
				},
			},
		},
	};
	writeFileSync(join(cdkOut, "Stack.template.json"), JSON.stringify(template));
	writeFileSync(
		join(cdkOut, "Stack.assets.json"),
		JSON.stringify({
			files: {
				abcdef01: { source: { path: "asset.abcdef01", packaging: "zip" } },
				feedface: { source: { path: "asset.feedface", packaging: "zip" } },
			},
		}),
	);
	return { root, cdkOut };
}

describe("extractManifest", () => {
	it("produces a v2 manifest with lambdas, route, and authorizerKey", async () => {
		const { root, cdkOut } = makeRepo();
		const m = await extractManifest({
			cdkOut,
			stack: "Stack",
			stage: "dev",
			repoRoot: root,
		});
		expect(m.source).toBe("cdk-synth");
		expect(m.stack).toBe("Stack");
		expect(m.stage).toBe("dev");
		expect(m.cdkOut).toBe(cdkOut);

		expect(Object.keys(m.lambdas).sort()).toEqual(["grizzly", "pelican"]);
		const grizzly = m.lambdas.grizzly!;
		expect(grizzly.handler).toBe("main");
		expect(grizzly.runtime).toBe("nodejs22.x");
		expect(grizzly.entry).toContain("api/src/functions/hello/handler.ts");
		expect(grizzly.environment.STAGE).toBe("dev");
		expect(grizzly.lambdaFunctionName).toBe("zephyr-wombat-dev-grizzly");

		expect(m.routes["GET /hello"]).toEqual({
			method: "GET",
			path: "/hello",
			functionKey: "grizzly",
			authorizerKey: "pelican",
		});
	});
});
