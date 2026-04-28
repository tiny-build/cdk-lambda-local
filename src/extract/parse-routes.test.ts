import { describe, expect, it } from "vitest";

import { parseApiGatewayMethods } from "./parse-routes.js";

describe("parseApiGatewayMethods", () => {
	const helloResources = {
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
				AuthorizationType: "NONE",
				Integration: {
					Type: "AWS_PROXY",
					Uri: {
						"Fn::Join": [
							"",
							["arn:...:functions/", { "Fn::GetAtt": ["HelloLambda", "Arn"] }, "/invocations"],
						],
					},
				},
			},
		},
		HelloLambda: {
			Type: "AWS::Lambda::Function",
			Properties: { FunctionName: "zephyr-wombat-dev-grizzly" },
		},
	};

	it("extracts an unauthenticated AWS_PROXY route", () => {
		const routes = parseApiGatewayMethods(helloResources);
		expect(routes).toEqual([
			{
				httpMethod: "GET",
				path: "/hello",
				lambdaLogicalId: "HelloLambda",
				authorizerLogicalId: null,
			},
		]);
	});

	it("attaches authorizer logical id when AuthorizationType is CUSTOM", () => {
		const resources = {
			...helloResources,
			HelloMethod: {
				...helloResources.HelloMethod,
				Properties: {
					...helloResources.HelloMethod.Properties,
					AuthorizationType: "CUSTOM",
					AuthorizerId: { Ref: "MyAuthorizer" },
				},
			},
		};
		const routes = parseApiGatewayMethods(resources);
		expect(routes[0]?.authorizerLogicalId).toBe("MyAuthorizer");
	});

	it("skips MOCK integrations", () => {
		const resources = {
			...helloResources,
			HelloMethod: {
				...helloResources.HelloMethod,
				Properties: {
					...helloResources.HelloMethod.Properties,
					Integration: { Type: "MOCK" },
				},
			},
		};
		expect(parseApiGatewayMethods(resources)).toEqual([]);
	});
});
