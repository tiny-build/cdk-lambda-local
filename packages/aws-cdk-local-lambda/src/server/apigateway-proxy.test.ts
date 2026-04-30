import type { Request } from "express";

import { describe, expect, it } from "vitest";

import { buildProxyEvent, buildRequestAuthorizerEvent, lambdaContext } from "./apigateway-proxy";

function fakeReq(over: Partial<Request> = {}): Request {
	return {
		headers: { "x-test": "v" },
		query: {},
		body: undefined,
		ip: "127.0.0.1",
		get: (_h: string) => "agent",
		path: "/hello",
		...over,
	} as unknown as Request;
}

describe("apigateway event builders", () => {
	it("builds a REQUEST authorizer event with the right shape", () => {
		const e = buildRequestAuthorizerEvent(fakeReq(), {
			path: "/hello",
			httpMethod: "GET",
			stage: "dev",
		});
		expect(e.type).toBe("REQUEST");
		expect(e.methodArn).toContain("/dev/GET/hello");
		expect(e.headers?.["x-test"]).toBe("v");
	});

	it("builds a proxy event and carries authorizer context", () => {
		const e = buildProxyEvent(fakeReq({ body: { a: 1 } as unknown as Request["body"] }), {
			path: "/hello",
			httpMethod: "POST",
			stage: "dev",
			authorizerContext: { userId: "u-1" },
		});
		expect(e.requestContext.authorizer).toEqual({ userId: "u-1" });
		expect(e.body).toBe('{"a":1}');
		expect(e.httpMethod).toBe("POST");
	});

	it("lambdaContext exposes the function name and a request id", () => {
		const c = lambdaContext("fn-name");
		expect(c.functionName).toBe("fn-name");
		expect(c.invokedFunctionArn).toContain("fn-name");
		expect(typeof c.awsRequestId).toBe("string");
		expect(c.awsRequestId.length).toBeGreaterThan(8);
	});
});
