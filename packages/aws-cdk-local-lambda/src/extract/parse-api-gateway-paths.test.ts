import { describe, expect, it } from "vitest";

import { buildApiGatewayResourcePaths } from "./parse-api-gateway-paths.js";

describe("buildApiGatewayResourcePaths", () => {
	it("builds /hello from root + child resource", () => {
		const resources = {
			ZephyrBoulderApi3F9D214B: {
				Type: "AWS::ApiGateway::RestApi",
				Properties: { Name: "wombat-nebula-staging" },
			},
			WaffleMooseResource8C1D3E27: {
				Type: "AWS::ApiGateway::Resource",
				Properties: {
					ParentId: {
						"Fn::GetAtt": ["ZephyrBoulderApi3F9D214B", "RootResourceId"],
					},
					PathPart: "hello",
					RestApiId: { Ref: "ZephyrBoulderApi3F9D214B" },
				},
			},
		};

		const paths = buildApiGatewayResourcePaths(resources);
		expect(paths.get("WaffleMooseResource8C1D3E27")).toBe("/hello");
	});

	it("builds nested /common/get-all-assessments", () => {
		const resources = {
			Api: {
				Type: "AWS::ApiGateway::RestApi",
				Properties: {},
			},
			CommonRes: {
				Type: "AWS::ApiGateway::Resource",
				Properties: {
					ParentId: {
						"Fn::GetAtt": ["Api", "RootResourceId"],
					},
					PathPart: "common",
					RestApiId: { Ref: "Api" },
				},
			},
			NestedRes: {
				Type: "AWS::ApiGateway::Resource",
				Properties: {
					ParentId: { Ref: "CommonRes" },
					PathPart: "get-all-assessments",
					RestApiId: { Ref: "Api" },
				},
			},
		};

		const paths = buildApiGatewayResourcePaths(resources);
		expect(paths.get("CommonRes")).toBe("/common");
		expect(paths.get("NestedRes")).toBe("/common/get-all-assessments");
	});
});
