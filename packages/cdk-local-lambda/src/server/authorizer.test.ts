import { describe, expect, it } from "vitest";

import { isAuthorizerAllow } from "./authorizer";

describe("isAuthorizerAllow", () => {
	it("allows single-statement Allow", () => {
		expect(
			isAuthorizerAllow({
				policyDocument: { Statement: [{ Effect: "Allow" }] },
			}).allow,
		).toBe(true);
	});

	it("denies if any statement is Deny", () => {
		expect(
			isAuthorizerAllow({
				policyDocument: {
					Statement: [{ Effect: "Allow" }, { Effect: "Deny" }],
				},
			}).allow,
		).toBe(false);
	});

	it("denies on unknown input", () => {
		expect(isAuthorizerAllow(null).allow).toBe(false);
		expect(isAuthorizerAllow("no").allow).toBe(false);
	});

	it("forwards string context when allowing", () => {
		const r = isAuthorizerAllow({
			policyDocument: { Statement: [{ Effect: "Allow" }] },
			context: { userId: "u1", roles: ["admin"] },
		});
		expect(r.allow).toBe(true);
		expect(r.context?.userId).toBe("u1");
		expect(r.context?.roles).toBe('["admin"]');
	});
});
